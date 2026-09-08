import { AsyncLocalStorage } from "node:async_hooks";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import {
	type CallToolResult,
	createRequestStateCodec,
	type ElicitRequestFormParams,
	type ElicitResult,
	type InputRequiredResult,
	type McpServer,
	inputRequired,
	inputResponse,
	type ServerContext,
} from "@modelcontextprotocol/server";
import { getMcpSessionPrincipal } from "./mcpSessionPrincipal";

type Prompt = Omit<ElicitRequestFormParams, "mode"> & { mode?: "form" };
type ApprovalScope = {
	elicit: (prompt: Prompt, signal?: AbortSignal) => Promise<ElicitResult>;
};
const approvalScope = new AsyncLocalStorage<ApprovalScope>();

/** Undefined means the caller is outside a request-scoped modern operation. */
export function requestScopedElicitation(
	prompt: Prompt,
	signal?: AbortSignal,
): Promise<ElicitResult> | undefined {
	return approvalScope.getStore()?.elicit(prompt, signal);
}

/** All approval callers use this seam; modern requests never use a global client. */
export async function elicitMcpForm(
	prompt: Prompt,
	server?: Pick<McpServer, "server"> | null,
	signal?: AbortSignal,
): Promise<ElicitResult> {
	signal?.throwIfAborted();
	const scoped = requestScopedElicitation(prompt, signal);
	if (scoped) return scoped;
	if (!server) throw new Error("The MCP server is unavailable");
	if (!server.server.getClientCapabilities()?.elicitation?.form) throw new Error("The MCP client does not support form elicitation");
	return server.server.elicitInput(prompt, signal ? { signal } : undefined);
}

/** Keep legacy approvals on the originating request and client. */
export function runWithLegacyApprovalContext<T>(server: Pick<McpServer, "server">, ctx: ServerContext, callback: () => T): T {
 return approvalScope.run({ elicit: async (prompt, signal) => {
  if (!server.server.getClientCapabilities()?.elicitation?.form) throw new Error("The MCP client does not support form elicitation");
  const requestSignal = signal ? AbortSignal.any([signal, ctx.mcpReq.signal]) : ctx.mcpReq.signal;
  requestSignal.throwIfAborted();
  return ctx.mcpReq.send({ method: "elicitation/create", params: { ...prompt, mode: "form" } }, { signal: requestSignal });
 } }, callback);
}

type Continuation = { id: string; round: number };
type Challenge = {
	round: number;
	prompt: Prompt;
	answer: (result: ElicitResult) => void;
};
type Operation = {
	fingerprint: string;
	challenge?: Challenge;
	result?: CallToolResult;
	round: number;
	changed: Promise<void>;
	notify: () => void;
	expires: ReturnType<typeof setTimeout>;
	controller: AbortController;
};

function errorResult(message: string): CallToolResult {
	return { isError: true, content: [{ type: "text", text: message }] };
}

function stableJson(value: unknown): string {
	if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
	if (value !== null && typeof value === "object") {
		return `{${Object.keys(value)
			.sort()
			.map(
				(key) =>
					`${JSON.stringify(key)}:${stableJson((value as Record<string, unknown>)[key])}`,
			)
			.join(",")}}`;
	}
	return JSON.stringify(value) ?? "null";
}

/**
 * Bridges asynchronous wallet permission callbacks to MCP multi-round-trip
 * input requests. A retry resumes the original suspended operation; it never
 * replays a tool callback or recreates a transaction. State is process-local:
 * a restart rejects outstanding continuations rather than guessing settlement.
 */
export class McpApprovalFlow {
	private readonly operations = new Map<string, Operation>();
	private readonly codec;
	constructor(
		private readonly ttlMs = 300_000,
		private readonly capacity = 256,
	) {
		this.codec = createRequestStateCodec<Continuation>({
			key: randomBytes(32),
			ttlSeconds: Math.ceil(ttlMs / 1000),
			bind: (ctx) =>
				JSON.stringify([
					ctx.mcpReq.method,
					getMcpSessionPrincipal(ctx.http?.authInfo),
					ctx.http?.authInfo?.scopes.slice().sort() ?? [],
				]),
		});
	}

	private change(operation: Operation): void {
		const notify = operation.notify;
		operation.changed = new Promise((resolve) => {
			operation.notify = resolve;
		});
		notify();
	}

	private cancel(operation: Operation): void {
		operation.controller.abort(
			new Error("Approval operation expired or canceled"),
		);
		const challenge = operation.challenge;
		operation.challenge = undefined;
		challenge?.answer({ action: "cancel" });
		operation.result ??= errorResult(
			"Approval operation expired or canceled. Inspect wallet history before starting another write.",
		);
		this.change(operation);
	}

	close(): void {
		for (const operation of this.operations.values()) {
			clearTimeout(operation.expires);
			this.cancel(operation);
		}
		this.operations.clear();
	}

	async run(
		name: string,
		args: unknown,
		ctx: ServerContext,
		supportsForm: boolean,
		callback: (signal: AbortSignal) => Promise<CallToolResult>,
	): Promise<CallToolResult | InputRequiredResult> {
		ctx.mcpReq.signal.throwIfAborted();
		const fingerprint = createHash("sha256")
			.update(stableJson([name, args]))
			.digest("hex");
		const state = ctx.mcpReq.requestState();
		let id: string;
		let operation: Operation;
		if (state !== undefined) {
			if (typeof state !== "string")
				throw new Error("Invalid approval continuation");
			const continuation = await this.codec.verify(state, ctx);
			const existing = this.operations.get(continuation.id);
			if (!existing || existing.fingerprint !== fingerprint)
				throw new Error(
					"Approval continuation does not match this operation or has expired",
				);
			id = continuation.id;
			operation = existing;
			if (continuation.round > operation.round)
				throw new Error("Invalid approval round");
			const challenge = operation.challenge;
			if (challenge?.round === continuation.round) {
				const response = inputResponse(ctx.mcpReq.inputResponses, "approval");
				if (response.kind !== "missing") {
					operation.challenge = undefined;
					challenge.answer(
						response.kind === "elicit"
							? {
									action: response.action,
									content: response.content as ElicitResult["content"],
								}
							: { action: "cancel" },
					);
				}
			}
		} else {
			if (ctx.mcpReq.inputResponses !== undefined)
				throw new Error("Approval responses require a valid continuation");
			if (this.operations.size >= this.capacity)
				throw new Error("Too many active approval operations; retry later");
			id = randomUUID();
			let notify = () => {};
			const changed = new Promise<void>((resolve) => {
				notify = resolve;
			});
			operation = {
				fingerprint,
				round: 0,
				changed,
				notify,
				controller: new AbortController(),
				expires: setTimeout(() => {
					this.cancel(operation);
					this.operations.delete(id);
				}, this.ttlMs),
			};
			operation.expires.unref();
			this.operations.set(id, operation);
			const scope: ApprovalScope = {
				elicit: async (prompt, signal) => {
					operation.controller.signal.throwIfAborted();
					signal?.throwIfAborted();
					if (!supportsForm)
						throw new Error("The MCP client does not support form elicitation");
					if (operation.challenge)
						throw new Error(
							"Concurrent approvals within one operation are unsupported",
						);
					const response = new Promise<ElicitResult>((answer) => {
						operation.challenge = { round: ++operation.round, prompt, answer };
					});
					this.change(operation);
					const abort = () => this.cancel(operation);
					signal?.addEventListener("abort", abort, { once: true });
					if (signal?.aborted) abort();
					try {
						return await response;
					} finally {
						signal?.removeEventListener("abort", abort);
					}
				},
			};
			void approvalScope
				.run(scope, async () => callback(operation.controller.signal))
				.then(
					(result) => {
						operation.result = result;
						this.change(operation);
					},
					(error) => {
						operation.result = errorResult(
							error instanceof Error ? error.message : String(error),
						);
						this.change(operation);
					},
				);
		}
		const abort = () => this.cancel(operation);
		ctx.mcpReq.signal.addEventListener("abort", abort, { once: true });
		if (ctx.mcpReq.signal.aborted) abort();
		try {
			while (!operation.result && !operation.challenge) await operation.changed;
			if (operation.result) return operation.result;
			const challenge = operation.challenge;
			if (!challenge)
				throw new Error("Approval operation has no pending request");
			return inputRequired({
				inputRequests: { approval: inputRequired.elicit(challenge.prompt) },
				requestState: await this.codec.mint(
					{ id, round: challenge.round },
					ctx,
				),
			});
		} finally {
			ctx.mcpReq.signal.removeEventListener("abort", abort);
			// Calls that never suspended have no continuation to replay.
			if (operation.round === 0 && operation.result) {
				clearTimeout(operation.expires);
				this.operations.delete(id);
			}
		}
	}
}

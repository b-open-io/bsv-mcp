import {
	type CallToolResult,
	CLIENT_CAPABILITIES_META_KEY,
	type ClientCapabilities,
	type McpServer,
	type ProtocolEra,
	type ServerContext,
} from "@modelcontextprotocol/server";
import { McpApprovalFlow, runWithLegacyApprovalContext } from "./mcpApprovalFlow";

export type ToolPolicyEra = ProtocolEra;
type Callback = (
	...args: unknown[]
) => CallToolResult | Promise<CallToolResult>;

/**
 * Run modern tools in an operation scope shared across request-local servers.
 * Wallet/account approval helpers can suspend the operation with input_required
 * without replaying its side effects on the next request. Tool-specific wallet,
 * role, and hosted-access policies still decide which operations are available.
 */
export function withMcpToolExecution(
	server: McpServer,
	era: ProtocolEra,
	flow = new McpApprovalFlow(),
): McpServer {
	return new Proxy(server, {
		get(target, property, receiver) {
			if (property !== "registerTool")
				return Reflect.get(target, property, receiver);
			return (...registration: unknown[]) => {
				const [name, config, callback] = registration;
				if (typeof name !== "string" || typeof callback !== "function") {
					return Reflect.apply(target.registerTool, target, registration);
				}
				return Reflect.apply(target.registerTool, target, [
					name,
					config,
					async (...args: unknown[]) => {
						const ctx = args.at(-1) as ServerContext;
						if (era === "legacy") return runWithLegacyApprovalContext(target, ctx, () => (callback as Callback)(...args));
						const input = args.length > 1 ? args[0] : undefined;
						// SDK 2.0.0 currently emits an empty RequestMetaEnvelope type,
						// although its runtime supplies the reserved capability entry.
						const envelopeCapabilities = ctx.mcpReq.envelope
							? (Reflect.get(
									ctx.mcpReq.envelope,
									CLIENT_CAPABILITIES_META_KEY,
								) as ClientCapabilities | undefined)
							: undefined;
						const capabilities =
							envelopeCapabilities ?? target.server.getClientCapabilities();
						return flow.run(
							name,
							input,
							ctx,
							Boolean(capabilities?.elicitation?.form),
							(signal) => {
								const operationContext = {
									...ctx,
									mcpReq: { ...ctx.mcpReq, signal },
								};
								const invocation =
									args.length > 1
										? [input, operationContext]
										: [operationContext];
								return Promise.resolve((callback as Callback)(...invocation));
							},
						);
					},
				]);
			};
		},
	});
}

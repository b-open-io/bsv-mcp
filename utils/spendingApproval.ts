import type {
	PermissionRequest,
	WalletPermissionsManager,
} from "@bsv/wallet-toolbox/out/src/WalletPermissionsManager.js";
import type { McpServer } from "@modelcontextprotocol/server";

export type SpendingPermissionRequest = PermissionRequest & {
	requestID: string;
};
type SpendingPermissionManager = Pick<
	WalletPermissionsManager,
	"grantPermission" | "denyPermission"
>;

/** The part of an MCP server used by the legacy push-style approval path. */
export type SpendingApprovalServer = Pick<McpServer, "server">;

let serverInstance: McpServer | null = null;

/**
 * Set the MCP server used to ask the client for spending approval.
 */
export function setSpendingApprovalServerInstance(
	server: McpServer | null,
): void {
	serverInstance = server;
}

function formatSpendingSummary(request: SpendingPermissionRequest): string {
	const spending = request.spending;
	if (!spending) {
		return "Requested amount: unknown";
	}

	const lines = [`Requested amount: ${spending.satoshis} satoshis`];
	for (const item of spending.lineItems ?? []) {
		lines.push(
			`- ${item.type}: ${item.description} (${item.satoshis} satoshis)`,
		);
	}
	return lines.join("\n");
}

function denialMessage(
	request: SpendingPermissionRequest,
	reason: string,
): string {
	const amount = request.spending?.satoshis ?? 0;
	return `Spending authorization refused for ${amount} satoshis: ${reason}.`;
}

/**
 * Ask the connected MCP client to approve a spending request, then settle the
 * wallet permission exactly once. All failures are denied rather than left
 * pending.
 */
export async function handleSpendingAuthorization(
	request: SpendingPermissionRequest,
	permissionsManager: SpendingPermissionManager,
	serverOverride?: SpendingApprovalServer,
	signal?: AbortSignal,
): Promise<void> {
	let approved = false;
	let denialReason = "approval was not granted";

	try {
		signal?.throwIfAborted();
		if (!request.spending) {
			denialReason = "the request did not include spending details";
		} else if (!serverOverride && !serverInstance) {
			denialReason = "the MCP server is unavailable";
		} else {
			const approvalServer = serverOverride ?? serverInstance;
			// The v1/v2 SDK checks the form sub-capability before sending
			// elicitation/create. Checking the same advertised capability here
			// avoids treating `{ elicitation: {} }` as approval authority.
			if (!approvalServer?.server.getClientCapabilities()?.elicitation?.form) {
				denialReason = "the MCP client does not support form elicitation";
				throw new Error(denialReason);
			}
			const amount = request.spending.satoshis;
			if (!Number.isSafeInteger(amount) || amount < 0) {
				denialReason = "the requested amount is invalid";
				throw new Error(denialReason);
			}
			const response = await approvalServer.server.elicitInput(
				{
					mode: "form",
					message: [
						`Approve spending exactly ${amount} satoshis?`,
						formatSpendingSummary(request),
						`If approval is not affirmative, this ${amount}-satoshi request will be refused.`,
					].join("\n"),
					requestedSchema: {
						type: "object",
						properties: {
							approved: {
								type: "boolean",
								title: "Approve this spending request",
								description: `Allow exactly ${amount} satoshis to be spent`,
							},
						},
						required: ["approved"],
					},
				},
				signal ? { signal } : undefined,
			);
			signal?.throwIfAborted();

			approved =
				response.action === "accept" && response.content?.approved === true;
			if (!approved) {
				denialReason =
					response.action === "accept"
						? "the user did not approve the requested amount"
						: response.action === "decline"
							? "the user declined the approval request"
							: "the user canceled the approval request";
			}
		}
	} catch (error) {
		const detail = error instanceof Error ? error.message : String(error);
		denialReason = `the approval prompt failed (${detail})`;
	}

	if (approved && request.spending && !signal?.aborted) {
		await permissionsManager.grantPermission({
			requestID: request.requestID,
			amount: request.spending.satoshis,
			ephemeral: true,
		});
		return;
	}

	console.error(denialMessage(request, denialReason));
	await permissionsManager.denyPermission(request.requestID);
}

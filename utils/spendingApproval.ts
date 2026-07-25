import type {
	PermissionRequest,
	WalletPermissionsManager,
} from "@bsv/wallet-toolbox/out/src/WalletPermissionsManager.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export type SpendingPermissionRequest = PermissionRequest & {
	requestID: string;
};
type SpendingPermissionManager = Pick<
	WalletPermissionsManager,
	"grantPermission" | "denyPermission"
>;

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
): Promise<void> {
	let approved = false;
	let denialReason = "approval was not granted";

	try {
		if (!request.spending) {
			denialReason = "the request did not include spending details";
		} else if (!serverInstance) {
			denialReason = "the MCP server is unavailable";
		} else if (!serverInstance.server.getClientCapabilities()?.elicitation) {
			denialReason = "the MCP client does not support elicitation";
		} else {
			const amount = request.spending.satoshis;
			const response = await serverInstance.server.elicitInput({
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
			});

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

	if (approved && request.spending) {
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

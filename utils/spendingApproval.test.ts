import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import type { PermissionRequest } from "@bsv/wallet-toolbox/out/src/WalletPermissionsManager.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
	handleSpendingAuthorization,
	setSpendingApprovalServerInstance,
} from "./spendingApproval";

type SpendingRequest = PermissionRequest & { requestID: string };

const request: SpendingRequest = {
	type: "spending",
	originator: "wallet_purchaseListing",
	requestID: "spending-request-1",
	spending: {
		satoshis: 12_345,
		lineItems: [
			{
				type: "output",
				description: "Marketplace purchase",
				satoshis: 12_000,
			},
			{ type: "fee", description: "Network fee", satoshis: 345 },
		],
	},
};

function makePermissionsManager() {
	return {
		grantPermission: async (_params: {
			requestID: string;
			amount?: number;
			expiry?: number;
			ephemeral?: boolean;
		}): Promise<void> => undefined,
		denyPermission: async (_requestID: string): Promise<void> => undefined,
	};
}

function makeServer(
	elicitInput: () => Promise<{
		action: "accept" | "decline" | "cancel";
		content?: Record<string, string | number | boolean | string[]>;
	}>,
	supportsElicitation = true,
): McpServer {
	return {
		server: {
			getClientCapabilities: () =>
				supportsElicitation ? { elicitation: {} } : {},
			elicitInput,
		},
	} as unknown as McpServer;
}

let consoleErrorSpy: ReturnType<typeof spyOn<typeof console, "error">>;

beforeEach(() => {
	consoleErrorSpy = spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
	setSpendingApprovalServerInstance(null);
	consoleErrorSpy.mockRestore();
});

describe("spending approval", () => {
	it("grants the exact requested amount when approval is affirmative", async () => {
		const permissionsManager = makePermissionsManager();
		const grantSpy = spyOn(permissionsManager, "grantPermission");
		const denySpy = spyOn(permissionsManager, "denyPermission");
		setSpendingApprovalServerInstance(
			makeServer(async () => ({
				action: "accept",
				content: { approved: true },
			})),
		);

		await handleSpendingAuthorization(request, permissionsManager);

		expect(grantSpy).toHaveBeenCalledTimes(1);
		expect(grantSpy).toHaveBeenCalledWith({
			requestID: request.requestID,
			amount: request.spending?.satoshis,
			ephemeral: true,
		});
		expect(denySpy).not.toHaveBeenCalled();
	});

	it("denies when the answer is negative", async () => {
		const permissionsManager = makePermissionsManager();
		const grantSpy = spyOn(permissionsManager, "grantPermission");
		const denySpy = spyOn(permissionsManager, "denyPermission");
		setSpendingApprovalServerInstance(
			makeServer(async () => ({
				action: "accept",
				content: { approved: false },
			})),
		);

		await handleSpendingAuthorization(request, permissionsManager);

		expect(grantSpy).not.toHaveBeenCalled();
		expect(denySpy).toHaveBeenCalledTimes(1);
		expect(denySpy).toHaveBeenCalledWith(request.requestID);
		expect(consoleErrorSpy).toHaveBeenCalledWith(
			"Spending authorization refused for 12345 satoshis: the user did not approve the requested amount.",
		);
	});

	it("denies when no server instance is set", async () => {
		const permissionsManager = makePermissionsManager();
		const grantSpy = spyOn(permissionsManager, "grantPermission");
		const denySpy = spyOn(permissionsManager, "denyPermission");

		await handleSpendingAuthorization(request, permissionsManager);

		expect(grantSpy).not.toHaveBeenCalled();
		expect(denySpy).toHaveBeenCalledTimes(1);
	});

	it("denies when the client does not support elicitation", async () => {
		const permissionsManager = makePermissionsManager();
		const grantSpy = spyOn(permissionsManager, "grantPermission");
		const denySpy = spyOn(permissionsManager, "denyPermission");
		setSpendingApprovalServerInstance(
			makeServer(
				async () => ({
					action: "accept",
					content: { approved: true },
				}),
				false,
			),
		);

		await handleSpendingAuthorization(request, permissionsManager);

		expect(grantSpy).not.toHaveBeenCalled();
		expect(denySpy).toHaveBeenCalledTimes(1);
	});

	it("denies when elicitation throws", async () => {
		const permissionsManager = makePermissionsManager();
		const grantSpy = spyOn(permissionsManager, "grantPermission");
		const denySpy = spyOn(permissionsManager, "denyPermission");
		setSpendingApprovalServerInstance(
			makeServer(async () => {
				throw new Error("client disconnected");
			}),
		);

		await handleSpendingAuthorization(request, permissionsManager);

		expect(grantSpy).not.toHaveBeenCalled();
		expect(denySpy).toHaveBeenCalledTimes(1);
	});

	it("settles every approval path exactly once", async () => {
		const scenarios = [
			{ action: "accept" as const, content: { approved: true } },
			{ action: "accept" as const, content: { approved: false } },
			{ action: "decline" as const },
			{ action: "cancel" as const },
		];

		for (const response of scenarios) {
			const permissionsManager = makePermissionsManager();
			const grantSpy = spyOn(permissionsManager, "grantPermission");
			const denySpy = spyOn(permissionsManager, "denyPermission");
			setSpendingApprovalServerInstance(makeServer(async () => response));

			await handleSpendingAuthorization(request, permissionsManager);

			expect(grantSpy.mock.calls.length + denySpy.mock.calls.length).toBe(1);
		}

		const permissionsManager = makePermissionsManager();
		const grantSpy = spyOn(permissionsManager, "grantPermission");
		const denySpy = spyOn(permissionsManager, "denyPermission");
		setSpendingApprovalServerInstance(null);

		await handleSpendingAuthorization(request, permissionsManager);

		expect(grantSpy.mock.calls.length + denySpy.mock.calls.length).toBe(1);
	});
});

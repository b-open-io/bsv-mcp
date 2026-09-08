import { expect, test } from "bun:test";
import { createContext } from "@1sat/actions";
import type { WalletInterface } from "@bsv/sdk";
import type { McpServer, ServerContext } from "@modelcontextprotocol/server";
import { z } from "zod";
import { createWalletRoleRouting } from "./walletRoleRouting";

test("independent providers can reuse reference strings without crossing role or user boundaries", async () => {
	const settled: string[] = [];
	const context = (role: string) => createContext({ createAction: async () => ({ signableTransaction: { reference: "provider-ref", tx: [] } }), signAction: async () => { settled.push(role); return { txid: role }; } } as unknown as WalletInterface);
	const roles = { payments: context("payments"), ordinals: context("ordinals") };
	const callbacks = new Map<string, (args: Record<string, unknown>, ctx: ServerContext) => Promise<unknown>>();
	const capture = { registerTool(name: string, _schema: unknown, callback: (args: Record<string, unknown>, ctx: ServerContext) => Promise<unknown>) { callbacks.set(name, callback); } } as unknown as McpServer;
	const route = createWalletRoleRouting(roles);
	const server = route.server(capture);
	server.registerTool("create", { inputSchema: z.object({}) }, async () => { await route.ctx.wallet.createAction({ description: "Synthetic action" }); return { content: [] }; });
	server.registerTool("sign", { inputSchema: z.object({}) }, async () => { await route.ctx.wallet.signAction({ reference: "provider-ref", spends: {} }); return { content: [] }; });
	const call = (name: string, walletRole?: string, subject = "owner") => {
		const callback = callbacks.get(name);
		if (!callback) throw new Error("Missing test operation");
		return callback({ walletRole }, { http: { authInfo: { extra: { sub: subject }, clientId: subject, scopes: [], token: "synthetic" } } } as unknown as ServerContext);
	};
	await call("create", "payments");
	await call("create", "ordinals");
	await expect(call("sign")).rejects.toThrow("multiple wallets");
	await expect(call("sign", "ordinals", "other-user")).rejects.toThrow("another wallet role or authenticated user");
	await call("sign", "ordinals");
	await expect(call("sign", "ordinals")).rejects.toThrow("already been submitted");
	await call("sign", "payments");
	expect(settled).toEqual(["ordinals", "payments"]);
});

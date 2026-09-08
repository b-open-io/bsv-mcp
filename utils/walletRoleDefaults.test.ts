import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OneSatContext } from "@1sat/actions";
import { PrivateKey } from "@bsv/sdk";
import type { McpServer } from "@modelcontextprotocol/server";
import { registerBrc100Tools } from "../tools/wallet/brc100";
import { newAccountConfig, writeAccount } from "./accounts";
import {
	getWalletRoleSettings,
	saveWalletRoleDefaults,
} from "./walletRoleDefaults";

test("role defaults preserve sources, merge independent MCP overrides and reject stale or missing selections", () => {
	const home = mkdtempSync(join(tmpdir(), "role-defaults-"));
	try {
		const key = PrivateKey.fromHex("01");
		writeAccount(
			"alice",
			{
				...newAccountConfig("main", key.toAddress()),
				vaultBinding: {
					version: 1,
					contract: "embedded-roots-v1",
					vaultId: "fixture",
					payment: { entryId: "pay", publicKey: key.toPublicKey().toString() },
					identity: {
						entryId: "id",
						publicKey: PrivateKey.fromHex("02").toPublicKey().toString(),
					},
				},
			},
			join(home, ".bsv-mcp", "accounts"),
		);
		writeFileSync(
			join(home, ".bsv-mcp", "settings.json"),
			JSON.stringify({
				sources: [{ name: "custom", directory: join(home, "custom") }],
			}),
		);
		saveWalletRoleDefaults(
			{
				payments: "alice:payment",
				identity: "alice:identity",
				ordinals: "alice:payment",
			},
			0,
			home,
		);
		const settings = getWalletRoleSettings(home, {
			BSV_MCP_IDENTITY_KEY: "none",
			BSV_MCP_ORDINALS_KEY: "alice:identity",
		});
		expect(settings.effective).toEqual({
			payments: "alice:payment",
			identity: null,
			ordinals: "alice:identity",
		});
		expect(settings.defaults.identity).toBe("alice:identity");
		expect(settings.keys).toHaveLength(2);
		expect(() =>
			saveWalletRoleDefaults({ payments: "missing:payment" }, 1, home),
		).toThrow("Choose a key");
		expect(() => saveWalletRoleDefaults({ payments: null }, 0, home)).toThrow(
			"changed",
		);
		expect(() =>
			getWalletRoleSettings(home, { BSV_MCP_PAYMENT_KEY: "" }),
		).toThrow();
	} finally {
		rmSync(home, { recursive: true, force: true });
	}
});

test("identity operations use the identity wallet and never fall back when disabled", async () => {
	let payments = 0,
		identities = 0;
	const paymentCtx = {
		wallet: {
			createSignature: async () => {
				payments++;
				return { signature: [1] };
			},
		},
	} as unknown as OneSatContext;
	const identityCtx = {
		wallet: {
			createSignature: async () => {
				identities++;
				return { signature: [2] };
			},
		},
	} as unknown as OneSatContext;
	for (const selected of [identityCtx, null]) {
		const handlers = new Map<
			string,
			(args: unknown) => Promise<{ isError?: boolean }>
		>();
		const server = {
			registerTool: (
				name: string,
				_config: unknown,
				handler: (args: unknown) => Promise<{ isError?: boolean }>,
			) => {
				handlers.set(name, handler);
			},
		} as unknown as McpServer;
		registerBrc100Tools(server, paymentCtx, selected);
		const result = await handlers.get("wallet_createSignature")?.({
			protocolIDJSON: '[1,"message signing"]',
			keyID: "1",
			data: [1],
		});
		expect(result?.isError === true).toBe(selected === null);
	}
	expect(payments).toBe(0);
	expect(identities).toBe(1);
});

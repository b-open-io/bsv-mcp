import { afterEach, beforeEach, expect, mock, spyOn, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import * as actions from "@1sat/actions";
import * as nodeWallet from "@1sat/wallet-node";
import { PrivateKey } from "@bsv/sdk";
import { createAccount } from "./accountCommands";
import { accountDir } from "./accounts";
import { serveSigner } from "./signer";
import { destroyWallet, initWallet } from "./walletInit";

const identityKey = PrivateKey.fromString("6", 16).toPublicKey().toString();
const paymentKey = PrivateKey.fromString("7", 16);

const isolatedVariables = [
	"BSV_MCP_ACCOUNT",
	"BSV_MCP_PASSWORD",
	"PRIVATE_KEY_WIF",
	"IDENTITY_KEY_WIF",
	"BRC100_WALLET_URL",
	"REMOTE_STORAGE_URL",
] as const;
let previousEnvironment: Record<string, string | undefined>;
beforeEach(() => {
	previousEnvironment = {};
	for (const name of isolatedVariables) {
		previousEnvironment[name] = process.env[name];
		delete process.env[name];
	}
});
afterEach(() => {
	mock.restore();
	for (const name of isolatedVariables) {
		const previous = previousEnvironment[name];
		if (previous === undefined) delete process.env[name];
		else process.env[name] = previous;
	}
});

test("embedded wallet opts out of automatic storage payments", async () => {
	const account = `storage-payment-${crypto.randomUUID()}`;
	const accountDir = join(homedir(), ".bsv-mcp", "accounts", account);
	const wallet = {
		getPublicKey: async () => ({ publicKey: identityKey }),
	};
	const destroy = mock(async () => undefined);
	process.env.BSV_MCP_ACCOUNT = account;
	mkdirSync(accountDir, { recursive: true, mode: 0o700 });
	writeFileSync(
		join(accountDir, "config.json"),
		JSON.stringify({
			chain: "main",
			storageIdentityKey: "storage-payment-test",
			activeRemote: "https://active.example",
			backups: ["https://backup.example"],
		}),
		{ mode: 0o600 },
	);
	writeFileSync(join(accountDir, "wallet-main.db"), "", { mode: 0o600 });

	const create = spyOn(nodeWallet, "createNodeWallet").mockResolvedValue({
		wallet,
		services: {},
		destroy,
	} as never);
	spyOn(actions.deriveDepositAddresses, "execute").mockResolvedValue({
		derivations: [{ address: "1FakeDepositAddress" }],
	} as never);
	try {
		const result = await initWallet(paymentKey.toWif(), "main");
		const options = create.mock.calls[0]?.[0] as unknown as Record<
			string,
			unknown
		>;
		expect(options.autoStoragePayments).toBe(false);
		expect(options.activeRemote).toBe("https://active.example");
		expect(options.backups).toEqual(["https://backup.example"]);
		await result.destroy();
		expect(destroy).toHaveBeenCalledTimes(1);
	} finally {
		await destroyWallet();
		rmSync(accountDir, { recursive: true, force: true });
	}
});

test("signer-serve also opts out of automatic storage payments", async () => {
	const account = `storage-payment-signer-${crypto.randomUUID()}`;
	const accountDirPath = accountDir(account);
	const key = PrivateKey.fromString("8", 16);
	const destroy = mock(async () => undefined);
	const wallet = {
		getPublicKey: async () => ({ publicKey: identityKey }),
	};
	process.env.BSV_MCP_PASSWORD = "test-only-password";
	try {
		await createAccount(account, { payPk: key }, process.env.BSV_MCP_PASSWORD, {
			chain: "main",
			storageIdentityKey: "storage-payment-test",
			address: key.toAddress(),
			depositPrefix: "mcp",
			activeRemote: "https://active.example",
			backups: ["https://backup.example"],
		});
		const create = spyOn(nodeWallet, "createNodeWallet").mockResolvedValue({
			wallet,
			services: {},
			destroy,
		} as never);
		const serve = spyOn(Bun, "serve").mockReturnValue({
			port: 43123,
			stop: mock(() => undefined),
		} as never);
		const spawn = spyOn(Bun, "spawn").mockReturnValue({
			kill: mock(() => undefined),
			exited: Promise.resolve(0),
		} as never);
		await serveSigner(account);
		const options = create.mock.calls[0]?.[0] as unknown as Record<
			string,
			unknown
		>;
		expect(options.autoStoragePayments).toBe(false);
		expect(options.activeRemote).toBe("https://active.example");
		expect(options.backups).toEqual(["https://backup.example"]);
		expect(serve).toHaveBeenCalledTimes(1);
		expect(spawn).toHaveBeenCalledTimes(1);
		expect(destroy).toHaveBeenCalledTimes(1);
	} finally {
		rmSync(accountDirPath, { recursive: true, force: true });
		delete process.env.BSV_MCP_PASSWORD;
	}
});

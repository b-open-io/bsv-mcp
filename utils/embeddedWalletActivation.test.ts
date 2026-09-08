import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { PrivateKey } from "@bsv/sdk";
import {
	type AccountConfig,
	accountsRoot,
	type EmbeddedVaultBinding,
	newAccountConfig,
	writeAccount,
} from "./accounts";
import type { EmbeddedVaultIo } from "./embeddedVaultIo";
import {
	createEmbeddedWalletActivation,
	type EmbeddedWalletInitializer,
} from "./embeddedWalletActivation";
import type { WalletInitResult } from "./walletInit";

const PASSWORD = "browser-only-password";
const PAYMENT_KEY = PrivateKey.fromString("1", 16);

function binding(): EmbeddedVaultBinding {
	return {
		version: 1,
		contract: "embedded-roots-v1",
		vaultId: "vault-1",
		payment: {
			entryId: "payment-1",
			publicKey: PAYMENT_KEY.toPublicKey().toString(),
		},
	};
}

function fakeResult(
	destroyed: { count: number },
	depositAddress = "1DepositAddress",
): WalletInitResult {
	return {
		wallet: {} as WalletInitResult["wallet"],
		services: {} as WalletInitResult["services"],
		ctx: {} as WalletInitResult["ctx"],
		depositAddress,
		destroy: async () => {
			destroyed.count++;
		},
	};
}

function testAccount(value = binding()): AccountConfig {
	const config = newAccountConfig("main", PAYMENT_KEY.toAddress());
	config.vaultBinding = value;
	writeAccount("default", config, accountsRoot());
	return config;
}

function withHome(root: string): void {
	process.env.HOME = root;
}

function fakeIo(counters: { unlock: number; lock: number }): EmbeddedVaultIo {
	return {
		listKeys: async () => ({ vaultId: "fixture", keys: [] }),
		create: async () => binding(),
		importKeys: async () => binding(),
		unlock: async ({ password, binding: receipt }) => {
			counters.unlock++;
			expect(password).toBe(PASSWORD);
			expect(receipt).toMatchObject({
				vaultId: binding().vaultId,
				payment: binding().payment,
			});
			return { payPk: PAYMENT_KEY };
		},
		lock: () => {
			counters.lock++;
		},
	};
}

function initializer(
	destroyed: { count: number },
	seen: { key?: PrivateKey; chain?: string; accountName?: string },
): EmbeddedWalletInitializer {
	return async (key, chain, options) => {
		seen.key = key;
		seen.chain = chain;
		seen.accountName = options.accountName;
		return fakeResult(destroyed);
	};
}

test("activates an account from its public binding and locks the Vault", async () => {
	const root = mkdtempSync(join(homedir(), "bsv-activation-home-"));
	const previousHome = process.env.HOME;
	const counters = { unlock: 0, lock: 0 };
	const destroyed = { count: 0 };
	const seen: { key?: PrivateKey; chain?: string; accountName?: string } = {};
	try {
		withHome(root);
		const expected = testAccount();
		const result = await createEmbeddedWalletActivation({
			vaultPath: join(root, "vault.bep"),
			io: fakeIo(counters),
			initializeWallet: initializer(destroyed, seen),
		}).activate({
			accountName: "default",
			password: PASSWORD,
			binding: binding(),
		});
		expect(counters).toEqual({ unlock: 1, lock: 1 });
		expect(seen.key?.toWif()).toBe(PAYMENT_KEY.toWif());
		expect(seen.chain).toBe(expected.chain);
		expect(seen.accountName).toBe("default");
		expect(result.ctx).toBeDefined();
		expect(JSON.stringify(result)).not.toContain(PAYMENT_KEY.toWif());
		await result.destroy();
		expect(destroyed.count).toBe(1);
	} finally {
		if (previousHome === undefined) delete process.env.HOME;
		else process.env.HOME = previousHome;
		rmSync(root, { recursive: true, force: true });
	}
});

test("rejects a request whose binding or address does not match account config", async () => {
	const root = mkdtempSync(join(homedir(), "bsv-activation-mismatch-"));
	const previousHome = process.env.HOME;
	const counters = { unlock: 0, lock: 0 };
	try {
		withHome(root);
		testAccount();
		const activation = createEmbeddedWalletActivation({
			vaultPath: join(root, "vault.bep"),
			io: fakeIo(counters),
			initializeWallet: async () => fakeResult({ count: 0 }),
		});
		await expect(
			activation.activate({
				accountName: "default",
				password: PASSWORD,
				binding: { ...binding(), vaultId: "other-vault" },
			}),
		).rejects.toMatchObject({ code: "BINDING_MISMATCH" });
		expect(counters.unlock).toBe(0);
		expect(counters.lock).toBe(1);

		const wrongAddress = newAccountConfig(
			"main",
			"1BoatSLRHtKNngkdXEeobR76b53LETtpyT",
		);
		wrongAddress.vaultBinding = binding();
		writeAccount("default", wrongAddress, accountsRoot());
		await expect(
			activation.activate({
				accountName: "default",
				password: PASSWORD,
				binding: binding(),
			}),
		).rejects.toMatchObject({ code: "BINDING_MISMATCH" });
		expect(counters.unlock).toBe(1);
		expect(counters.lock).toBe(2);
	} finally {
		if (previousHome === undefined) delete process.env.HOME;
		else process.env.HOME = previousHome;
		rmSync(root, { recursive: true, force: true });
	}
});

test("fails concurrent activation closed and permits retry after active release", async () => {
	const root = mkdtempSync(join(homedir(), "bsv-activation-concurrency-"));
	const previousHome = process.env.HOME;
	const counters = { unlock: 0, lock: 0 };
	const destroyed = { count: 0 };
	let releaseUnlock!: () => void;
	const unlockPaused = new Promise<void>((resolve) => {
		releaseUnlock = resolve;
	});
	try {
		withHome(root);
		testAccount();
		const io = fakeIo(counters);
		const originalUnlock = io.unlock;
		io.unlock = async (input) => {
			await unlockPaused;
			return originalUnlock(input);
		};
		const activation = createEmbeddedWalletActivation({
			vaultPath: join(root, "vault.bep"),
			io,
			initializeWallet: initializer(destroyed, {}),
		});
		const first = activation.activate({
			accountName: "default",
			password: PASSWORD,
			binding: binding(),
		});
		await expect(
			activation.activate({
				accountName: "default",
				password: PASSWORD,
				binding: binding(),
			}),
		).rejects.toMatchObject({ code: "BUSY" });
		releaseUnlock();
		const result = await first;
		await result.destroy();
		expect(counters.unlock).toBe(1);
		expect(counters.lock).toBe(1);
		const retry = await activation.activate({
			accountName: "default",
			password: PASSWORD,
			binding: binding(),
		});
		expect(retry).toBeDefined();
		await retry.destroy();
	} finally {
		if (previousHome === undefined) delete process.env.HOME;
		else process.env.HOME = previousHome;
		rmSync(root, { recursive: true, force: true });
	}
});

test("accepts a preserved configured address when it equals the deterministic deposit address", async () => {
	const root = mkdtempSync(join(homedir(), "bsv-activation-deposit-"));
	const previousHome = process.env.HOME;
	const counters = { unlock: 0, lock: 0 };
	const destroyed = { count: 0 };
	const depositAddress = PrivateKey.fromString("2", 16).toAddress();
	try {
		withHome(root);
		const config = newAccountConfig("main", depositAddress);
		config.vaultBinding = binding();
		writeAccount("default", config, accountsRoot());
		const result = await createEmbeddedWalletActivation({
			vaultPath: join(root, "vault.bep"),
			io: fakeIo(counters),
			initializeWallet: async () => fakeResult(destroyed, depositAddress),
		}).activate({
			accountName: "default",
			password: PASSWORD,
			binding: binding(),
		});
		expect(result.depositAddress).toBe(depositAddress);
		await result.destroy();
		expect(destroyed.count).toBe(1);
	} finally {
		if (previousHome === undefined) delete process.env.HOME;
		else process.env.HOME = previousHome;
		rmSync(root, { recursive: true, force: true });
	}
});

test("destroys an initialized wallet when post-init validation fails", async () => {
	const root = mkdtempSync(join(homedir(), "bsv-activation-cleanup-"));
	const previousHome = process.env.HOME;
	const counters = { unlock: 0, lock: 0 };
	const destroyed = { count: 0 };
	try {
		withHome(root);
		testAccount();
		await expect(
			createEmbeddedWalletActivation({
				vaultPath: join(root, "vault.bep"),
				io: fakeIo(counters),
				initializeWallet: async () =>
					({
						destroy: async () => destroyed.count++,
					}) as unknown as WalletInitResult,
			}).activate({
				accountName: "default",
				password: PASSWORD,
				binding: binding(),
			}),
		).rejects.toMatchObject({ code: "FAILED" });
		expect(destroyed.count).toBe(1);
		expect(counters.lock).toBe(1);
	} finally {
		if (previousHome === undefined) delete process.env.HOME;
		else process.env.HOME = previousHome;
		rmSync(root, { recursive: true, force: true });
	}
});

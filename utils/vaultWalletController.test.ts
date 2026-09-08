import { describe, expect, it, mock } from "bun:test";
import { PrivateKey, ProtoWallet, type WalletInterface } from "@bsv/sdk";
import {
	type ProjectRoleBindings,
	resolveProjectRoleBinding,
} from "./projectRoleBindings";
import {
	createVaultWalletController,
	loadInstalledVaultModule,
	vaultSelectionFromSnapshot,
} from "./vaultWalletController";
import type { WalletInitResult } from "./walletInit";

const key = PrivateKey.fromHex("1");
function setup() {
	const config: ProjectRoleBindings = {
		schemaVersion: 1,
		projectId: "project",
		revision: 0,
		current: {
			"identity-signing": null,
			payments: "payment",
			"one-sat": null,
			encryption: null,
		},
		bindings: [
			{
				bindingId: "payment",
				role: "payments",
				accountId: "selected",
				key: {
					vaultId: "vault",
					entryId: "entry",
					expectedPublicKey: key.toPublicKey().toString(),
				},
				keyUseContract: "direct-v1",
				createdAt: "2026-09-08T00:00:00Z",
			},
		],
		retained: [],
	};
	const destroy = mock(async () => {});
	const wallet = new ProtoWallet(key) as unknown as WalletInterface;
	const initializeWallet = mock(
		async (): Promise<WalletInitResult> => ({
			wallet,
			ctx: { wallet } as WalletInitResult["ctx"],
			services: {} as WalletInitResult["services"],
			depositAddress: "synthetic",
			destroy,
		}),
	);
	const openVault = mock(async () => ({
		toDocument: () => ({ id: "vault" }),
		get: () => ({ kind: "private" }),
		reveal: () => key.toHex(),
		unlock: () => {},
		lock: () => {},
	}));
	const loadBindings = mock(async () => config);
	const readSelectedAccount = mock(() => ({
		chain: "test" as const,
		storageIdentityKey: "test",
		depositPrefix: "mcp" as const,
	}));
	const options = {
		projectRoot: "/explicit/project",
		expectedProjectId: "project",
		resolveVaultPath: () => "/synthetic/vault",
		loadBindings,
		readSelectedAccount,
		loadVaultModule: async () => ({
			PassphraseProvider: class {
				constructor(readonly passphrase: string) {}
			},
			openVault,
		}),
		walletDependencies: { initializeWallet },
	};
	return {
		config,
		options,
		destroy,
		openVault,
		loadBindings,
		readSelectedAccount,
	};
}
describe("installed Vault module", () => {
	it("reports missing local dependencies without claiming registry availability", async () => {
		await expect(
			loadInstalledVaultModule(async (specifier) => {
				expect(specifier).toBe("@opl.dev/vault");
				throw Object.assign(new Error("private-detail"), {
					code: "ERR_MODULE_NOT_FOUND",
				});
			}),
		).rejects.toMatchObject({
			code: "VAULT_PACKAGE_MISSING",
			message:
				"The Vault package or a required dependency is not installed in this runtime.",
		});
	});
	it("rejects invalid exports and sanitizes other loader errors", async () => {
		await expect(
			loadInstalledVaultModule(async () => ({})),
		).rejects.toMatchObject({ code: "VAULT_PACKAGE_INCOMPATIBLE" });
		await expect(
			loadInstalledVaultModule(async () => {
				throw new Error("private-detail");
			}),
		).rejects.toMatchObject({
			code: "VAULT_PACKAGE_LOAD_FAILED",
			message: "The installed Vault package could not be loaded.",
		});
	});
});
describe("local Vault controller", () => {
	it("loads only the explicit project and bound account, returning public status", async () => {
		const f = setup();
		const c = createVaultWalletController(f.options);
		const result = await c.unlock(
			"payments",
			"secret-passphrase",
			"Synthetic test",
		);
		expect(f.loadBindings).toHaveBeenCalledWith("/explicit/project", "project");
		expect(f.readSelectedAccount).toHaveBeenCalledWith("selected");
		expect(JSON.stringify(result)).not.toContain("secret-passphrase");
		expect("wallet" in result).toBe(false);
		expect(
			await c.run(
				"payments",
				async (session) =>
					(await session.wallet.getPublicKey({ identityKey: true })).publicKey,
			),
		).toBe(key.toPublicKey().toString());
		await c.lock();
		expect(f.destroy).toHaveBeenCalledTimes(1);
	});
	it("does not fall back from an unassigned role", async () => {
		const f = setup();
		const c = createVaultWalletController(f.options);
		await expect(c.unlock("encryption", "pass", "test")).rejects.toThrow(
			"UNASSIGNED",
		);
		expect(f.openVault).not.toHaveBeenCalled();
	});
	it("rejects missing account and unsupported key contracts before opening Vault", async () => {
		const f = setup();
		const c = createVaultWalletController({
			...f.options,
			readSelectedAccount: () => undefined,
		});
		await expect(c.unlock("payments", "pass", "test")).rejects.toMatchObject({
			code: "ACCOUNT_UNAVAILABLE",
		});
		expect(f.openVault).not.toHaveBeenCalled();
		const snapshot = resolveProjectRoleBinding(f.config, "project", "payments");
		expect(() =>
			vaultSelectionFromSnapshot(
				{
					...snapshot,
					binding: { ...snapshot.binding, keyUseContract: "brc42-leaf-v1" },
				},
				{ vaultPath: "/synthetic", chain: "test", reason: "test" },
			),
		).toThrow("directly selected");
	});
	it("locks a session whose project binding changed before another operation", async () => {
		const f = setup();
		const c = createVaultWalletController(f.options);
		await c.unlock("payments", "pass", "test");
		f.config.revision++;
		const operation = mock(async () => true);
		await expect(c.run("payments", operation)).rejects.toThrow("STALE");
		expect(operation).not.toHaveBeenCalled();
		expect(f.destroy).toHaveBeenCalledTimes(1);
	});
	it("rejects an unlock completed after explicit lock", async () => {
		const f = setup();
		let release!: () => void;
		const original = f.options.loadVaultModule;
		f.options.loadVaultModule = async () => {
			await new Promise<void>((resolve) => {
				release = resolve;
			});
			return original();
		};
		const c = createVaultWalletController(f.options);
		const attempt = c.unlock("payments", "pass", "test");
		while (!release) await Promise.resolve();
		await c.lock();
		release();
		await expect(attempt).rejects.toMatchObject({ code: "UNLOCK_SUPERSEDED" });
		expect(f.destroy).not.toHaveBeenCalled();
		expect(f.openVault).not.toHaveBeenCalled();
	});
	it("requires an absolute project root", () => {
		const f = setup();
		expect(() =>
			createVaultWalletController({ ...f.options, projectRoot: "." }),
		).toThrow("absolute");
	});
});

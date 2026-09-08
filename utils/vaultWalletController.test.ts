import { describe, expect, it, mock } from "bun:test";
import { PrivateKey, ProtoWallet, type WalletInterface } from "@bsv/sdk";
import {
	changeProjectRoleBinding,
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
		).toThrow("supported explicit Vault key contract");
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
	it("supersedes overlapping unlocks of the same role only", async () => {
		const f = setup();
		let releaseFirstModule!: () => void;
		const firstModuleRelease = new Promise<void>((resolve) => {
			releaseFirstModule = resolve;
		});
		let firstModuleStarted!: () => void;
		const firstModuleReady = new Promise<void>((resolve) => {
			firstModuleStarted = resolve;
		});
		let moduleCalls = 0;
		const originalLoadModule = f.options.loadVaultModule;
		f.options.loadVaultModule = async () => {
			moduleCalls += 1;
			if (moduleCalls === 1) {
				firstModuleStarted();
				await firstModuleRelease;
			}
			return originalLoadModule();
		};

		const controller = createVaultWalletController(f.options);
		const first = controller.unlock("payments", "first", "switch");
		await firstModuleReady;
		const second = await controller.unlock("payments", "second", "switch");
		expect(second.role).toBe("payments");
		releaseFirstModule();
		await expect(first).rejects.toMatchObject({ code: "UNLOCK_SUPERSEDED" });
		expect(f.openVault).toHaveBeenCalledTimes(1);
		expect(await controller.run("payments", async () => "latest")).toBe(
			"latest",
		);
		await controller.lock();
		expect(f.destroy).toHaveBeenCalledTimes(1);
	});

	it("keeps payments and identity-signing sessions active simultaneously", async () => {
		const paymentKey = PrivateKey.fromHex("11");
		const identityKey = PrivateKey.fromHex("22");
		const f = setup();
		f.config.current["identity-signing"] = "identity";
		f.config.bindings.push({
			bindingId: "identity",
			role: "identity-signing",
			accountId: "selected-identity",
			key: {
				vaultId: "vault",
				entryId: "identity-entry",
				expectedPublicKey: identityKey.toPublicKey().toString(),
			},
			keyUseContract: "direct-v1",
			createdAt: "2026-09-08T00:01:00Z",
		});
		const paymentBinding = f.config.bindings[0];
		if (!paymentBinding) throw new Error("missing fixture");
		paymentBinding.key.expectedPublicKey = paymentKey.toPublicKey().toString();
		const byEntry: Record<string, PrivateKey> = {
			entry: paymentKey,
			"identity-entry": identityKey,
		};
		(f.options as unknown as { openVault: unknown }).openVault = mock(
			async () => ({
				toDocument: () => ({ id: "vault" }),
				get: () => ({ kind: "private" }),
				reveal: (id: string) => byEntry[id]?.toHex() ?? paymentKey.toHex(),
				unlock: () => {},
				lock: () => {},
			}),
		);
		f.options.loadVaultModule = async () => ({
			PassphraseProvider: class {
				constructor(readonly passphrase: string) {}
			},
			openVault: (f.options as unknown as { openVault: unknown })
				.openVault as never,
		});
		(
			f.options.walletDependencies as unknown as { initializeWallet: unknown }
		).initializeWallet = mock(
			async (
				revealed: PrivateKey,
				selection: { accountName: string },
			): Promise<WalletInitResult> => {
				const wallet = new ProtoWallet(revealed) as unknown as WalletInterface;
				return {
					wallet,
					ctx: { wallet } as WalletInitResult["ctx"],
					services: {} as WalletInitResult["services"],
					depositAddress: `synthetic-${selection.accountName}`,
					destroy: async () => {},
				};
			},
		);
		(
			f.options as unknown as { readSelectedAccount: unknown }
		).readSelectedAccount = mock((name: string) => {
			expect(["selected", "selected-identity"]).toContain(name);
			return {
				chain: "test" as const,
				storageIdentityKey: "test",
				depositPrefix: "mcp" as const,
			};
		});

		const controller = createVaultWalletController(f.options);
		const paymentStatus = await controller.unlock(
			"payments",
			"pass",
			"payments session",
		);
		const identityStatus = await controller.unlock(
			"identity-signing",
			"pass",
			"identity session",
		);
		expect(paymentStatus.bindingId).toBe("payment");
		expect(identityStatus.bindingId).toBe("identity");
		expect(identityStatus.publicKey).toBe(identityKey.toPublicKey().toString());
		const paymentPub = await controller.run(
			"payments",
			async (session) =>
				(await session.wallet.getPublicKey({ identityKey: true })).publicKey,
		);
		const identityPub = await controller.run(
			"identity-signing",
			async (session) =>
				(await session.wallet.getPublicKey({ identityKey: true })).publicKey,
		);
		expect(paymentPub).toBe(paymentKey.toPublicKey().toString());
		expect(identityPub).toBe(identityKey.toPublicKey().toString());
		expect(paymentPub).not.toBe(identityPub);
		await controller.lock("payments");
		await expect(
			controller.run("payments", async () => true),
		).rejects.toMatchObject({ code: "SESSION_LOCKED" });
		expect(
			await controller.run("identity-signing", async () => "still-active"),
		).toBe("still-active");
		await controller.lock();
		await expect(
			controller.run("identity-signing", async () => true),
		).rejects.toMatchObject({ code: "SESSION_LOCKED" });
	});

	it("revokes only the stale role and never falls back across roles", async () => {
		const f = setup();
		f.config.current["identity-signing"] = "identity";
		f.config.bindings.push({
			bindingId: "identity",
			role: "identity-signing",
			accountId: "selected",
			key: {
				vaultId: "vault",
				entryId: "identity-entry",
				expectedPublicKey: key.toPublicKey().toString(),
			},
			keyUseContract: "direct-v1",
			createdAt: "2026-09-08T00:01:00Z",
		});
		const controller = createVaultWalletController(f.options);
		await controller.unlock("payments", "pass", "test");
		await controller.unlock("identity-signing", "pass", "test");
		const paymentBinding = f.config.bindings.find(
			(item) => item.bindingId === "payment",
		);
		if (!paymentBinding) throw new Error("missing fixture");
		paymentBinding.key.entryId = "rotated-entry";
		const operation = mock(async () => true);
		await expect(controller.run("payments", operation)).rejects.toThrow(
			"STALE",
		);
		expect(operation).not.toHaveBeenCalled();
		expect(
			await controller.run("identity-signing", async () => "other-role-ok"),
		).toBe("other-role-ok");
		await controller.lock("identity-signing");
		await expect(
			controller.run("identity-signing", async () => true),
		).rejects.toMatchObject({ code: "SESSION_LOCKED" });
		await expect(
			controller.run("payments", async () => true),
		).rejects.toMatchObject({ code: "SESSION_LOCKED" });
	});

	it("locks and disposes a session that finishes after a concurrent controller lock", async () => {
		const f = setup();
		let releaseInitialization!: () => void;
		let initializationStarted!: () => void;
		const initializationRelease = new Promise<void>((resolve) => {
			releaseInitialization = resolve;
		});
		const initializationReady = new Promise<void>((resolve) => {
			initializationStarted = resolve;
		});
		const originalInitialize = f.options.walletDependencies.initializeWallet;
		f.options.walletDependencies.initializeWallet = mock(
			async (...args: Parameters<typeof originalInitialize>) => {
				initializationStarted();
				await initializationRelease;
				return originalInitialize(...args);
			},
		);

		const controller = createVaultWalletController(f.options);
		const attempt = controller.unlock("payments", "pass", "switch");
		await initializationReady;
		const locking = controller.lock();
		releaseInitialization();
		await locking;
		await expect(attempt).rejects.toMatchObject({ code: "UNLOCK_SUPERSEDED" });
		expect(f.openVault).toHaveBeenCalledTimes(1);
		expect(f.destroy).toHaveBeenCalledTimes(1);
		await expect(
			controller.run("payments", async () => true),
		).rejects.toMatchObject({
			code: "SESSION_LOCKED",
		});
	});

	it("rejects a changed role snapshot before exposing an initialized session", async () => {
		const f = setup();
		const next = changeProjectRoleBinding(f.config, {
			expectedProjectId: "project",
			expectedRevision: 0,
			role: "payments",
			binding: {
				bindingId: "payment-2",
				accountId: "selected",
				key: {
					vaultId: "vault",
					entryId: "entry-2",
					expectedPublicKey: key.toPublicKey().toString(),
				},
				keyUseContract: "direct-v1",
				createdAt: "2026-09-08T00:01:00Z",
			},
		});
		const originalInitialize = f.options.walletDependencies.initializeWallet;
		f.options.walletDependencies.initializeWallet = mock(
			async (...args: Parameters<typeof originalInitialize>) => {
				f.options.loadBindings = mock(
					async () => next as unknown as ProjectRoleBindings,
				);
				return originalInitialize(...args);
			},
		);

		const controller = createVaultWalletController(f.options);
		await expect(
			controller.unlock("payments", "pass", "switch"),
		).rejects.toThrow("PROJECT_ROLE_SNAPSHOT_STALE");
		expect(f.destroy).toHaveBeenCalledTimes(1);
		await expect(
			controller.run("payments", async () => true),
		).rejects.toMatchObject({
			code: "SESSION_LOCKED",
		});
	});

	it("rejects an invalid selected chain before Vault access or database initialization", async () => {
		const f = setup();
		const controller = createVaultWalletController({
			...f.options,
			readSelectedAccount: () =>
				({
					chain: "regtest",
					storageIdentityKey: "test",
					depositPrefix: "mcp",
				}) as never,
		});
		await expect(
			controller.unlock("payments", "pass", "switch"),
		).rejects.toMatchObject({
			code: "INVALID_SELECTION",
		});
		expect(f.openVault).not.toHaveBeenCalled();
		expect(
			f.options.walletDependencies.initializeWallet,
		).not.toHaveBeenCalled();
	});

	it("coalesces overlapping controller locks without duplicating cleanup", async () => {
		const f = setup();
		const controller = createVaultWalletController(f.options);
		await controller.unlock("payments", "pass", "switch");
		await Promise.all([
			controller.lock(),
			controller.lock(),
			controller.lock(),
		]);
		expect(f.destroy).toHaveBeenCalledTimes(1);
		await expect(
			controller.run("payments", async () => true),
		).rejects.toMatchObject({
			code: "SESSION_LOCKED",
		});
	});

	it("requires an absolute project root", () => {
		const f = setup();
		expect(() =>
			createVaultWalletController({ ...f.options, projectRoot: "." }),
		).toThrow("absolute");
	});
});

it("passes the selected profile descriptor and installed derivation API through the controller", async () => {
	const f = setup();
	const binding = f.config.bindings[0];
	if (!binding) throw new Error("missing fixture");
	binding.keyUseContract = "brc157-leaf-v1";
	binding.key.derivation = {
		scheme: "brc157",
		index: 13,
		leaf: {
			scheme: "brc42",
			protocolID: [2, "project signing"],
			keyID: "selected",
			counterparty: "self",
		},
	};
	const profile = mock(() => PrivateKey.fromHex("2"));
	const leaf = mock(() => key);
	const originalModule = await f.options.loadVaultModule();
	const controller = createVaultWalletController({
		...f.options,
		loadVaultModule: async () => ({
			...originalModule,
			openVault: async () => ({
				toDocument: () => ({ id: "vault" }),
				get: () => ({ kind: "entropy" }),
				reveal: () => "synthetic",
				unlock: () => {},
				lock: () => {},
			}),
			mnemonicToEntropy: () => "synthetic",
			brc157Profile: profile,
			brc42Derive: leaf,
			bip32Derive: () => "unused",
		}),
	});
	const selected = vaultSelectionFromSnapshot(
		resolveProjectRoleBinding(f.config, "project", "payments"),
		{ vaultPath: "/synthetic/vault", chain: "test", reason: "test" },
	);
	expect(selected.binding.derivation).toEqual(binding.key.derivation);
	await controller.unlock("payments", "synthetic", "test");
	expect(profile).toHaveBeenCalledWith("synthetic", 13);
	expect(leaf).toHaveBeenCalledWith(
		PrivateKey.fromHex("2").toWif(),
		[2, "project signing"],
		"selected",
		"self",
	);
	await controller.lock();
});

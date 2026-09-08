import { describe, expect, it, mock } from "bun:test";
import {
	KeyDeriver,
	PrivateKey,
	ProtoWallet,
	type WalletInterface,
} from "@bsv/sdk";
import {
	createOplVaultLoader,
	openVaultWalletSession,
	type VaultWalletAccess,
	type VaultWalletSelection,
} from "./vaultWallet";
import type { WalletInitResult } from "./walletInit";

const key = PrivateKey.fromHex("1".padStart(64, "0"));
function setup() {
	const selection: VaultWalletSelection = {
		binding: {
			projectId: "project",
			revision: 1,
			bindingId: "payment",
			accountId: "test",
			vaultId: "vault",
			entryId: "entry",
			expectedPublicKey: key.toPublicKey().toString(),
			keyUseContract: "direct-v1",
		},
		vaultPath: "/synthetic/vault",
		accountName: "test",
		chain: "test",
		reason: "Synthetic test",
		ttlSeconds: 10,
	};
	const access: VaultWalletAccess = {
		id: "vault",
		get: mock(() => ({
			kind: "private",
			publicKey: key.toPublicKey().toString(),
		})),
		unlock: mock(() => {}),
		reveal: mock(() => key.toHex()),
		lock: mock(() => {}),
	};
	const raw = new ProtoWallet(key) as unknown as WalletInterface;
	const destroy = mock(async () => {});
	const initializeWallet = mock(
		async (
			_key: PrivateKey,
			_selection: Readonly<VaultWalletSelection>,
			_signal: AbortSignal,
		): Promise<WalletInitResult> => ({
			wallet: raw,
			ctx: { wallet: raw } as WalletInitResult["ctx"],
			services: {} as WalletInitResult["services"],
			depositAddress: "synthetic",
			destroy,
		}),
	);
	const openVault = mock(async () => access);
	return { selection, access, raw, destroy, initializeWallet, openVault };
}

it("flat BRC-42 project bindings initialize only the pinned child and support BRC-100 signing", async () => {
	for (const counterparty of [
		"self",
		"anyone",
		PrivateKey.fromHex("2").toPublicKey().toString(),
	]) {
		const f = setup();
		const derivation = {
			scheme: "brc42" as const,
			protocolID: [2, "project signing"] as [2, string],
			keyID: "project-a",
			counterparty,
		};
		const expected = new KeyDeriver(key).derivePrivateKey(
			derivation.protocolID,
			derivation.keyID,
			counterparty,
		);
		f.selection.binding = {
			...f.selection.binding,
			keyUseContract: "brc42-leaf-v1",
			derivation,
			expectedPublicKey: expected.toPublicKey().toString(),
		};
		f.initializeWallet.mockImplementation(async (selected) => {
			const wallet = new ProtoWallet(selected) as unknown as WalletInterface;
			return {
				wallet,
				ctx: { wallet } as WalletInitResult["ctx"],
				services: {} as WalletInitResult["services"],
				depositAddress: "synthetic",
				destroy: f.destroy,
			};
		});
		const session = await openVaultWalletSession(f.selection, "synthetic", f);
		expect(f.initializeWallet.mock.calls[0]?.[0].toPublicKey().toString()).toBe(
			expected.toPublicKey().toString(),
		);
		expect(expected.toPublicKey().toString()).not.toBe(
			key.toPublicKey().toString(),
		);
		const parameters = {
			protocolID: [2, "application signing"] as [2, string],
			keyID: "invoice-42",
			counterparty: "self",
			data: [1, 2, 3],
		};
		const signed = await session.wallet.createSignature(parameters);
		expect(
			(
				await session.wallet.verifySignature({
					...parameters,
					signature: signed.signature,
				})
			).valid,
		).toBe(true);
		await session.lock();
		await expect(
			session.wallet.createSignature(parameters),
		).rejects.toMatchObject({ code: "SESSION_LOCKED" });
	}
});

describe("Vault wallet session", () => {
	it("rejects a different account before unlocking or opening its database", async () => {
		const f = setup();
		f.selection.accountName = "another-account";
		await expect(
			openVaultWalletSession(f.selection, "pass", f),
		).rejects.toMatchObject({
			code: "INVALID_SELECTION",
		});
		expect(f.openVault).not.toHaveBeenCalled();
		expect(f.initializeWallet).not.toHaveBeenCalled();
	});
	it("aborts an initializer at expiry and disposes its late result", async () => {
		const f = setup();
		f.selection.ttlSeconds = 1;
		await expect(
			openVaultWalletSession(f.selection, "pass", {
				...f,
				initializeWallet: async (...args) => {
					await new Promise<void>((resolve) =>
						args[2].addEventListener("abort", () => resolve(), { once: true }),
					);
					return f.initializeWallet(...args);
				},
			}),
		).rejects.toMatchObject({ code: "SESSION_EXPIRED" });
		expect(f.destroy).toHaveBeenCalledTimes(1);
		expect(f.access.lock).toHaveBeenCalledTimes(1);
	});
	it("uses the explicitly selected key, pins the binding, and exposes only the guarded wallet", async () => {
		const f = setup();
		const session = await openVaultWalletSession(
			f.selection,
			"synthetic-passphrase",
			f,
		);
		f.selection.binding.entryId = "another";
		expect(session.binding.entryId).toBe("entry");
		expect(session.ctx.wallet).toBe(session.wallet);
		expect(Object.keys(session.wallet)).toHaveLength(28);
		expect("keyDeriver" in session.wallet).toBe(false);
		expect(f.initializeWallet.mock.calls[0]?.[0].toPublicKey().toString()).toBe(
			session.binding.expectedPublicKey,
		);
		expect(f.access.lock).toHaveBeenCalledTimes(1);
		const args = {
			protocolID: [0, "synthetic"] as [0, string],
			keyID: "1",
			data: [1, 2, 3],
		};
		const signed = await session.wallet.createSignature(args);
		expect(
			(
				await session.wallet.verifySignature({
					...args,
					signature: signed.signature,
				})
			).valid,
		).toBe(true);
		expect(JSON.stringify(session)).not.toContain("synthetic-passphrase");
		await session.lock();
		await session.lock();
		expect(f.destroy).toHaveBeenCalledTimes(1);
		await expect(session.wallet.createSignature(args)).rejects.toMatchObject({
			code: "SESSION_LOCKED",
		});
	});
	it("supports WIF entries", async () => {
		const f = setup();
		f.access.get = () => ({ kind: "wif" });
		f.access.reveal = () => key.toWif();
		const session = await openVaultWalletSession(f.selection, "pass", f);
		await session.lock();
		expect(f.initializeWallet).toHaveBeenCalledTimes(1);
	});
	it.each(["vault", "entry", "kind", "metadata", "actual", "reveal"])(
		"rejects %s mismatch before wallet creation and cleans up",
		async (variant) => {
			const f = setup();
			if (variant === "vault") f.selection.binding.vaultId = "other";
			if (variant === "entry")
				f.access.get = () => {
					throw new Error("secret-leak");
				};
			if (variant === "kind") f.access.get = () => ({ kind: "seed" });
			if (variant === "metadata")
				f.access.get = () => ({
					kind: "private",
					publicKey: PrivateKey.fromHex("2").toPublicKey().toString(),
				});
			if (variant === "actual")
				f.access.reveal = () => PrivateKey.fromHex("2").toHex();
			if (variant === "reveal")
				f.access.reveal = () => {
					throw new Error("secret-leak");
				};
			try {
				await openVaultWalletSession(f.selection, "pass", f);
				throw new Error("unexpected success");
			} catch (error) {
				expect(String(error)).not.toContain("secret-leak");
				expect(String(error)).not.toContain("unexpected success");
			}
			expect(f.initializeWallet).not.toHaveBeenCalled();
			expect(f.access.lock).toHaveBeenCalledTimes(1);
		},
	);
	it("expires and aborts approval before a stale wallet reference can act", async () => {
		const f = setup();
		let now = 100;
		const session = await openVaultWalletSession(f.selection, "pass", {
			...f,
			now: () => now,
		});
		now += 10_000;
		await expect(
			session.wallet.getPublicKey({ identityKey: true }),
		).rejects.toMatchObject({ code: "SESSION_EXPIRED" });
		expect(f.initializeWallet.mock.calls[0]?.[2].aborted).toBe(true);
		await session.lock();
		expect(session.state).toBe("expired");
		expect(f.destroy).toHaveBeenCalledTimes(1);
	});
	it("preserves already submitted results while lock drains and refuses new calls", async () => {
		const f = setup();
		let finish!: (value: { version: string }) => void;
		f.raw.getVersion = mock(
			() =>
				new Promise<{ version: string }>((resolve) => {
					finish = resolve;
				}),
		);
		const session = await openVaultWalletSession(f.selection, "pass", f);
		const pending = session.wallet.getVersion({});
		await Promise.resolve();
		const closing = session.lock();
		expect(f.destroy).not.toHaveBeenCalled();
		await expect(session.wallet.getVersion({})).rejects.toMatchObject({
			code: "SESSION_LOCKED",
		});
		finish({ version: "submitted-result" });
		expect(await pending).toEqual({ version: "submitted-result" });
		await closing;
		expect(f.destroy).toHaveBeenCalledTimes(1);
	});
	it("cleans up if initialization completes after expiry", async () => {
		const f = setup();
		let now = 0;
		const original = f.initializeWallet;
		await expect(
			openVaultWalletSession(f.selection, "pass", {
				...f,
				now: () => now,
				initializeWallet: async (...args) => {
					const result = await original(...args);
					now = 20_000;
					return result;
				},
			}),
		).rejects.toMatchObject({ code: "SESSION_EXPIRED" });
		expect(f.destroy).toHaveBeenCalledTimes(1);
	});
	it("keeps independently selected sessions isolated", async () => {
		const a = setup(),
			b = setup();
		const first = await openVaultWalletSession(a.selection, "a", a);
		const second = await openVaultWalletSession(b.selection, "b", b);
		await first.lock();
		expect(
			(await second.wallet.getPublicKey({ identityKey: true })).publicKey,
		).toBe(key.toPublicKey().toString());
		await second.lock();
	});
	it("sanitizes factory failures and locks Vault", async () => {
		const f = setup();
		await expect(
			openVaultWalletSession(f.selection, "pass", {
				...f,
				initializeWallet: async () => {
					throw new Error(key.toWif());
				},
			}),
		).rejects.toMatchObject({
			code: "INITIALIZATION_FAILED",
			message: "Cannot initialize the selected Vault wallet.",
		});
		expect(f.access.lock).toHaveBeenCalledTimes(1);
	});
	it("adapts Vault without bypassing reveal policy and discards the handle on lock", async () => {
		const f = setup();
		const loader = createOplVaultLoader({
			PassphraseProvider: class {
				constructor(readonly passphrase: string) {}
			},
			openVault: async () => ({
				...f.access,
				toDocument: () => ({ id: "vault" }),
			}),
		});
		const access = await loader("/synthetic", "pass");
		expect(access.id).toBe("vault");
		expect(access.reveal("entry", "test")).toBe(key.toHex());
		access.lock();
		expect(() => access.reveal("entry", "test")).toThrow("locked");
	});
});

const profileLeaf = {
	scheme: "brc42" as const,
	protocolID: [2, "project signing"] as [2, string],
	keyID: "selected",
	counterparty: "self",
};
function profileSetup() {
	const f = setup();
	f.selection.binding.keyUseContract = "brc157-leaf-v1";
	f.selection.binding.derivation = {
		scheme: "brc157",
		index: 7,
		leaf: { ...profileLeaf },
	};
	f.access.get = () => ({
		kind: "entropy",
		publicKey: PrivateKey.fromHex("2").toPublicKey().toString(),
	});
	const profileDerivationApi = {
		mnemonicToEntropy: () => "synthetic",
		brc157Profile: mock(() => PrivateKey.fromHex("2")),
		brc42Derive: mock(() => key),
		bip32Derive: () => "unused",
	};
	return { ...f, profileDerivationApi };
}
it("resolves only the explicit profile leaf and deeply pins its descriptor", async () => {
	const f = profileSetup();
	const session = await openVaultWalletSession(f.selection, "synthetic", f);
	expect(f.initializeWallet.mock.calls[0]?.[0].toHex()).toBe(key.toHex());
	expect(f.profileDerivationApi.brc157Profile).toHaveBeenCalledWith(
		key.toHex(),
		7,
	);
	expect(session.binding.entryId).toBe("entry");
	expect(Object.isFrozen(session.binding.derivation)).toBe(true);
	const derived = session.binding.derivation;
	if (derived?.scheme !== "brc157") throw new Error("wrong descriptor");
	expect(Object.isFrozen(derived.leaf)).toBe(true);
	expect(Object.isFrozen(derived.leaf.protocolID)).toBe(true);
	f.selection.binding.derivation = {
		scheme: "brc157",
		index: 99,
		leaf: { ...profileLeaf },
	};
	expect(derived.index).toBe(7);
	await session.lock();
});
it("rejects unsupported profile APIs, source types, mismatched pins and expiry before initializing", async () => {
	for (const variant of ["api", "source", "pin", "expiry", "contract"]) {
		const f = profileSetup();
		let now = 100;
		if (variant === "source") f.access.get = () => ({ kind: "private" });
		if (variant === "pin")
			f.selection.binding.expectedPublicKey = PrivateKey.fromHex("3")
				.toPublicKey()
				.toString();
		if (variant === "contract")
			f.selection.binding.keyUseContract = "yours-legacy-leaf-v1";
		if (variant === "expiry")
			f.profileDerivationApi.brc42Derive.mockImplementation(() => {
				now += 20000;
				return key;
			});
		await expect(
			openVaultWalletSession(f.selection, "synthetic", {
				...f,
				now: () => now,
				profileDerivationApi:
					variant === "api" ? undefined : f.profileDerivationApi,
			}),
		).rejects.toBeInstanceOf(Error);
		expect(f.initializeWallet).not.toHaveBeenCalled();
		if (variant === "api" || variant === "contract")
			expect(f.openVault).not.toHaveBeenCalled();
	}
});
const realProfilePath =
	process.env.BSV_MCP_TEST_VAULT_MODULE ?? "@opl.dev/vault";
const realProfileModule = realProfilePath
	? await import(realProfilePath)
	: undefined;
it.skipIf(!realProfileModule)(
	"real Vault profile sources hand only selected BRC157 and Yours leaves to SDK initialization",
	async () => {
		const real = realProfileModule;
		if (!real) throw new Error("missing fixture");
		const { HD, Mnemonic, KeyDeriver } = await import("@bsv/sdk");
		const master = HD.fromSeed(
			Mnemonic.fromString(real.BRC157_PHRASE).toSeed(),
		);
		const vault = new real.Vault(real.createVaultDocument());
		const entries = vault.importPlain(
			{
				ids: "synthetic",
				mnemonic: real.BRC157_PHRASE,
				xprv: master.toString(),
			},
			"synthetic",
		);
		const mnemonic = entries.find(
			(entry: { kind: string }) => entry.kind === "mnemonic",
		);
		const hd = entries.find(
			(entry: { kind: string }) => entry.kind === "hd-private",
		);
		const brcLeaf = new KeyDeriver(
			master.derive("m/0'/7'").privKey,
		).derivePrivateKey(
			profileLeaf.protocolID,
			profileLeaf.keyID,
			profileLeaf.counterparty,
		);
		const { YOURS_LEGACY_PROFILE_PATHS } = await import(
			"./vaultProfileDerivation"
		);
		const candidates = [
			{
				entry: mnemonic,
				contract: "brc157-leaf-v1" as const,
				derivation: { scheme: "brc157" as const, index: 7, leaf: profileLeaf },
				expected: brcLeaf,
			},
			...YOURS_LEGACY_PROFILE_PATHS.map((path) => ({
				entry: hd,
				contract: "yours-legacy-leaf-v1" as const,
				derivation: { scheme: "yours-legacy-bip32" as const, path },
				expected: master.derive(path).privKey,
			})),
		];
		const before = vault.list();
		for (const candidate of candidates) {
			const f = setup();
			f.selection.binding = {
				...f.selection.binding,
				vaultId: vault.toDocument().id,
				entryId: candidate.entry.id,
				keyUseContract: candidate.contract,
				derivation: candidate.derivation,
				expectedPublicKey: candidate.expected.toPublicKey().toString(),
			};
			const session = await openVaultWalletSession(f.selection, "synthetic", {
				...f,
				profileDerivationApi: real,
				openVault: async () => ({
					id: vault.toDocument().id,
					get: (id) => vault.get(id),
					reveal: (id, reason) => vault.reveal(id, reason),
					unlock: (reason, ttl) => vault.unlock(reason, ttl),
					lock: () => vault.lock(),
				}),
			});
			expect(f.initializeWallet.mock.calls[0]?.[0].toHex()).toBe(
				candidate.expected.toHex(),
			);
			expect(f.initializeWallet.mock.calls[0]?.[0].toHex()).not.toBe(
				master.privKey.toHex(),
			);
			await session.lock();
		}
		expect(vault.list()).toEqual(before);
	},
);

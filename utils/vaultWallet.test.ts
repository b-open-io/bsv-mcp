import { describe, expect, it, mock } from "bun:test";
import { PrivateKey, ProtoWallet, type WalletInterface } from "@bsv/sdk";
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
			accountId: "account",
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

describe("Vault wallet session", () => {
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

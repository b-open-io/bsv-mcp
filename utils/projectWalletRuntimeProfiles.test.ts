import { expect, mock, test } from "bun:test";
import {
	HD,
	KeyDeriver,
	Mnemonic,
	type PrivateKey,
	ProtoWallet,
	type WalletInterface,
} from "@bsv/sdk";
import type { ProjectRoleBindings } from "./projectRoleBindings";
import { createProjectWalletRuntime } from "./projectWalletRuntime";
import { YOURS_LEGACY_PROFILE_PATHS } from "./vaultProfileDerivation";
import type { WalletInitResult } from "./walletInit";

const modulePath = process.env.BSV_MCP_TEST_VAULT_MODULE;
const real = modulePath ? await import(modulePath) : undefined;

test.skipIf(!real)(
	"real Vault profile startup pins each selected leaf and revokes retained runtime handles at expiry",
	async () => {
		if (!real) throw new Error("Missing real Vault fixture");
		const master = HD.fromSeed(
			Mnemonic.fromString(real.BRC157_PHRASE).toSeed(),
		);
		const leaf = {
			scheme: "brc42" as const,
			protocolID: [2, "project signing"] as [2, string],
			keyID: "selected",
			counterparty: "self",
		};
		const expectedBrc = new KeyDeriver(
			master.derive("m/0'/7'").privKey,
		).derivePrivateKey(leaf.protocolID, leaf.keyID, leaf.counterparty);
		const candidates = [
			{ scheme: "brc157" as const, index: 7, leaf },
			...YOURS_LEGACY_PROFILE_PATHS.map((path) => ({
				scheme: "yours-legacy-bip32" as const,
				path,
			})),
		];
		for (const derivation of candidates) {
			const vault = new real.Vault(real.createVaultDocument());
			const entries = vault.importPlain(
				{
					ids: "synthetic",
					mnemonic: real.BRC157_PHRASE,
					xprv: master.toString(),
				},
				"synthetic",
			);
			const entry = entries.find(
				(item: { kind: string }) =>
					item.kind ===
					(derivation.scheme === "brc157" ? "mnemonic" : "hd-private"),
			);
			const expected =
				derivation.scheme === "brc157"
					? expectedBrc
					: master.derive(derivation.path).privKey;
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
				retained: [],
				bindings: [
					{
						bindingId: "payment",
						role: "payments",
						accountId: "selected",
						keyUseContract:
							derivation.scheme === "brc157"
								? "brc157-leaf-v1"
								: "yours-legacy-leaf-v1",
						createdAt: "2026-09-08T00:00:00Z",
						key: {
							vaultId: vault.toDocument().id,
							entryId: entry.id,
							expectedPublicKey: expected.toPublicKey().toString(),
							derivation,
						},
					},
				],
			};
			const destroy = mock(async () => {});
			const initializeWallet = mock(
				async (key: PrivateKey): Promise<WalletInitResult> => {
					const wallet = new ProtoWallet(key) as unknown as WalletInterface;
					return {
						wallet,
						ctx: { wallet } as WalletInitResult["ctx"],
						services: {} as WalletInitResult["services"],
						depositAddress: "synthetic",
						destroy,
					};
				},
			);
			let expiry = () => {};
			const terminate = mock(() => {});
			const runtime = await createProjectWalletRuntime({
				env: {
					BSV_MCP_PROJECT_ROOT: "/synthetic/project",
					BSV_MCP_PROJECT_ID: "project",
					BSV_MCP_PASSWORD: "synthetic-only",
					VAULT_PATH: "/synthetic/vault",
					TRANSPORT: "stdio",
				},
				argv: ["--stdio"],
				loadVaultModule: async () => ({
					...real,
					openVault: async () => vault,
				}),
				controllerOptions: {
					loadBindings: async () => config,
					readSelectedAccount: () => ({
						chain: "test",
						storageIdentityKey: "synthetic",
						depositPrefix: "mcp",
					}),
					walletDependencies: { initializeWallet },
				},
				schedule: (callback) => {
					expiry = callback;
					return "timer";
				},
				clearSchedule: () => {},
				terminate,
				lockTimeoutMs: 1,
			});
			expect(initializeWallet.mock.calls[0]?.[0].toHex()).toBe(
				expected.toHex(),
			);
			expect(initializeWallet.mock.calls[0]?.[0].toHex()).not.toBe(
				master.privKey.toHex(),
			);
			const retained = runtime.ctx.wallet;
			expect(await retained.getPublicKey({ identityKey: true })).toEqual({
				publicKey: expected.toPublicKey().toString(),
			});
			expiry();
			await new Promise((resolve) => setTimeout(resolve, 5));
			expect(terminate).toHaveBeenCalledTimes(1);
			expect(destroy).toHaveBeenCalledTimes(1);
			await expect(
				retained.getPublicKey({ identityKey: true }),
			).rejects.toThrow("Unlock");
			await runtime.cleanup();
		}
	},
);

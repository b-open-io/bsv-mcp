import { describe, expect, test } from "bun:test";
import { PrivateKey, ProtoWallet, type WalletInterface } from "@bsv/sdk";
import type { ProjectRoleBindings } from "./projectRoleBindings";
import {
	createProjectWalletRuntime,
	readProjectWalletConfig,
} from "./projectWalletRuntime";
import type { WalletInitResult } from "./walletInit";

const key = PrivateKey.fromHex("1");

function fixture() {
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
	const wallet = new ProtoWallet(key) as unknown as WalletInterface;
	const destroy = async () => {};
	const initializeWallet = async (): Promise<WalletInitResult> => ({
		wallet,
		ctx: { wallet } as WalletInitResult["ctx"],
		services: {} as WalletInitResult["services"],
		depositAddress: "synthetic-address",
		destroy,
	});
	return {
		config,
		controllerOptions: {
			loadBindings: async () => config,
			readSelectedAccount: () => ({
				chain: "test" as const,
				storageIdentityKey: "synthetic",
				depositPrefix: "mcp" as const,
			}),
			walletDependencies: { initializeWallet },
		},
		loadVaultModule: async () => ({
			PassphraseProvider: class {
				constructor(readonly passphrase: string) {}
			},
			openVault: async () => ({
				toDocument: () => ({ id: "vault" }),
				get: () => ({ kind: "private" }),
				reveal: () => key.toHex(),
				unlock: () => {},
				lock: () => {},
			}),
		}),
	};
}

describe("project wallet runtime", () => {
	test("requires paired stdio selectors and rejects legacy wallet selectors", () => {
		expect(() =>
			readProjectWalletConfig({ BSV_MCP_PROJECT_ROOT: "/tmp/project" }, [
				"--stdio",
			]),
		).toThrow("configured together");
		expect(() =>
			readProjectWalletConfig(
				{
					BSV_MCP_PROJECT_ROOT: "/tmp/project",
					BSV_MCP_PROJECT_ID: "project",
					TRANSPORT: "stdio",
					PRIVATE_KEY_WIF: "legacy",
				},
				[],
			),
		).toThrow("PRIVATE_KEY_WIF");
		expect(() =>
			readProjectWalletConfig(
				{
					BSV_MCP_PROJECT_ROOT: "/tmp/project",
					BSV_MCP_PROJECT_ID: "project",
					TRANSPORT: "http",
				},
				[],
			),
		).toThrow("stdio");
	});

	test("opens the payments role through a guarded context", async () => {
		const f = fixture();
		let expiry!: () => void;
		let cleared = false;
		const runtime = await createProjectWalletRuntime({
			env: {
				BSV_MCP_PROJECT_ROOT: "/explicit/project",
				BSV_MCP_PROJECT_ID: "project",
				BSV_MCP_PASSWORD: "runtime-secret",
				VAULT_PATH: "/synthetic/vault",
				TRANSPORT: "stdio",
			},
			argv: ["--stdio"],
			loadVaultModule: f.loadVaultModule,
			controllerOptions: f.controllerOptions,
			schedule: (callback) => {
				expiry = callback;
				return "timer";
			},
			clearSchedule: () => {
				cleared = true;
			},
			terminate: () => {},
		});
		expect(runtime.projectId).toBe("project");
		expect(runtime.depositAddress).toBe("synthetic-address");
		expect(JSON.stringify(runtime)).not.toContain("runtime-secret");
		expect(
			await runtime.ctx.wallet.getPublicKey({ identityKey: true }),
		).toEqual({ publicKey: key.toPublicKey().toString() });
		await runtime.cleanup();
		expect(cleared).toBe(true);
		expect(() => expiry()).not.toThrow();
	});

	test("locks before terminating when the project session expires", async () => {
		const f = fixture();
		let expiry!: () => void;
		let terminated = false;
		const runtime = await createProjectWalletRuntime({
			env: {
				BSV_MCP_PROJECT_ROOT: "/explicit/project",
				BSV_MCP_PROJECT_ID: "project",
				BSV_MCP_PASSWORD: "runtime-secret",
				VAULT_PATH: "/synthetic/vault",
				TRANSPORT: "stdio",
			},
			argv: ["--stdio"],
			loadVaultModule: f.loadVaultModule,
			controllerOptions: f.controllerOptions,
			schedule: (callback) => {
				expiry = callback;
				return "timer";
			},
			clearSchedule: () => {},
			terminate: () => {
				terminated = true;
			},
		});

		expiry();
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(terminated).toBe(true);
		await expect(
			runtime.ctx.wallet.getPublicKey({ identityKey: true }),
		).rejects.toThrow("Unlock the explicitly assigned project role first");
	});
});

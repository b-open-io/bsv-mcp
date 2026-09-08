import { expect, test } from "bun:test";
import {
	KeyDeriver,
	PrivateKey,
	ProtoWallet,
	type WalletInterface,
} from "@bsv/sdk";
import { Client } from "@modelcontextprotocol/client";
import {
	type CallToolResult,
	InMemoryTransport,
	McpServer,
} from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import * as vaultModule from "@opl.dev/vault";
import { registerWalletTools } from "../tools/wallet/tools";
import { McpApprovalFlow } from "./mcpApprovalFlow";
import { withMcpToolExecution } from "./mcpToolExecution";
import {
	PROJECT_KEY_ROLES,
	type ProjectKeyRole,
	type ProjectRoleBindings,
} from "./projectRoleBindings";
import { createProjectWalletRuntime } from "./projectWalletRuntime";
import type { WalletInitResult } from "./walletInit";

function textResult<T>(result: CallToolResult): T {
	if (result.isError) throw new Error(JSON.stringify(result.content));
	const first = result.content[0];
	if (first?.type !== "text") throw new Error("Expected JSON text result");
	return JSON.parse(first.text) as T;
}

test("project roles and BRC-42 children route real crypto through a modern MCP connection", async () => {
	const vault = new vaultModule.Vault(vaultModule.createVaultDocument());
	const expected = new Map<ProjectKeyRole, PrivateKey>();
	const keyFor = (role: ProjectKeyRole): PrivateKey => {
		const value = expected.get(role);
		if (!value) throw new Error(`Missing synthetic key for ${role}`);
		return value;
	};
	const config: ProjectRoleBindings = {
		schemaVersion: 1,
		projectId: "project-a",
		revision: 0,
		current: {
			payments: null,
			"identity-signing": null,
			"one-sat": null,
			encryption: null,
		},
		bindings: [],
		retained: [],
	};
	const leaf = {
		scheme: "brc42" as const,
		protocolID: [2, "project identity"] as [2, string],
		keyID: "project-a",
		counterparty: "self",
	};
	for (const [index, role] of PROJECT_KEY_ROLES.entries()) {
		const root = PrivateKey.fromHex(String(index + 1));
		const [entry] = vault.importPlain({ wif: root.toWif() }, role);
		if (!entry) throw new Error("Synthetic import failed");
		const key =
			role === "identity-signing"
				? new KeyDeriver(root).derivePrivateKey(
						leaf.protocolID,
						leaf.keyID,
						leaf.counterparty,
					)
				: root;
		expected.set(role, key);
		config.current[role] = role;
		config.bindings.push({
			bindingId: role,
			role,
			accountId: role,
			key: {
				vaultId: vault.toDocument().id,
				entryId: entry.id,
				expectedPublicKey: key.toPublicKey().toString(),
				...(role === "identity-signing" ? { derivation: leaf } : {}),
			},
			keyUseContract:
				role === "identity-signing" ? "brc42-leaf-v1" : "direct-v1",
			createdAt: "2026-09-08T00:00:00Z",
		});
	}
	const reads: string[] = [];
	const initialized: string[] = [];
	const runtime = await createProjectWalletRuntime({
		env: {
			BSV_MCP_PROJECT_ROOT: "/synthetic/project-a",
			BSV_MCP_PROJECT_ID: "project-a",
			TRANSPORT: "stdio",
			BSV_MCP_PASSWORD: "synthetic-passphrase",
			VAULT_PATH: "/synthetic/vault.bep",
		},
		argv: [],
		loadVaultModule: async () => ({
			...vaultModule,
			openVault: async () => vault,
		}),
		controllerOptions: {
			loadBindings: async () => config,
			readSelectedAccount: () => ({
				chain: "test",
				storageIdentityKey: "synthetic",
				depositPrefix: "mcp",
			}),
			walletDependencies: {
				initializeWallet: async (key, selection): Promise<WalletInitResult> => {
					initialized.push(key.toPublicKey().toString());
					const wallet = new ProtoWallet(key) as unknown as WalletInterface;
					wallet.listOutputs = async () => {
						reads.push(selection.binding.accountId);
						return { totalOutputs: 0, outputs: [] };
					};
					return {
						wallet,
						ctx: {
							wallet,
							chain: "test",
							isBaseWallet: true,
						} as WalletInitResult["ctx"],
						services: {} as WalletInitResult["services"],
						depositAddress: key.toAddress([0x6f]),
						destroy: async () => {},
					};
				},
			},
		},
	});
	const flow = new McpApprovalFlow();
	const [clientTransport, serverTransport] =
		InMemoryTransport.createLinkedPair();
	const handle = serveStdio(
		(context) => {
			const server = withMcpToolExecution(
				new McpServer({ name: "project-roles", version: "1" }),
				context.era,
				flow,
			);
			registerWalletTools(server, undefined, {
				ctx: runtime.ctx,
				roleContexts: runtime.roleContexts,
			});
			return server;
		},
		{ transport: serverTransport, legacy: "reject" },
	);
	const client = new Client(
		{ name: "project-client", version: "1" },
		{ versionNegotiation: { mode: "auto" } },
	);
	try {
		await client.connect(clientTransport);
		expect(initialized).toEqual(
			PROJECT_KEY_ROLES.map((role) => keyFor(role).toPublicKey().toString()),
		);
		for (const [walletRole, projectRole] of [
			["payments", "payments"],
			["identity", "identity-signing"],
			["ordinals", "one-sat"],
			["encryption", "encryption"],
		] as const) {
			const key = textResult<{ publicKey: string }>(
				await client.callTool({
					name: "wallet_getPublicKey",
					arguments: { identityKey: true, walletRole },
				}),
			);
			expect(key.publicKey).toBe(keyFor(projectRole).toPublicKey().toString());
		}
		const parameters = {
			protocolIDJSON: '[2,"application signing"]',
			keyID: "invoice-a",
			counterparty: "self",
			data: [1, 2, 3],
		};
		const signed = textResult<{ signature: number[] }>(
			await client.callTool({
				name: "wallet_createSignature",
				arguments: parameters,
			}),
		);
		const verifier = new ProtoWallet(keyFor("identity-signing"));
		expect(
			(
				await verifier.verifySignature({
					protocolID: [2, "application signing"],
					keyID: "invoice-a",
					counterparty: "self",
					data: [1, 2, 3],
					signature: signed.signature,
				})
			).valid,
		).toBe(true);
		const encrypted = textResult<{ ciphertext: number[] }>(
			await client.callTool({
				name: "wallet_encrypt",
				arguments: {
					protocolIDJSON: '[2,"project encryption"]',
					keyID: "secret-a",
					counterparty: "self",
					plaintext: [4, 5, 6],
				},
			}),
		);
		const decryptor = new ProtoWallet(keyFor("encryption"));
		expect(
			(
				await decryptor.decrypt({
					protocolID: [2, "project encryption"],
					keyID: "secret-a",
					counterparty: "self",
					ciphertext: encrypted.ciphertext,
				})
			).plaintext,
		).toEqual([4, 5, 6]);
		await client.callTool({
			name: "wallet_listOutputs",
			arguments: { basket: "1sat" },
		});
		await client.callTool({
			name: "wallet_listOutputs",
			arguments: { basket: "bap" },
		});
		await client.callTool({
			name: "wallet_listOutputs",
			arguments: { basket: "default" },
		});
		expect(reads).toEqual(["one-sat", "identity-signing", "payments"]);
		config.revision++;
		expect(
			(
				await client.callTool({
					name: "wallet_createSignature",
					arguments: parameters,
				})
			).isError,
		).toBe(true);
	} finally {
		await client.close();
		await handle.close();
		flow.close();
		await runtime.cleanup();
	}
});

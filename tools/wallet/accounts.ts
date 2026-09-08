import { existsSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { PrivateKey } from "@bsv/sdk";
import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { createAccount } from "../../utils/accountStore";
import {
	accountDir,
	accountName,
	accountNameSchema,
	listAccounts,
	newAccountConfig,
	readAccount,
	regularPath,
} from "../../utils/accounts";
import { errorToToolResult, successResult } from "../../utils/errors";
import { decodeEncryptedKeys } from "../../utils/keyManager";

export function registerAccountTools(server: McpServer) {
	const run = async (fn: () => Promise<unknown>) => {
		try {
			return successResult(await fn());
		} catch (error) {
			return errorToToolResult(error);
		}
	};
	const approve = async (message: string) => {
		if (!server.server.getClientCapabilities()?.elicitation)
			throw new Error(
				"Account changes require human approval. Use the corresponding bsv-mcp command in a local terminal.",
			);
		const response = await server.server.elicitInput({
			message,
			requestedSchema: {
				type: "object",
				properties: {
					approved: { type: "boolean", title: "Approve account change" },
				},
				required: ["approved"],
			},
		});
		if (response.action !== "accept" || response.content?.approved !== true)
			throw new Error("Account change declined");
	};
	server.registerTool(
		"wallet_list",
		{
			description:
				"List named local accounts by public address. Does not unlock wallets, reveal keys or contact a service.",
			inputSchema: z.object({}),
			annotations: { readOnlyHint: true, idempotentHint: true },
		},
		async () => run(async () => ({ accounts: listAccounts() })),
	);
	for (const importing of [false, true]) {
		server.registerTool(
			importing ? "wallet_import" : "wallet_generate",
			{
				description: importing
					? "Import an encrypted bitcoin-backup WIF account after human approval. Never provide a plaintext key or password. BSV_MCP_PASSWORD must already be configured locally; use the terminal wallet_import command for a WIF."
					: "Explicitly create a named encrypted account after human approval. Requires BSV_MCP_PASSWORD configured locally. Returns only its public address; back up keys.bep and config.json before funding.",
				inputSchema: z.object({
					name: accountNameSchema,
					chain: z.enum(["main", "test"]),
					...(importing
						? { encryptedBackup: z.string().max(1024 * 1024) }
						: {}),
				}),
			},
			async (input) =>
				run(async () => {
					const { name, chain } = input;
					const password = process.env.BSV_MCP_PASSWORD;
					if (!password || password.length < 8)
						throw new Error(
							"Configure BSV_MCP_PASSWORD locally or use bsv-mcp init in a terminal; do not send the password through MCP",
						);
					if (existsSync(accountDir(name)))
						throw new Error("Account already exists");
					await approve(
						`${importing ? "Import" : "Create"} account ${name} on ${chain}? Back up its encrypted keys and configuration before funding it.`,
					);
					const keys = importing
						? await decodeEncryptedKeys(String(input.encryptedBackup), password)
						: { payPk: PrivateKey.fromRandom() };
					if (!keys.payPk)
						throw new Error("Backup does not contain a payment key");
					const address = keys.payPk.toAddress(chain === "test" ? [0x6f] : [0]);
					await createAccount(
						name,
						keys,
						password,
						newAccountConfig(chain, address),
					);
					return { name, chain, address, backupRequired: true };
				}),
		);
	}
	server.registerTool(
		"wallet_use",
		{
			description:
				"Validate an account and give its restart configuration. Does not replace the wallet of a running session or modify client settings.",
			inputSchema: z.object({ name: accountNameSchema }),
			annotations: { readOnlyHint: true, idempotentHint: true },
		},
		async ({ name }) =>
			run(async () => {
				if (!readAccount(name)) throw new Error("Account is not initialized");
				return {
					account: name,
					restartRequired: true,
					environment: { BSV_MCP_ACCOUNT: name },
				};
			}),
	);
	server.registerTool(
		"wallet_remove",
		{
			description:
				"Remove a local account only with force, backup confirmation and human approval. Fund absence cannot be proven across all derived addresses. Cannot remove the active account; never sweeps funds.",
			inputSchema: z.object({
				name: accountNameSchema,
				force: z.boolean().default(false),
				backupConfirmed: z.boolean().default(false),
			}),
			annotations: { destructiveHint: true },
		},
		async ({ name, force, backupConfirmed }) =>
			run(async () => {
				if (name === accountName())
					throw new Error(
						"Cannot remove the active account; stop its server and use the terminal command",
					);
				if (!force || !backupConfirmed)
					throw new Error(
						"Removal requires force and a verified backup because remaining funds may exist",
					);
				if (!readAccount(name)) throw new Error("Account is not initialized");
				await approve(
					`Permanently remove local account ${name}? Confirm its encrypted keys and database have a verified backup; any remaining funds still require them.`,
				);
				const dir = accountDir(name);
				regularPath(dir, true);
				for (const file of readdirSync(dir)) regularPath(join(dir, file));
				rmSync(dir, { recursive: true });
				return { removed: name };
			}),
	);
}

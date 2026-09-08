import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import packageJson from "../../package.json";
import {
	configuredChain,
	explorerUrl,
	junglebusUrl,
	legacyOrdinalsUrl,
	onesatUrl,
} from "../../utils/backends";
import { successResult } from "../../utils/errors";
import type { ToolsConfig, VaultMigrationStatus } from "../index";

export function registerStatusTool(
	server: McpServer,
	config: ToolsConfig,
): void {
	server.registerTool(
		"bsv_status",
		{
			description:
				"Show server version, configured network, wallet availability, backend URLs, live 1Sat modules and any persistent Vault migration warning. Does not request keys, sign, sync or spend. Backend modules do not imply MCP tools or sponsor approval.",
			inputSchema: {
				checkServices: z
					.boolean()
					.default(true)
					.describe("Read the 1Sat capabilities endpoint (10 second timeout)"),
			},
			annotations: {
				readOnlyHint: true,
				idempotentHint: true,
				openWorldHint: true,
			},
		},
		async ({ checkServices }) => {
			const chain = config.ctx?.chain ?? configuredChain();
			const base =
				config.ctx?.services?.baseUrl ??
				config.services?.baseUrl ??
				onesatUrl(chain);
			let service: Record<string, unknown> = { status: "not_checked" };
			if (checkServices) {
				try {
					const response = await fetch(`${base}/1sat/capabilities`, {
						signal: AbortSignal.timeout(10_000),
						redirect: "error",
					});
					if (!response.ok)
						throw new Error(`1Sat capabilities: HTTP ${response.status}`);
					const capabilities: unknown = await response.json();
					if (
						!Array.isArray(capabilities) ||
						!capabilities.every((item) => typeof item === "string")
					)
						throw new Error(
							"1Sat capabilities: expected an array of module names",
						);
					service = { status: "reachable", capabilities };
				} catch (error) {
					service = {
						status: "unavailable",
						error: error instanceof Error ? error.message : String(error),
						nextStep:
							"Check ONESAT_API_URL, network access and the deployment's /1sat/capabilities route.",
					};
				}
			}
			const vaultMigration: VaultMigrationStatus = config.vaultMigration ?? {
				available: false,
				required: false,
				sources: 0,
				environmentKeys: { payment: false, identity: false },
				nextStep:
					"Local key migration status is unavailable in hosted mode; inspect the computer that runs BSV MCP.",
			};
			const data = {
				version: packageJson.version,
				chain,
				security: {
					vaultMigration,
					...(vaultMigration.required
						? {
								warning:
									"Vault migration is pending. Use vault-setup for a read-only inventory; import remains unavailable until Vault integration is enabled.",
							}
						: {}),
				},
				wallet: {
					available: Boolean(
						config.ctx || config.wallet || config.integratedWallet,
					),
					mode: process.env.BRC100_WALLET_URL
						? "external_signer"
						: config.integratedWallet?.isDroplitMode
							? "droplit"
							: config.ctx || config.wallet
								? "local"
								: "none",
				},
				broadcastingDisabled:
					config.disableBroadcasting === true ||
					process.env.DISABLE_BROADCASTING === "true",
				backends: {
					onesat: base,
					explorer: explorerUrl(chain),
					junglebus: junglebusUrl(),
					legacyOrdinals: legacyOrdinalsUrl(),
				},
				service,
			};
			return { ...successResult(data), structuredContent: data };
		},
	);
}

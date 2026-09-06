import type { OneSatContext } from "@1sat/actions";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
	RevelationError,
	revealDelegation,
} from "../../utils/revealDelegation";
import { createSuccessResponse } from "../utils/errorHandler";

export function registerRevealDelegationTool(
	server: McpServer,
	ctx?: OneSatContext,
) {
	server.registerTool(
		"wallet_revealDelegation",
		{
			description:
				"Receive the human owner's BRC-169 certificate handoff, acquire and prove it with this connected agent wallet, and reveal its restrictions to the specified Sigma verifier. Imports a certificate and activates its existing delegation. Never pays, broadcasts, follows redirects, or retries an ambiguous POST. The subject keyring stays with the wallet.",
			inputSchema: {
				sigmaOrigin: z
					.string()
					.max(2048)
					.describe(
						"Explicit Sigma HTTPS origin, or HTTP loopback for local testing",
					),
				handoffJSON: z
					.string()
					.max(131072)
					.describe(
						"JSON package copied by the owner: certificate, subjectKeyring, revealTo, revelationPath",
					),
			},
			annotations: {
				readOnlyHint: false,
				destructiveHint: false,
				idempotentHint: false,
				openWorldHint: true,
			},
		},
		async ({ sigmaOrigin, handoffJSON }) => {
			try {
				if (!ctx)
					throw new RevelationError(
						"wallet_unavailable",
						"Connect the agent's existing wallet first.",
					);
				const data = await revealDelegation(
					ctx.wallet,
					sigmaOrigin,
					handoffJSON,
				);
				return { ...createSuccessResponse(data), structuredContent: data };
			} catch (error) {
				const failure =
					error instanceof RevelationError
						? error
						: new RevelationError(
								"revelation_failed",
								"Delegation revelation failed. Check wallet and owner status before retrying.",
							);
				const data = {
					error: failure.code,
					message: failure.message,
					...(failure.status === undefined ? {} : { status: failure.status }),
				};
				return {
					...createSuccessResponse(data),
					structuredContent: data,
					isError: true,
				};
			}
		},
	);
}

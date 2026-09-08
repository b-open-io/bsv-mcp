import { PrivateKey } from "@bsv/sdk";
import type { McpServer, ServerContext } from "@modelcontextprotocol/server";
import type { MneeInterface } from "mnee";
import { z } from "zod";

export const getBalanceArgsSchema = z.object({});

export type GetBalanceArgs = z.infer<typeof getBalanceArgsSchema>;

export function registerGetBalanceTool(
	server: McpServer,
	mnee: MneeInterface,
): void {
	server.registerTool(
		"mnee_getBalance",
		{
			description:
				"Retrieves the current MNEE token balance for the wallet. Returns the balance in MNEE tokens.",
			inputSchema: z.object({}),
		},
		async (_params, _extra: ServerContext) => {
			try {
				// Get private key from wallet
				const privateKeyWif = process.env.PRIVATE_KEY_WIF;
				if (!privateKeyWif) {
					throw new Error(
						"Private key WIF not available in environment variables",
					);
				}
				const privateKey = PrivateKey.fromWif(privateKeyWif);
				if (!privateKey) {
					throw new Error("No private key available");
				}

				const address = privateKey.toAddress().toString();
				const balance = await mnee.balance(address);

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify({ balance }, null, 2),
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{
							type: "text",
							text: error instanceof Error ? error.message : String(error),
						},
					],
					isError: true,
				};
			}
		},
	);
}

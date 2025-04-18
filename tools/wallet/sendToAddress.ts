import { P2PKH } from "@bsv/sdk";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { toSatoshi } from "satoshi-token";
import type { z } from "zod";
import { getBsvPriceWithCache } from "../bsv/getPrice";
import { sendToAddressArgsSchema } from "./schemas";
import type { Wallet } from "./wallet";

// Use the schema imported from schemas.ts
export type SendToAddressArgs = z.infer<typeof sendToAddressArgsSchema>;

/**
 * Register the sendToAddress tool
 */
export function registerSendToAddressTool(server: McpServer, wallet: Wallet) {
	server.tool(
		"wallet_sendToAddress",
		"Sends Bitcoin SV (BSV) to a specified address. This tool supports payments in both BSV and USD amounts (with automatic conversion using current exchange rates). Transaction fees are automatically calculated and a confirmation with transaction ID is returned upon success.",
		{
			args: sendToAddressArgsSchema,
		},
		async (
			{ args }: { args: SendToAddressArgs },
			extra: RequestHandlerExtra,
		) => {
			try {
				const {
					address,
					amount,
					currency = "BSV",
					description = "Send to address",
				} = args;

				// Convert to satoshis
				let satoshis: number;
				if (currency === "USD") {
					// Get current BSV price
					const bsvPriceUsd = await getBsvPriceWithCache();

					// Convert USD to BSV
					const bsvAmount = amount / bsvPriceUsd;

					// Convert BSV to satoshis using the library
					satoshis = toSatoshi(bsvAmount);
				} else {
					// Convert BSV to satoshis using the library
					satoshis = toSatoshi(amount);
				}

				// Create P2PKH script from address
				const lockingScript = new P2PKH().lock(address);

				// Create the transaction
				const tx = await wallet.createAction({
					description,
					outputs: [
						{
							lockingScript: lockingScript.toHex(),
							satoshis,
							outputDescription: `Payment to ${address}`,
						},
					],
				});

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify({
								status: "success",
								txid: tx.txid,
								satoshis,
							}),
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

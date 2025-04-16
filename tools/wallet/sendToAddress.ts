import { P2PKH } from "@bsv/sdk";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { toSatoshi } from "satoshi-token";
import type { z } from "zod";
import { sendToAddressArgsSchema } from "./schemas";
import type { Wallet } from "./wallet";

/**
 * Fetch the current BSV price from whatsonchain API
 * @returns The BSV price in USD
 */
async function getBsvPrice(): Promise<number> {
	try {
		const res = await fetch(
			"https://api.whatsonchain.com/v1/bsv/main/exchangerate",
		);
		if (!res.ok) throw new Error("Failed to fetch BSV price");

		// Parse the response with proper type casting
		const data = (await res.json()) as {
			rate: string;
			currency: string;
			time: number;
		};
		const price = Number(data.rate);

		if (Number.isNaN(price) || price <= 0) throw new Error("Invalid BSV price");
		return price;
	} catch (error) {
		console.error("BSV price fetch error:", error);
		throw error;
	}
}

// Use the schema imported from schemas.ts
export type SendToAddressArgs = z.infer<typeof sendToAddressArgsSchema>;

/**
 * Register the sendToAddress tool
 */
export function registerSendToAddressTool(server: McpServer, wallet: Wallet) {
	server.tool(
		"wallet_sendToAddress",
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
					const bsvPriceUsd = await getBsvPrice();
					
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

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// Define cache duration (5 minutes in milliseconds)
const PRICE_CACHE_DURATION = 5 * 60 * 1000;

// Cache object to store price data
let cachedPrice: { value: number; timestamp: number } | null = null;

/**
 * Get the BSV price with caching mechanism
 * @returns The current BSV price in USD
 */
async function getBsvPriceWithCache(): Promise<number> {
	// Return cached price if it's still valid
	if (
		cachedPrice &&
		Date.now() - cachedPrice.timestamp < PRICE_CACHE_DURATION
	) {
		return cachedPrice.value;
	}

	// If no valid cache, fetch new price
	const res = await fetch(
		"https://api.whatsonchain.com/v1/bsv/main/exchangerate",
	);
	if (!res.ok) throw new Error("Failed to fetch price");

	const data = (await res.json()) as {
		currency: string;
		rate: string;
		time: number;
	};

	const price = Number(data.rate);
	if (Number.isNaN(price) || price <= 0)
		throw new Error("Invalid price received");

	// Update cache
	cachedPrice = {
		value: price,
		timestamp: Date.now(),
	};

	return price;
}

/**
 * Register the BSV price lookup tool
 * @param server The MCP server instance
 */
export function registerGetPriceTool(server: McpServer): void {
	server.tool(
		"bsv_getPrice",
		"Retrieves the current price of Bitcoin SV (BSV) in USD from a reliable exchange API. This tool provides real-time market data that can be used for calculating transaction values, monitoring market conditions, or converting between BSV and fiat currencies.",
		{
			args: z
				.object({})
				.optional()
				.describe(
					"No parameters required - simply returns the current BSV price in USD",
				),
		},
		async () => {
			try {
				const price = await getBsvPriceWithCache();
				return {
					content: [
						{
							type: "text",
							text: `Current BSV price: $${price.toFixed(2)} USD`,
						},
					],
				};
			} catch (err) {
				return {
					content: [{ type: "text", text: "Error fetching BSV price." }],
					isError: true,
				};
			}
		},
	);
}

// Export the cached price getter for use in other modules
export { getBsvPriceWithCache };

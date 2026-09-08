import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { explorerFetch, explorerUrl } from "../../utils/backends";

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
	const res = await explorerFetch(`${explorerUrl("main")}/exchangerate`, {
		signal: AbortSignal.timeout(10_000),
	});
	if (!res.ok) throw new Error("Failed to fetch price");

	const data = (await res.json()) as {
		currency: string;
		rate: string;
		time: number;
	};

	const price = Number(data.rate);
	if (!Number.isFinite(price) || price <= 0)
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
	server.registerTool(
		"bsv_getPrice",
		{
			description:
				"Retrieves the current price of Bitcoin SV (BSV) in USD from a reliable exchange API. This tool provides real-time market data that can be used for calculating transaction values, monitoring market conditions, or converting between BSV and fiat currencies.",
			inputSchema: z.object({}),
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
			} catch {
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

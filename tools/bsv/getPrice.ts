import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

/**
 * Register the BSV price lookup tool
 * @param server The MCP server instance
 */
export function registerGetPriceTool(server: McpServer): void {
	server.tool(
		"bsv_getPrice",
		"Retrieves the current price of Bitcoin SV (BSV) in USD from a reliable exchange API. This tool provides real-time market data that can be used for calculating transaction values, monitoring market conditions, or converting between BSV and fiat currencies.",
		{
			args: z.object({}).optional().describe("No parameters required - simply returns the current BSV price in USD"),
		},
		async () => {
			try {
				const res = await fetch(
					"https://api.whatsonchain.com/v1/bsv/main/exchangerate",
				);
				if (!res.ok) throw new Error("Failed to fetch price");
				const data = (await res.json()) as {
					currency: string;
					rate: string;
					time: number;
				};
				const price = data.rate;
				if (typeof price !== "string" && typeof price !== "number")
					throw new Error("Price not found");
				return {
					content: [
						{
							type: "text",
							text: `Current BSV price: $${Number(price).toFixed(2)} USD`,
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

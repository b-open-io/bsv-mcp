import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

/**
 * Register the BSV price lookup tool
 * @param server The MCP server instance
 */
export function registerGetPriceTool(server: McpServer): void {
	server.tool(
		"bsv_getPrice",
		{
			args: z.object({}).optional(),
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

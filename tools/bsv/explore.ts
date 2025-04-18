import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// Base URL for WhatsOnChain API
const WOC_API_BASE_URL = "https://api.whatsonchain.com/v1/bsv";

/**
 * WhatsOnChain API endpoints available for exploration
 */
enum ExploreEndpoint {
	// Chain endpoints
	CHAIN_INFO = "chain_info",
	CHAIN_TIPS = "chain_tips",
	CIRCULATING_SUPPLY = "circulating_supply",
	PEER_INFO = "peer_info",

	// Block endpoints
	BLOCK_BY_HASH = "block_by_hash",
	BLOCK_BY_HEIGHT = "block_by_height",
	BLOCK_HEADERS = "block_headers",
	BLOCK_PAGES = "block_pages",

	// Stats endpoints
	TAG_COUNT_BY_HEIGHT = "tag_count_by_height",
	BLOCK_STATS_BY_HEIGHT = "block_stats_by_height",
	BLOCK_MINER_STATS = "block_miner_stats",
	MINER_SUMMARY_STATS = "miner_summary_stats",

	// Transaction endpoints
	TX_BY_HASH = "tx_by_hash",
	TX_RAW = "tx_raw",
	TX_RECEIPT = "tx_receipt",
	BULK_TX_DETAILS = "bulk_tx_details",
	ADDRESS_HISTORY = "address_history",
	ADDRESS_UTXOS = "address_utxos",

	// Health endpoint
	HEALTH = "health",
}

enum Network {
	MAIN = "main",
	TEST = "test",
}

// Schema for the bsv_explore tool arguments
const exploreArgsSchema = z.object({
	endpoint: z
		.nativeEnum(ExploreEndpoint)
		.describe("WhatsOnChain API endpoint to call"),
	network: z
		.nativeEnum(Network)
		.default(Network.MAIN)
		.describe("Network to use (main or test)"),

	// Parameters for specific endpoints
	blockHash: z
		.string()
		.optional()
		.describe("Block hash (required for block_by_hash endpoint)"),
	blockHeight: z
		.number()
		.optional()
		.describe(
			"Block height (required for block_by_height and block_stats_by_height endpoints)",
		),
	txHash: z
		.string()
		.optional()
		.describe(
			"Transaction hash (required for tx_by_hash, tx_raw, and tx_receipt endpoints)",
		),
	txids: z
		.array(z.string())
		.optional()
		.describe("Array of transaction IDs for bulk_tx_details endpoint"),
	address: z
		.string()
		.optional()
		.describe(
			"Bitcoin address (required for address_history and address_utxos endpoints)",
		),
	limit: z
		.number()
		.optional()
		.describe("Limit for paginated results (optional for address_history)"),
	pageNumber: z
		.number()
		.optional()
		.describe("Page number for block_pages endpoint (defaults to 1)"),
	days: z
		.number()
		.optional()
		.describe("Number of days for miner stats endpoints (defaults to 7)"),
});

// Type for the tool arguments
type ExploreArgs = z.infer<typeof exploreArgsSchema>;

/**
 * Register the bsv_explore tool with the MCP server
 * @param server The MCP server instance
 */
export function registerExploreTool(server: McpServer): void {
	server.tool(
		"bsv_explore",
		"Explore Bitcoin SV blockchain data using the WhatsOnChain API. Access multiple data types:\n\n" +
			"CHAIN DATA:\n" +
			"- chain_info: Network stats, difficulty, and chain work\n" +
			"- chain_tips: Current chain tips including heights and states\n" +
			"- circulating_supply: Current BSV circulating supply\n" +
			"- peer_info: Connected peer statistics\n\n" +
			"BLOCK DATA:\n" +
			"- block_by_hash: Complete block data via hash (requires blockHash parameter)\n" +
			"- block_by_height: Complete block data via height (requires blockHeight parameter)\n" +
			"- tag_count_by_height: Stats on tag count for a specific block via height (requires blockHeight parameter)\n" +
			"- block_headers: Retrieves the last 10 block headers\n" +
			"- block_pages: Retrieves pages of transaction IDs for large blocks (requires blockHash and optional pageNumber)\n\n" +
			"STATS DATA:\n" +
			"- block_stats_by_height: Block statistics for a specific height (requires blockHeight parameter)\n" +
			"- block_miner_stats: Block mining statistics for a time period (optional days parameter, default 7)\n" +
			"- miner_summary_stats: Summary of mining statistics (optional days parameter, default 7)\n\n" +
			"TRANSACTION DATA:\n" +
			"- tx_by_hash: Detailed transaction data (requires txHash parameter)\n" +
			"- tx_raw: Raw transaction hex data (requires txHash parameter)\n" +
			"- tx_receipt: Transaction receipt (requires txHash parameter)\n" +
			"- bulk_tx_details: Bulk transaction details (requires txids parameter as array of transaction hashes)\n\n" +
			"ADDRESS DATA:\n" +
			"- address_history: Transaction history for address (requires address parameter, optional limit)\n" +
			"- address_utxos: Unspent outputs for address (requires address parameter)\n\n" +
			"NETWORK:\n" +
			"- health: API health check\n\n" +
			"Use the appropriate parameters for each endpoint type and specify 'main' or 'test' network.",
		{ args: exploreArgsSchema },
		async ({ args }) => {
			try {
				const params = exploreArgsSchema.parse(args);

				// Validate required parameters for specific endpoints
				if (
					params.endpoint === ExploreEndpoint.BLOCK_BY_HASH &&
					!params.blockHash
				) {
					throw new Error("blockHash is required for block_by_hash endpoint");
				}

				if (
					(params.endpoint === ExploreEndpoint.BLOCK_BY_HEIGHT ||
						params.endpoint === ExploreEndpoint.TAG_COUNT_BY_HEIGHT) &&
					params.blockHeight === undefined
				) {
					throw new Error(
						"blockHeight is required for block_by_height and tag_count_by_height endpoints",
					);
				}

				if (
					[
						ExploreEndpoint.TX_BY_HASH,
						ExploreEndpoint.TX_RAW,
						ExploreEndpoint.TX_RECEIPT,
					].includes(params.endpoint) &&
					!params.txHash
				) {
					throw new Error("txHash is required for transaction endpoints");
				}

				if (
					[
						ExploreEndpoint.ADDRESS_HISTORY,
						ExploreEndpoint.ADDRESS_UTXOS,
					].includes(params.endpoint) &&
					!params.address
				) {
					throw new Error("address is required for address endpoints");
				}

				if (
					params.endpoint === ExploreEndpoint.BLOCK_PAGES &&
					!params.blockHash
				) {
					throw new Error("blockHash is required for block_pages endpoint");
				}

				if (
					params.endpoint === ExploreEndpoint.BLOCK_STATS_BY_HEIGHT &&
					params.blockHeight === undefined
				) {
					throw new Error(
						"blockHeight is required for block_stats_by_height endpoint",
					);
				}

				if (
					params.endpoint === ExploreEndpoint.BULK_TX_DETAILS &&
					(!params.txids || params.txids.length === 0)
				) {
					throw new Error(
						"txids array is required for bulk_tx_details endpoint",
					);
				}

				// Build API URL based on the selected endpoint
				let apiUrl = `${WOC_API_BASE_URL}/${params.network}`;

				switch (params.endpoint) {
					case ExploreEndpoint.CHAIN_INFO:
						apiUrl += "/chain/info";
						break;
					case ExploreEndpoint.CHAIN_TIPS:
						apiUrl += "/chain/tips";
						break;
					case ExploreEndpoint.CIRCULATING_SUPPLY:
						apiUrl += "/circulatingsupply";
						break;
					case ExploreEndpoint.PEER_INFO:
						apiUrl += "/peer/info";
						break;
					case ExploreEndpoint.BLOCK_BY_HASH:
						apiUrl += `/block/hash/${params.blockHash}`;
						break;
					case ExploreEndpoint.BLOCK_BY_HEIGHT:
						apiUrl += `/block/height/${params.blockHeight}`;
						break;
					case ExploreEndpoint.TAG_COUNT_BY_HEIGHT:
						apiUrl += `/block/tagcount/height/${params.blockHeight}/stats`;
						break;
					case ExploreEndpoint.BLOCK_HEADERS:
						apiUrl += "/block/headers";
						break;
					case ExploreEndpoint.BLOCK_PAGES: {
						const pageNumber = params.pageNumber || 1;
						apiUrl += `/block/hash/${params.blockHash}/page/${pageNumber}`;
						break;
					}
					case ExploreEndpoint.BLOCK_STATS_BY_HEIGHT:
						apiUrl += `/block/height/${params.blockHeight}/stats`;
						break;
					case ExploreEndpoint.BLOCK_MINER_STATS: {
						const days = params.days !== undefined ? params.days : 7;
						apiUrl += `/miner/blocks/stats?days=${days}`;
						break;
					}
					case ExploreEndpoint.MINER_SUMMARY_STATS: {
						const days = params.days !== undefined ? params.days : 7;
						apiUrl += `/miner/summary/stats?days=${days}`;
						break;
					}
					case ExploreEndpoint.TX_BY_HASH:
						apiUrl += `/tx/hash/${params.txHash}`;
						break;
					case ExploreEndpoint.TX_RAW:
						apiUrl += `/tx/${params.txHash}/hex`;
						break;
					case ExploreEndpoint.TX_RECEIPT:
						apiUrl += `/tx/${params.txHash}/receipt`;
						break;
					case ExploreEndpoint.BULK_TX_DETAILS:
						apiUrl += "/txs";
						break;
					case ExploreEndpoint.ADDRESS_HISTORY:
						apiUrl += `/address/${params.address}/history`;
						if (params.limit !== undefined) {
							apiUrl += `?limit=${params.limit}`;
						}
						break;
					case ExploreEndpoint.ADDRESS_UTXOS:
						apiUrl += `/address/${params.address}/unspent`;
						break;
					case ExploreEndpoint.HEALTH:
						apiUrl += "/woc";
						break;
					default:
						throw new Error(`Unsupported endpoint: ${params.endpoint}`);
				}

				// Special handling for bulk_tx_details which requires a POST request
				if (params.endpoint === ExploreEndpoint.BULK_TX_DETAILS) {
					const response = await fetch(apiUrl, {
						method: "POST",
						headers: {
							"Content-Type": "application/json",
						},
						body: JSON.stringify({ txids: params.txids }),
					});

					if (!response.ok) {
						let errorMsg = `API error: ${response.status} ${response.statusText}`;
						if (response.status === 404) {
							errorMsg += " - One or more transaction IDs not found";
						}
						throw new Error(errorMsg);
					}

					const result = await response.json();

					return {
						content: [
							{
								type: "text",
								text: JSON.stringify(result, null, 2),
							},
						],
					};
				}

				// For all other endpoints, use GET request
				const response = await fetch(apiUrl);
				if (!response.ok) {
					let errorMsg = `API error: ${response.status} ${response.statusText}`;
					// Provide helpful tips for specific error codes
					if (response.status === 404) {
						switch (params.endpoint) {
							case ExploreEndpoint.BLOCK_BY_HASH:
								errorMsg += ` - Block hash "${params.blockHash}" not found`;
								break;
							case ExploreEndpoint.BLOCK_BY_HEIGHT:
								errorMsg += ` - Block at height ${params.blockHeight} not found`;
								break;
							case ExploreEndpoint.BLOCK_PAGES:
								errorMsg += ` - Block hash "${params.blockHash}" not found or page ${params.pageNumber || 1} does not exist`;
								break;
							case ExploreEndpoint.TX_BY_HASH:
							case ExploreEndpoint.TX_RAW:
							case ExploreEndpoint.TX_RECEIPT:
								errorMsg += ` - Transaction hash "${params.txHash}" not found`;
								break;
							case ExploreEndpoint.ADDRESS_HISTORY:
							case ExploreEndpoint.ADDRESS_UTXOS:
								errorMsg += ` - No data found for address "${params.address}"`;
								break;
						}
					}
					throw new Error(errorMsg);
				}

				const result = await response.json();

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(result, null, 2),
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{
							type: "text",
							text: `Error: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
					isError: true,
				};
			}
		},
	);
}

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

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
  
  // Transaction endpoints
  TX_BY_HASH = "tx_by_hash",
  TX_RAW = "tx_raw",
  TX_RECEIPT = "tx_receipt",
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
  endpoint: z.nativeEnum(ExploreEndpoint).describe("WhatsOnChain API endpoint to call"),
  network: z.nativeEnum(Network).default(Network.MAIN).describe("Network to use (main or test)"),
  
  // Parameters for specific endpoints
  blockHash: z.string().optional().describe("Block hash (required for block_by_hash endpoint)"),
  blockHeight: z.number().optional().describe("Block height (required for block_by_height endpoint)"),
  txHash: z.string().optional().describe("Transaction hash (required for tx_by_hash, tx_raw, and tx_receipt endpoints)"),
  address: z.string().optional().describe("Bitcoin address (required for address_history and address_utxos endpoints)"),
  limit: z.number().optional().describe("Limit for paginated results (optional for address_history)"),
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
    "- block_by_height: Complete block data via height (requires blockHeight parameter)\n\n" +
    "TRANSACTION DATA:\n" +
    "- tx_by_hash: Detailed transaction data (requires txHash parameter)\n" +
    "- tx_raw: Raw transaction hex data (requires txHash parameter)\n" +
    "- tx_receipt: Transaction receipt (requires txHash parameter)\n\n" +
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
        if (params.endpoint === ExploreEndpoint.BLOCK_BY_HASH && !params.blockHash) {
          throw new Error("blockHash is required for block_by_hash endpoint");
        }
        
        if (params.endpoint === ExploreEndpoint.BLOCK_BY_HEIGHT && params.blockHeight === undefined) {
          throw new Error("blockHeight is required for block_by_height endpoint");
        }

        if ([ExploreEndpoint.TX_BY_HASH, ExploreEndpoint.TX_RAW, ExploreEndpoint.TX_RECEIPT].includes(params.endpoint) && !params.txHash) {
          throw new Error("txHash is required for transaction endpoints");
        }

        if ([ExploreEndpoint.ADDRESS_HISTORY, ExploreEndpoint.ADDRESS_UTXOS].includes(params.endpoint) && !params.address) {
          throw new Error("address is required for address endpoints");
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
          case ExploreEndpoint.TX_BY_HASH:
            apiUrl += `/tx/hash/${params.txHash}`;
            break;
          case ExploreEndpoint.TX_RAW:
            apiUrl += `/tx/${params.txHash}/hex`;
            break;
          case ExploreEndpoint.TX_RECEIPT:
            apiUrl += `/tx/${params.txHash}/receipt`;
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
        
        // Make the API request
        const response = await fetch(apiUrl);
        if (!response.ok) {
          throw new Error(`API error: ${response.status} ${response.statusText}`);
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
              text: `Error: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true,
        };
      }
    }
  );
} 
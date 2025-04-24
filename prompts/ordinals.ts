import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type {
	ServerNotification,
	ServerRequest,
} from "@modelcontextprotocol/sdk/types.js";

/**
 * 1Sat Ordinals Prompt
 *
 * Provides comprehensive information about Bitcoin SV ordinals,
 * including what they are, how they work, and how to use them.
 */
export const ORDINALS_PROMPT = `
# 1Sat Ordinals - Comprehensive Guide

Ordinals are a way to uniquely identify and track specific satoshis (the smallest unit of Bitcoin) 
on the blockchain. This concept allows for "inscriptions" - embedding data directly into a satoshi, 
effectively creating NFT-like functionality native to the Bitcoin protocol.

## Key Concepts

1. **Ordinal Theory**: Each satoshi has a unique position in the Bitcoin ledger, determined by the order 
   in which they were mined.

2. **Inscriptions**: Content embedded directly into a specific satoshi. Can be any valid content type.

3. **On-chain Storage**: All ordinal data is stored immutably on the blockchain.

## BSV Ordinals (1Sat Ordinals) vs. BTC Ordinals

- 1Sat Ordinals leverage the larger block sizes and lower fees of Bitcoin SV, making them more practical
  for storing meaningful data and media.
  
- 1Sat Ordinals can store much larger inscriptions compared to BTC, enabling richer media and applications.

- 1Sat Ordinals typically cost a fraction of what BTC ordinals cost to create and transfer.

## Creating Ordinals

To create a BSV ordinal:

1. Choose the content to inscribe (image, text, audio, etc.)
2. Use a compatible wallet or service that supports ordinal creation
3. Pay the transaction fee to inscribe your content on-chain
4. Receive a unique ordinal ID that references your specific satoshi

## Transferring Ordinals

Ordinals are transferred by sending the specific satoshi that contains the inscription. Compatible wallets
ensure that when you transfer an ordinal, the specific satoshi containing the inscription is included in
the transaction.

## Viewing Ordinals

Ordinal inscriptions can be viewed through:

1. Specialized ordinal explorers
2. Compatible wallets with ordinal support
3. Marketplaces that support BSV ordinals

## Use Cases

- Digital Art and Collectibles
- Certificates of Authenticity
- Domain Names
- Documentation and Verification
- Gaming Assets
- Media Distribution

## Best Practices

- Verify file sizes and transaction costs before inscribing
- Use appropriate file formats optimized for on-chain storage
- Keep private keys secure to maintain ownership of valuable ordinals
- Consider using a specialized wallet for managing valuable ordinal collections

For technical implementation details, refer to the official documentation and BSV ordinals standards.
`;

/**
 * Register the Ordinals prompt with the MCP server
 * @param server The MCP server instance
 */
export function registerOrdinalsPrompt(server: McpServer): void {
	server.prompt(
		"bitcoin_sv_ordinals",
		"Comprehensive information about Bitcoin SV ordinals, including what they are, how they work, and how to use them.",
		async (extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
			return {
				messages: [
					{
						role: "assistant",
						content: {
							type: "text",
							text: ORDINALS_PROMPT,
						},
					},
				],
			};
		},
	);
}

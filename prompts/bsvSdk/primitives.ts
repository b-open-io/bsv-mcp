import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type {
	ServerNotification,
	ServerRequest,
} from "@modelcontextprotocol/sdk/types.js";

/**
 * BSV SDK Primitives Prompt
 *
 * Provides detailed information about the primitive data types and structures in the BSV SDK,
 * including Binary, Hex, Points, and other fundamental types.
 */
export const BSV_SDK_PRIMITIVES_PROMPT = `
# BSV SDK - Primitives Module

The Primitives module in the BSV SDK provides fundamental data types and structures that form the building blocks for working with Bitcoin transactions and blockchain data.

## Core Primitive Types

This section includes a placeholder for detailed content about the primitive types available in the BSV SDK.

## Key Primitives

- Binary data handling
- Hex string conversion
- Point and curve operations
- Bitcoin-specific data structures
- Network message formats

## Common Operations

- Serialization and deserialization
- Type conversion
- Data validation
- Encoding and decoding

## Best Practices

1. **Type Safety**: Use appropriate types for Bitcoin operations
2. **Validation**: Validate input data before processing
3. **Performance**: Consider performance implications when working with large data structures

For complete API documentation and additional information about primitives, refer to the official BSV SDK documentation.
`;

/**
 * Register the BSV SDK Primitives prompt with the MCP server
 * @param server The MCP server instance
 */
export function registerPrimitivesPrompt(server: McpServer): void {
	server.prompt(
		"bitcoin_sv_sdk_primitives",
		"Detailed information about the primitive data types and structures in the BSV SDK, including Binary, Hex, Points, and other fundamental types.",
		async (extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
			return {
				messages: [
					{
						role: "assistant",
						content: {
							type: "text",
							text: BSV_SDK_PRIMITIVES_PROMPT,
						},
					},
				],
			};
		},
	);
}

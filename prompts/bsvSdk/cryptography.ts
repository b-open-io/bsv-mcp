import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type {
	ServerNotification,
	ServerRequest,
} from "@modelcontextprotocol/sdk/types.js";

/**
 * BSV SDK Cryptography Prompt
 *
 * Provides detailed information about the cryptographic functionality in the BSV SDK,
 * including key generation, signing, encryption, and hashing.
 */
export const BSV_SDK_CRYPTOGRAPHY_PROMPT = `
# BSV SDK - Cryptography Module

The Cryptography module in the BSV SDK provides comprehensive tools for handling cryptographic operations required for secure Bitcoin transactions and applications.

## Key Cryptographic Operations

This section includes a placeholder for detailed content about the BSV SDK cryptographic operations.

## Core Features

- Key generation and management
- Digital signatures (ECDSA)
- Message signing and verification
- Encryption and decryption
- Hash functions (SHA-256, RIPEMD-160, etc.)

## Best Practices

1. **Key Security**: Always handle private keys securely
2. **Random Number Generation**: Use cryptographically secure random number generation
3. **Testing**: Verify cryptographic operations with known test vectors

For complete API documentation and additional cryptographic features, refer to the official BSV SDK documentation.
`;

/**
 * Register the BSV SDK Cryptography prompt with the MCP server
 * @param server The MCP server instance
 */
export function registerCryptographyPrompt(server: McpServer): void {
	server.prompt(
		"bitcoin_sv_sdk_cryptography",
		"Detailed information about the cryptographic functionality in the BSV SDK, including key generation, signing, encryption, and hashing.",
		async (extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
			return {
				messages: [
					{
						role: "assistant",
						content: {
							type: "text",
							text: BSV_SDK_CRYPTOGRAPHY_PROMPT,
						},
					},
				],
			};
		},
	);
}

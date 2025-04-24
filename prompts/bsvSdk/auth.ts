import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type {
	ServerNotification,
	ServerRequest,
} from "@modelcontextprotocol/sdk/types.js";

/**
 * BSV SDK Authentication Prompt
 *
 * Provides detailed information about the authentication functionality in the BSV SDK,
 * including identity protocols, certificates, and session management.
 */
export const BSV_SDK_AUTH_PROMPT = `
# BSV SDK - Authentication Module

The Authentication module in the BSV SDK provides robust mechanisms for identity management, peer authentication, and certificate handling on the Bitcoin SV blockchain.

## Key Components

This section includes a placeholder for detailed content about the BSV SDK authentication mechanisms.

## Core Features

- Identity management
- Certificate handling
- Peer authentication
- Session management

## Best Practices

1. **Security**: Follow best practices for authentication security
2. **Testing**: Test authentication flows thoroughly before production use
3. **Error Handling**: Implement proper error handling

For complete API documentation and additional authentication features, refer to the official BSV SDK documentation.
`;

/**
 * Register the BSV SDK Authentication prompt with the MCP server
 * @param server The MCP server instance
 */
export function registerAuthPrompt(server: McpServer): void {
	server.prompt(
		"bitcoin_sv_sdk_auth",
		"Detailed information about the authentication functionality in the BSV SDK, including identity protocols, certificates, and session management.",
		async (extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
			return {
				messages: [
					{
						role: "assistant",
						content: {
							type: "text",
							text: BSV_SDK_AUTH_PROMPT,
						},
					},
				],
			};
		},
	);
}

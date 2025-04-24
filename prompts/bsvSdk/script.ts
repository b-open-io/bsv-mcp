import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type {
	ServerNotification,
	ServerRequest,
} from "@modelcontextprotocol/sdk/types.js";

/**
 * BSV SDK Script Prompt
 *
 * Provides detailed information about the script functionality in the BSV SDK,
 * including Bitcoin Script operations, locking and unlocking scripts, and OP_CODES.
 */
export const BSV_SDK_SCRIPT_PROMPT = `
# BSV SDK - Script Module

The Script module in the BSV SDK provides comprehensive tools for working with Bitcoin Script, the programming language used to specify conditions for spending Bitcoin.

## Bitcoin Script Basics

This section includes a placeholder for detailed content about Bitcoin Script and its implementation in the BSV SDK.

## Core Features

- Creating and manipulating scripts
- Locking script (scriptPubKey) creation
- Unlocking script (scriptSig) creation
- Script verification and execution
- Support for all Bitcoin OP_CODES

## Common Script Types

- P2PKH (Pay to Public Key Hash)
- P2PK (Pay to Public Key)
- P2MS (Multi-signature)
- OP_RETURN (Data storage)
- Custom scripts

## Best Practices

1. **Testing**: Test scripts thoroughly before production use
2. **Security**: Be aware of potential script vulnerabilities
3. **Compatibility**: Ensure scripts are compatible with network rules

For complete API documentation and additional script features, refer to the official BSV SDK documentation.
`;

/**
 * Register the BSV SDK Script prompt with the MCP server
 * @param server The MCP server instance
 */
export function registerScriptPrompt(server: McpServer): void {
	server.prompt(
		"bitcoin_sv_sdk_script",
		"Detailed information about the script functionality in the BSV SDK, including Bitcoin Script operations, locking and unlocking scripts, and OP_CODES.",
		async (extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
			return {
				messages: [
					{
						role: "assistant",
						content: {
							type: "text",
							text: BSV_SDK_SCRIPT_PROMPT,
						},
					},
				],
			};
		},
	);
}

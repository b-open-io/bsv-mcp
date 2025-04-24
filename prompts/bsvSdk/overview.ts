import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type {
	ServerNotification,
	ServerRequest,
} from "@modelcontextprotocol/sdk/types.js";

/**
 * BSV SDK Overview Prompt
 *
 * Provides a general overview of the Bitcoin SV SDK,
 * including what it is, its purpose, and its main components.
 */
export const BSV_SDK_OVERVIEW_PROMPT = `
# BSV SDK - Overview

The BSV SDK is a comprehensive TypeScript/JavaScript library designed to provide a unified and modern 
layer for developing scalable applications on the Bitcoin SV blockchain. This SDK addresses limitations 
of previous tools by offering a fresh approach that adheres to the principles of SPV (Simplified Payment 
Verification) while ensuring privacy and scalability.

## Core Objectives

- Provide a unified, modern API for Bitcoin SV development
- Enable secure, peer-to-peer operations
- Support SPV (Simplified Payment Verification) principles
- Ensure privacy and scalability in blockchain applications
- Simplify integration with the Bitcoin SV ecosystem

## Main Components

The BSV SDK is organized into several key modules:

1. **Wallet**: Manage keys, addresses, and UTXOs
2. **Transaction**: Build and manipulate Bitcoin transactions
3. **Auth**: Authentication and identity protocols
4. **Cryptography**: Signing, encryption, and verification
5. **Script**: Bitcoin scripting and contract capabilities
6. **Primitives**: Core data types and structures
7. **Messages**: Network message handling
8. **Overlay Tools**: Additional utilities and extensions

## Getting Started

To use the BSV SDK in your project:

\`\`\`bash
# Install with npm
npm install @bsv/sdk

# Or with yarn
yarn add @bsv/sdk
\`\`\`

Then import the components you need:

\`\`\`typescript
import { PrivateKey, Transaction } from "@bsv/sdk";
\`\`\`

## Use Cases

- Wallet applications
- Payment systems
- Smart contract platforms
- Token systems
- Identity solutions
- Data storage and verification

## Additional Resources

For detailed information about specific components, please see the dedicated prompts for each module:
- Wallet operations: Use prompt "bitcoin_sv_sdk_wallet"
- Transaction building: Use prompt "bitcoin_sv_sdk_transaction"
- Authentication: Use prompt "bitcoin_sv_sdk_auth"
- Cryptography: Use prompt "bitcoin_sv_sdk_cryptography"
- Scripting: Use prompt "bitcoin_sv_sdk_script"
- Primitives: Use prompt "bitcoin_sv_sdk_primitives"

For official documentation, visit the BSV Blockchain Libraries Project repository.
`;

/**
 * Register the BSV SDK Overview prompt with the MCP server
 * @param server The MCP server instance
 */
export function registerOverviewPrompt(server: McpServer): void {
	server.prompt(
		"bitcoin_sv_sdk_overview",
		"General overview of the Bitcoin SV SDK, including its purpose and main components.",
		async (extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
			return {
				messages: [
					{
						role: "assistant",
						content: {
							type: "text",
							text: BSV_SDK_OVERVIEW_PROMPT,
						},
					},
				],
			};
		},
	);
}

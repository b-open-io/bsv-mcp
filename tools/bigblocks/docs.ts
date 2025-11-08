import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const BIGBLOCKS_CONCEPTS = {
	"type-42-keys": {
		title: "Type 42 Master Keys",
		description:
			"Enhanced Bitcoin key derivation system for improved identity management",
		content: `# Type 42 Master Keys

Type 42 keys represent an advanced key derivation system used in BigBlocks for enhanced Bitcoin identity management.

## What are Type 42 Keys?

Type 42 keys extend beyond traditional BIP32 hierarchical deterministic (HD) wallets to provide:
- **Enhanced Security**: Improved key derivation with stronger entropy
- **Identity Management**: Better support for BAP (Bitcoin Application Protocol) identities
- **Migration Support**: Seamless upgrade from legacy BIP32 keys

## Key Benefits

1. **Stronger Cryptography**: Uses advanced derivation algorithms
2. **BAP Integration**: Native support for Bitcoin Application Protocol
3. **Backward Compatibility**: Can migrate from existing BIP32 keys
4. **Multi-Identity**: Support for multiple identity contexts

## Migration from BIP32

BigBlocks provides automatic migration tools:

\`\`\`tsx
import { MasterKeyMigration } from 'bigblocks';

<MasterKeyMigration
  onMigrationComplete={(result) => {
    console.log('Migrated to Type 42:', result);
  }}
  legacyKey={existingBip32Key}
/>
\`\`\`

## Usage in BigBlocks

Type 42 keys are automatically used when:
- Creating new identities through BigBlocks components
- Using BAP-related functionality
- Performing identity operations

## Security Considerations

- Always backup Type 42 keys using BigBlocks backup components
- Use encrypted storage for key material
- Consider using hardware security modules for high-value applications`,
	},
	"bap-identity": {
		title: "Bitcoin Application Protocol (BAP) Identity",
		description: "Decentralized identity system built on Bitcoin SV",
		content: `# Bitcoin Application Protocol (BAP) Identity

BAP provides a decentralized identity system where users control their identity data on the Bitcoin SV blockchain.

## Core Concepts

### Identity Keys
- **Master Key**: Root key for all identity operations
- **Identity Key**: Derived key for specific identity context
- **Signing Keys**: Keys used for content authentication

### Identity Data
- **Profile Information**: Name, bio, avatar, contact info
- **Attestations**: Verified claims about identity
- **Social Connections**: Follows, friends, trust relationships

## Using BAP in BigBlocks

BigBlocks provides complete BAP integration:

\`\`\`tsx
import { 
  ProfileCard, 
  ProfileEditor, 
  BapKeyRotationManager 
} from 'bigblocks';

// Display a BAP identity
<ProfileCard 
  bapId="identity_key_here"
  showActions={true}
/>

// Edit identity profile
<ProfileEditor
  onSave={(profile) => {
    // Profile saved to blockchain
  }}
/>

// Manage identity keys
<BapKeyRotationManager
  onRotation={(newKey) => {
    // Identity key rotated
  }}
/>
\`\`\`

## Identity Operations

1. **Creation**: Generate new BAP identity
2. **Publishing**: Publish profile data to blockchain
3. **Discovery**: Find identities by various criteria
4. **Verification**: Verify identity authenticity
5. **Social Actions**: Follow, message, attest

## Security Features

- **Key Rotation**: Regularly rotate identity keys
- **Attestations**: Cryptographic proof of claims
- **Revocation**: Ability to revoke compromised keys
- **Backup**: Secure backup and recovery processes`,
	},
	"bmap-social": {
		title: "Bitcoin Map (BMAP) Social Protocol",
		description: "Social media infrastructure built on Bitcoin SV blockchain",
		content: `# Bitcoin Map (BMAP) Social Protocol

BMAP is a social media protocol that stores posts, likes, follows, and other social interactions directly on the Bitcoin SV blockchain.

## Social Primitives

### Posts
- **Text Posts**: Simple text content
- **Media Posts**: Images, videos, documents
- **Replies**: Threaded conversations
- **Quotes**: Quote posts with commentary

### Interactions
- **Likes**: Express appreciation for content
- **Follows**: Subscribe to user content
- **Shares**: Republish content
- **Comments**: Engage in discussions

## Using BMAP in BigBlocks

BigBlocks provides full BMAP social functionality:

\`\`\`tsx
import { 
  PostButton, 
  LikeButton, 
  FollowButton, 
  SocialFeed,
  PostCard 
} from 'bigblocks';

// Create posts
<PostButton
  onSuccess={(txid) => {
    console.log('Post published:', txid);
  }}
  encryption={false} // Optional encryption
/>

// Like posts
<LikeButton
  postTxid="transaction_id"
  onLike={(liked) => {
    console.log('Post liked:', liked);
  }}
/>

// Follow users
<FollowButton
  userBapId="user_identity"
  onFollow={(following) => {
    console.log('User followed:', following);
  }}
/>

// Display social feed
<SocialFeed
  posts={posts}
  onLoadMore={() => {
    // Load more posts
  }}
/>
\`\`\`

## Data Ownership

- **User Control**: Users own their social data
- **Censorship Resistance**: No central authority can delete content
- **Portability**: Data can be accessed by any BMAP-compatible app
- **Monetization**: Direct micropayments for content

## Privacy Options

- **Public Posts**: Visible to everyone
- **Encrypted Posts**: Only visible to intended recipients
- **Group Posts**: Shared with specific groups
- **Private Messages**: Direct encrypted communication`,
	},
	"bitcoin-authentication": {
		title: "Bitcoin-based Authentication",
		description: "Secure authentication using Bitcoin cryptographic signatures",
		content: `# Bitcoin-based Authentication

Bitcoin authentication uses cryptographic signatures to prove identity without passwords or centralized services.

## How It Works

1. **Key Generation**: User generates a Bitcoin key pair
2. **Challenge**: Server provides a challenge message
3. **Signing**: User signs challenge with private key
4. **Verification**: Server verifies signature with public key

## Advantages

- **No Passwords**: Eliminates password-related vulnerabilities
- **Self-Sovereign**: Users control their identity
- **Cryptographically Secure**: Based on Bitcoin's proven cryptography
- **Cross-Platform**: Works on any device with Bitcoin capabilities

## BigBlocks Implementation

BigBlocks makes Bitcoin auth simple:

\`\`\`tsx
import { 
  BitcoinAuthProvider, 
  AuthFlowOrchestrator,
  AuthButton 
} from 'bigblocks';

// Setup authentication provider
<BitcoinAuthProvider config={authConfig}>
  <App />
</BitcoinAuthProvider>

// Complete authentication flow
<AuthFlowOrchestrator
  flowType="unified"
  onSuccess={(user) => {
    console.log('Authenticated:', user);
  }}
/>

// Simple auth button
<AuthButton
  variant="solid"
  onSuccess={(session) => {
    // User authenticated
  }}
/>
\`\`\`

## Security Considerations

- **Key Storage**: Secure storage of private keys
- **Challenge Freshness**: Use fresh challenges to prevent replay
- **Signature Validation**: Proper verification of signatures
- **Key Rotation**: Regular rotation of authentication keys

## Integration Patterns

- **Session Management**: Maintain authenticated sessions
- **Role-Based Access**: Different authentication levels
- **Multi-Device**: Sync authentication across devices
- **Backup/Recovery**: Secure key backup and recovery`,
	},
	"bitcoin-payments": {
		title: "Bitcoin Payments and Wallets",
		description: "Integrating Bitcoin payments into applications",
		content: `# Bitcoin Payments and Wallets

BigBlocks provides comprehensive Bitcoin payment functionality for building wallet applications and payment flows.

## Core Payment Features

### Sending Payments
- **Address Validation**: Ensure valid recipient addresses
- **Amount Calculation**: Handle satoshi/BSV conversions
- **Fee Management**: Automatic fee calculation
- **Transaction Building**: Construct valid Bitcoin transactions

### Receiving Payments
- **Address Generation**: Create unique receiving addresses
- **Payment Monitoring**: Watch for incoming transactions
- **Confirmation Tracking**: Monitor transaction confirmations
- **Webhook Integration**: Real-time payment notifications

## BigBlocks Wallet Components

\`\`\`tsx
import { 
  SendBSVButton,
  WalletOverview,
  TokenBalance,
  QuickSendButton,
  DonateButton 
} from 'bigblocks';

// Complete wallet interface
<WalletOverview
  showHistory={true}
  showTokens={true}
/>

// Send Bitcoin
<SendBSVButton
  amount={0.001} // BSV amount
  address="recipient_address"
  onSuccess={(txid) => {
    console.log('Payment sent:', txid);
  }}
/>

// Quick payment buttons
<QuickSendButton
  presetAmounts={[0.001, 0.01, 0.1]}
  recipient="user_address"
/>

// Donation interface
<DonateButton
  recipient="charity_address"
  amounts={[0.01, 0.05, 0.1]}
  message="Thank you!"
/>
\`\`\`

## Payment Security

- **Private Key Management**: Secure key storage and handling
- **Transaction Verification**: Validate before broadcasting
- **Double-Spend Protection**: Monitor for conflicting transactions
- **Backup Strategies**: Secure wallet backup and recovery

## UTXO Management

- **UTXO Selection**: Efficient coin selection algorithms
- **Change Handling**: Proper change address management
- **Dust Prevention**: Avoid creating uneconomical outputs
- **Consolidation**: Merge small UTXOs when beneficial

## Testing and Development

- **Testnet Support**: Use testnet for development
- **Mock Payments**: Simulate payments without real money
- **Transaction Preview**: Show transaction details before sending
- **Droplet Integration**: Use droplit faucets for testing`,
	},
};

const docsSchema = z.object({
	concept: z
		.string()
		.optional()
		.describe(
			"Specific concept to learn about (type-42-keys, bap-identity, bmap-social, bitcoin-authentication, bitcoin-payments)",
		),
	search: z.string().optional().describe("Search term to find concepts"),
	listAll: z.boolean().optional().describe("List all available concepts"),
});

/**
 * Register the BigBlocks documentation tool
 */
export function registerBigBlocksDocsTool(server: McpServer): void {
	server.tool(
		"bigblocks_docs",
		"Learn about Bitcoin and BigBlocks concepts. Get detailed explanations of key technologies, protocols, and implementation patterns.\n\n" +
			"Available concepts:\n" +
			"- type-42-keys: Enhanced Bitcoin key derivation system\n" +
			"- bap-identity: Decentralized identity on Bitcoin\n" +
			"- bmap-social: Social media protocol on Bitcoin\n" +
			"- bitcoin-authentication: Cryptographic authentication\n" +
			"- bitcoin-payments: Payment integration patterns\n\n" +
			"Usage examples:\n" +
			'- Learn about concept: {"concept": "type-42-keys"}\n' +
			'- Search concepts: {"search": "identity"}\n' +
			'- List all: {"listAll": true}',
		{ args: docsSchema },
		async ({ args }) => {
			try {
				const { concept, search, listAll } = args;

				// Show specific concept
				if (concept) {
					const conceptData = BIGBLOCKS_CONCEPTS[concept];
					if (!conceptData) {
						const available = Object.keys(BIGBLOCKS_CONCEPTS).join(", ");
						return {
							content: [
								{
									type: "text",
									text: `Concept "${concept}" not found. Available concepts: ${available}`,
								},
							],
							isError: true,
						};
					}

					return {
						content: [
							{
								type: "text",
								text: conceptData.content,
							},
						],
					};
				}

				// Search concepts
				if (search) {
					const searchTerm = search.toLowerCase();
					let results = `# BigBlocks Concepts Search: "${search}"\n\n`;
					let found = false;

					for (const [conceptKey, conceptData] of Object.entries(
						BIGBLOCKS_CONCEPTS,
					)) {
						if (
							conceptKey.toLowerCase().includes(searchTerm) ||
							conceptData.title.toLowerCase().includes(searchTerm) ||
							conceptData.description.toLowerCase().includes(searchTerm) ||
							conceptData.content.toLowerCase().includes(searchTerm)
						) {
							found = true;
							results += `## ${conceptData.title}\n`;
							results += `${conceptData.description}\n`;
							results += `**Key:** \`${conceptKey}\`\n\n`;
						}
					}

					if (!found) {
						results += "No concepts found matching your search.";
					}

					return { content: [{ type: "text", text: results }] };
				}

				// List all concepts
				if (listAll) {
					let result = "# BigBlocks Concepts\n\n";
					result +=
						"Comprehensive documentation of Bitcoin and BigBlocks technologies.\n\n";

					for (const [conceptKey, conceptData] of Object.entries(
						BIGBLOCKS_CONCEPTS,
					)) {
						result += `## ${conceptData.title}\n`;
						result += `${conceptData.description}\n`;
						result += `**Learn more:** Use {\"concept\": \"${conceptKey}\"}\n\n`;
					}

					return { content: [{ type: "text", text: result }] };
				}

				// Default: show overview
				return {
					content: [
						{
							type: "text",
							text: `# BigBlocks Documentation

Available concepts:
${Object.entries(BIGBLOCKS_CONCEPTS)
	.map(([key, data]) => `- **${key}**: ${data.description}`)
	.join("\n")}

Use {"concept": "conceptName"} to learn about a specific topic, or {"listAll": true} to see all available concepts.`,
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

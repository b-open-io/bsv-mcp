import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type {
	ServerNotification,
	ServerRequest,
} from "@modelcontextprotocol/sdk/types.js";

/**
 * BSV SDK Wallet Prompt
 *
 * Provides detailed information about the wallet functionality in the BSV SDK,
 * including key management, address handling, and UTXO management.
 */
export const BSV_SDK_WALLET_PROMPT = `
# BSV SDK - Wallet Module

The wallet module in BSV SDK provides comprehensive functionality for managing Bitcoin keys, addresses, and UTXOs (Unspent Transaction Outputs). It forms the foundation for creating and managing Bitcoin wallets in your applications.

## Key Classes and Interfaces

### ProtoWallet

The \`ProtoWallet\` class provides a basic implementation of the wallet interface with core functionality:

\`\`\`typescript
import { PrivateKey, ProtoWallet } from "@bsv/sdk";

// Create a new wallet with a random private key
const privateKey = PrivateKey.fromRandom();
const wallet = new ProtoWallet(privateKey);
\`\`\`

### WalletInterface

The \`WalletInterface\` defines the standard interface that wallet implementations should follow. It includes methods for:

- Key management
- Cryptographic operations
- Transaction creation and signing
- Output management
- Certificate handling

## Key Management

### Generating Keys

\`\`\`typescript
import { PrivateKey } from "@bsv/sdk";

// Generate a random private key
const privateKey = PrivateKey.fromRandom();

// Generate from a WIF (Wallet Import Format) string
const importedKey = PrivateKey.fromWif("your-wif-string");

// Generate from a seed
const seedKey = PrivateKey.fromSeed(Buffer.from("your-seed-data"));

// Get the corresponding public key
const publicKey = privateKey.toPublicKey();
\`\`\`

### KeyDeriver & CachedKeyDeriver

For HD (Hierarchical Deterministic) wallet functionality:

\`\`\`typescript
import { KeyDeriver } from "@bsv/sdk";

// Create a key deriver with a seed
const deriver = new KeyDeriver(seed);

// Derive a key at a specific path
const derivedKey = await deriver.deriveKey("m/44'/0'/0'/0/0");
\`\`\`

## Address Management

\`\`\`typescript
// Get the address for a private key
const address = privateKey.toAddress();

// Get the address for a public key
const address = publicKey.toAddress();

// Get the address string
const addressString = address.toString();
\`\`\`

## UTXO Management

Managing UTXOs (Unspent Transaction Outputs) is a critical part of wallet functionality:

\`\`\`typescript
// Example of tracking UTXOs
class MyWallet extends ProtoWallet {
  private utxos = [];
  
  async refreshUtxos(address) {
    // Fetch UTXOs from a service or API
    this.utxos = await fetchUtxosFromService(address);
  }
  
  getAvailableUtxos() {
    return this.utxos.filter(utxo => !utxo.spent);
  }
  
  getBalance() {
    return this.getAvailableUtxos().reduce((sum, utxo) => sum + utxo.satoshis, 0);
  }
}
\`\`\`

## Cryptographic Operations

The wallet module provides various cryptographic operations:

\`\`\`typescript
// Signing data
const signature = await wallet.createSignature({
  data: [1, 2, 3, 4],  // Data to sign
  protocolID: [1, "ecdsa"],  // Protocol to use
  keyID: "default"  // Key identifier
});

// Verifying signatures
const isValid = await wallet.verifySignature({
  data: [1, 2, 3, 4],  // Original data
  signature: signatureBytes,  // Signature to verify
  protocolID: [1, "ecdsa"],
  keyID: "default"
});

// Encryption and decryption
const encrypted = await wallet.encrypt({
  plaintext: [1, 2, 3, 4],
  protocolID: [1, "aes256"],
  keyID: "default"
});

const decrypted = await wallet.decrypt({
  ciphertext: encrypted.ciphertext,
  protocolID: [1, "aes256"],
  keyID: "default"
});
\`\`\`

## Best Practices

1. **Key Security**: Always handle private keys securely and never expose them unnecessarily
2. **UTXO Management**: Maintain accurate UTXO information for wallet functionality
3. **Error Handling**: Implement proper error handling for all wallet operations
4. **Testing**: Test wallet functionality thoroughly on testnet before deploying to mainnet
5. **Backup**: Provide key backup and recovery mechanisms for users

## Advanced Topics

- **Multi-signature wallets**: Implementing wallets requiring multiple signatures
- **HD Wallets**: Creating hierarchical deterministic wallets for key derivation
- **Watch-only wallets**: Tracking addresses without private keys
- **Hardware wallet integration**: Connecting to hardware security devices

For complete API documentation and additional wallet features, refer to the official BSV SDK documentation.
`;

/**
 * Register the BSV SDK Wallet prompt with the MCP server
 * @param server The MCP server instance
 */
export function registerWalletPrompt(server: McpServer): void {
	server.prompt(
		"bitcoin_sv_sdk_wallet",
		"Detailed information about the wallet functionality in the BSV SDK, including key management, address handling, and UTXO management.",
		async (extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
			return {
				messages: [
					{
						role: "assistant",
						content: {
							type: "text",
							text: BSV_SDK_WALLET_PROMPT,
						},
					},
				],
			};
		},
	);
}

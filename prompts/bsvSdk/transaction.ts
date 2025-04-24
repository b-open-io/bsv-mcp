import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type {
	ServerNotification,
	ServerRequest,
} from "@modelcontextprotocol/sdk/types.js";

/**
 * BSV SDK Transaction Prompt
 *
 * Provides detailed information about transaction building and management
 * in the BSV SDK, including input/output handling, script integration, and transaction signing.
 */
export const BSV_SDK_TRANSACTION_PROMPT = `
# BSV SDK - Transaction Module

The Transaction module in the BSV SDK provides comprehensive functionality for creating, manipulating, and signing Bitcoin transactions. It gives developers fine-grained control over transaction construction while abstracting many of the complexities.

## Key Components

### Transaction Class

The core \`Transaction\` class represents a Bitcoin transaction and provides methods for manipulating its components:

\`\`\`typescript
import { Transaction, PrivateKey, LockingScript } from "@bsv/sdk";

// Create a new transaction
const tx = new Transaction();

// Set transaction properties
tx.version = 1;
tx.lockTime = 0;
\`\`\`

## Building Transactions

### Adding Inputs

\`\`\`typescript
// Add an input by specifying the source transaction and output index
tx.addInput({
  sourceTXID: "previous_transaction_id_in_hex",
  sourceOutputIndex: 0,
  sequence: 0xffffffff // Optional, defaults to max value
});

// Add multiple inputs
const inputs = [
  { sourceTXID: "txid1", sourceOutputIndex: 0 },
  { sourceTXID: "txid2", sourceOutputIndex: 1 }
];
inputs.forEach(input => tx.addInput(input));
\`\`\`

### Adding Outputs

\`\`\`typescript
// Add an output with a locking script and amount
import { LockingScript } from "@bsv/sdk";

// Create from a Bitcoin address
const lockingScript = LockingScript.fromAddress("recipient_address");

// Add the output to the transaction
tx.addOutput({
  lockingScript,
  satoshis: 5000 // Amount in satoshis
});

// Add a data (OP_RETURN) output
const dataScript = LockingScript.fromData(Buffer.from("Hello, Bitcoin!"));
tx.addOutput({
  lockingScript: dataScript,
  satoshis: 0 // OP_RETURN outputs typically have 0 value
});
\`\`\`

### Working with UTXOs

When building transactions with existing UTXOs:

\`\`\`typescript
import { UnlockingScript } from "@bsv/sdk";

// Example UTXO data
const utxos = [
  {
    txid: "previous_tx_id_in_hex",
    vout: 0,
    satoshis: 10000,
    scriptPubKey: "locking_script_hex"
  }
];

// Create transaction using UTXOs
const tx = new Transaction();

// Add input from UTXO
utxos.forEach(utxo => {
  tx.addInput({
    sourceTXID: utxo.txid,
    sourceOutputIndex: utxo.vout
  });
});

// Add output with recipient address
tx.addOutput({
  lockingScript: LockingScript.fromAddress("recipient_address"),
  satoshis: 9000 // Sending 9000 satoshis (10000 - 1000 fee)
});
\`\`\`

## Signing Transactions

### Basic Transaction Signing

\`\`\`typescript
import { PrivateKey, SigningConfig, Utils } from "@bsv/sdk";

// Create a private key
const privateKey = PrivateKey.fromWif("your_private_key_wif");

// Sign a specific input
const inputIndex = 0;
const signingConfig: SigningConfig = {
  privateKey,
  lockingScript: LockingScript.fromAddress(privateKey.toAddress()),
  satoshis: 10000, // Original amount in the UTXO
  inputIndex,
  sigHashType: Utils.SIGHASH_ALL | Utils.SIGHASH_FORKID // Standard signing algorithm
};

// Apply the signature to the transaction
tx.sign(signingConfig);
\`\`\`

### Signing Multiple Inputs

\`\`\`typescript
// Sign multiple inputs with different keys
const keys = [privateKey1, privateKey2];
const utxos = [utxo1, utxo2];

utxos.forEach((utxo, index) => {
  const signingConfig = {
    privateKey: keys[index],
    lockingScript: LockingScript.fromHex(utxo.scriptPubKey),
    satoshis: utxo.satoshis,
    inputIndex: index,
    sigHashType: Utils.SIGHASH_ALL | Utils.SIGHASH_FORKID
  };
  
  tx.sign(signingConfig);
});
\`\`\`

## Transaction Serialization

\`\`\`typescript
// Convert transaction to binary format
const txBinary = tx.toBinary();

// Convert to hex string
const txHex = tx.toHex();

// Get transaction ID
const txid = tx.hash("hex");

// Parse an existing transaction
const parsedTx = Transaction.fromHex("transaction_hex_string");
\`\`\`

## Fee Calculation

\`\`\`typescript
// Manual fee calculation based on transaction size
const txSize = tx.toBinary().length;
const feeRate = 0.5; // satoshis per byte
const fee = Math.ceil(txSize * feeRate);

// Adjust output amount to include fee
outputAmount = inputAmount - fee;
\`\`\`

## Advanced Transaction Features

### Time Locks

\`\`\`typescript
// Set absolute locktime (by block height)
tx.lockTime = 700000; // Transaction can't be mined until block 700000

// Set relative locktime using sequence number (BIP 68)
const sequenceForBlocks = (blocks) => 0xffffffff - blocks;
tx.inputs[0].sequence = sequenceForBlocks(10); // Locked for 10 blocks
\`\`\`

### Custom Scripts

\`\`\`typescript
import { Script, OpCodes } from "@bsv/sdk";

// Create a custom script
const customScript = new Script();
customScript.add(OpCodes.OP_DUP);
customScript.add(OpCodes.OP_HASH160);
customScript.add(Buffer.from("public_key_hash", "hex"));
customScript.add(OpCodes.OP_EQUALVERIFY);
customScript.add(OpCodes.OP_CHECKSIG);

// Create a locking script from the custom script
const customLockingScript = LockingScript.fromScript(customScript);
\`\`\`

## Best Practices

1. **Fee Management**: Calculate appropriate fees based on transaction size and network conditions
2. **Input/Output Management**: Properly track inputs and outputs to avoid double-spending
3. **Change Handling**: Always account for change when not spending the full UTXO amount
4. **Testing**: Test transactions on testnet before deploying to mainnet
5. **Error Handling**: Implement proper error handling for transaction building and signing

For complete API documentation and additional transaction features, refer to the official BSV SDK documentation.
`;

/**
 * Register the BSV SDK Transaction prompt with the MCP server
 * @param server The MCP server instance
 */
export function registerTransactionPrompt(server: McpServer): void {
	server.prompt(
		"bitcoin_sv_sdk_transaction",
		"Detailed information about transaction building and management in the BSV SDK, including input/output handling, script integration, and transaction signing.",
		async (extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
			return {
				messages: [
					{
						role: "assistant",
						content: {
							type: "text",
							text: BSV_SDK_TRANSACTION_PROMPT,
						},
					},
				],
			};
		},
	);
}

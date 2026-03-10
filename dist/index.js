#!/usr/bin/env bun
// @bun
var __isStdio = process.argv.includes("--stdio") || (process.env.TRANSPORT || "").toLowerCase() === "stdio";
if (__isStdio) {
  var __err = console.error.bind(console);
  console.log = function() { __err.apply(null, ["[log]"].concat([].slice.call(arguments))); };
  console.warn = function() { __err.apply(null, ["[warn]"].concat([].slice.call(arguments))); };
  console.info = function() { __err.apply(null, ["[info]"].concat([].slice.call(arguments))); };
  console.debug = function() { __err.apply(null, ["[debug]"].concat([].slice.call(arguments))); };
}
import { createRequire } from "node:module";
var __require = /* @__PURE__ */ createRequire(import.meta.url);

// index.ts
import { readFile } from "fs/promises";
import os4 from "os";
import path6 from "path";
import { dirname, join as join3 } from "path";
import { fileURLToPath } from "url";
import { PrivateKey as PrivateKey11 } from "@bsv/sdk";
import {
  RESOURCE_MIME_TYPE,
  registerAppResource,
  registerAppTool
} from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport as StdioServerTransport2 } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z as z40 } from "zod";
// package.json
var package_default = {
  name: "bsv-mcp",
  module: "dist/index.js",
  type: "module",
  version: "0.2.12",
  license: "MIT",
  author: "satchmo",
  description: "A collection of Bitcoin SV (BSV) tools for the Model Context Protocol (MCP) framework",
  repository: {
    type: "git",
    url: "https://github.com/b-open-io/bsv-mcp"
  },
  keywords: [
    "bitcoin",
    "bsv",
    "bitcoin-sv",
    "wallet",
    "ordinals",
    "blockchain",
    "1sat-ordinals",
    "explorer",
    "block explorer"
  ],
  files: [
    "dist/**/*.js",
    "dist/**/*.html",
    "package.json",
    "*.ts",
    "tools/*.ts",
    "tools/**/*.ts",
    "prompts/*.ts",
    "prompts/**/*.ts",
    "resources/*.ts",
    "resources/**/*.ts",
    "LICENSE",
    "README.md",
    "CHANGELOG.md",
    "smithery.yaml"
  ],
  bin: {
    "bsv-mcp": "./dist/index.js"
  },
  private: false,
  devDependencies: {
    "@biomejs/biome": "^2.4.6",
    "@radix-ui/react-dialog": "^1.1.15",
    "@radix-ui/react-dropdown-menu": "^2.1.16",
    "@radix-ui/react-label": "^2.1.8",
    "@radix-ui/react-separator": "^1.1.8",
    "@radix-ui/react-slot": "^1.2.4",
    "@radix-ui/react-tabs": "^1.1.13",
    "@radix-ui/react-toast": "^1.2.15",
    "@radix-ui/react-tooltip": "^1.2.8",
    "@radix-ui/themes": "^3.3.0",
    "@tailwindcss/postcss": "^4.2.1",
    "@tanstack/react-query": "^5.90.21",
    "@types/bun": "^1.3.10",
    "@types/node": "^25.3.5",
    "@types/react": "^19.2.14",
    "@types/react-dom": "^19.2.3",
    autoprefixer: "^10.4.27",
    bun: "^1.3.10",
    "class-variance-authority": "^0.7.1",
    clsx: "^2.1.1",
    "lucide-react": "0.577.0",
    next: "^16.1.6",
    "next-themes": "^0.4.6",
    postcss: "^8.5.8",
    react: "^19.2.4",
    "react-dom": "^19.2.4",
    sonner: "^2.0.7",
    "tailwind-merge": "^3.5.0",
    tailwindcss: "^4.2.1",
    "tailwindcss-animate": "^1.0.7",
    vite: "^7.3.1",
    "vite-plugin-singlefile": "^2.3.0"
  },
  peerDependencies: {
    typescript: "^5.9.3"
  },
  dependencies: {
    "@1sat/actions": "0.0.27",
    "@1sat/wallet-remote": "0.0.7",
    "@bsv/sdk": "^2.0.6",
    "@modelcontextprotocol/ext-apps": "^1.2.0",
    "@modelcontextprotocol/sdk": "^1.27.1",
    "bitcoin-auth": "^0.0.7",
    "bitcoin-backup": "0.0.7",
    "bmap-api-types": "0.0.9",
    "bsv-bap": "0.1.23",
    jose: "^6.2.0",
    "js-1sat-ord": "^0.1.91",
    "mcp-handler": "^1.0.7",
    mnee: "^3.1.0",
    "satoshi-token": "^0.0.7",
    "schema-dts": "^1.1.5",
    "sigma-protocol": "^0.1.9",
    zod: "^4.3.6"
  },
  scripts: {
    build: "bun run ./scripts/build.ts",
    "build:view": "vite build",
    "build:all": "bun run build:view && bun run build",
    dev: "next dev",
    "build:next": "next build",
    "start:next": "next start",
    lint: "biome check .",
    "lint:fix": "biome check . --write",
    prepack: "bun run build:all"
  }
};

// prompts/bsvSdk/auth.ts
var BSV_SDK_AUTH_PROMPT = `
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
function registerAuthPrompt(server) {
  server.prompt("bitcoin_sv_sdk_auth", "Detailed information about the authentication functionality in the BSV SDK, including identity protocols, certificates, and session management.", async (extra) => {
    return {
      messages: [
        {
          role: "assistant",
          content: {
            type: "text",
            text: BSV_SDK_AUTH_PROMPT
          }
        }
      ]
    };
  });
}

// prompts/bsvSdk/cryptography.ts
var BSV_SDK_CRYPTOGRAPHY_PROMPT = `
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
function registerCryptographyPrompt(server) {
  server.prompt("bitcoin_sv_sdk_cryptography", "Detailed information about the cryptographic functionality in the BSV SDK, including key generation, signing, encryption, and hashing.", async (extra) => {
    return {
      messages: [
        {
          role: "assistant",
          content: {
            type: "text",
            text: BSV_SDK_CRYPTOGRAPHY_PROMPT
          }
        }
      ]
    };
  });
}

// prompts/bsvSdk/overview.ts
var BSV_SDK_OVERVIEW_PROMPT = `
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
function registerOverviewPrompt(server) {
  server.prompt("bitcoin_sv_sdk_overview", "General overview of the Bitcoin SV SDK, including its purpose and main components.", async (extra) => {
    return {
      messages: [
        {
          role: "assistant",
          content: {
            type: "text",
            text: BSV_SDK_OVERVIEW_PROMPT
          }
        }
      ]
    };
  });
}

// prompts/bsvSdk/primitives.ts
var BSV_SDK_PRIMITIVES_PROMPT = `
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
function registerPrimitivesPrompt(server) {
  server.prompt("bitcoin_sv_sdk_primitives", "Detailed information about the primitive data types and structures in the BSV SDK, including Binary, Hex, Points, and other fundamental types.", async (extra) => {
    return {
      messages: [
        {
          role: "assistant",
          content: {
            type: "text",
            text: BSV_SDK_PRIMITIVES_PROMPT
          }
        }
      ]
    };
  });
}

// prompts/bsvSdk/script.ts
var BSV_SDK_SCRIPT_PROMPT = `
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
function registerScriptPrompt(server) {
  server.prompt("bitcoin_sv_sdk_script", "Detailed information about the script functionality in the BSV SDK, including Bitcoin Script operations, locking and unlocking scripts, and OP_CODES.", async (extra) => {
    return {
      messages: [
        {
          role: "assistant",
          content: {
            type: "text",
            text: BSV_SDK_SCRIPT_PROMPT
          }
        }
      ]
    };
  });
}

// prompts/bsvSdk/transaction.ts
var BSV_SDK_TRANSACTION_PROMPT = `
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
const dataScript = LockingScript.fromData(Utils.toArray("Hello, Bitcoin!", "utf8"));
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
customScript.add(Utils.toArray("public_key_hash", "hex"));
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
function registerTransactionPrompt(server) {
  server.prompt("bitcoin_sv_sdk_transaction", "Detailed information about transaction building and management in the BSV SDK, including input/output handling, script integration, and transaction signing.", async (extra) => {
    return {
      messages: [
        {
          role: "assistant",
          content: {
            type: "text",
            text: BSV_SDK_TRANSACTION_PROMPT
          }
        }
      ]
    };
  });
}

// prompts/bsvSdk/wallet.ts
var BSV_SDK_WALLET_PROMPT = `
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
const seedKey = PrivateKey.fromSeed(Utils.toArray("your-seed-data", "utf8"));

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
function registerWalletPrompt(server) {
  server.prompt("bitcoin_sv_sdk_wallet", "Detailed information about the wallet functionality in the BSV SDK, including key management, address handling, and UTXO management.", async (extra) => {
    return {
      messages: [
        {
          role: "assistant",
          content: {
            type: "text",
            text: BSV_SDK_WALLET_PROMPT
          }
        }
      ]
    };
  });
}

// prompts/bsvSdk/index.ts
function registerAllBsvSdkPrompts(server) {
  registerOverviewPrompt(server);
  registerWalletPrompt(server);
  registerTransactionPrompt(server);
  registerAuthPrompt(server);
  registerCryptographyPrompt(server);
  registerScriptPrompt(server);
  registerPrimitivesPrompt(server);
}

// prompts/ordinals.ts
var ORDINALS_PROMPT = `
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
function registerOrdinalsPrompt(server) {
  server.prompt("bitcoin_sv_ordinals", "Comprehensive information about Bitcoin SV ordinals, including what they are, how they work, and how to use them.", async (extra) => {
    return {
      messages: [
        {
          role: "assistant",
          content: {
            type: "text",
            text: ORDINALS_PROMPT
          }
        }
      ]
    };
  });
}

// prompts/index.ts
function registerAllPrompts(server) {
  registerOrdinalsPrompt(server);
  registerAllBsvSdkPrompts(server);
}

// resources/bitcom.ts
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
var bitcomProtocols = {
  AIP: {
    name: "Author Identity Protocol (AIP)",
    prefix: "15PciHG22SNLQJXMoSUaWVi7WSqc7hCfva",
    description: "A simple and flexible method to sign arbitrary OP_RETURN data with Bitcoin ECDSA signatures, decoupling the signing address from the funding source.",
    structure: `
OP_RETURN
  [Data]
  [Media Type]
  [Encoding]
  [Filename]
  |
  15PciHG22SNLQJXMoSUaWVi7WSqc7hCfva (AIP Prefix)
  [Signing Algorithm] (e.g., BITCOIN_ECDSA)
  [Signing Address]
  [Signature] (Base64 Encoded)
  [Field Index 0] (Optional, 0 = OP_RETURN 0x6a)
  [Field Index 1] (Optional)
  ... (If indexes are omitted, all fields left of '|' are signed)
`,
    reference: "https://raw.githubusercontent.com/b-open-io/AIP/refs/heads/main/README.md"
  },
  MAP: {
    name: "Magic Attribute Protocol (MAP)",
    prefix: "1PuQa7K62MiKCtssSLKy1kh56WWU7MtUR5",
    description: "A simple protocol for associating data in a single transaction by defining key-value pairs, often used for mapping content (like B:// protocol data) to identifiers or actions.",
    structure: `
OP_RETURN
  ... (Optional Input Data Protocol, e.g., B://)
  |
  1PuQa7K62MiKCtssSLKy1kh56WWU7MtUR5 (MAP Prefix)
  'SET'
  [Key 1] (UTF8 String)
  [Value 1] (UTF8 String)
  [Key 2] (Optional UTF8 String)
  [Value 2] (Optional UTF8 String)
  ...
`,
    notes: "Can be used standalone or chained after other protocols (like B). Keys can represent attributes (url, type, coordinates.lat) or actions (like, follow.user).",
    reference: "https://raw.githubusercontent.com/rohenaz/MAP/refs/heads/master/README.md"
  },
  SIGMA: {
    name: "Sigma Protocol",
    prefix: "SIGMA",
    description: "Enhances transaction security by signing custom output scripts, incorporating input txid and output data hashes to mitigate replay attacks.",
    structure: `
<locking script>
OP_RETURN
  [Additional Data] (Optional)
  | (Optional Separator)
  SIGMA (Protocol Identifier)
  [Signing Algorithm] (e.g., ECDSA)
  [Signing Address]
  [Signature] (Base64 Encoded in lib, Hex in script)
  [VIN] (Index of input whose txid is included in signature, -1 for corresponding input)
`,
    reference: "User provided text (Abstract/Introduction)"
  }
};
var bitcomResourceTemplate = new ResourceTemplate("bitcom://protocol/{protocolName}", { list: undefined });
function registerBitcomResource(server) {
  server.resource("bitcom_protocol", bitcomResourceTemplate, async (uri, params) => {
    const protocolName = params.protocolName;
    if (!protocolName || !(protocolName in bitcomProtocols)) {
      const available = Object.keys(bitcomProtocols).join(", ");
      return {
        code: -32602,
        message: `Invalid or missing protocol name. Available: ${available}`,
        contents: []
      };
    }
    const proto = bitcomProtocols[protocolName];
    const notesString = "notes" in proto && proto.notes ? `\\nNotes:\\n${proto.notes}\\n` : "";
    const textContent = `
Protocol: ${proto.name}
Prefix: ${proto.prefix || "N/A"}
Reference: ${proto.reference}

Description:
${proto.description}

Structure:
\`\`\`
${proto.structure.trim()}
\`\`\`
${notesString}      `.trim();
    return {
      contents: [
        {
          uri: uri.href,
          text: textContent,
          mimeType: "text/plain"
        }
      ]
    };
  });
}

// resources/brcs.ts
import {
  ResourceTemplate as ResourceTemplate2
} from "@modelcontextprotocol/sdk/server/mcp.js";
function registerBRCsResources(server) {
  server.resource("brcs_readme", "https://raw.githubusercontent.com/bitcoin-sv/BRCs/master/README.md", {
    title: "Bitcoin SV BRCs Overview",
    description: "Overview of all Bitcoin SV protocol specifications in the BRCs repository"
  }, async (uri) => {
    const resp = await fetch(uri.href);
    const text = await resp.text();
    return {
      contents: [
        {
          uri: uri.href,
          text
        }
      ]
    };
  });
  server.resource("brcs_summary", "https://raw.githubusercontent.com/bitcoin-sv/BRCs/master/SUMMARY.md", {
    title: "Bitcoin SV BRCs Summary",
    description: "Table of contents for all Bitcoin SV BRCs"
  }, async (uri) => {
    const resp = await fetch(uri.href);
    const text = await resp.text();
    return {
      contents: [
        {
          uri: uri.href,
          text
        }
      ]
    };
  });
  server.resource("brc_spec", new ResourceTemplate2("brc://{category}/{brcNumber}", { list: undefined }), {
    title: "Bitcoin SV BRC Specification",
    description: "Access specific BRC specifications by category and number"
  }, async (uri, { category, brcNumber }) => {
    const path = `${category}/${brcNumber}.md`;
    const resp = await fetch(`https://raw.githubusercontent.com/bitcoin-sv/BRCs/master/${path}`);
    if (!resp.ok) {
      throw new Error(`BRC specification not found: ${path}`);
    }
    const text = await resp.text();
    return {
      contents: [
        {
          uri: uri.href,
          text
        }
      ]
    };
  });
  registerAllBRCs(server);
}
function registerAllBRCs(server) {
  const brcs = [
    {
      number: "0",
      title: "Banana-Powered Bitcoin Wallet Control Protocol",
      category: "wallet" /* Wallet */
    },
    {
      number: "1",
      title: "Transaction Creation",
      category: "wallet" /* Wallet */
    },
    {
      number: "2",
      title: "Data Encryption and Decryption",
      category: "wallet" /* Wallet */
    },
    {
      number: "3",
      title: "Digital Signature Creation and Verification",
      category: "wallet" /* Wallet */
    },
    { number: "4", title: "Input Redemption", category: "wallet" /* Wallet */ },
    {
      number: "5",
      title: "HTTP Wallet Communications Substrate",
      category: "wallet" /* Wallet */
    },
    {
      number: "6",
      title: "XDM Wallet Communications Substrate",
      category: "wallet" /* Wallet */
    },
    {
      number: "7",
      title: "Window Wallet Communication Substrate",
      category: "wallet" /* Wallet */
    },
    {
      number: "8",
      title: "Everett-style Transaction Envelopes",
      category: "transactions" /* Transactions */
    },
    {
      number: "9",
      title: "Simplified Payment Verification",
      category: "transactions" /* Transactions */
    },
    {
      number: "10",
      title: "Merkle proof standardised format",
      category: "transactions" /* Transactions */
    },
    {
      number: "11",
      title: "TSC Proof Format with Heights",
      category: "transactions" /* Transactions */
    },
    {
      number: "12",
      title: "Raw Transaction Format",
      category: "transactions" /* Transactions */
    },
    {
      number: "13",
      title: "TXO Transaction Object Format",
      category: "transactions" /* Transactions */
    },
    {
      number: "14",
      title: "Bitcoin Script Binary, Hex and ASM Formats",
      category: "scripts" /* Scripts */
    },
    {
      number: "15",
      title: "Bitcoin Script Assembly Language",
      category: "scripts" /* Scripts */
    },
    {
      number: "16",
      title: "Pay to Public Key Hash",
      category: "scripts" /* Scripts */
    },
    {
      number: "17",
      title: "Pay to R Puzzle Hash",
      category: "scripts" /* Scripts */
    },
    {
      number: "18",
      title: "Pay to False Return",
      category: "scripts" /* Scripts */
    },
    {
      number: "19",
      title: "Pay to True Return",
      category: "scripts" /* Scripts */
    },
    { number: "20", title: "There is no BRC-20", category: "tokens" /* Tokens */ },
    { number: "21", title: "Push TX", category: "scripts" /* Scripts */ },
    {
      number: "22",
      title: "Overlay Network Data Synchronization",
      category: "overlays" /* Overlays */
    },
    {
      number: "23",
      title: "Confederacy Host Interconnect Protocol (CHIP)",
      category: "overlays" /* Overlays */
    },
    {
      number: "24",
      title: "Overlay Network Lookup Services",
      category: "overlays" /* Overlays */
    },
    {
      number: "25",
      title: "Confederacy Lookup Availability Protocol (CLAP)",
      category: "overlays" /* Overlays */
    },
    {
      number: "26",
      title: "Universal Hash Resolution Protocol",
      category: "overlays" /* Overlays */
    },
    {
      number: "27",
      title: "Direct Payment Protocol (DPP)",
      category: "payments" /* Payments */
    },
    {
      number: "28",
      title: "Paymail Payment Destinations",
      category: "payments" /* Payments */
    },
    {
      number: "29",
      title: "Simple Authenticated BSV P2PKH Payment Protocol",
      category: "payments" /* Payments */
    },
    {
      number: "30",
      title: "Transaction Extended Format (EF)",
      category: "transactions" /* Transactions */
    },
    {
      number: "31",
      title: "Authrite Mutual Authentication",
      category: "peer-to-peer" /* PeerToPeer */
    },
    {
      number: "32",
      title: "BIP32 Key Derivation Scheme",
      category: "key-derivation" /* KeyDerivation */
    },
    {
      number: "33",
      title: "PeerServ Message Relay Interface",
      category: "peer-to-peer" /* PeerToPeer */
    },
    {
      number: "34",
      title: "PeerServ Host Interconnect Protocol",
      category: "peer-to-peer" /* PeerToPeer */
    },
    {
      number: "36",
      title: "Format for Bitcoin Outpoints",
      category: "outpoints" /* Outpoints */
    },
    {
      number: "37",
      title: "Spending Instructions Extension for UTXO Storage Format",
      category: "outpoints" /* Outpoints */
    },
    {
      number: "41",
      title: "PacketPay HTTP Payment Mechanism",
      category: "payments" /* Payments */
    },
    {
      number: "42",
      title: "BSV Key Derivation Scheme (BKDS)",
      category: "key-derivation" /* KeyDerivation */
    },
    {
      number: "43",
      title: "Security Levels, Protocol IDs, Key IDs and Counterparties",
      category: "key-derivation" /* KeyDerivation */
    },
    {
      number: "44",
      title: "Admin-reserved and Prohibited Key Derivation Protocols",
      category: "key-derivation" /* KeyDerivation */
    },
    {
      number: "45",
      title: "Definition of UTXOs as Bitcoin Tokens",
      category: "tokens" /* Tokens */
    },
    {
      number: "46",
      title: "Wallet Transaction Output Tracking (Output Baskets)",
      category: "wallet" /* Wallet */
    },
    {
      number: "47",
      title: "Bare Multi-Signature",
      category: "scripts" /* Scripts */
    },
    { number: "48", title: "Pay to Push Drop", category: "scripts" /* Scripts */ },
    {
      number: "49",
      title: "Users should never see an address",
      category: "opinions" /* Opinions */
    },
    {
      number: "50",
      title: "Submitting Received Payments to a Wallet",
      category: "wallet" /* Wallet */
    },
    {
      number: "51",
      title: "List of user experiences",
      category: "opinions" /* Opinions */
    },
    {
      number: "52",
      title: "Identity Certificates",
      category: "peer-to-peer" /* PeerToPeer */
    },
    {
      number: "53",
      title: "Certificate Creation and Revelation",
      category: "wallet" /* Wallet */
    },
    {
      number: "54",
      title: "Hybrid Payment Mode for DPP",
      category: "payments" /* Payments */
    },
    {
      number: "55",
      title: "HTTPS Transport Mechanism for DPP",
      category: "payments" /* Payments */
    },
    {
      number: "56",
      title: "Unified Abstract Wallet-to-Application Messaging Layer",
      category: "wallet" /* Wallet */
    },
    {
      number: "57",
      title: "Legitimate Uses for mAPI",
      category: "opinions" /* Opinions */
    },
    {
      number: "58",
      title: "Merkle Path JSON format",
      category: "transactions" /* Transactions */
    },
    {
      number: "59",
      title: "Security and Scalability Benefits of UTXO-based Overlay Networks",
      category: "opinions" /* Opinions */
    },
    {
      number: "60",
      title: "Simplifying State Machine Event Chains in Bitcoin",
      category: "state-machines" /* StateMachines */
    },
    {
      number: "61",
      title: "Compound Merkle Path Format",
      category: "transactions" /* Transactions */
    },
    {
      number: "62",
      title: "Background Evaluation Extended Format (BEEF) Transactions",
      category: "transactions" /* Transactions */
    },
    {
      number: "63",
      title: "Genealogical Identity Protocol",
      category: "peer-to-peer" /* PeerToPeer */
    },
    {
      number: "64",
      title: "Overlay Network Transaction History Tracking",
      category: "overlays" /* Overlays */
    },
    {
      number: "65",
      title: "Transaction Labels and List Actions",
      category: "wallet" /* Wallet */
    },
    {
      number: "66",
      title: "Output Basket Removal and Certificate Deletion",
      category: "wallet" /* Wallet */
    },
    {
      number: "67",
      title: "Simplified Payment Verification",
      category: "transactions" /* Transactions */
    },
    {
      number: "68",
      title: "Publishing Trust Anchor Details at an Internet Domain",
      category: "peer-to-peer" /* PeerToPeer */
    },
    {
      number: "69",
      title: "Revealing Key Linkages",
      category: "key-derivation" /* KeyDerivation */
    },
    {
      number: "70",
      title: "Paymail BEEF Transaction",
      category: "payments" /* Payments */
    },
    {
      number: "71",
      title: "Merkle Path Binary Format",
      category: "transactions" /* Transactions */
    },
    {
      number: "72",
      title: "Protecting BRC-69 Key Linkage Information in Transit",
      category: "key-derivation" /* KeyDerivation */
    },
    {
      number: "73",
      title: "Group Permissions for App Access",
      category: "wallet" /* Wallet */
    },
    {
      number: "74",
      title: "BSV Unified Merkle Path (BUMP) Format",
      category: "transactions" /* Transactions */
    },
    {
      number: "75",
      title: "Mnemonic For Master Private Key",
      category: "key-derivation" /* KeyDerivation */
    },
    {
      number: "76",
      title: "Graph Aware Sync Protocol",
      category: "transactions" /* Transactions */
    },
    {
      number: "77",
      title: "Message Signature Creation and Verification",
      category: "peer-to-peer" /* PeerToPeer */
    },
    {
      number: "78",
      title: "Serialization Format for Portable Encrypted Messages",
      category: "peer-to-peer" /* PeerToPeer */
    },
    {
      number: "79",
      title: "Token Exchange Protocol for UTXO-based Overlay Networks",
      category: "tokens" /* Tokens */
    },
    {
      number: "80",
      title: "Improving on MLD for BSV Multicast Services",
      category: "opinions" /* Opinions */
    },
    {
      number: "81",
      title: "Private Overlays with P2PKH Transactions",
      category: "overlays" /* Overlays */
    },
    {
      number: "82",
      title: "Defining a Scalable IPv6 Multicast Protocol for Blockchain Transaction Broadcast",
      category: "peer-to-peer" /* PeerToPeer */
    },
    {
      number: "83",
      title: "Scalable Transaction Processing in the BSV Network",
      category: "transactions" /* Transactions */
    },
    {
      number: "84",
      title: "Linked Key Derivation Scheme",
      category: "key-derivation" /* KeyDerivation */
    },
    {
      number: "85",
      title: "Proven Identity Key Exchange (PIKE)",
      category: "peer-to-peer" /* PeerToPeer */
    },
    {
      number: "86",
      title: "Bidirectionally Authenticated Derivation of Privacy Restricted Type 42 Keys",
      category: "key-derivation" /* KeyDerivation */
    },
    {
      number: "87",
      title: "Standardized Naming Conventions for BRC-22 Topic Managers and BRC-24 Lookup Services",
      category: "overlays" /* Overlays */
    },
    {
      number: "88",
      title: "Overlay Services Synchronization Architecture",
      category: "overlays" /* Overlays */
    },
    {
      number: "89",
      title: "Web 3.0 Standard (at a high level)",
      category: "opinions" /* Opinions */
    },
    {
      number: "90",
      title: "Thoughts on the Mandala Network",
      category: "opinions" /* Opinions */
    },
    {
      number: "91",
      title: "Outputs, Overlays, and Scripts in the Mandala Network",
      category: "opinions" /* Opinions */
    },
    {
      number: "92",
      title: "Mandala Token Protocol",
      category: "tokens" /* Tokens */
    },
    {
      number: "93",
      title: "Limitations of BRC-69 Key Linkage Revelation",
      category: "key-derivation" /* KeyDerivation */
    },
    {
      number: "94",
      title: "Verifiable Revelation of Shared Secrets Using Schnorr Protocol",
      category: "key-derivation" /* KeyDerivation */
    },
    {
      number: "95",
      title: "Atomic BEEF Transactions",
      category: "transactions" /* Transactions */
    },
    {
      number: "96",
      title: "BEEF V2 Txid Only Extension",
      category: "transactions" /* Transactions */
    },
    {
      number: "97",
      title: "Extensible Proof-Type Format for Specific Key Linkage Claims",
      category: "wallet" /* Wallet */
    },
    {
      number: "98",
      title: "P Protocols: Allowing future wallet protocol permission schemes",
      category: "wallet" /* Wallet */
    },
    {
      number: "99",
      title: "P Baskets: Allowing Future Wallet Basket and Digital Asset Permission Schemes",
      category: "wallet" /* Wallet */
    },
    {
      number: "100",
      title: "Unified, Vendor-Neutral, Unchanging, and Open BSV Blockchain Standard Wallet-to-Application Interface",
      category: "wallet" /* Wallet */
    },
    {
      number: "101",
      title: "Diverse Facilitators and URL Protocols for SHIP and SLAP Overlay Advertisements",
      category: "overlays" /* Overlays */
    },
    {
      number: "102",
      title: "The deployment-info.json Specification",
      category: "apps" /* Apps */
    },
    {
      number: "103",
      title: "Peer-to-Peer Mutual Authentication and Certificate Exchange Protocol",
      category: "peer-to-peer" /* PeerToPeer */
    },
    {
      number: "104",
      title: "HTTP Transport for BRC-103 Mutual Authentication",
      category: "peer-to-peer" /* PeerToPeer */
    },
    {
      number: "105",
      title: "HTTP Service Monetization Framework",
      category: "payments" /* Payments */
    }
  ];
  for (const brc of brcs) {
    const paddedNumber = brc.number.padStart(4, "0");
    const titleKeywords = brc.title.replace(/[^a-zA-Z0-9 ]/g, "").split(" ");
    const keyword = titleKeywords.find((word) => word.length > 3 && ![
      "with",
      "from",
      "that",
      "this",
      "your",
      "when",
      "then",
      "them",
      "they",
      "bitcoin"
    ].includes(word.toLowerCase())) || titleKeywords[0] || "brc";
    const resourceId = `brc_${paddedNumber}_${keyword.toLowerCase()}`;
    const url = `https://raw.githubusercontent.com/bitcoin-sv/BRCs/master/${brc.category}/${brc.number.padStart(4, "0")}.md`;
    server.resource(resourceId, url, {
      title: `BRC-${brc.number}: ${brc.title}`,
      description: `Bitcoin SV BRC-${brc.number}: ${brc.title}`
    }, async (uri) => {
      const resp = await fetch(uri.href);
      if (!resp.ok) {
        throw new Error(`BRC-${brc.number} not found at ${uri.href}`);
      }
      const text = await resp.text();
      return {
        contents: [
          {
            uri: uri.href,
            text
          }
        ]
      };
    });
  }
}

// resources/changelog.ts
var CHANGELOG_URL = "https://raw.githubusercontent.com/b-open-io/bsv-mcp/master/CHANGELOG.md";
async function fetchChangelog() {
  try {
    const response = await fetch(CHANGELOG_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch changelog: ${response.status} ${response.statusText}`);
    }
    return await response.text();
  } catch (error) {
    console.error("Error fetching changelog:", error);
    return `# BSV MCP Server Changelog

Error: Could not load changelog content.
Please check the server logs for more details.`;
  }
}
function registerChangelogResource(server) {
  server.resource("bsv-mcp-changelog", "https://github.com/b-open-io/bsv-mcp/blob/main/CHANGELOG.md", {
    title: "BSV MCP Server Changelog",
    description: "Version history and changelog for the BSV MCP server"
  }, async (uri) => {
    const changelogContent = await fetchChangelog();
    return {
      contents: [
        {
          uri: uri.href,
          text: changelogContent
        }
      ]
    };
  });
}

// resources/junglebus.ts
var JUNGLEBUS_DOCS_URL = "https://junglebus.gorillapool.io/docs/";
function getJungleBusDocumentation() {
  return `# JungleBus API Documentation

## Overview

JungleBus is a transaction monitoring service for Bitcoin SV that allows applications to subscribe to transaction events and filter them based on specific criteria. The API provides both subscription and querying capabilities.

## API Endpoints

### Base URL
\`\`\`
https://junglebus.gorillapool.io/v1
\`\`\`

### Transaction API

#### Get Transaction by ID
\`\`\`
GET /transaction/get/{txid}
\`\`\`

Returns detailed information about a specific transaction, including:
- Transaction data (hex format)
- Block information (hash, height, time)
- Input and output details
- Address information

#### Get Transactions by Block Hash
\`\`\`
GET /block/{blockhash}/transactions
\`\`\`

Returns all transactions within a specific block.

### Subscription API

#### Create Subscription
\`\`\`
POST /subscribe
\`\`\`

Create a new subscription to monitor transactions based on filtering criteria.

Example request body:
\`\`\`json
{
  "callback": "https://your-callback-url.com",
  "fromBlock": 0,
  "query": {
    "find": {
      "out.tape.cell.s": "BEEF"
    }
  }
}
\`\`\`

#### Delete Subscription
\`\`\`
DELETE /subscribe/{id}
\`\`\`

Deletes an existing subscription.

### Network API

#### Get Network Info
\`\`\`
GET /network/info
\`\`\`

Returns current blockchain network information, including block height and other statistics.

## Client Implementations

### TypeScript Client

Installation:
\`\`\`bash
$ npm install @gorillapool/js-junglebus
\`\`\`

Usage:
\`\`\`javascript
import { JungleBusClient } from '@gorillapool/js-junglebus';

const server = "junglebus.gorillapool.io";
const jungleBusClient = new JungleBusClient(server, {
  onConnected(ctx) {
    // add your own code here
    console.log(ctx);
  },
  onConnecting(ctx) {
    // add your own code here
    console.log(ctx);
  },
  onDisconnected(ctx) {
    // add your own code here
    console.log(ctx);
  },
  onError(ctx) {
    // add your own code here
    console.error(ctx);
  }
});

// create subscriptions in the dashboard of the JungleBus website
const subId = "...."; // fill in the ID for the subscription
const fromBlock = 750000;

const subscription = jungleBusClient.Subscribe(
  subId,
  fromBlock,
  onPublish(tx) => {
    // add your own code here
    console.log(tx);
  },
  onStatus(ctx) => {
    // add your own code here
    console.log(ctx);
  },
  onError(ctx) => {
    // add your own code here
    console.log(ctx);
  },
  onMempool(tx) => {
    // add your own code here
    console.log(tx);
  }
);

// For lite mode (transaction hash and block height only)
await client.Subscribe("a5e2fa655c41753331539a2a86546bf9335ff6d9b7a512dc9acddb00ab9985c0", 1550000, onPublish, onStatus, onError, onMempool, true);
\`\`\`

### Go Client

Installation:
\`\`\`bash
go get github.com/GorillaPool/go-junglebus
\`\`\`

Usage:
\`\`\`go
package main

import (
  "context"
  "log"
  "sync"
  "github.com/GorillaPool/go-junglebus"
  "github.com/GorillaPool/go-junglebus/models"
)

func main() {
  wg := &sync.WaitGroup{}
  
  junglebusClient, err := junglebus.New(
    junglebus.WithHTTP("https://junglebus.gorillapool.io"),
  )
  if err != nil {
    log.Fatalln(err.Error())
  }
  
  subscriptionID := "..." // fill in the ID for the subscription
  fromBlock := uint64(750000)
  
  eventHandler := junglebus.EventHandler{
    // do not set this function to leave out mined transactions
    OnTransaction: func(tx *models.TransactionResponse) {
      log.Printf("[TX]: %d: %v", tx.BlockHeight, tx.Id)
    },
    // do not set this function to leave out mempool transactions
    OnMempool: func(tx *models.TransactionResponse) {
      log.Printf("[MEMPOOL TX]: %v", tx.Id)
    },
    OnStatus: func(status *models.ControlResponse) {
      log.Printf("[STATUS]: %v", status)
    },
    OnError: func(err error) {
      log.Printf("[ERROR]: %v", err)
    },
  }
  
  var subscription *junglebus.Subscription
  if subscription, err = junglebusClient.Subscribe(context.Background(), subscriptionID, fromBlock, eventHandler); err != nil {
    log.Printf("ERROR: failed getting subscription %s", err.Error())
  }
  
  // For lite mode
  if subscription, err := junglebusClient.SubscribeWithQueue(context.Background(), subscriptionID, fromBlock, 0, eventHandler, &junglebus.SubscribeOptions{
    QueueSize: 100000,
    LiteMode: true,
  }); err != nil {
    log.Printf("ERROR: failed getting subscription %s", err.Error())
  }
  
  wg.Add(1)
  wg.Wait()
}
\`\`\`

## Further Reading

For complete API documentation, visit [JungleBus Docs](${JUNGLEBUS_DOCS_URL})
`;
}
function registerJungleBusResource(server) {
  server.resource("junglebus-api-docs", JUNGLEBUS_DOCS_URL, {
    title: "JungleBus API Documentation",
    description: "API documentation for JungleBus, a transaction monitoring service for Bitcoin SV"
  }, async (uri) => {
    const documentationContent = getJungleBusDocumentation();
    return {
      contents: [
        {
          uri: uri.href,
          text: documentationContent
        }
      ]
    };
  });
}

// resources/resources.ts
function registerResources(server) {
  registerBRCsResources(server);
  registerChangelogResource(server);
  registerJungleBusResource(server);
  registerBitcomResource(server);
}

// tools/bsv/getPrice.ts
var PRICE_CACHE_DURATION = 5 * 60 * 1000;
var cachedPrice = null;
async function getBsvPriceWithCache() {
  if (cachedPrice && Date.now() - cachedPrice.timestamp < PRICE_CACHE_DURATION) {
    return cachedPrice.value;
  }
  const res = await fetch("https://api.whatsonchain.com/v1/bsv/main/exchangerate");
  if (!res.ok)
    throw new Error("Failed to fetch price");
  const data = await res.json();
  const price = Number(data.rate);
  if (Number.isNaN(price) || price <= 0)
    throw new Error("Invalid price received");
  cachedPrice = {
    value: price,
    timestamp: Date.now()
  };
  return price;
}

// tools/a2b/discover.ts
import { z } from "zod";
var OVERLAY_API_URL = "https://a2b-overlay-production.up.railway.app/v1";
var a2bDiscoverArgsSchema = z.object({
  queryType: z.enum(["agent", "tool"]).describe("Type of discovery to perform"),
  query: z.string().describe("Search agent or tool names, descriptions"),
  limit: z.number().optional().describe("Limit the number of results"),
  offset: z.number().optional().describe("Offset the results"),
  fromBlock: z.number().optional().describe("From block"),
  toBlock: z.number().optional().describe("To block")
});
function registerA2bDiscoverTool(server) {
  server.tool("a2b_discover", "Search on-chain agent and MCP tool records. Use 'agent' to search for agents, 'tool' to search for MCP tools.", { ...a2bDiscoverArgsSchema.shape }, async ({ queryType, query, limit, offset, fromBlock, toBlock }, extra) => {
    try {
      const params = new URLSearchParams;
      params.set("type", queryType);
      let searchEndpoint = "/search/enhanced";
      if (!query || !query.trim()) {
        searchEndpoint = "/search";
      } else {
        params.set("q", query);
      }
      params.set("limit", limit?.toString() ?? "10");
      params.set("offset", offset?.toString() ?? "0");
      if (fromBlock) {
        params.set("fromBlock", fromBlock.toString());
      }
      if (toBlock) {
        params.set("toBlock", toBlock.toString());
      }
      const searchUrl = `${OVERLAY_API_URL}${searchEndpoint}?${params.toString()}`;
      const response = await fetch(searchUrl, {
        method: "GET",
        headers: {
          Accept: "application/json"
        }
      });
      if (!response.ok) {
        throw new Error(`API returned status ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      let result = "";
      if (data?.items?.length > 0) {
        result = `Found ${data.items.length} ${queryType}(s):

`;
        data.items.forEach((item, index) => {
          result += `${index + 1}. **${item.serverName || "Unknown"}** - ${item.description || "No description"}
`;
          if (item.command) {
            const cmdArgs = item.args ? Object.values(item.args).join(" ") : "";
            result += `   Command: \`${item.command} ${cmdArgs}\`
`;
          }
          if (item.tools?.length) {
            result += `   Tools: ${item.tools.length} available
`;
          }
          if (item.keywords?.length) {
            result += `   Keywords: ${item.keywords.join(", ")}
`;
          }
          if (item.outpoint) {
            result += `   Outpoint: ${item.outpoint}
`;
          }
          if (item.blockHeight !== undefined) {
            const date = item.timestamp ? new Date(item.timestamp).toLocaleDateString() : "Unknown date";
            result += `   Block: ${item.blockHeight}, ${date}
`;
          }
          result += `
`;
        });
      } else {
        result = `No ${queryType} results found.`;
      }
      return {
        content: [{ type: "text", text: result }],
        isError: false
      };
    } catch (error) {
      console.error("Search error:", error);
      return {
        content: [
          {
            type: "text",
            text: `Error querying A2B Overlay: ${error instanceof Error ? error.message : String(error)}`
          }
        ],
        isError: true
      };
    }
  });
}

// tools/bap/friend.ts
import {
  fromUtxo,
  isBroadcastFailure,
  isBroadcastResponse,
  P2PKH as P2PKH2,
  PrivateKey,
  SatoshisPerKilobyte,
  Script,
  Transaction as Transaction3,
  Utils as Utils3
} from "@bsv/sdk";
import { BAP, MemberID } from "bsv-bap";
import { z as z2 } from "zod";

// tools/constants.ts
var MARKET_FEE_PERCENTAGE = 0.03;
var MARKET_WALLET_ADDRESS = "15q8YQSqUa9uTh6gh4AVixxq29xkpBBP9z";
var MINIMUM_MARKET_FEE_SATOSHIS = 1e4;
var BAP_PREFIX = "1BAPSuaPnfGnSBM3GLV9yhxUdYe4vGbdMT";
var B_PREFIX = "19HxigV4QyBv3tHpQVcUEQyq1pzZVdoAut";
var MAP_PREFIX = "1PuQa7K62MiKCtssSLKy1kh56WWU7MtUR5";
var AIP_PREFIX = "1HPcP7a4kQjpJzyV4HWHKagon76KC3BsZA";
var PUBLIC_URL = process.env.PUBLIC_URL || "";
var BMAP_URL = process.env.PUBLIC_BMAP_URL || "https://bmap-api-production.up.railway.app";
var ORDFS_URL = process.env.PUBLIC_ORDFS_URL || "https://ordfs.network";
var BSOCIAL_API_URL = "https://api.sigmaidentity.com/v1";
var V5_API_URL = "https://ordinals.1sat.app/v5";

// utils/buffer.ts
function numArrayToBuffer(numArray) {
  return new Uint8Array(numArray).buffer;
}

// utils/broadcaster.ts
class BsocialBroadcaster {
  async broadcast(transaction) {
    const response = await fetch(`${BSOCIAL_API_URL}/submit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "X-BSV-TOPIC": "tm_bsocial,tm_bap"
      },
      body: numArrayToBuffer(transaction.toBEEF())
    });
    if (!response.ok) {
      return {
        status: "error",
        code: response.statusText,
        txid: transaction.id("hex"),
        description: response.statusText
      };
    }
    return {
      status: "success",
      txid: transaction.id("hex"),
      message: "Transaction broadcasted successfully"
    };
  }
}

class V5Broadcaster {
  async broadcast(transaction) {
    const response = await fetch(`${V5_API_URL}/submit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream"
      },
      body: numArrayToBuffer(transaction.toBinary())
    });
    const v5Response = await response.json();
    if (!response.ok) {
      return {
        status: "error",
        code: response.statusText,
        txid: transaction.id("hex"),
        description: v5Response.error
      };
    }
    if (v5Response.success) {
      return {
        status: "success",
        txid: transaction.id("hex"),
        message: "Transaction broadcasted successfully"
      };
    }
    return {
      status: "error",
      code: response.statusText,
      txid: transaction.id("hex"),
      description: v5Response.error
    };
  }
}

// utils/keys.ts
import { Hash, HD, Utils } from "@bsv/sdk";
var friendPrivateKeyFromMemberIdKey = (memberIdKey, targetBapId) => {
  return memberIdKey.deriveChild(memberIdKey.toPublicKey(), targetBapId);
};

// tools/wallet/fetchPaymentUtxos.ts
import { Utils as Utils2 } from "@bsv/sdk";

// tools/wallet/utxo.ts
import { Transaction } from "@bsv/sdk";
async function getBeefTransactionById(txid) {
  const url = `https://junglebus.gorillapool.io/v1/transaction/beef/${txid}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`Failed to fetch transaction ${txid} from Junglebus: ${response.status} ${response.statusText}`);
      return null;
    }
    const rawTxBuffer = await response.arrayBuffer();
    if (!rawTxBuffer) {
      console.warn(`Empty raw transaction buffer for ${txid} from Junglebus`);
      return null;
    }
    const uint8Array = arrayBufferToUint8Array(rawTxBuffer);
    const tx = Transaction.fromBEEF(uint8Array, txid);
    return tx;
  } catch (error) {
    console.warn(`Error fetching or parsing transaction ${txid}: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

// tools/wallet/fetchPaymentUtxos.ts
var { toBase64, toHex, toArray } = Utils2;
async function fetchPaymentUtxos(address) {
  if (!address) {
    console.error("fetchPaymentUtxos: No address provided");
    return;
  }
  try {
    const response = await fetch(`https://api.whatsonchain.com/v1/bsv/main/address/${address}/unspent`);
    if (!response.ok) {
      console.error(`WhatsOnChain API error: ${response.status} ${response.statusText}`);
      return;
    }
    const data = await response.json();
    if (!Array.isArray(data)) {
      console.error("Invalid response format from WhatsOnChain API");
      return;
    }
    const utxos = await Promise.all(data.map(async (utxo) => {
      const tx = await getBeefTransactionById(utxo.tx_hash);
      const script = tx?.outputs[utxo.tx_pos]?.lockingScript.toHex();
      if (!script) {
        console.error(`Could not get script for UTXO: ${utxo.tx_hash}:${utxo.tx_pos}`);
        return null;
      }
      return {
        txid: utxo.tx_hash,
        vout: utxo.tx_pos,
        satoshis: utxo.value,
        script
      };
    }));
    const validUtxos = utxos.filter((utxo) => utxo !== null);
    return validUtxos;
  } catch (error) {
    console.error("Error fetching payment UTXOs:", error);
    return;
  }
}
async function fetchPaymentUtxosFromV5(address) {
  try {
    const url = `${V5_API_URL}/own/${address}/utxos?refresh=true&txo=true&script=true&limit=250&tags=p2pkh`;
    console.error(`Fetching UTXOs from V5: ${url}`);
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`V5 UTXO fetch failed: ${response.status} ${response.statusText}`);
      return;
    }
    const data = await response.json();
    if (!Array.isArray(data)) {
      console.error(`V5 UTXO response was not an array: ${typeof data}`);
      return;
    }
    const utxos = [];
    for (const utxo of data) {
      if (!utxo.data.p2pkh) {
        continue;
      }
      const [txid, vout] = utxo.outpoint.split("_");
      if (!txid || !vout) {
        console.error(`Invalid outpoint: ${utxo.outpoint}`);
        continue;
      }
      utxos.push({
        txid,
        vout: Number.parseInt(vout),
        satoshis: utxo.satoshis,
        script: toHex(toArray(utxo.script, "base64"))
      });
    }
    return utxos;
  } catch (error) {
    console.error("Error fetching payment UTXOs from V5:", error);
    return;
  }
}

// tools/bap/friend.ts
var { toArray: toArray2, toHex: toHex2 } = Utils3;
var APP_DOMAIN = "bsv-mcp";
var bapFriendArgsSchema = z2.object({
  targetBapId: z2.string().min(1, "targetBapId is required.")
});
function registerBapFriendTool(server, wallet, xprv, config) {
  server.tool("bap_friend", "Initiates a friend request to another BAP ID by broadcasting an on-chain MAP transaction.", { ...bapFriendArgsSchema.shape }, async ({ targetBapId }, extra) => {
    const logFunc = console.error;
    try {
      if (!xprv) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: "Server does not have a BAP master key (xprv). Cannot derive friend public key."
            }
          ]
        };
      }
      const payPk = wallet.getPaymentKey();
      const identityPk = wallet.getIdentityKey();
      if (!identityPk || !payPk) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: !payPk ? "Wallet private key not available. Cannot fund friend request transaction." : "Wallet identity key not available. Cannot derive friend public key."
            }
          ]
        };
      }
      const bap = new BAP(xprv);
      const idpk = PrivateKey.fromWif(bap.newId().exportMemberBackup().derivedPrivateKey);
      const identityInstance = new MemberID(idpk);
      const paymentAddress = payPk.toAddress();
      const friendPubKey = friendPrivateKeyFromMemberIdKey(identityPk, targetBapId).toPublicKey().toString();
      const payloadParts = [
        MAP_PREFIX,
        "SET",
        "app",
        APP_DOMAIN,
        "type",
        "friend",
        "bapID",
        targetBapId,
        "publicKey",
        friendPubKey
      ];
      const payloadBuffers = payloadParts.map((part) => toArray2(part));
      const signedBuffers = identityInstance.signOpReturnWithAIP(payloadBuffers);
      const payloadHex = signedBuffers.map((b) => toHex2(b));
      const asmPayload = `OP_0 ${payloadHex.join(" ")}`;
      const opReturnScript = Script.fromASM(asmPayload);
      const tx = new Transaction3;
      tx.addOutput({ lockingScript: opReturnScript, satoshis: 0 });
      const utxos = await fetchPaymentUtxosFromV5(paymentAddress);
      if (!utxos || utxos.length === 0) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `No UTXOs available for payment address ${paymentAddress}. Cannot send friend request.`
            }
          ]
        };
      }
      const feeModel = new SatoshisPerKilobyte(10);
      let totalInput = 0n;
      let estFee = await feeModel.computeFee(tx);
      for (const utxo of utxos) {
        if (totalInput >= BigInt(estFee))
          break;
        const unlockTemplate = new P2PKH2().unlock(payPk, "all", false, utxo.satoshis, Script.fromBinary(toArray2(utxo.script, "hex")));
        const input = fromUtxo(utxo, unlockTemplate);
        tx.addInput(input);
        totalInput += BigInt(utxo.satoshis);
        estFee = await feeModel.computeFee(tx);
      }
      if (totalInput < BigInt(estFee)) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Not enough funds to cover fee. Needed ${estFee}, have ${totalInput}.`
            }
          ]
        };
      }
      const change = totalInput - BigInt(estFee);
      if (change > 0n) {
        tx.addOutput({
          lockingScript: new P2PKH2().lock(paymentAddress),
          satoshis: Number(change),
          change: true
        });
      }
      await tx.fee(feeModel);
      await tx.sign();
      const txHex = tx.toHex();
      const txid = tx.id("hex");
      if (config?.disableBroadcasting) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                disabledBroadcast: true,
                txid,
                rawTx: txHex,
                message: `Broadcasting disabled. Friend request transaction built for ${targetBapId}.`
              })
            }
          ]
        };
      }
      const broadcaster = new BsocialBroadcaster;
      const broadcastResult = await tx.broadcast(broadcaster);
      let success = true;
      let errorMsg;
      let resultTxid = txid;
      if (isBroadcastResponse(broadcastResult)) {
        resultTxid = broadcastResult.txid;
      } else if (isBroadcastFailure(broadcastResult)) {
        success = false;
        const failure = broadcastResult;
        errorMsg = `Broadcast failed: ${failure.description} (Code: ${failure.code})`;
        if (failure.txid)
          resultTxid = failure.txid;
      }
      return {
        isError: !success,
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success,
              txid: resultTxid,
              rawTx: txHex,
              message: success ? `Friend request sent to ${targetBapId}.` : errorMsg ?? "Broadcast failed"
            })
          }
        ]
      };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Failed to send friend request: ${errMsg}`
          }
        ]
      };
    }
  });
}

// tools/bap/generate.ts
import os2 from "node:os";
import path2 from "node:path";
import {
  Utils as BSVUtils,
  fromUtxo as fromUtxo2,
  HD as HD2,
  isBroadcastFailure as isBroadcastFailure2,
  P2PKH as P2PKH3,
  PrivateKey as PrivateKey3,
  Script as Script2,
  Transaction as Transaction4
} from "@bsv/sdk";
import { BAP as BAP2 } from "bsv-bap";
import { z as z3 } from "zod";

// utils/keyManager.ts
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PrivateKey as PrivateKey2 } from "@bsv/sdk";
import {
  decryptBackup,
  encryptBackup
} from "bitcoin-backup";

class SecureKeyManager {
  keyDir;
  legacyFile;
  encryptedFile;
  backupFile;
  constructor(config = {}) {
    this.keyDir = config.keyDir || path.join(os.homedir(), ".bsv-mcp");
    this.legacyFile = path.join(this.keyDir, "keys.json");
    this.encryptedFile = path.join(this.keyDir, "keys.bep");
    this.backupFile = path.join(this.keyDir, "keys.bep.backup");
  }
  async loadKeys(passphrase) {
    if (passphrase && this.hasEncryptedBackup()) {
      const keys = await this.loadEncryptedKeys(passphrase);
      return { keys, source: "encrypted" };
    }
    if (this.hasEncryptedBackup() && !passphrase) {
      console.error("Encrypted keys found (keys.bep). Provide a passphrase via loadKeys(passphrase) to decrypt, or use keys.json / PRIVATE_KEY_WIF instead.");
    }
    if (this.hasLegacyKeys()) {
      const keys = this.loadLegacyKeys();
      return { keys, source: "legacy" };
    }
    return { keys: {}, source: "none" };
  }
  async saveKeys(keys, options = {}) {
    if (options.passphrase) {
      await this.saveEncryptedKeys(keys, options.passphrase);
      return;
    }
    this.saveLegacyKeys(keys);
  }
  loadLegacyKeys() {
    try {
      const content = fs.readFileSync(this.legacyFile, "utf8");
      const data = JSON.parse(content);
      return {
        payPk: data.payPk ? PrivateKey2.fromWif(data.payPk) : undefined,
        identityPk: data.identityPk ? PrivateKey2.fromWif(data.identityPk) : undefined,
        xprv: data.xprv
      };
    } catch (error) {
      throw new Error(`Failed to load legacy keys: ${error}`);
    }
  }
  saveLegacyKeys(keys) {
    const data = {
      payPk: keys.payPk?.toWif(),
      identityPk: keys.identityPk?.toWif(),
      xprv: keys.xprv
    };
    fs.mkdirSync(this.keyDir, { recursive: true, mode: 448 });
    fs.writeFileSync(this.legacyFile, JSON.stringify(data, null, 2), {
      mode: 384
    });
  }
  async loadEncryptedKeys(passphrase) {
    const encrypted = fs.readFileSync(this.encryptedFile, "utf8");
    const decrypted = await decryptBackup(encrypted, passphrase);
    if ("payPk" in decrypted && "identityPk" in decrypted) {
      const backup = decrypted;
      let xprv;
      if (fs.existsSync(this.legacyFile)) {
        try {
          const legacyData = JSON.parse(fs.readFileSync(this.legacyFile, "utf8"));
          xprv = legacyData.xprv;
        } catch (_e) {}
      }
      return {
        payPk: backup.payPk ? PrivateKey2.fromWif(backup.payPk) : undefined,
        identityPk: backup.identityPk ? PrivateKey2.fromWif(backup.identityPk) : undefined,
        xprv
      };
    }
    if ("xprv" in decrypted) {
      const backup = decrypted;
      return {
        payPk: undefined,
        identityPk: undefined,
        xprv: backup.xprv
      };
    }
    throw new Error("Unknown backup format");
  }
  async saveEncryptedKeys(keys, passphrase) {
    const data = {
      payPk: keys.payPk?.toWif() || "",
      identityPk: keys.identityPk?.toWif() || "",
      ordPk: "",
      label: "BSV MCP Keys",
      createdAt: new Date().toISOString()
    };
    if (keys.xprv) {
      const legacyData = {
        xprv: keys.xprv
      };
      fs.mkdirSync(this.keyDir, { recursive: true, mode: 448 });
      fs.writeFileSync(this.legacyFile, JSON.stringify(legacyData, null, 2), {
        mode: 384
      });
    }
    const encrypted = await encryptBackup(data, passphrase);
    if (fs.existsSync(this.encryptedFile)) {
      fs.copyFileSync(this.encryptedFile, this.backupFile);
    }
    fs.mkdirSync(this.keyDir, { recursive: true, mode: 448 });
    fs.writeFileSync(this.encryptedFile, encrypted, { mode: 384 });
  }
  hasEncryptedBackup() {
    return fs.existsSync(this.encryptedFile);
  }
  hasLegacyKeys() {
    return fs.existsSync(this.legacyFile);
  }
  getStatus() {
    const hasEncrypted = this.hasEncryptedBackup();
    const hasLegacy = this.hasLegacyKeys();
    return {
      hasEncrypted,
      hasLegacy,
      isSecure: hasEncrypted && !hasLegacy
    };
  }
}
var keyManager = new SecureKeyManager;

// tools/bap/generate.ts
var { toArray: toArray3 } = BSVUtils;
var KEY_DIR = path2.join(os2.homedir(), ".bsv-mcp");
var KEY_FILE_PATH = path2.join(KEY_DIR, "keys.json");
var bapGenerateArgsSchema = z3.object({
  alternateName: z3.string().optional().describe("Alternate name for the BAP identity profile"),
  description: z3.string().optional().describe("Description for the BAP identity profile")
});
async function generateBapKeys(args) {
  const keyManager2 = new SecureKeyManager({ keyDir: KEY_DIR });
  let tempXprv = "";
  let identityPk;
  let payPkToPreserve;
  try {
    let keys;
    let source;
    try {
      const result = await keyManager2.loadKeys();
      keys = result.keys;
      source = result.source;
    } catch (loadError) {
      const errorMsg = loadError instanceof Error ? loadError.message : String(loadError);
      console.error(`ERROR: Failed to read keys from secure storage: ${errorMsg}`);
      if (errorMsg.includes("JSON Parse error") || errorMsg.includes("JSON.parse")) {
        const match = errorMsg.match(/JSON Parse error[^.]*\.?/);
        const jsonError = match ? match[0] : "JSON Parse error";
        return {
          success: false,
          error: `Could not read or parse keys.json: ${jsonError}`
        };
      }
      return {
        success: false,
        error: `Failed to read keys: ${errorMsg}`
      };
    }
    if (!keys.payPk) {
      console.error("ERROR: Payment Private Key (payPk) does not exist in secure storage.");
      const errorMessage = source === "none" ? "keys.json not found. Payment Private Key (payPk) is required." : "Payment Private Key (payPk) does not exist in keys.json.";
      return {
        success: false,
        error: errorMessage
      };
    }
    payPkToPreserve = keys.payPk;
    if (keys.xprv) {
      console.error("ERROR: BAP Master Key (xprv) already exists in secure storage.");
      return {
        success: false,
        error: "BAP Master Key (xprv) already exists in keys.json."
      };
    }
    if (keys.identityPk) {
      console.error("ERROR: BAP Identity Key (identityPk) already exists. Cannot generate HD key.");
      return {
        success: false,
        error: "BAP Identity Key (identityPk) already exists in keys.json."
      };
    }
    const status = keyManager2.getStatus();
    if (source === "legacy" && !status.hasEncrypted) {
      console.warn("WARN: Using unencrypted keys. Run the server again to encrypt them.");
    }
  } catch (fileError) {
    console.error("ERROR: Failed to read keys from secure storage:", fileError);
    return {
      success: false,
      error: `Failed to read keys: ${fileError instanceof Error ? fileError.message : String(fileError)}`
    };
  }
  try {
    const payPk = payPkToPreserve;
    const paymentAddress = payPk.toAddress();
    const hdKey = HD2.fromRandom();
    tempXprv = hdKey.toString();
    const bapInstance = new BAP2(tempXprv);
    const identityAttributes = {
      name: {
        value: args?.alternateName || "Anonymous User",
        nonce: BSVUtils.toHex(BSVUtils.toArray(Math.random().toString()))
      },
      description: {
        value: args?.description || "A BAP identity managed by BSV-MCP.",
        nonce: BSVUtils.toHex(BSVUtils.toArray(Math.random().toString()))
      }
    };
    const bapId = bapInstance.newId(undefined, identityAttributes);
    const generatedIdentityKey = bapId.getIdentityKey();
    const generatedIdentityAddress = bapId.rootAddress;
    const memberBackup = bapId.exportMemberBackup();
    identityPk = memberBackup.derivedPrivateKey;
    console.error(`INFO: Generated BAP identity key: ${generatedIdentityKey}`);
    console.error(`INFO: Generated BAP identity address: ${generatedIdentityAddress}`);
    const updatedKeys = {
      payPk: payPkToPreserve,
      identityPk: PrivateKey3.fromWif(identityPk),
      xprv: tempXprv
    };
    await keyManager2.saveKeys(updatedKeys);
    const status = keyManager2.getStatus();
    if (status.hasEncrypted) {
      console.error(`INFO: BAP HD Master Key and initial Identity Key have been generated and saved (encrypted) to ${KEY_DIR}/keys.bep`);
    } else {
      console.error(`INFO: BAP HD Master Key and initial Identity Key have been generated and saved to ${KEY_FILE_PATH}`);
    }
    const idPayload = [
      toArray3(BAP_PREFIX, "utf8"),
      toArray3("ID"),
      toArray3(generatedIdentityKey),
      toArray3(bapId.rootAddress),
      toArray3(bapId.rootAddress)
    ];
    const signedIdPayload = bapId.signOpReturnWithAIP(idPayload);
    const idHexStrings = signedIdPayload.map((bytes) => BSVUtils.toHex(bytes));
    const idAsmString = `OP_0 OP_RETURN ${idHexStrings.join(" ")}`;
    const idScript = Script2.fromASM(idAsmString);
    const aliasData = {
      "@context": "https://schema.org",
      "@type": "Person",
      name: args?.alternateName || "Anonymous User",
      description: args?.description || "A BAP identity managed by BSV-MCP.",
      url: `bitcoin:${paymentAddress}`
    };
    const aliasPayload = [
      toArray3(BAP_PREFIX, "utf8"),
      toArray3("ALIAS"),
      toArray3(generatedIdentityKey),
      toArray3(JSON.stringify(aliasData))
    ];
    const signedAliasPayload = bapId.signOpReturnWithAIP(aliasPayload);
    const aliasHexStrings = signedAliasPayload.map((bytes) => BSVUtils.toHex(bytes));
    const aliasAsmString = `OP_0 OP_RETURN ${aliasHexStrings.join(" ")}`;
    const aliasScript = Script2.fromASM(aliasAsmString);
    const tx = new Transaction4;
    tx.addOutput({
      lockingScript: idScript,
      satoshis: 0
    });
    tx.addOutput({
      lockingScript: aliasScript,
      satoshis: 0
    });
    console.error(`INFO: Fetching UTXOs for payment address: ${paymentAddress}`);
    const paymentUtxos = await fetchPaymentUtxos(paymentAddress);
    if (!paymentUtxos || paymentUtxos.length === 0) {
      console.error(`ERROR: No UTXOs found for payment address ${paymentAddress}. Cannot fund BAP registration.`);
      return {
        success: true,
        identityAddress: generatedIdentityAddress,
        identityKey: generatedIdentityKey,
        message: "BAP HD Key and Initial Identity Generated & Saved to secure storage. No UTXOs available to fund registration.",
        error: "No UTXOs found for payment address. Cannot fund BAP registration."
      };
    }
    console.error(`INFO: Found ${paymentUtxos.length} payment UTXOs.`);
    let estimatedSize = tx.toHex().length / 2;
    estimatedSize += paymentUtxos.length * 148;
    estimatedSize += 34;
    const estimatedFee = Math.ceil(estimatedSize * 0.05);
    for (const utxo of paymentUtxos) {
      const input = fromUtxo2(utxo, new P2PKH3().unlock(payPk));
      tx.addInput(input);
    }
    const totalInputValue = paymentUtxos.reduce((sum, utxo) => sum + utxo.satoshis, 0);
    const changeAmount = totalInputValue - estimatedFee;
    if (changeAmount > 0) {
      tx.addOutput({
        lockingScript: new P2PKH3().lock(paymentAddress),
        satoshis: changeAmount
      });
    }
    await tx.sign();
    const rawTxHex = tx.toHex();
    const txid = tx.id("hex");
    console.error(`INFO: BAP registration transaction created. TXID: ${txid}`);
    console.error(`DEBUG: Raw transaction hex: ${rawTxHex}`);
    const disableBroadcasting = args?.disableBroadcasting || process.env.DISABLE_BROADCASTING === "true";
    if (disableBroadcasting) {
      console.error("INFO: Broadcasting disabled. Transaction not sent to network.");
      const message = `BAP HD Key and Initial Identity Generated & Saved to secure storage. Registration transaction created but not broadcast (TXID: ${txid}).`;
      return {
        success: true,
        identityAddress: bapId.rootAddress,
        identityKey: generatedIdentityKey,
        txid,
        rawTx: rawTxHex,
        message
      };
    }
    try {
      const broadcaster = new V5Broadcaster;
      const broadcastResult = await tx.broadcast(broadcaster);
      let effectiveTxid = txid;
      if (!isBroadcastFailure2(broadcastResult)) {
        effectiveTxid = broadcastResult.txid;
        console.error(`INFO: BAP registration transaction broadcast successfully. TXID: ${effectiveTxid}`);
      } else if (isBroadcastFailure2(broadcastResult)) {
        const failureTxid = broadcastResult.txid ? ` (${broadcastResult.txid})` : "";
        console.warn(`WARN: Transaction broadcast failed${failureTxid}. Code: ${broadcastResult.code}, Description: ${broadcastResult.description}. Original TXID ${txid}.`);
        if (broadcastResult.txid) {
          effectiveTxid = broadcastResult.txid;
        }
      }
      const message = `BAP HD Key and Initial Identity Generated & Saved to secure storage. Registration TXID: ${effectiveTxid}.`;
      let overallSuccess = true;
      let errorMessageFromBroadcast;
      if (isBroadcastFailure2(broadcastResult)) {
        overallSuccess = false;
        errorMessageFromBroadcast = `Broadcast failed: ${broadcastResult.description} (Code: ${broadcastResult.code})`;
      }
      return {
        success: overallSuccess,
        identityAddress: generatedIdentityAddress,
        identityKey: generatedIdentityKey,
        txid: effectiveTxid,
        rawTx: rawTxHex,
        message: isBroadcastFailure2(broadcastResult) ? `${message} Note: ${errorMessageFromBroadcast}` : message,
        error: isBroadcastFailure2(broadcastResult) ? errorMessageFromBroadcast : undefined
      };
    } catch (broadcastError) {
      const errorMsg = broadcastError instanceof Error ? broadcastError.message : String(broadcastError);
      console.error(`ERROR: Failed to broadcast BAP registration transaction ${txid}: ${errorMsg}`);
      return {
        success: true,
        identityAddress: generatedIdentityAddress,
        identityKey: generatedIdentityKey,
        txid,
        rawTx: rawTxHex,
        message: `Keys generated and saved, but failed to broadcast BAP registration transaction: ${errorMsg}`,
        error: `Broadcast failed: ${errorMsg}. You can manually broadcast the raw transaction.`
      };
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`ERROR: Failed to generate BAP HD key or register identity: ${errorMsg}`);
    return {
      success: false,
      error: `Failed during BAP key generation/saving or transaction construction: ${errorMsg}`
    };
  }
}
function registerBapGenerateTool(server) {
  server.tool("bap_generate", "Generates a BAP HD master key AND derives the first identity key if no BAP keys (xprv or identityPk) exist. Saves keys to secure storage. Attempts on-chain registration using payPk (honors DISABLE_BROADCASTING). Optionally takes alternateName and description for the profile.", { ...bapGenerateArgsSchema.shape }, async ({ alternateName, description }) => {
    try {
      const result = await generateBapKeys({ alternateName, description });
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        isError: !result.success
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { content: [{ type: "text", text: msg }], isError: true };
    }
  });
}

// tools/bap/getCurrentAddress.ts
import { PrivateKey as PrivateKey4 } from "@bsv/sdk";
function registerBapGetCurrentAddressTool(server, identityPk) {
  server.tool("bap_getCurrentAddress", "Retrieves the current BAP identity's Bitcoin SV address. This address is derived from the server's configured identity key.", {}, async () => {
    try {
      let pkToUse = identityPk;
      if (!pkToUse) {
        const identityKeyWifEnv = process.env.IDENTITY_KEY_WIF;
        if (identityKeyWifEnv) {
          try {
            pkToUse = PrivateKey4.fromWif(identityKeyWifEnv);
          } catch (e) {}
        }
      }
      if (!pkToUse) {
        throw new Error("Could not retrieve BAP identity address. Identity key not configured.");
      }
      const address = pkToUse.toAddress().toString();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ address, status: "ok" })
          }
        ]
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: "Failed to get BAP identity address",
              message: msg,
              status: "error"
            })
          }
        ],
        isError: true
      };
    }
  });
}

// tools/bap/getId.ts
import { PrivateKey as PrivateKey5 } from "@bsv/sdk";
import { z as z4 } from "zod";
var bapGetIdArgsSchema = z4.object({
  idKey: z4.string().optional().describe("Optional Identity Key (Paymail or public key). If not provided, attempts to use the server's configured identity key.")
});
var fetchProfile = async (idKey) => {
  const response = await fetch(`${BSOCIAL_API_URL}/identity/get`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ idKey })
  });
  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    const errorBody = await response.text();
    throw new Error(`Sigma API request failed with status ${response.status}: ${errorBody}`);
  }
  try {
    const profileData = await response.json();
    if (typeof profileData.result === "undefined") {
      throw new Error("Sigma API response is missing the 'result' field.");
    }
    return profileData.result;
  } catch (jsonError) {
    throw new Error(`Failed to parse Sigma API response: ${jsonError instanceof Error ? jsonError.message : String(jsonError)}`);
  }
};
function registerBapGetIdTool(server, identityPk) {
  server.tool("bap_getId", "Retrieves a Bitcoin Attestation Protocol (BAP) identity profile using an idKey (Paymail or public key). If no idKey is provided, it attempts to use the server's configured identity key.", { ...bapGetIdArgsSchema.shape }, async ({ idKey }, extra) => {
    let targetIdKey = idKey;
    if (!targetIdKey) {
      const authInfo = extra.authInfo;
      if (authInfo?.metadata?.bapId) {
        targetIdKey = authInfo.metadata.bapId;
        console.error(`Using authenticated user's BAP ID: ${targetIdKey}`);
      } else if (authInfo?.metadata?.pubkey) {
        targetIdKey = authInfo.metadata.pubkey;
        console.error(`Using authenticated user's pubkey: ${targetIdKey}`);
      } else {
        let pkToUse = identityPk;
        if (!pkToUse) {
          const identityKeyWifEnv = process.env.IDENTITY_KEY_WIF;
          if (identityKeyWifEnv) {
            try {
              pkToUse = PrivateKey5.fromWif(identityKeyWifEnv);
            } catch (e) {}
          }
        }
        if (pkToUse) {
          targetIdKey = pkToUse.toPublicKey().toString();
        } else {
          return {
            content: [
              {
                type: "text",
                text: "idKey not provided and could not be derived from authenticated session or server configuration."
              }
            ],
            isError: true
          };
        }
      }
    }
    if (!targetIdKey) {
      return {
        content: [
          {
            type: "text",
            text: "Critical error: targetIdKey is unexpectedly undefined after derivation attempts."
          }
        ],
        isError: true
      };
    }
    try {
      const identityDataResult = await fetchProfile(targetIdKey);
      if (identityDataResult === null) {
        return {
          content: [
            {
              type: "text",
              text: `No BAP identity found for idKey: ${targetIdKey}`
            }
          ],
          isError: false
        };
      }
      return {
        content: [
          { type: "text", text: JSON.stringify(identityDataResult, null, 2) }
        ]
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [
          { type: "text", text: `Error fetching BAP ID: ${errorMessage}` }
        ],
        isError: true
      };
    }
  });
}

// tools/bap/index.ts
var logFunc = console.error;
function registerBapTools(server, config) {
  const {
    identityPk,
    masterXprv,
    wallet,
    disableBroadcasting = false
  } = config || {};
  const envIdentityKeyWif = process.env.IDENTITY_KEY_WIF;
  const canGenerateBapIdentity = !envIdentityKeyWif && !masterXprv;
  if (canGenerateBapIdentity) {
    logFunc("INFO: Registering bap_generate tool. No master identity (xprv) or direct identity WIF found.");
    registerBapGenerateTool(server, { disableBroadcasting });
  } else {
    logFunc("INFO: bap_generate tool not registered. Master identity (xprv) or direct identity WIF already exists.");
  }
  const hasEstablishedIdentity = !!identityPk || !!envIdentityKeyWif;
  if (hasEstablishedIdentity) {
    logFunc("INFO: Registering BAP tools that require an established identity (bap_getId, bap_getCurrentAddress).");
    if (identityPk) {
      registerBapGetCurrentAddressTool(server, identityPk);
    } else {
      logFunc("WARN: bap_getCurrentAddress tool not registered. Server identityPk not available (might be using env var directly).");
    }
  } else {
    logFunc("INFO: BAP tools requiring established identity not registered (no identityPk or IDENTITY_KEY_WIF).");
  }
  registerBapGetIdTool(server, identityPk);
  if (masterXprv) {
    try {
      if (wallet) {
        logFunc("INFO: Registering bap_friend tool (requires wallet & masterXprv).");
        registerBapFriendTool(server, wallet, masterXprv, {
          disableBroadcasting
        });
      } else {
        logFunc("WARN: Wallet not available, bap_friend tool not registered.");
      }
    } catch (e) {
      console.error(`ERROR: Failed during masterXprv tool registration: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}

// tools/bsocial/bmapFollow.ts
import { z as z5 } from "zod";
var bmapReadFollowsArgsSchema = z5.object({
  bapId: z5.string().describe("BAP identity key to get follow relationships for"),
  type: z5.enum(["followers", "following"]).default("following").describe("Type of relationship to query"),
  limit: z5.number().min(1).max(100).default(20).describe("Maximum number of follows to return"),
  page: z5.number().min(1).default(1).describe("Page number for pagination (1-based)")
});
async function readBmapFollows(args) {
  try {
    const { bapId, type, limit, page } = args;
    const params = new URLSearchParams;
    params.append("limit", limit.toString());
    params.append("page", page.toString());
    const endpoint = type === "followers" ? "followers" : "following";
    const response = await fetch(`${BMAP_URL}/bap/${bapId}/${endpoint}?${params}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json"
      }
    });
    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `BMAP API request failed: ${response.status} ${errorText}`
      };
    }
    const data = await response.json();
    return {
      success: true,
      data
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error reading BMAP follows:", errorMessage);
    return {
      success: false,
      error: errorMessage
    };
  }
}
function registerBmapReadFollowsTool(server) {
  server.tool("bmap_readFollows", "Read follow relationships from the BMAP API. Shows who a user is following or who follows them.", { ...bmapReadFollowsArgsSchema.shape }, async ({ bapId, type, limit, page }) => {
    try {
      const result = await readBmapFollows({ bapId, type, limit, page });
      if (result.success) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result.data, null, 2)
            }
          ],
          isError: false
        };
      }
      return {
        content: [
          {
            type: "text",
            text: result.error || "Unknown error occurred"
          }
        ],
        isError: true
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text", text: `Error: ${msg}` }],
        isError: true
      };
    }
  });
}

// tools/bsocial/bmapLikes.ts
import { z as z6 } from "zod";
var bmapReadLikesArgsSchema = z6.object({
  txid: z6.string().describe("Transaction ID of the post to get likes for"),
  limit: z6.number().min(1).max(100).default(20).describe("Maximum number of likes to return"),
  page: z6.number().min(1).default(1).describe("Page number for pagination (1-based)")
});
async function readBmapLikes(args) {
  try {
    const { txid, limit, page } = args;
    const params = new URLSearchParams;
    params.append("limit", limit.toString());
    params.append("page", page.toString());
    const response = await fetch(`${BMAP_URL}/post/${txid}/like?${params}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json"
      }
    });
    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `BMAP API request failed: ${response.status} ${errorText}`
      };
    }
    const data = await response.json();
    return {
      success: true,
      data
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error reading BMAP likes:", errorMessage);
    return {
      success: false,
      error: errorMessage
    };
  }
}
function registerBmapReadLikesTool(server) {
  server.tool("bmap_readLikes", "Read likes and reactions for a specific post from the BMAP API. Shows who liked the post and what emoji reactions were used.", { ...bmapReadLikesArgsSchema.shape }, async ({ txid, limit, page }) => {
    try {
      const result = await readBmapLikes({ txid, limit, page });
      if (result.success) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result.data, null, 2)
            }
          ],
          isError: false
        };
      }
      return {
        content: [
          {
            type: "text",
            text: result.error || "Unknown error occurred"
          }
        ],
        isError: true
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text", text: `Error: ${msg}` }],
        isError: true
      };
    }
  });
}

// tools/bsocial/bmapReadPosts.ts
import { z as z7 } from "zod";
var bmapReadPostsArgsSchema = z7.object({
  bapId: z7.string().optional().describe("BAP identity key to filter posts by author"),
  txid: z7.string().optional().describe("Specific transaction ID to fetch"),
  limit: z7.number().min(1).max(100).default(20).describe("Maximum number of posts to return"),
  page: z7.number().min(1).default(1).describe("Page number for pagination (1-based)"),
  feed: z7.boolean().default(false).describe("Whether to fetch feed (posts from followed users)"),
  address: z7.string().optional().describe("Bitcoin address to filter posts by")
});
async function readBmapPosts(args) {
  try {
    const { bapId, txid, limit, page, feed, address } = args;
    if (txid) {
      const response2 = await fetch(`${BMAP_URL}/post/${txid}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json"
        }
      });
      if (!response2.ok) {
        const errorText = await response2.text();
        return {
          success: false,
          error: `BMAP API request failed: ${response2.status} ${errorText}`
        };
      }
      const data2 = await response2.json();
      return {
        success: true,
        data: data2
      };
    }
    const params = new URLSearchParams;
    if (bapId)
      params.append("bapId", bapId);
    if (address)
      params.append("address", address);
    params.append("limit", limit.toString());
    params.append("page", page.toString());
    if (feed)
      params.append("feed", "true");
    const response = await fetch(`${BMAP_URL}/posts?${params}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json"
      }
    });
    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `BMAP API request failed: ${response.status} ${errorText}`
      };
    }
    const data = await response.json();
    return {
      success: true,
      data
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error reading BMAP posts:", errorMessage);
    return {
      success: false,
      error: errorMessage
    };
  }
}
function registerBmapReadPostsTool(server) {
  server.tool("bmap_readPosts", "Read social posts from the BMAP API (query layer). Can fetch posts by author (BAP ID), specific post by transaction ID, or recent posts from all users. Supports pagination and feed functionality.", { ...bmapReadPostsArgsSchema.shape }, async ({ bapId, txid, limit, page, feed, address }) => {
    try {
      const result = await readBmapPosts({ bapId, txid, limit, page, feed, address });
      if (result.success) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result.data, null, 2)
            }
          ],
          isError: false
        };
      }
      return {
        content: [
          {
            type: "text",
            text: result.error || "Unknown error occurred"
          }
        ],
        isError: true
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text", text: `Error: ${msg}` }],
        isError: true
      };
    }
  });
}

// tools/bsocial/createPost.ts
import { Utils as Utils6 } from "@bsv/sdk";
import { z as z8 } from "zod";

// tools/utils/aip.ts
import { BSM, Utils as Utils4 } from "@bsv/sdk";
var { toArray: toArray4, toBase64: toBase642, toUTF8 } = Utils4;
async function signOpReturnWithAIP(dataArrays, signingKey, signingAddress) {
  let messageToSign = new Uint8Array;
  for (const data of dataArrays) {
    const temp = new Uint8Array(messageToSign.length + data.length);
    temp.set(messageToSign);
    temp.set(data, messageToSign.length);
    messageToSign = temp;
  }
  const signature = BSM.sign(messageToSign, signingKey);
  const signatureBase64 = toBase642(signature.toCompact());
  const aipData = [
    toArray4("|", "utf8"),
    toArray4(AIP_PREFIX, "utf8"),
    toArray4("BITCOIN_ECDSA", "utf8"),
    toArray4(signingAddress, "utf8"),
    toArray4(signatureBase64, "utf8")
  ];
  return {
    signedData: [...dataArrays, ...aipData]
  };
}

// tools/utils/errorHandler.ts
function formatError(error) {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
function createResponse(result) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(result, null, 2)
      }
    ],
    isError: !result.success
  };
}

// tools/utils/transactionBuilder.ts
import {
  isBroadcastFailure as isBroadcastFailure3,
  isBroadcastResponse as isBroadcastResponse2,
  P2PKH as P2PKH4,
  Script as Script3,
  Transaction as Transaction5
} from "@bsv/sdk";
var DEFAULT_SAT_PER_BYTE = 0.05;
var DUST_LIMIT = 546;
async function buildAndSendTransaction(config, broadcast = true) {
  const {
    outputs,
    utxos,
    changeAddress,
    paymentKey,
    feePerByte = DEFAULT_SAT_PER_BYTE
  } = config;
  if (!utxos || utxos.length === 0) {
    return {
      success: false,
      error: "No UTXOs available to fund transaction"
    };
  }
  const tx = new Transaction5;
  const p2pkh = new P2PKH4;
  for (const output of outputs) {
    if (output.script) {
      tx.addOutput({
        lockingScript: output.script,
        satoshis: output.satoshis
      });
    } else if (output.address) {
      tx.addOutput({
        lockingScript: p2pkh.lock(output.address),
        satoshis: output.satoshis
      });
    }
  }
  const totalOutputSatoshis = outputs.reduce((sum, out) => sum + out.satoshis, 0);
  let totalInputSatoshis = 0;
  const selectedUtxos = [];
  const sortedUtxos = [...utxos].sort((a, b) => a.satoshis - b.satoshis);
  for (const utxo of sortedUtxos) {
    selectedUtxos.push(utxo);
    totalInputSatoshis += utxo.satoshis;
    const input = {
      sourceTransaction: utxo.tx,
      sourceOutputIndex: utxo.vout,
      unlockingScriptTemplate: p2pkh.unlock(paymentKey)
    };
    tx.addInput(input);
    const estimatedSize2 = tx.toHex().length / 2 + 150;
    const estimatedFee = Math.ceil(estimatedSize2 * feePerByte);
    if (totalInputSatoshis >= totalOutputSatoshis + estimatedFee + DUST_LIMIT) {
      break;
    }
  }
  const estimatedSize = tx.toHex().length / 2 + 35;
  const fee = Math.ceil(estimatedSize * feePerByte);
  if (totalInputSatoshis < totalOutputSatoshis + fee) {
    return {
      success: false,
      error: `Insufficient funds. Have ${totalInputSatoshis} sats, need ${totalOutputSatoshis + fee} sats`
    };
  }
  const change = totalInputSatoshis - totalOutputSatoshis - fee;
  if (change >= DUST_LIMIT) {
    tx.addOutput({
      lockingScript: p2pkh.lock(changeAddress),
      satoshis: change
    });
  }
  await tx.sign();
  const rawTx = tx.toHex();
  const txid = tx.id("hex");
  if (process.env.DISABLE_BROADCASTING === "true" || !broadcast) {
    return {
      success: true,
      txid,
      rawTx,
      fee
    };
  }
  try {
    const broadcaster = new V5Broadcaster;
    const broadcastResult = await tx.broadcast(broadcaster);
    if (isBroadcastResponse2(broadcastResult)) {
      return {
        success: true,
        txid: broadcastResult.txid || txid,
        rawTx,
        fee
      };
    }
    if (isBroadcastFailure3(broadcastResult)) {
      return {
        success: true,
        txid,
        rawTx,
        fee,
        error: `Transaction created but broadcast failed: ${broadcastResult.description}`
      };
    }
    return {
      success: true,
      txid,
      rawTx,
      fee,
      error: "Transaction created but broadcast status uncertain"
    };
  } catch (error) {
    return {
      success: true,
      txid,
      rawTx,
      fee,
      error: `Transaction created but broadcast failed: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}
function buildOpReturnScript(dataArrays) {
  return new Script3([
    { op: 0 },
    { op: 106 },
    ...dataArrays.map((data) => ({ data }))
  ]);
}

// tools/bsocial/createPost.ts
var { toArray: toArray5 } = Utils6;
var createPostArgsSchema = z8.object({
  content: z8.string().describe("The content of the post"),
  contentType: z8.enum(["text/plain", "text/markdown"]).default("text/plain").describe("Content type of the post"),
  app: z8.string().default("bsv-mcp").describe("Application name creating the post"),
  additionalMapData: z8.string().optional().describe(`Additional MAP protocol key-value pairs as a JSON object string, e.g. '{"key": "value"}'`)
});
async function createSocialPost(args, wallet) {
  try {
    const { content, contentType, app, additionalMapData } = args;
    const address = await wallet.getAddress();
    const paymentKey = wallet.getPaymentKey();
    if (!paymentKey) {
      return {
        success: false,
        error: "Payment key not available in wallet"
      };
    }
    const fileExtension = contentType === "text/markdown" ? "md" : "txt";
    const fileName = `post.${fileExtension}`;
    const bData = [
      toArray5(B_PREFIX, "utf8"),
      toArray5(content, "utf8"),
      toArray5(contentType, "utf8"),
      toArray5("utf-8", "utf8"),
      toArray5(fileName, "utf8")
    ];
    const mapData = [
      toArray5(MAP_PREFIX, "utf8"),
      toArray5("SET", "utf8"),
      toArray5("app", "utf8"),
      toArray5(app, "utf8"),
      toArray5("type", "utf8"),
      toArray5("post", "utf8")
    ];
    if (additionalMapData) {
      const parsedMapData = JSON.parse(additionalMapData);
      for (const [key, value] of Object.entries(parsedMapData)) {
        mapData.push(toArray5(key, "utf8"), toArray5(value, "utf8"));
      }
    }
    const pipeData = toArray5("|", "utf8");
    const dataToSign = [...bData, pipeData, ...mapData];
    const { signedData } = await signOpReturnWithAIP(dataToSign, paymentKey, address.toString());
    const script = buildOpReturnScript(signedData);
    const utxos = await wallet.getPaymentUtxos();
    return await buildAndSendTransaction({
      outputs: [{ script, satoshis: 0 }],
      utxos,
      changeAddress: address.toString(),
      paymentKey
    });
  } catch (error) {
    console.error("Error creating social post:", formatError(error));
    return {
      success: false,
      error: formatError(error)
    };
  }
}
function registerCreatePostTool(server, wallet) {
  server.tool("bsocial_createPost", "Create a social post on the BSV blockchain using B:// and MAP protocols. Posts are stored permanently on-chain and can include plain text or markdown content.", { ...createPostArgsSchema.shape }, async ({ content, contentType, app, additionalMapData }) => {
    const result = await createSocialPost({ content, contentType, app, additionalMapData }, wallet);
    return createResponse(result);
  });
}

// tools/bsocial/readPosts.ts
import { z as z9 } from "zod";
var readPostsArgsSchema = z9.object({
  bapId: z9.string().optional().describe("BAP identity key to filter posts by author"),
  txid: z9.string().optional().describe("Specific transaction ID to fetch"),
  limit: z9.number().min(1).max(100).default(20).describe("Maximum number of posts to return"),
  page: z9.number().min(1).default(1).describe("Page number for pagination (1-based)"),
  feed: z9.boolean().default(false).describe("Whether to fetch feed (posts from followed users)")
});
async function readSocialPosts(args) {
  try {
    const { bapId, txid, limit, page, feed } = args;
    if (txid) {
      const response2 = await fetch(`${BMAP_URL}/post/${txid}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json"
        }
      });
      if (!response2.ok) {
        const errorText = await response2.text();
        return {
          success: false,
          error: `BMAP API request failed: ${response2.status} ${errorText}`
        };
      }
      const data2 = await response2.json();
      if (data2.status !== "success") {
        return {
          success: false,
          error: data2.error || "Unknown API error"
        };
      }
      return {
        success: true,
        posts: [data2.result.post],
        signers: data2.result.signers,
        meta: [data2.result.meta]
      };
    }
    const params = new URLSearchParams;
    if (bapId)
      params.append("bapId", bapId);
    params.append("limit", limit.toString());
    params.append("page", page.toString());
    if (feed)
      params.append("feed", "true");
    const response = await fetch(`${BMAP_URL}/posts?${params}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json"
      }
    });
    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `BMAP API request failed: ${response.status} ${errorText}`
      };
    }
    const data = await response.json();
    if (data.status !== "success") {
      return {
        success: false,
        error: data.error || "Unknown API error"
      };
    }
    return {
      success: true,
      posts: data.data.results,
      signers: data.data.signers,
      meta: data.data.meta,
      pagination: {
        page: data.data.page,
        limit: data.data.limit,
        count: data.data.count
      }
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error reading social posts:", errorMessage);
    return {
      success: false,
      error: errorMessage
    };
  }
}
function formatPost(post, index, signer, meta) {
  const lines = [
    `Post ${index + 1}:`,
    `  TX ID: ${post.tx.h}`,
    `  Content: ${post.B[0]?.content || "[No Content]"}`,
    `  Content Type: ${post.B[0]?.["content-type"] || "text/plain"}`,
    `  Timestamp: ${new Date(post.timestamp * 1000).toISOString()}`
  ];
  if (signer) {
    lines.push(`  Author: ${signer.displayName || signer.idKey}`);
    if (signer.paymail) {
      lines.push(`  Paymail: ${signer.paymail}`);
    }
  }
  const mapData = post.MAP.find((m) => m.type === "post");
  if (mapData?.app) {
    lines.push(`  App: ${mapData.app}`);
  }
  if (meta) {
    if (meta.likes > 0) {
      lines.push(`  Likes: ${meta.likes}`);
    }
    if (meta.replies > 0) {
      lines.push(`  Replies: ${meta.replies}`);
    }
    if (meta.reactions.length > 0) {
      const reactions = meta.reactions.map((r) => `${r.emoji}(${r.count})`).join(" ");
      lines.push(`  Reactions: ${reactions}`);
    }
  }
  return lines.join(`
`);
}
function registerReadPostsTool(server) {
  server.tool("bsocial_readPosts", "Read social posts from the BSV blockchain using BMAP API. Can fetch posts by author (BAP ID), specific post by transaction ID, or recent posts from all users. Supports pagination and feed functionality.", { ...readPostsArgsSchema.shape }, async ({ bapId, txid, limit, page, feed }) => {
    try {
      const result = await readSocialPosts({ bapId, txid, limit, page, feed });
      if (result.success && result.posts) {
        const formattedPosts = result.posts.map((post, index) => {
          const signer = result.signers?.find((s) => s.currentAddress === post.AIP[0]?.address);
          const meta = result.meta?.[index];
          return formatPost(post, index, signer, meta);
        }).join(`

`);
        let output = result.posts.length > 0 ? formattedPosts : "No posts found";
        if (result.pagination) {
          output += `

Pagination: Page ${result.pagination.page}, showing ${result.posts.length} of ${result.pagination.count} posts`;
        }
        return {
          content: [
            {
              type: "text",
              text: output
            }
          ],
          isError: false
        };
      }
      return {
        content: [
          {
            type: "text",
            text: result.error || "Unknown error occurred"
          }
        ],
        isError: true
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text", text: `Error: ${msg}` }],
        isError: true
      };
    }
  });
}

// tools/bsocial/index.ts
function registerBsocialTools(server, config) {
  registerReadPostsTool(server);
  console.error("✅ Registered bsocial_readPosts tool");
  registerBmapReadPostsTool(server);
  console.error("✅ Registered bmap_readPosts tool");
  registerBmapReadLikesTool(server);
  console.error("✅ Registered bmap_readLikes tool");
  registerBmapReadFollowsTool(server);
  console.error("✅ Registered bmap_readFollows tool");
  if (config.wallet) {
    registerCreatePostTool(server, config.wallet);
    console.error("✅ Registered bsocial_createPost tool");
  } else {
    console.error("⚠️ bsocial_createPost tool not registered (no wallet available)");
  }
}

// tools/bsv/decodeTransaction.ts
import { Transaction as Transaction6, Utils as Utils7 } from "@bsv/sdk";
import { z as z10 } from "zod";
var decodeTransactionArgsSchema = z10.object({
  tx: z10.string().describe("Transaction data or txid"),
  encoding: z10.enum(["hex", "base64"]).default("hex").describe("Encoding of the input data")
});
async function fetchJungleBusData(txid) {
  try {
    const response = await fetch(`https://junglebus.gorillapool.io/v1/transaction/get/${txid}`);
    if (!response.ok) {
      console.error(`JungleBus API error: ${response.status} ${response.statusText}`);
      return null;
    }
    return await response.json();
  } catch (error) {
    console.error("Error fetching from JungleBus:", error);
    return null;
  }
}
function isTxid(str) {
  return /^[0-9a-f]{64}$/i.test(str);
}
function registerDecodeTransactionTool(server) {
  server.tool("bsv_decodeTransaction", "Decodes and analyzes Bitcoin SV transactions to provide detailed insights. This powerful tool accepts either a transaction ID or raw transaction data and returns comprehensive information including inputs, outputs, fee calculations, script details, and blockchain context. Supports both hex and base64 encoded transactions and automatically fetches additional on-chain data when available.", decodeTransactionArgsSchema.shape, async ({ tx, encoding }, extra) => {
    try {
      let transaction;
      let rawTx;
      let txid;
      let junglebusData = null;
      if (isTxid(tx)) {
        txid = tx;
        junglebusData = await fetchJungleBusData(txid);
        if (!junglebusData) {
          throw new Error(`Failed to fetch transaction data for txid: ${txid}`);
        }
        rawTx = junglebusData.transaction;
        const isBase64 = /^[A-Za-z0-9+/=]+$/.test(rawTx);
        if (isBase64) {
          const txBytes = Utils7.toArray(rawTx, "base64");
          transaction = Transaction6.fromBinary(txBytes);
        } else {
          transaction = Transaction6.fromHex(rawTx);
        }
      } else {
        let txBytes;
        if (encoding === "hex") {
          txBytes = Utils7.toArray(tx, "hex");
        } else {
          txBytes = Utils7.toArray(tx, "base64");
        }
        transaction = Transaction6.fromBinary(txBytes);
        txid = transaction.hash("hex");
        junglebusData = await fetchJungleBusData(txid);
      }
      const result = {
        txid,
        version: transaction.version,
        locktime: transaction.lockTime,
        size: transaction.toBinary().length,
        inputs: transaction.inputs.map((input) => ({
          txid: input.sourceTXID,
          vout: input.sourceOutputIndex,
          sequence: input.sequence,
          script: input.unlockingScript ? input.unlockingScript.toHex() : "",
          scriptAsm: input.unlockingScript ? input.unlockingScript.toASM() : ""
        })),
        outputs: transaction.outputs.map((output) => ({
          n: transaction.outputs.indexOf(output),
          value: output.satoshis,
          scriptPubKey: {
            hex: output.lockingScript.toHex(),
            asm: output.lockingScript.toASM()
          }
        }))
      };
      if (junglebusData) {
        result.confirmations = junglebusData.block_height ? await getCurrentBlockHeight() - junglebusData.block_height + 1 : 0;
        result.block = junglebusData.block_hash ? {
          hash: junglebusData.block_hash,
          height: junglebusData.block_height || 0,
          time: junglebusData.block_time || 0,
          index: junglebusData.block_index || 0
        } : null;
        if (junglebusData.input_types && junglebusData.input_types.length > 0) {
          result.inputs = result.inputs.map((input, i) => ({
            ...input,
            type: junglebusData.input_types?.[i] || "unknown"
          }));
        }
        if (junglebusData.output_types && junglebusData.output_types.length > 0) {
          result.outputs = result.outputs.map((output, i) => ({
            ...output,
            type: junglebusData.output_types?.[i] || "unknown"
          }));
        }
        if (junglebusData.addresses && junglebusData.addresses.length > 0) {
          result.addresses = junglebusData.addresses;
        }
      }
      const totalInputValue = result.inputs.reduce((sum, input) => sum + (input.value || 0), 0);
      const totalOutputValue = result.outputs.reduce((sum, output) => sum + (output.value || 0), 0);
      result.fee = totalInputValue > 0 ? totalInputValue - totalOutputValue : null;
      result.feeRate = result.fee !== null ? Math.round(result.fee / result.size * 1e8) / 1e8 : null;
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: error instanceof Error ? error.message : String(error)
          }
        ],
        isError: true
      };
    }
  });
}
async function getCurrentBlockHeight() {
  try {
    const response = await fetch("https://junglebus.gorillapool.io/v1/network/info");
    if (!response.ok) {
      return 0;
    }
    const data = await response.json();
    return data.blocks || 0;
  } catch (error) {
    console.error("Error fetching current block height:", error);
    return 0;
  }
}

// tools/bsv/explore.ts
import { z as z11 } from "zod";
var WOC_API_BASE_URL = "https://api.whatsonchain.com/v1/bsv";
var ExploreEndpoint;
((ExploreEndpoint2) => {
  ExploreEndpoint2["CHAIN_INFO"] = "chain_info";
  ExploreEndpoint2["CHAIN_TIPS"] = "chain_tips";
  ExploreEndpoint2["CIRCULATING_SUPPLY"] = "circulating_supply";
  ExploreEndpoint2["PEER_INFO"] = "peer_info";
  ExploreEndpoint2["BLOCK_BY_HASH"] = "block_by_hash";
  ExploreEndpoint2["BLOCK_BY_HEIGHT"] = "block_by_height";
  ExploreEndpoint2["BLOCK_HEADERS"] = "block_headers";
  ExploreEndpoint2["BLOCK_PAGES"] = "block_pages";
  ExploreEndpoint2["TAG_COUNT_BY_HEIGHT"] = "tag_count_by_height";
  ExploreEndpoint2["BLOCK_STATS_BY_HEIGHT"] = "block_stats_by_height";
  ExploreEndpoint2["BLOCK_MINER_STATS"] = "block_miner_stats";
  ExploreEndpoint2["MINER_SUMMARY_STATS"] = "miner_summary_stats";
  ExploreEndpoint2["TX_BY_HASH"] = "tx_by_hash";
  ExploreEndpoint2["TX_RAW"] = "tx_raw";
  ExploreEndpoint2["TX_RECEIPT"] = "tx_receipt";
  ExploreEndpoint2["BULK_TX_DETAILS"] = "bulk_tx_details";
  ExploreEndpoint2["ADDRESS_HISTORY"] = "address_history";
  ExploreEndpoint2["ADDRESS_UTXOS"] = "address_utxos";
  ExploreEndpoint2["HEALTH"] = "health";
})(ExploreEndpoint ||= {});
var Network;
((Network2) => {
  Network2["MAIN"] = "main";
  Network2["TEST"] = "test";
})(Network ||= {});
var exploreArgsSchema = z11.object({
  endpoint: z11.nativeEnum(ExploreEndpoint).describe("WhatsOnChain API endpoint to call"),
  network: z11.nativeEnum(Network).default("main" /* MAIN */).describe("Network to use (main or test)"),
  blockHash: z11.string().optional().describe("Block hash (required for block_by_hash endpoint)"),
  blockHeight: z11.number().optional().describe("Block height (required for block_by_height and block_stats_by_height endpoints)"),
  txHash: z11.string().optional().describe("Transaction hash (required for tx_by_hash, tx_raw, and tx_receipt endpoints)"),
  txids: z11.array(z11.string()).optional().describe("Array of transaction IDs for bulk_tx_details endpoint"),
  address: z11.string().optional().describe("Bitcoin address (required for address_history and address_utxos endpoints)"),
  limit: z11.number().optional().describe("Limit for paginated results (optional for address_history)"),
  pageNumber: z11.number().optional().describe("Page number for block_pages endpoint (defaults to 1)"),
  days: z11.number().optional().describe("Number of days for miner stats endpoints (defaults to 7)")
});
function registerExploreTool(server) {
  server.tool("bsv_explore", `Explore Bitcoin SV blockchain data using the WhatsOnChain API. Access multiple data types:

` + `CHAIN DATA:
` + `- chain_info: Network stats, difficulty, and chain work
` + `- chain_tips: Current chain tips including heights and states
` + `- circulating_supply: Current BSV circulating supply
` + `- peer_info: Connected peer statistics

` + `BLOCK DATA:
` + `- block_by_hash: Complete block data via hash (requires blockHash parameter)
` + `- block_by_height: Complete block data via height (requires blockHeight parameter)
` + `- tag_count_by_height: Stats on tag count for a specific block via height (requires blockHeight parameter)
` + `- block_headers: Retrieves the last 10 block headers
` + `- block_pages: Retrieves pages of transaction IDs for large blocks (requires blockHash and optional pageNumber)

` + `STATS DATA:
` + `- block_stats_by_height: Block statistics for a specific height (requires blockHeight parameter)
` + `- block_miner_stats: Block mining statistics for a time period (optional days parameter, default 7)
` + `- miner_summary_stats: Summary of mining statistics (optional days parameter, default 7)

` + `TRANSACTION DATA:
` + `- tx_by_hash: Detailed transaction data (requires txHash parameter)
` + `- tx_raw: Raw transaction hex data (requires txHash parameter)
` + `- tx_receipt: Transaction receipt (requires txHash parameter)
` + `- bulk_tx_details: Bulk transaction details (requires txids parameter as array of transaction hashes)

` + `ADDRESS DATA:
` + `- address_history: Transaction history for address (requires address parameter, optional limit)
` + `- address_utxos: Unspent outputs for address (requires address parameter)

` + `NETWORK:
` + `- health: API health check

` + "Use the appropriate parameters for each endpoint type and specify 'main' or 'test' network.", exploreArgsSchema.shape, async (params) => {
    try {
      if (params.endpoint === "block_by_hash" /* BLOCK_BY_HASH */ && !params.blockHash) {
        throw new Error("blockHash is required for block_by_hash endpoint");
      }
      if ((params.endpoint === "block_by_height" /* BLOCK_BY_HEIGHT */ || params.endpoint === "tag_count_by_height" /* TAG_COUNT_BY_HEIGHT */) && params.blockHeight === undefined) {
        throw new Error("blockHeight is required for block_by_height and tag_count_by_height endpoints");
      }
      if ([
        "tx_by_hash" /* TX_BY_HASH */,
        "tx_raw" /* TX_RAW */,
        "tx_receipt" /* TX_RECEIPT */
      ].includes(params.endpoint) && !params.txHash) {
        throw new Error("txHash is required for transaction endpoints");
      }
      if ([
        "address_history" /* ADDRESS_HISTORY */,
        "address_utxos" /* ADDRESS_UTXOS */
      ].includes(params.endpoint) && !params.address) {
        throw new Error("address is required for address endpoints");
      }
      if (params.endpoint === "block_pages" /* BLOCK_PAGES */ && !params.blockHash) {
        throw new Error("blockHash is required for block_pages endpoint");
      }
      if (params.endpoint === "block_stats_by_height" /* BLOCK_STATS_BY_HEIGHT */ && params.blockHeight === undefined) {
        throw new Error("blockHeight is required for block_stats_by_height endpoint");
      }
      if (params.endpoint === "bulk_tx_details" /* BULK_TX_DETAILS */ && (!params.txids || params.txids.length === 0)) {
        throw new Error("txids array is required for bulk_tx_details endpoint");
      }
      let apiUrl = `${WOC_API_BASE_URL}/${params.network}`;
      switch (params.endpoint) {
        case "chain_info" /* CHAIN_INFO */:
          apiUrl += "/chain/info";
          break;
        case "chain_tips" /* CHAIN_TIPS */:
          apiUrl += "/chain/tips";
          break;
        case "circulating_supply" /* CIRCULATING_SUPPLY */:
          apiUrl += "/circulatingsupply";
          break;
        case "peer_info" /* PEER_INFO */:
          apiUrl += "/peer/info";
          break;
        case "block_by_hash" /* BLOCK_BY_HASH */:
          apiUrl += `/block/hash/${params.blockHash}`;
          break;
        case "block_by_height" /* BLOCK_BY_HEIGHT */:
          apiUrl += `/block/height/${params.blockHeight}`;
          break;
        case "tag_count_by_height" /* TAG_COUNT_BY_HEIGHT */:
          apiUrl += `/block/tagcount/height/${params.blockHeight}/stats`;
          break;
        case "block_headers" /* BLOCK_HEADERS */:
          apiUrl += "/block/headers";
          break;
        case "block_pages" /* BLOCK_PAGES */: {
          const pageNumber = params.pageNumber || 1;
          apiUrl += `/block/hash/${params.blockHash}/page/${pageNumber}`;
          break;
        }
        case "block_stats_by_height" /* BLOCK_STATS_BY_HEIGHT */:
          apiUrl += `/block/height/${params.blockHeight}/stats`;
          break;
        case "block_miner_stats" /* BLOCK_MINER_STATS */: {
          const days = params.days !== undefined ? params.days : 7;
          apiUrl += `/miner/blocks/stats?days=${days}`;
          break;
        }
        case "miner_summary_stats" /* MINER_SUMMARY_STATS */: {
          const days = params.days !== undefined ? params.days : 7;
          apiUrl += `/miner/summary/stats?days=${days}`;
          break;
        }
        case "tx_by_hash" /* TX_BY_HASH */:
          apiUrl += `/tx/hash/${params.txHash}`;
          break;
        case "tx_raw" /* TX_RAW */:
          apiUrl += `/tx/${params.txHash}/hex`;
          break;
        case "tx_receipt" /* TX_RECEIPT */:
          apiUrl += `/tx/${params.txHash}/receipt`;
          break;
        case "bulk_tx_details" /* BULK_TX_DETAILS */:
          apiUrl += "/txs";
          break;
        case "address_history" /* ADDRESS_HISTORY */:
          apiUrl += `/address/${params.address}/history`;
          if (params.limit !== undefined) {
            apiUrl += `?limit=${params.limit}`;
          }
          break;
        case "address_utxos" /* ADDRESS_UTXOS */:
          apiUrl += `/address/${params.address}/unspent`;
          break;
        case "health" /* HEALTH */:
          apiUrl += "/woc";
          break;
        default:
          throw new Error(`Unsupported endpoint: ${params.endpoint}`);
      }
      if (params.endpoint === "bulk_tx_details" /* BULK_TX_DETAILS */) {
        const response2 = await fetch(apiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ txids: params.txids })
        });
        if (!response2.ok) {
          let errorMsg = `API error: ${response2.status} ${response2.statusText}`;
          if (response2.status === 404) {
            errorMsg += " - One or more transaction IDs not found";
          }
          throw new Error(errorMsg);
        }
        const result2 = await response2.json();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result2, null, 2)
            }
          ]
        };
      }
      const response = await fetch(apiUrl);
      if (!response.ok) {
        let errorMsg = `API error: ${response.status} ${response.statusText}`;
        if (response.status === 404) {
          switch (params.endpoint) {
            case "block_by_hash" /* BLOCK_BY_HASH */:
              errorMsg += ` - Block hash "${params.blockHash}" not found`;
              break;
            case "block_by_height" /* BLOCK_BY_HEIGHT */:
              errorMsg += ` - Block at height ${params.blockHeight} not found`;
              break;
            case "block_pages" /* BLOCK_PAGES */:
              errorMsg += ` - Block hash "${params.blockHash}" not found or page ${params.pageNumber || 1} does not exist`;
              break;
            case "tx_by_hash" /* TX_BY_HASH */:
            case "tx_raw" /* TX_RAW */:
            case "tx_receipt" /* TX_RECEIPT */:
              errorMsg += ` - Transaction hash "${params.txHash}" not found`;
              break;
            case "address_history" /* ADDRESS_HISTORY */:
            case "address_utxos" /* ADDRESS_UTXOS */:
              errorMsg += ` - No data found for address "${params.address}"`;
              break;
          }
        }
        throw new Error(errorMsg);
      }
      const result = await response.json();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error instanceof Error ? error.message : String(error)}`
          }
        ],
        isError: true
      };
    }
  });
}

// tools/bsv/getPrice.ts
var PRICE_CACHE_DURATION2 = 5 * 60 * 1000;
var cachedPrice2 = null;
async function getBsvPriceWithCache2() {
  if (cachedPrice2 && Date.now() - cachedPrice2.timestamp < PRICE_CACHE_DURATION2) {
    return cachedPrice2.value;
  }
  const res = await fetch("https://api.whatsonchain.com/v1/bsv/main/exchangerate");
  if (!res.ok)
    throw new Error("Failed to fetch price");
  const data = await res.json();
  const price = Number(data.rate);
  if (Number.isNaN(price) || price <= 0)
    throw new Error("Invalid price received");
  cachedPrice2 = {
    value: price,
    timestamp: Date.now()
  };
  return price;
}
function registerGetPriceTool(server) {
  server.tool("bsv_getPrice", "Retrieves the current price of Bitcoin SV (BSV) in USD from a reliable exchange API. This tool provides real-time market data that can be used for calculating transaction values, monitoring market conditions, or converting between BSV and fiat currencies.", {}, async () => {
    try {
      const price = await getBsvPriceWithCache2();
      return {
        content: [
          {
            type: "text",
            text: `Current BSV price: $${price.toFixed(2)} USD`
          }
        ]
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: "Error fetching BSV price." }],
        isError: true
      };
    }
  });
}

// tools/bsv/index.ts
function registerBsvTools(server) {
  registerGetPriceTool(server);
  registerDecodeTransactionTool(server);
  registerExploreTool(server);
}

// tools/mnee/index.ts
import Mnee from "mnee";

// tools/mnee/getBalance.ts
import { PrivateKey as PrivateKey6 } from "@bsv/sdk";
import { z as z12 } from "zod";
var getBalanceArgsSchema = z12.object({});
function registerGetBalanceTool(server, mnee) {
  server.tool("mnee_getBalance", "Retrieves the current MNEE token balance for the wallet. Returns the balance in MNEE tokens.", {}, async (_params, extra) => {
    try {
      const privateKeyWif = process.env.PRIVATE_KEY_WIF;
      if (!privateKeyWif) {
        throw new Error("Private key WIF not available in environment variables");
      }
      const privateKey = PrivateKey6.fromWif(privateKeyWif);
      if (!privateKey) {
        throw new Error("No private key available");
      }
      const address = privateKey.toAddress().toString();
      const balance = await mnee.balance(address);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ balance }, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: error instanceof Error ? error.message : String(error)
          }
        ],
        isError: true
      };
    }
  });
}

// tools/mnee/parseTx.ts
import { z as z13 } from "zod";
var parseTxArgsSchema = z13.object({
  txid: z13.string().describe("Transaction ID to parse")
});
function registerParseTxTool(server, mnee) {
  server.tool("mnee_parseTx", "Parse an MNEE transaction to get detailed information about its operations and amounts. All amounts are in atomic units with 5 decimal precision (e.g. 1000 atomic units = 0.01 MNEE).", { ...parseTxArgsSchema.shape }, async ({ txid }, extra) => {
    try {
      const result = await mnee.parseTx(txid);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { content: [{ type: "text", text: msg }], isError: true };
    }
  });
}

// tools/mnee/sendMnee.ts
import { z as z14 } from "zod";
var sendMneeArgsSchema = z14.object({
  address: z14.string().describe("The recipient's address"),
  amount: z14.number().describe("Amount to send"),
  currency: z14.enum(["MNEE", "USD"]).default("MNEE").describe("Currency of the amount (MNEE or USD)")
});
function formatUSD(amount) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}
function registerSendMneeTool(server, mnee) {
  server.tool("mnee_sendMnee", "Send MNEE tokens to a specified address", { ...sendMneeArgsSchema.shape }, async ({ address, amount, currency }, extra) => {
    try {
      const mneeAmount = amount;
      const transferRequest = [
        {
          address,
          amount: mneeAmount
        }
      ];
      const wif = process.env.PRIVATE_KEY_WIF;
      if (!wif) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: false,
                error: "No private key available",
                message: "Please set PRIVATE_KEY_WIF environment variable with a valid Bitcoin SV private key in WIF format."
              }, null, 2)
            }
          ],
          isError: true
        };
      }
      const result = await mnee.transfer(transferRequest, wif);
      if (result.error) {
        throw new Error(result.error);
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              txid: result.txid,
              rawtx: result.rawtx,
              mneeAmount,
              usdAmount: formatUSD(mneeAmount),
              recipient: address
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { content: [{ type: "text", text: msg }], isError: true };
    }
  });
}

// tools/mnee/index.ts
var mnee = new Mnee({
  environment: "production"
});
var mneeToolsRegistered = new WeakSet;
function registerMneeTools(server) {
  if (mneeToolsRegistered.has(server)) {
    return;
  }
  registerGetBalanceTool(server, mnee);
  registerSendMneeTool(server, mnee);
  registerParseTxTool(server, mnee);
  mneeToolsRegistered.add(server);
}

// tools/ordinals/getInscription.ts
import { z as z15 } from "zod";
function registerGetInscriptionTool(server, ctx) {
  server.tool("ordinals_getInscription", "Retrieves metadata for an inscription by its outpoint. Returns content type, file info, origin, MAP data, and sequence info.", {
    outpoint: z15.string().describe("Outpoint in format 'txid_vout'")
  }, async ({ outpoint }) => {
    try {
      if (!ctx?.services) {
        throw new Error("OneSat services not available");
      }
      if (!/^[0-9a-f]{64}_\d+$/i.test(outpoint)) {
        throw new Error("Invalid outpoint format. Expected 'txid_vout'");
      }
      const data = await ctx.services.ordfs.getMetadata(outpoint);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(data, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: error instanceof Error ? error.message : String(error)
          }
        ],
        isError: true
      };
    }
  });
}

// tools/ordinals/getTokenByIdOrTicker.ts
import { z as z16 } from "zod";
function registerGetTokenByIdOrTickerTool(server, ctx) {
  server.tool("ordinals_getTokenByIdOrTicker", "Retrieves detailed information about a BSV21 token by its ID (txid_vout format). Returns token data including symbol, supply, decimals, funding status, and current state.", {
    id: z16.string().describe("BSV21 token ID in outpoint format (txid_vout)")
  }, async ({ id }) => {
    try {
      if (!ctx?.services) {
        throw new Error("OneSat services not available");
      }
      if (!/^[0-9a-f]{64}_\d+$/i.test(id)) {
        throw new Error("Invalid token ID format. Expected 'txid_vout'");
      }
      const data = await ctx.services.bsv21.getTokenDetails(id);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(data, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: error instanceof Error ? error.message : String(error)
          }
        ],
        isError: true
      };
    }
  });
}

// tools/ordinals/marketListings.ts
function registerMarketListingsTool(server, ctx) {
  server.tool("ordinals_marketListings", "Query marketplace listings for ordinals and tokens. Currently awaiting 1sat-stack marketplace API implementation.", {}, async () => {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            error: "Marketplace listings API not yet available on 1sat-stack",
            status: "not_implemented"
          })
        }
      ],
      isError: true
    };
  });
}

// tools/ordinals/marketSales.ts
function registerMarketSalesTool(server, ctx) {
  server.tool("ordinals_marketSales", "Query past marketplace sales for ordinals and tokens. Currently awaiting 1sat-stack marketplace API implementation.", {}, async () => {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            error: "Marketplace sales API not yet available on 1sat-stack",
            status: "not_implemented"
          })
        }
      ],
      isError: true
    };
  });
}

// tools/ordinals/searchInscriptions.ts
function registerSearchInscriptionsTool(server, ctx) {
  server.tool("ordinals_searchInscriptions", "Search for inscriptions by various criteria. Currently awaiting 1sat-stack search API implementation.", {}, async () => {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            error: "Inscription search API not yet available on 1sat-stack",
            status: "not_implemented"
          })
        }
      ],
      isError: true
    };
  });
}

// tools/ordinals/index.ts
function registerOrdinalsTools(server, ctx) {
  registerGetInscriptionTool(server, ctx);
  registerSearchInscriptionsTool(server, ctx);
  registerMarketListingsTool(server, ctx);
  registerMarketSalesTool(server, ctx);
  registerGetTokenByIdOrTickerTool(server, ctx);
}

// tools/utils/index.ts
import { z as z19 } from "zod";

// tools/utils/conversion.ts
import { Utils as Utils8 } from "@bsv/sdk";
import { z as z17 } from "zod";
var {
  toArray: bsvToArray,
  toBase64: bsvToBase64,
  toHex: bsvToHex,
  toUTF8: bsvToUTF8
} = Utils8;
var encodingSchema = z17.enum(["utf8", "hex", "base64", "binary"]);
function convertData({
  data,
  from,
  to
}) {
  encodingSchema.parse(from);
  encodingSchema.parse(to);
  let arr;
  if (from === "binary") {
    try {
      arr = JSON.parse(data);
      if (!Array.isArray(arr) || !arr.every((n) => typeof n === "number")) {
        throw new Error;
      }
    } catch {
      throw new Error("Invalid binary input: must be a JSON array of numbers");
    }
  } else {
    arr = bsvToArray(data, from);
  }
  if (to === "binary") {
    return JSON.stringify(arr);
  }
  if (to === "hex") {
    return bsvToHex(arr);
  }
  if (to === "base64") {
    return bsvToBase64(arr);
  }
  if (to === "utf8") {
    return bsvToUTF8(arr);
  }
  throw new Error("Invalid 'to' encoding");
}

// tools/utils/installAgentMaster.ts
import { spawn } from "node:child_process";
import { z as z18 } from "zod";
var installAgentMasterSchema = z18.object({
  method: z18.enum(["go", "source", "auto"]).optional().describe("Installation method")
});
async function installAgentMaster(args) {
  const method = args.method || "auto";
  return new Promise((resolve, reject) => {
    let command;
    let commandArgs = [];
    if (method === "auto" || method === "go") {
      command = "go";
      commandArgs = ["install", "github.com/b-open-io/agent-master-cli@latest"];
    } else if (method === "source") {
      reject(new Error(`Source installation requires manual steps. Please run:
git clone https://github.com/b-open-io/agent-master-cli.git
cd agent-master-cli
make deps && make build && make install`));
      return;
    }
    console.error(`\uD83D\uDD27 Installing Agent Master CLI using ${method} method...`);
    const install = spawn(command, commandArgs, {
      stdio: "inherit",
      shell: true
    });
    install.on("error", (error) => {
      if (method === "auto" && command === "go") {
        reject(new Error(`Go installation failed. Please ensure Go is installed or try manual installation:

1. Install Go from https://golang.org/dl/
2. Run: go install github.com/b-open-io/agent-master-cli@latest

Or install from source:
git clone https://github.com/b-open-io/agent-master-cli.git
cd agent-master-cli
make deps && make build && make install`));
      } else {
        reject(error);
      }
    });
    install.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Installation failed with code ${code}`));
      } else {
        resolve({
          success: true,
          message: `✅ Agent Master CLI installed successfully!

Get started with:
  agent-master init --with-demo
  agent-master list
  agent-master sync --preset claude`,
          nextSteps: [
            "Initialize configuration: agent-master init --with-demo",
            "List servers: agent-master list",
            'Add BSV MCP: agent-master add bsv-mcp --transport stdio --command "bunx" --args "bsv-mcp@latest"',
            "Sync to Claude: agent-master sync --preset claude"
          ]
        });
      }
    });
  });
}
var installAgentMasterTool = {
  name: "utils_installAgentMaster",
  description: "Install the Agent Master CLI tool for managing MCP server configurations across multiple platforms (Claude, VS Code, Cursor, etc.)",
  inputSchema: installAgentMasterSchema,
  handler: installAgentMaster
};

// tools/utils/index.ts
var encodingSchema2 = z19.enum(["utf8", "hex", "base64", "binary"]);
function registerUtilsTools(server) {
  server.tool(installAgentMasterTool.name, installAgentMasterTool.description, { ...installAgentMasterTool.inputSchema.shape }, async (params) => {
    try {
      const result = await installAgentMasterTool.handler(params);
      return {
        content: [
          {
            type: "text",
            text: typeof result === "string" ? result : JSON.stringify(result, null, 2)
          }
        ]
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        content: [
          {
            type: "text",
            text: `Error: ${msg}`
          }
        ],
        isError: true
      };
    }
  });
  server.tool("utils_convertData", `Converts data between different encodings (utf8, hex, base64, binary). Useful for transforming data formats when working with blockchain data, encryption, or file processing.

` + `Parameters:
` + `- data (required): The string to convert
` + `- from (required): Source encoding format (utf8, hex, base64, or binary)
` + `- to (required): Target encoding format (utf8, hex, base64, or binary)

` + `Example usage:
` + `- UTF-8 to hex: {"data": "hello world", "from": "utf8", "to": "hex"} → 68656c6c6f20776f726c64
` + `- UTF-8 to base64: {"data": "Hello World", "from": "utf8", "to": "base64"} → SGVsbG8gV29ybGQ=
` + `- base64 to UTF-8: {"data": "SGVsbG8gV29ybGQ=", "from": "base64", "to": "utf8"} → Hello World
` + `- hex to base64: {"data": "68656c6c6f20776f726c64", "from": "hex", "to": "base64"} → aGVsbG8gd29ybGQ=

` + `Notes:
` + `- All parameters are required
` + `- The tool returns the converted data as a string
` + "- For binary conversion, data is represented as an array of byte values", {
    data: z19.string().describe("The data string to be converted"),
    from: encodingSchema2.describe("Source encoding format (utf8, hex, base64, or binary)"),
    to: encodingSchema2.describe("Target encoding format to convert to (utf8, hex, base64, or binary)")
  }, async ({ data, from, to }) => {
    try {
      const result = convertData({
        data,
        from,
        to
      });
      return {
        content: [
          {
            type: "text",
            text: result
          }
        ]
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        content: [
          {
            type: "text",
            text: `Error: ${msg}`
          }
        ],
        isError: true
      };
    }
  });
}

// tools/wallet/getBalanceDroplet.ts
function registerWalletGetBalanceDropletTool(server, dropletClient) {
  server.tool("wallet_getBalance", "Gets the current balance of the wallet (Droplet mode)", {}, async () => {
    try {
      const status = await dropletClient.getFaucetStatus();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              balance: status.balance_satoshis,
              unspentUtxoCount: status.unspent_utxo_count,
              spendableUtxoCount: status.spendable_utxo_count,
              consolidatingBalance: status.consolidating_balance_satoshis,
              consolidatingUtxoCount: status.consolidating_utxo_count,
              fixedDropSats: status.fixed_drop_sats,
              faucetName: status.faucet_name
            })
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: error instanceof Error ? error.message : String(error)
          }
        ],
        isError: true
      };
    }
  });
}

// tools/wallet/setupDroplet.ts
import { z as z20 } from "zod";
var setupDropletArgsSchema = z20.object({
  action: z20.enum(["register_key", "create_faucet", "check_status"]),
  faucetName: z20.string().optional(),
  fixedDropSats: z20.number().optional()
});
function registerSetupDropletTool(server, integratedWallet) {
  server.tool("wallet_setupDroplet", "Setup and manage Droplet API integration. Actions: register_key (registers your public key), create_faucet (creates a new faucet), check_status (checks faucet status)", { ...setupDropletArgsSchema.shape }, async ({ action, faucetName, fixedDropSats }) => {
    try {
      const dropletClient = integratedWallet.getDropletClient();
      if (!dropletClient) {
        throw new Error("Droplet client not configured");
      }
      const config = dropletClient.getConfig();
      const apiUrl = config.apiUrl;
      const authKey = config.authKey;
      switch (action) {
        case "register_key": {
          if (!authKey) {
            throw new Error("No auth key configured");
          }
          const pubkey = authKey.toPublicKey().toString();
          const response = await fetch(`${apiUrl}/auth/register`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ publicKey: pubkey })
          });
          if (!response.ok) {
            const error = await response.text();
            throw new Error(`Failed to register key: ${error}`);
          }
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  status: "success",
                  message: "Key registered successfully",
                  publicKey: pubkey
                })
              }
            ]
          };
        }
        case "create_faucet": {
          if (!faucetName) {
            throw new Error("faucetName is required for create_faucet action");
          }
          if (authKey) {
            const pubkey = authKey.toPublicKey().toString();
            await fetch(`${apiUrl}/auth/register`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json"
              },
              body: JSON.stringify({ publicKey: pubkey })
            });
          }
          const body = {
            name: faucetName,
            fixed_drop_sats: fixedDropSats || 1000,
            max_consolidation_inputs: 20
          };
          const headers = authKey ? await dropletClient.getAuthHeaders("POST", "/faucets", body) : {};
          const response = await fetch(`${apiUrl}/faucets`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...headers
            },
            body: JSON.stringify(body)
          });
          if (!response.ok) {
            const error = await response.text();
            throw new Error(`Failed to create faucet: ${error}`);
          }
          const result = await response.json();
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  status: "success",
                  message: "Faucet created successfully",
                  faucet: result
                })
              }
            ]
          };
        }
        case "check_status": {
          const status = await dropletClient.getFaucetStatus();
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  status: "success",
                  faucetStatus: status
                })
              }
            ]
          };
        }
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: error instanceof Error ? error.message : String(error)
          }
        ],
        isError: true
      };
    }
  });
}

// tools/wallet/a2bPublishMcp.ts
import { Utils as Utils9 } from "@bsv/sdk";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { createOrdinals } from "js-1sat-ord";
import { z as z21 } from "zod";
// package.json
var package_default2 = {
  name: "bsv-mcp",
  module: "dist/index.js",
  type: "module",
  version: "0.2.12",
  license: "MIT",
  author: "satchmo",
  description: "A collection of Bitcoin SV (BSV) tools for the Model Context Protocol (MCP) framework",
  repository: {
    type: "git",
    url: "https://github.com/b-open-io/bsv-mcp"
  },
  keywords: [
    "bitcoin",
    "bsv",
    "bitcoin-sv",
    "wallet",
    "ordinals",
    "blockchain",
    "1sat-ordinals",
    "explorer",
    "block explorer"
  ],
  files: [
    "dist/**/*.js",
    "dist/**/*.html",
    "package.json",
    "*.ts",
    "tools/*.ts",
    "tools/**/*.ts",
    "prompts/*.ts",
    "prompts/**/*.ts",
    "resources/*.ts",
    "resources/**/*.ts",
    "LICENSE",
    "README.md",
    "CHANGELOG.md",
    "smithery.yaml"
  ],
  bin: {
    "bsv-mcp": "./dist/index.js"
  },
  private: false,
  devDependencies: {
    "@biomejs/biome": "^2.4.6",
    "@radix-ui/react-dialog": "^1.1.15",
    "@radix-ui/react-dropdown-menu": "^2.1.16",
    "@radix-ui/react-label": "^2.1.8",
    "@radix-ui/react-separator": "^1.1.8",
    "@radix-ui/react-slot": "^1.2.4",
    "@radix-ui/react-tabs": "^1.1.13",
    "@radix-ui/react-toast": "^1.2.15",
    "@radix-ui/react-tooltip": "^1.2.8",
    "@radix-ui/themes": "^3.3.0",
    "@tailwindcss/postcss": "^4.2.1",
    "@tanstack/react-query": "^5.90.21",
    "@types/bun": "^1.3.10",
    "@types/node": "^25.3.5",
    "@types/react": "^19.2.14",
    "@types/react-dom": "^19.2.3",
    autoprefixer: "^10.4.27",
    bun: "^1.3.10",
    "class-variance-authority": "^0.7.1",
    clsx: "^2.1.1",
    "lucide-react": "0.577.0",
    next: "^16.1.6",
    "next-themes": "^0.4.6",
    postcss: "^8.5.8",
    react: "^19.2.4",
    "react-dom": "^19.2.4",
    sonner: "^2.0.7",
    "tailwind-merge": "^3.5.0",
    tailwindcss: "^4.2.1",
    "tailwindcss-animate": "^1.0.7",
    vite: "^7.3.1",
    "vite-plugin-singlefile": "^2.3.0"
  },
  peerDependencies: {
    typescript: "^5.9.3"
  },
  dependencies: {
    "@1sat/actions": "0.0.27",
    "@1sat/wallet-remote": "0.0.7",
    "@bsv/sdk": "^2.0.6",
    "@modelcontextprotocol/ext-apps": "^1.2.0",
    "@modelcontextprotocol/sdk": "^1.27.1",
    "bitcoin-auth": "^0.0.7",
    "bitcoin-backup": "0.0.7",
    "bmap-api-types": "0.0.9",
    "bsv-bap": "0.1.23",
    jose: "^6.2.0",
    "js-1sat-ord": "^0.1.91",
    "mcp-handler": "^1.0.7",
    mnee: "^3.1.0",
    "satoshi-token": "^0.0.7",
    "schema-dts": "^1.1.5",
    "sigma-protocol": "^0.1.9",
    zod: "^4.3.6"
  },
  scripts: {
    build: "bun run ./scripts/build.ts",
    "build:view": "vite build",
    "build:all": "bun run build:view && bun run build",
    dev: "next dev",
    "build:next": "next build",
    "start:next": "next start",
    lint: "biome check .",
    "lint:fix": "biome check . --write",
    prepack: "bun run build:all"
  }
};

// tools/wallet/a2bPublishMcp.ts
var { toArray: toArray6, toBase64: toBase643 } = Utils9;
var OVERLAY_API_URL2 = "https://a2b-overlay-production.up.railway.app/v1";
var McpConfigSchema = z21.object({
  command: z21.string().describe("The command to execute the tool"),
  args: z21.array(z21.string()).describe("Arguments to pass to the command"),
  tools: z21.array(z21.string()).optional().describe("Available tool names"),
  prompts: z21.array(z21.string()).optional().describe("Available prompt names"),
  resources: z21.array(z21.string()).optional().describe("Available resource URIs"),
  env: z21.record(z21.string()).optional().describe("Environment variables")
});
var a2bPublishMcpArgsSchema = z21.object({
  toolName: z21.string().describe("Human-friendly tool name"),
  command: z21.string().describe("The command to execute the tool"),
  args: z21.array(z21.string()).describe("Arguments to pass to the command"),
  keywords: z21.array(z21.string()).optional().describe("Optional keywords to improve tool discoverability"),
  env: z21.array(z21.object({
    key: z21.string().describe("Environment variable name"),
    description: z21.string().describe("Description of the environment variable")
  })).optional().describe("Optional environment variables with descriptions"),
  description: z21.string().optional().describe("Optional tool description"),
  destinationAddress: z21.string().optional().describe("Optional target address for inscription")
});
async function callIngestEndpoint(txid) {
  try {
    const response = await fetch(`${OVERLAY_API_URL2}/ingest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ txid })
    });
    if (!response.ok) {
      console.warn(`Ingest API returned status ${response.status}: ${response.statusText}`);
      return false;
    }
    const result = await response.json();
    return true;
  } catch (error) {
    console.warn("Error calling ingest endpoint:", error);
    return false;
  }
}
async function fetchMcpMetadata(command, args) {
  let transport;
  let client;
  try {
    transport = new StdioClientTransport({
      command,
      args,
      env: {
        ...process.env,
        DISABLE_BROADCASTING: "true"
      }
    });
    client = new Client({
      name: "metadata-fetcher",
      version: package_default2.version
    });
    await client.connect(transport);
    const toolsResponse = await client.listTools();
    const promptsResponse = await client.listPrompts();
    const resourcesResponse = await client.listResources();
    const tools = toolsResponse.tools.map((tool) => tool.name);
    const prompts = promptsResponse.prompts.map((prompt) => prompt.name);
    const resources = resourcesResponse.resources.map((resource) => resource.uri);
    const allTools = [...new Set([...tools])];
    return {
      tools: allTools,
      prompts,
      resources
    };
  } catch (error) {
    console.error("Error fetching MCP metadata:", error);
    return {
      tools: [],
      prompts: [],
      resources: []
    };
  } finally {
    if (transport) {
      try {
        await transport.close();
      } catch (e) {
        console.error("Error closing transport:", e);
      }
    }
  }
}
function registerA2bPublishMcpTool(server, wallet, identityPk, config) {
  server.tool("wallet_a2bPublishMcp", "Publish an MCP tool configuration record on-chain via Ordinal inscription. This creates a permanent, immutable, and discoverable tool definition that can be accessed by other MCP servers. The tool is published as a JSON inscription with metadata and optional digital signatures for authenticity verification.", { ...a2bPublishMcpArgsSchema.shape }, async ({ toolName, command, args, keywords, env, description, destinationAddress }) => {
    try {
      if (!identityPk) {
        console.warn("Warning: No identity key provided; sigma signing disabled for A2B MCP publish");
      }
      const paymentPk = wallet.getPaymentKey();
      if (!paymentPk)
        throw new Error("No payment private key available");
      const { paymentUtxos } = await wallet.getUtxos();
      if (!paymentUtxos?.length)
        throw new Error("No payment UTXOs available to fund inscription");
      const walletAddress = paymentPk.toAddress().toString();
      const metadata = await fetchMcpMetadata(command, args);
      const toolConfig2 = {
        command,
        args,
        tools: metadata.tools,
        prompts: metadata.prompts,
        resources: metadata.resources,
        env: env ? env.reduce((acc, { key, description: desc }) => {
          acc[key] = desc;
          return acc;
        }, {}) : undefined
      };
      McpConfigSchema.parse(toolConfig2);
      const fullConfig = {
        mcpServers: {
          [toolName]: {
            description: description || "",
            keywords: keywords || [],
            tools: metadata.tools || [],
            prompts: metadata.prompts || [],
            resources: metadata.resources || [],
            ...toolConfig2
          }
        }
      };
      const fileContent = JSON.stringify(fullConfig, null, 2);
      const dataB64 = toBase643(toArray6(fileContent));
      const inscription = {
        dataB64,
        contentType: "application/json"
      };
      const targetAddress = destinationAddress ?? walletAddress;
      const destinations = [
        { address: targetAddress, inscription }
      ];
      const metaData = { app: "bsv-mcp", type: "a2b-mcp" };
      const createOrdinalsConfig = {
        utxos: paymentUtxos,
        destinations,
        paymentPk,
        changeAddress: walletAddress,
        metaData
      };
      if (identityPk) {
        createOrdinalsConfig.signer = {
          idKey: identityPk
        };
      }
      let result;
      if (!config.disableBroadcasting) {
        result = await createOrdinals(createOrdinalsConfig);
      } else {
        console.warn("Broadcasting disabled. Transaction not created.");
      }
      if (!config.disableBroadcasting && result) {
        const broadcaster = new V5Broadcaster;
        await result.tx.broadcast(broadcaster);
        const txid = result.tx.id("hex");
        setTimeout(async () => {
          await callIngestEndpoint(txid);
        }, 1000);
        try {
          await wallet.refreshUtxos();
        } catch (refreshError) {
          console.warn("Failed to refresh UTXOs after transaction:", refreshError);
        }
        const outpointIndex = 0;
        const outpoint = `${txid}_${outpointIndex}`;
        const onchainUrl = `ord://${outpoint}`;
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                status: "success",
                txid,
                outpoint,
                onchainUrl,
                toolName,
                toolCount: metadata.tools.length,
                promptCount: metadata.prompts.length,
                resourceCount: metadata.resources.length,
                description: description || `MCP Tool: ${toolName}`,
                address: targetAddress
              }, null, 2)
            }
          ]
        };
      }
      return {
        content: [
          {
            type: "text",
            text: result?.tx.toHex() || ""
          }
        ]
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { content: [{ type: "text", text: msg }], isError: true };
    }
  });
}

// tools/wallet/brc100.ts
import { z as z22 } from "zod";
var noCtx = {
  content: [{ type: "text", text: "Wallet not initialized." }],
  isError: true
};
function result(data) {
  return { content: [{ type: "text", text: JSON.stringify(data) }] };
}
function error(err) {
  return {
    content: [{ type: "text", text: err instanceof Error ? err.message : String(err) }],
    isError: true
  };
}
function parseJSON(s) {
  if (!s)
    return;
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}
function registerBrc100Tools(server, ctx) {
  server.tool("wallet_createAction", "Creates a new Bitcoin transaction. Handles funding, signing, and broadcasting based on options.", {
    description: z22.string().describe("5-50 char description of the action"),
    inputsJSON: z22.string().optional().describe("JSON array of transaction inputs"),
    outputsJSON: z22.string().optional().describe("JSON array of transaction outputs [{lockingScript, satoshis, outputDescription, basket, tags, customInstructions}]"),
    labelsJSON: z22.string().optional().describe("JSON array of label strings"),
    lockTime: z22.number().optional(),
    version: z22.number().optional(),
    optionsJSON: z22.string().optional().describe("JSON CreateActionOptions: {noSend, sendWith, acceptDelayedBroadcast, signAndProcess, randomizeOutputs, noSendChange, knownTxids, trustSelf}")
  }, async ({ description, inputsJSON, outputsJSON, labelsJSON, lockTime, version, optionsJSON }) => {
    if (!ctx)
      return noCtx;
    try {
      return result(await ctx.wallet.createAction({
        description,
        inputs: parseJSON(inputsJSON),
        outputs: parseJSON(outputsJSON),
        labels: parseJSON(labelsJSON),
        lockTime,
        version,
        options: parseJSON(optionsJSON)
      }));
    } catch (e) {
      return error(e);
    }
  });
  server.tool("wallet_signAction", "Signs a transaction previously created with createAction (when signAndProcess was false).", {
    spendsJSON: z22.string().describe("JSON map of input index to {unlockingScript, sequenceNumber}"),
    reference: z22.string().describe("Base64 reference from createAction result"),
    optionsJSON: z22.string().optional().describe("JSON SignActionOptions: {acceptDelayedBroadcast, sendWith}")
  }, async ({ spendsJSON, reference, optionsJSON }) => {
    if (!ctx)
      return noCtx;
    try {
      return result(await ctx.wallet.signAction({
        spends: parseJSON(spendsJSON),
        reference,
        options: parseJSON(optionsJSON)
      }));
    } catch (e) {
      return error(e);
    }
  });
  server.tool("wallet_abortAction", "Aborts a pending (nosend or unsigned) transaction, releasing consumed inputs back to spendable state.", {
    reference: z22.string().describe("Base64 reference of the transaction to abort")
  }, async ({ reference }) => {
    if (!ctx)
      return noCtx;
    try {
      return result(await ctx.wallet.abortAction({ reference }));
    } catch (e) {
      return error(e);
    }
  });
  server.tool("wallet_internalizeAction", "Internalizes an external transaction, adding its outputs to wallet baskets.", {
    txJSON: z22.string().describe("JSON array of AtomicBEEF bytes"),
    outputsJSON: z22.string().describe("JSON array of outputs to internalize"),
    description: z22.string().describe("5-50 char description"),
    labelsJSON: z22.string().optional().describe("JSON array of label strings")
  }, async ({ txJSON, outputsJSON, description, labelsJSON }) => {
    if (!ctx)
      return noCtx;
    try {
      return result(await ctx.wallet.internalizeAction({
        tx: parseJSON(txJSON),
        outputs: parseJSON(outputsJSON),
        description,
        labels: parseJSON(labelsJSON)
      }));
    } catch (e) {
      return error(e);
    }
  });
  server.tool("wallet_listActions", "Lists wallet transactions filtered by labels, with optional input/output details.", {
    labelsJSON: z22.string().default("[]").describe("JSON array of label strings"),
    labelQueryMode: z22.enum(["any", "all"]).default("any"),
    includeLabels: z22.boolean().default(true),
    includeInputs: z22.boolean().default(false),
    includeInputSourceLockingScripts: z22.boolean().default(false),
    includeInputUnlockingScripts: z22.boolean().default(false),
    includeOutputs: z22.boolean().default(false),
    includeOutputLockingScripts: z22.boolean().default(false),
    limit: z22.number().default(25),
    offset: z22.number().default(0)
  }, async ({ labelsJSON, ...rest }) => {
    if (!ctx)
      return noCtx;
    try {
      return result(await ctx.wallet.listActions({
        labels: parseJSON(labelsJSON),
        ...rest
      }));
    } catch (e) {
      return error(e);
    }
  });
  server.tool("wallet_listOutputs", "Lists spendable outputs in a basket, optionally filtered by tags.", {
    basket: z22.string().describe('Basket name (e.g. "default")'),
    tagsJSON: z22.string().optional().describe("JSON array of tag strings"),
    tagQueryMode: z22.enum(["all", "any"]).optional(),
    include: z22.enum(["locking scripts", "entire transactions"]).optional(),
    includeCustomInstructions: z22.boolean().default(false),
    includeTags: z22.boolean().default(false),
    includeLabels: z22.boolean().default(false),
    limit: z22.number().default(25),
    offset: z22.number().default(0)
  }, async ({ tagsJSON, ...rest }) => {
    if (!ctx)
      return noCtx;
    try {
      return result(await ctx.wallet.listOutputs({
        tags: parseJSON(tagsJSON),
        ...rest
      }));
    } catch (e) {
      return error(e);
    }
  });
  server.tool("wallet_relinquishOutput", "Removes an output from a basket without spending it.", {
    basket: z22.string().describe("Basket name"),
    output: z22.string().describe("Outpoint string (txid.vout)")
  }, async (args) => {
    if (!ctx)
      return noCtx;
    try {
      return result(await ctx.wallet.relinquishOutput(args));
    } catch (e) {
      return error(e);
    }
  });
  server.tool("wallet_getPublicKey", 'Retrieves a public key by protocol/key derivation. Use identityKey:true for the root identity key. protocolID is a JSON array like [2,"1sat"].', {
    identityKey: z22.boolean().optional().describe("If true, return the identity key (ignores other args)"),
    protocolIDJSON: z22.string().optional().describe('JSON array [securityLevel, protocolString] e.g. [2,"1sat"]'),
    keyID: z22.string().optional(),
    counterparty: z22.string().optional(),
    forSelf: z22.boolean().optional(),
    privileged: z22.boolean().optional(),
    privilegedReason: z22.string().optional()
  }, async ({ protocolIDJSON, ...rest }) => {
    if (!ctx)
      return noCtx;
    try {
      return result(await ctx.wallet.getPublicKey({
        protocolID: parseJSON(protocolIDJSON),
        ...rest
      }));
    } catch (e) {
      return error(e);
    }
  });
  server.tool("wallet_encrypt", 'Encrypts data using wallet keys. protocolID is a JSON array like [2,"protocolName"].', {
    plaintext: z22.array(z22.number()).describe("Data bytes to encrypt"),
    protocolIDJSON: z22.string().describe("JSON array [securityLevel, protocolString]"),
    keyID: z22.string(),
    counterparty: z22.string().optional(),
    privileged: z22.boolean().optional()
  }, async ({ protocolIDJSON, ...rest }) => {
    if (!ctx)
      return noCtx;
    try {
      return result(await ctx.wallet.encrypt({
        protocolID: parseJSON(protocolIDJSON),
        ...rest
      }));
    } catch (e) {
      return error(e);
    }
  });
  server.tool("wallet_decrypt", "Decrypts data using wallet keys.", {
    ciphertext: z22.array(z22.number()).describe("Encrypted data bytes"),
    protocolIDJSON: z22.string().describe("JSON array [securityLevel, protocolString]"),
    keyID: z22.string(),
    counterparty: z22.string().optional(),
    privileged: z22.boolean().optional()
  }, async ({ protocolIDJSON, ...rest }) => {
    if (!ctx)
      return noCtx;
    try {
      return result(await ctx.wallet.decrypt({
        protocolID: parseJSON(protocolIDJSON),
        ...rest
      }));
    } catch (e) {
      return error(e);
    }
  });
  server.tool("wallet_createHmac", "Creates an HMAC using wallet keys.", {
    data: z22.array(z22.number()).describe("Data bytes"),
    protocolIDJSON: z22.string().describe("JSON array [securityLevel, protocolString]"),
    keyID: z22.string(),
    counterparty: z22.string().optional(),
    privileged: z22.boolean().optional()
  }, async ({ protocolIDJSON, ...rest }) => {
    if (!ctx)
      return noCtx;
    try {
      return result(await ctx.wallet.createHmac({
        protocolID: parseJSON(protocolIDJSON),
        ...rest
      }));
    } catch (e) {
      return error(e);
    }
  });
  server.tool("wallet_verifyHmac", "Verifies an HMAC using wallet keys.", {
    data: z22.array(z22.number()).describe("Data bytes"),
    hmac: z22.array(z22.number()).describe("HMAC bytes to verify"),
    protocolIDJSON: z22.string().describe("JSON array [securityLevel, protocolString]"),
    keyID: z22.string(),
    counterparty: z22.string().optional(),
    privileged: z22.boolean().optional()
  }, async ({ protocolIDJSON, ...rest }) => {
    if (!ctx)
      return noCtx;
    try {
      return result(await ctx.wallet.verifyHmac({
        protocolID: parseJSON(protocolIDJSON),
        ...rest
      }));
    } catch (e) {
      return error(e);
    }
  });
  server.tool("wallet_createSignature", "Creates a digital signature using wallet keys.", {
    data: z22.array(z22.number()).describe("Data bytes to sign"),
    protocolIDJSON: z22.string().describe("JSON array [securityLevel, protocolString]"),
    keyID: z22.string(),
    counterparty: z22.string().optional(),
    privileged: z22.boolean().optional()
  }, async ({ protocolIDJSON, ...rest }) => {
    if (!ctx)
      return noCtx;
    try {
      return result(await ctx.wallet.createSignature({
        protocolID: parseJSON(protocolIDJSON),
        ...rest
      }));
    } catch (e) {
      return error(e);
    }
  });
  server.tool("wallet_verifySignature", "Verifies a digital signature using wallet keys.", {
    data: z22.array(z22.number()).describe("Data bytes that were signed"),
    signature: z22.array(z22.number()).describe("Signature bytes"),
    protocolIDJSON: z22.string().describe("JSON array [securityLevel, protocolString]"),
    keyID: z22.string(),
    counterparty: z22.string().optional(),
    forSelf: z22.boolean().optional(),
    privileged: z22.boolean().optional()
  }, async ({ protocolIDJSON, ...rest }) => {
    if (!ctx)
      return noCtx;
    try {
      return result(await ctx.wallet.verifySignature({
        protocolID: parseJSON(protocolIDJSON),
        ...rest
      }));
    } catch (e) {
      return error(e);
    }
  });
  server.tool("wallet_revealCounterpartyKeyLinkage", "Reveals the linkage between the wallet identity and a counterparty to a verifier.", {
    counterparty: z22.string().describe("Counterparty public key hex"),
    verifier: z22.string().describe("Verifier public key hex"),
    privileged: z22.boolean().optional(),
    privilegedReason: z22.string().optional()
  }, async (args) => {
    if (!ctx)
      return noCtx;
    try {
      return result(await ctx.wallet.revealCounterpartyKeyLinkage(args));
    } catch (e) {
      return error(e);
    }
  });
  server.tool("wallet_revealSpecificKeyLinkage", "Reveals linkage for a specific protocol/key combination to a verifier.", {
    counterparty: z22.string().describe("Counterparty public key hex"),
    verifier: z22.string().describe("Verifier public key hex"),
    protocolIDJSON: z22.string().describe("JSON array [securityLevel, protocolString]"),
    keyID: z22.string(),
    privileged: z22.boolean().optional(),
    privilegedReason: z22.string().optional()
  }, async ({ protocolIDJSON, ...rest }) => {
    if (!ctx)
      return noCtx;
    try {
      return result(await ctx.wallet.revealSpecificKeyLinkage({
        protocolID: parseJSON(protocolIDJSON),
        ...rest
      }));
    } catch (e) {
      return error(e);
    }
  });
  server.tool("wallet_acquireCertificate", "Acquires an identity certificate from a certifier.", {
    type: z22.string().describe("Certificate type (base64)"),
    certifier: z22.string().describe("Certifier public key hex"),
    acquisitionProtocol: z22.enum(["direct", "issuance"]),
    fieldsJSON: z22.string().describe("JSON object of certificate fields"),
    serialNumber: z22.string().optional(),
    revocationOutpoint: z22.string().optional(),
    signature: z22.string().optional(),
    certifierUrl: z22.string().optional(),
    keyringRevealer: z22.string().optional(),
    keyringForSubjectJSON: z22.string().optional().describe("JSON object of keyring for subject"),
    privileged: z22.boolean().optional(),
    privilegedReason: z22.string().optional()
  }, async ({ fieldsJSON, keyringForSubjectJSON, ...rest }) => {
    if (!ctx)
      return noCtx;
    try {
      return result(await ctx.wallet.acquireCertificate({
        fields: parseJSON(fieldsJSON),
        keyringForSubject: parseJSON(keyringForSubjectJSON),
        ...rest
      }));
    } catch (e) {
      return error(e);
    }
  });
  server.tool("wallet_listCertificates", "Lists identity certificates filtered by certifiers and types.", {
    certifiersJSON: z22.string().describe("JSON array of certifier public key hexes"),
    typesJSON: z22.string().describe("JSON array of certificate types (base64)"),
    limit: z22.number().default(25),
    offset: z22.number().default(0),
    privileged: z22.boolean().optional(),
    privilegedReason: z22.string().optional()
  }, async ({ certifiersJSON, typesJSON, ...rest }) => {
    if (!ctx)
      return noCtx;
    try {
      return result(await ctx.wallet.listCertificates({
        certifiers: parseJSON(certifiersJSON),
        types: parseJSON(typesJSON),
        ...rest
      }));
    } catch (e) {
      return error(e);
    }
  });
  server.tool("wallet_proveCertificate", "Proves select fields of a certificate to a verifier.", {
    certificateJSON: z22.string().describe("JSON object of the certificate to prove"),
    fieldsToRevealJSON: z22.string().describe("JSON array of field names to reveal"),
    verifier: z22.string().describe("Verifier public key hex"),
    privileged: z22.boolean().optional(),
    privilegedReason: z22.string().optional()
  }, async ({ certificateJSON, fieldsToRevealJSON, ...rest }) => {
    if (!ctx)
      return noCtx;
    try {
      return result(await ctx.wallet.proveCertificate({
        certificate: parseJSON(certificateJSON),
        fieldsToReveal: parseJSON(fieldsToRevealJSON),
        ...rest
      }));
    } catch (e) {
      return error(e);
    }
  });
  server.tool("wallet_relinquishCertificate", "Removes a certificate from the wallet.", {
    type: z22.string().describe("Certificate type"),
    serialNumber: z22.string().describe("Certificate serial number"),
    certifier: z22.string().describe("Certifier public key hex")
  }, async (args) => {
    if (!ctx)
      return noCtx;
    try {
      return result(await ctx.wallet.relinquishCertificate(args));
    } catch (e) {
      return error(e);
    }
  });
  server.tool("wallet_discoverByIdentityKey", "Discovers certificates issued to a given identity key.", {
    identityKey: z22.string().describe("Identity public key hex"),
    limit: z22.number().default(25),
    offset: z22.number().default(0)
  }, async (args) => {
    if (!ctx)
      return noCtx;
    try {
      return result(await ctx.wallet.discoverByIdentityKey(args));
    } catch (e) {
      return error(e);
    }
  });
  server.tool("wallet_discoverByAttributes", "Discovers certificates matching specific attributes.", {
    attributesJSON: z22.string().describe("JSON object of attribute key/value pairs to match"),
    limit: z22.number().default(25),
    offset: z22.number().default(0)
  }, async ({ attributesJSON, ...rest }) => {
    if (!ctx)
      return noCtx;
    try {
      return result(await ctx.wallet.discoverByAttributes({
        attributes: parseJSON(attributesJSON),
        ...rest
      }));
    } catch (e) {
      return error(e);
    }
  });
  server.tool("wallet_isAuthenticated", "Checks if the wallet user is authenticated.", {}, async () => {
    if (!ctx)
      return noCtx;
    try {
      return result(await ctx.wallet.isAuthenticated({}));
    } catch (e) {
      return error(e);
    }
  });
  server.tool("wallet_getHeight", "Gets the current blockchain height.", {}, async () => {
    if (!ctx)
      return noCtx;
    try {
      return result(await ctx.wallet.getHeight({}));
    } catch (e) {
      return error(e);
    }
  });
  server.tool("wallet_getHeaderForHeight", "Gets the 80-byte block header at a given height.", {
    height: z22.number().describe("Block height")
  }, async ({ height }) => {
    if (!ctx)
      return noCtx;
    try {
      return result(await ctx.wallet.getHeaderForHeight({ height }));
    } catch (e) {
      return error(e);
    }
  });
  server.tool("wallet_getNetwork", "Gets the network the wallet is connected to (mainnet or testnet).", {}, async () => {
    if (!ctx)
      return noCtx;
    try {
      return result(await ctx.wallet.getNetwork({}));
    } catch (e) {
      return error(e);
    }
  });
  server.tool("wallet_getVersion", "Gets the wallet implementation version.", {}, async () => {
    if (!ctx)
      return noCtx;
    try {
      return result(await ctx.wallet.getVersion({}));
    } catch (e) {
      return error(e);
    }
  });
}

// tools/wallet/createOrdinals.ts
import { inscribe } from "@1sat/actions";
import { z as z23 } from "zod";
var createOrdinalsArgsSchema = z23.object({
  dataB64: z23.string().describe("Base64-encoded content to inscribe"),
  contentType: z23.string().describe("MIME type of the content"),
  destinationAddress: z23.string().optional().describe("Optional destination address for the ordinal"),
  metadata: z23.record(z23.string(), z23.string()).optional().describe("Optional MAP metadata for the inscription"),
  signWithBAP: z23.boolean().optional().describe("Sign with BAP identity (Sigma protocol). Uses anchor+inscription two-step flow.")
});
function registerCreateOrdinalsTool(server, ctx) {
  server.tool("wallet_createOrdinals", "Creates and inscribes ordinals (NFTs) on the Bitcoin SV blockchain. This tool lets you mint new digital artifacts by encoding data directly into the blockchain. Supports various content types including images, text, JSON, and HTML. The tool handles transaction creation, fee calculation, and broadcasting.", { ...createOrdinalsArgsSchema.shape }, async ({ dataB64, contentType, destinationAddress, metadata, signWithBAP }) => {
    if (!ctx) {
      return {
        content: [
          {
            type: "text",
            text: "Wallet not initialized. Please configure a wallet before creating ordinals."
          }
        ],
        isError: true
      };
    }
    try {
      const result2 = await inscribe.execute(ctx, {
        base64Content: dataB64,
        contentType,
        map: metadata,
        signWithBAP
      });
      if (result2.error) {
        return {
          content: [{ type: "text", text: result2.error }],
          isError: true
        };
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              txid: result2.txid,
              rawtx: result2.rawtx,
              contentType
            })
          }
        ]
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: err instanceof Error ? err.message : String(err)
          }
        ],
        isError: true
      };
    }
  });
}

// tools/wallet/gatherCollectionInfo.ts
import { promises as fs2 } from "node:fs";
import path3 from "node:path";
import { z as z24 } from "zod";
var gatherCollectionInfoArgsSchema = z24.object({
  folderPath: z24.string().describe("Path to folder containing images to analyze for collection")
});
async function analyzeImageFile(filePath) {
  const fileName = path3.basename(filePath);
  const ext = path3.extname(fileName).toLowerCase();
  const contentTypeMap = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml"
  };
  try {
    const stat = await fs2.stat(filePath);
    const contentType = contentTypeMap[ext];
    if (!contentType) {
      return {
        fileName,
        filePath,
        size: stat.size,
        sizeKB: Math.round(stat.size / 1024),
        contentType: "unknown",
        valid: false,
        error: `Unsupported file type: ${ext}`
      };
    }
    const sizeKB = Math.round(stat.size / 1024);
    const warnings = [];
    if (sizeKB > 50) {
      warnings.push(`Large file size: ${sizeKB}KB (consider optimizing for lower fees)`);
    }
    return {
      fileName,
      filePath,
      size: stat.size,
      sizeKB,
      contentType,
      valid: true,
      error: warnings.length > 0 ? warnings.join("; ") : undefined
    };
  } catch (error2) {
    return {
      fileName,
      filePath,
      size: 0,
      sizeKB: 0,
      contentType: "unknown",
      valid: false,
      error: error2 instanceof Error ? error2.message : "Unknown error"
    };
  }
}
function estimateInscriptionCost(sizeKB) {
  const baseCost = 1;
  const sizeCost = Math.ceil(sizeKB * 10);
  const miningFee = 500;
  return baseCost + sizeCost + miningFee;
}
function registerGatherCollectionInfoTool(server, wallet) {
  server.tool("wallet_gatherCollectionInfo", "Analyzes a folder of images and gathers all necessary information for minting an ordinals collection. This includes validating images, checking wallet balance, estimating costs, and suggesting metadata. Use this before minting to ensure everything is ready.", { ...gatherCollectionInfoArgsSchema.shape }, async ({ folderPath }) => {
    try {
      const analysis = {
        folderPath,
        totalImages: 0,
        validImages: 0,
        invalidImages: 0,
        totalSizeKB: 0,
        imageTypes: {},
        images: [],
        suggestedMetadata: {
          collectionName: "",
          description: "",
          quantity: 0
        },
        costEstimate: {
          collectionInscriptionCost: 0,
          perItemCost: 0,
          totalItemsCost: 0,
          totalCost: 0,
          totalCostBSV: 0
        },
        walletInfo: {
          address: "",
          balance: 0,
          balanceBSV: 0,
          hasEnoughFunds: false
        },
        warnings: [],
        errors: []
      };
      try {
        const folderStat = await fs2.stat(folderPath);
        if (!folderStat.isDirectory()) {
          throw new Error(`Path is not a directory: ${folderPath}`);
        }
      } catch (error2) {
        analysis.errors.push(`Folder not found or inaccessible: ${folderPath}`);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(analysis, null, 2)
            }
          ],
          isError: true
        };
      }
      const paymentPk = wallet.getPrivateKey();
      if (!paymentPk) {
        analysis.errors.push("No payment key available in wallet");
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(analysis, null, 2)
            }
          ],
          isError: true
        };
      }
      analysis.walletInfo.address = paymentPk.toAddress().toString();
      try {
        const { paymentUtxos } = await wallet.getUtxos();
        const balance = paymentUtxos.reduce((sum, utxo) => sum + utxo.satoshis, 0);
        analysis.walletInfo.balance = balance;
        analysis.walletInfo.balanceBSV = balance / 1e8;
      } catch (error2) {
        analysis.warnings.push("Could not fetch wallet balance");
      }
      const files = await fs2.readdir(folderPath);
      const imageExtensions = [
        ".jpg",
        ".jpeg",
        ".png",
        ".gif",
        ".webp",
        ".svg"
      ];
      for (const file of files) {
        const filePath = path3.join(folderPath, file);
        const stat = await fs2.stat(filePath);
        if (stat.isFile()) {
          const ext = path3.extname(file).toLowerCase();
          if (imageExtensions.includes(ext)) {
            const imageInfo = await analyzeImageFile(filePath);
            analysis.images.push(imageInfo);
            analysis.totalImages++;
            if (imageInfo.valid) {
              analysis.validImages++;
              analysis.totalSizeKB += imageInfo.sizeKB;
              const type = imageInfo.contentType.split("/")[1] || "unknown";
              analysis.imageTypes[type] = (analysis.imageTypes[type] || 0) + 1;
            } else {
              analysis.invalidImages++;
              if (imageInfo.error) {
                analysis.errors.push(`${imageInfo.fileName}: ${imageInfo.error}`);
              }
            }
          }
        }
      }
      analysis.images.sort((a, b) => a.fileName.localeCompare(b.fileName));
      if (analysis.validImages === 0) {
        analysis.errors.push("No valid images found in the folder");
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(analysis, null, 2)
            }
          ],
          isError: true
        };
      }
      const folderName = path3.basename(folderPath);
      analysis.suggestedMetadata = {
        collectionName: folderName.replace(/[-_]/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
        description: `A collection of ${analysis.validImages} unique digital artifacts`,
        quantity: analysis.validImages
      };
      const collectionIconSizeKB = 1;
      analysis.costEstimate.collectionInscriptionCost = estimateInscriptionCost(collectionIconSizeKB);
      const avgItemSizeKB = analysis.totalSizeKB / analysis.validImages;
      analysis.costEstimate.perItemCost = estimateInscriptionCost(avgItemSizeKB);
      analysis.costEstimate.totalItemsCost = analysis.costEstimate.perItemCost * analysis.validImages;
      analysis.costEstimate.totalCost = analysis.costEstimate.collectionInscriptionCost + analysis.costEstimate.totalItemsCost;
      analysis.costEstimate.totalCostBSV = analysis.costEstimate.totalCost / 1e8;
      analysis.walletInfo.hasEnoughFunds = analysis.walletInfo.balance >= analysis.costEstimate.totalCost;
      if (!analysis.walletInfo.hasEnoughFunds) {
        analysis.walletInfo.shortfall = analysis.costEstimate.totalCost - analysis.walletInfo.balance;
        analysis.warnings.push(`Insufficient funds: need ${analysis.costEstimate.totalCost} sats, have ${analysis.walletInfo.balance} sats (shortfall: ${analysis.walletInfo.shortfall} sats)`);
      }
      if (analysis.validImages > 100) {
        analysis.warnings.push(`Large collection (${analysis.validImages} items) will take time and multiple transactions to mint`);
      }
      if (analysis.totalSizeKB > 1000) {
        analysis.warnings.push(`Large total size (${Math.round(analysis.totalSizeKB / 1024)}MB) will result in higher fees`);
      }
      const summary = {
        ready: analysis.errors.length === 0 && analysis.walletInfo.hasEnoughFunds,
        summary: `Found ${analysis.validImages} valid images in "${folderName}". Total size: ${Math.round(analysis.totalSizeKB)}KB. Estimated cost: ${analysis.costEstimate.totalCost} sats (${analysis.costEstimate.totalCostBSV.toFixed(8)} BSV). Wallet balance: ${analysis.walletInfo.balance} sats. ${analysis.walletInfo.hasEnoughFunds ? "Ready to mint!" : "Insufficient funds."}`
      };
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              ...analysis,
              ...summary
            }, null, 2)
          }
        ]
      };
    } catch (error2) {
      const errorMessage = error2 instanceof Error ? error2.message : String(error2);
      return {
        content: [
          {
            type: "text",
            text: `Error analyzing collection: ${errorMessage}`
          }
        ],
        isError: true
      };
    }
  });
}

// tools/wallet/getAddress.ts
import {
  deriveDepositAddresses
} from "@1sat/actions";
var MCP_ADDRESS_PREFIX = "mcp";
function registerGetAddressTool(server, ctx) {
  server.tool("wallet_getAddress", "Retrieves the wallet's BRC-29 deposit address derived for MCP. This address can receive BSV, ordinals, or tokens via external payments.", {}, async () => {
    try {
      if (!ctx) {
        throw new Error("BRC-100 wallet context not available");
      }
      const { derivations } = await deriveDepositAddresses.execute(ctx, {
        prefix: MCP_ADDRESS_PREFIX
      });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              address: derivations[0].address,
              status: "ok"
            })
          }
        ]
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: "Failed to get wallet address",
              message: msg,
              status: "error"
            })
          }
        ],
        isError: true
      };
    }
  });
}

// tools/wallet/getBalance.ts
import { toBitcoin } from "satoshi-token";
function registerWalletGetBalanceTool(server, ctx) {
  server.tool("wallet_getBalance", "Retrieves the current BSV balance for the wallet.", {}, async () => {
    if (!ctx) {
      return {
        content: [
          {
            type: "text",
            text: "Wallet not initialized. Please configure a wallet before checking balance."
          }
        ],
        isError: true
      };
    }
    try {
      const result2 = await ctx.wallet.listOutputs({ basket: "default" });
      const totalSatoshis = result2.outputs.reduce((sum, output) => sum + output.satoshis, 0);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              satoshis: totalSatoshis,
              bsv: toBitcoin(totalSatoshis),
              utxoCount: result2.totalOutputs
            })
          }
        ]
      };
    } catch (error2) {
      return {
        content: [
          {
            type: "text",
            text: error2 instanceof Error ? error2.message : String(error2)
          }
        ],
        isError: true
      };
    }
  });
}

// tools/wallet/getBsv21Balances.ts
import { getBsv21Balances } from "@1sat/actions";
function registerGetBsv21BalancesTool(server, ctx) {
  server.tool("wallet_getBsv21Balances", "Get aggregated BSV21 token balances grouped by token ID", {}, async () => {
    try {
      if (!ctx)
        throw new Error("BRC-100 wallet context not available");
      const result2 = await getBsv21Balances.execute(ctx, {});
      return {
        content: [{
          type: "text",
          text: JSON.stringify(result2, (_, v) => typeof v === "bigint" ? v.toString() : v, 2)
        }]
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { content: [{ type: "text", text: msg }], isError: true };
    }
  });
}

// tools/wallet/getLockData.ts
import { getLockData } from "@1sat/actions";
function registerGetLockDataTool(server, ctx) {
  server.tool("wallet_getLockData", "Get summary of time-locked BSV (total, unlockable, next unlock height)", {}, async () => {
    try {
      if (!ctx)
        throw new Error("BRC-100 wallet context not available");
      const result2 = await getLockData.execute(ctx, {});
      return {
        content: [{ type: "text", text: JSON.stringify(result2, null, 2) }]
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { content: [{ type: "text", text: msg }], isError: true };
    }
  });
}

// tools/wallet/getOrdinals.ts
import { getOrdinals } from "@1sat/actions";
import { z as z25 } from "zod";
function registerGetOrdinalsTool(server, ctx) {
  server.tool("wallet_getOrdinals", "List ordinals/inscriptions in the wallet with metadata", {
    limit: z25.number().int().optional().describe("Max number of results to return"),
    offset: z25.number().int().optional().describe("Number of results to skip")
  }, async (params) => {
    try {
      if (!ctx)
        throw new Error("BRC-100 wallet context not available");
      const result2 = await getOrdinals.execute(ctx, params);
      const outputs = result2.outputs.map((o) => ({
        outpoint: o.outpoint,
        satoshis: o.satoshis,
        tags: o.tags,
        customInstructions: o.customInstructions
      }));
      return {
        content: [{ type: "text", text: JSON.stringify(outputs, null, 2) }]
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { content: [{ type: "text", text: msg }], isError: true };
    }
  });
}

// tools/wallet/listTokens.ts
import { listTokens } from "@1sat/actions";
import { z as z26 } from "zod";
function registerListTokensTool(server, ctx) {
  server.tool("wallet_listTokens", "List BSV21 token outputs in the wallet", {
    limit: z26.number().int().optional().describe("Max number of results to return")
  }, async (params) => {
    try {
      if (!ctx)
        throw new Error("BRC-100 wallet context not available");
      const result2 = await listTokens.execute(ctx, params);
      return {
        content: [{ type: "text", text: JSON.stringify(result2, null, 2) }]
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { content: [{ type: "text", text: msg }], isError: true };
    }
  });
}

// tools/wallet/mintCollection.ts
import { promises as fs3 } from "node:fs";
import path4 from "node:path";
import { Utils as Utils10 } from "@bsv/sdk";
import { createOrdinals as createOrdinals2 } from "js-1sat-ord";
import { z as z27 } from "zod";
var mintCollectionArgsSchema = z27.object({
  folderPath: z27.string().describe("Path to folder containing images to mint as a collection"),
  collectionName: z27.string().describe("Name of the collection"),
  description: z27.string().describe("Description of the collection"),
  rarityLabels: z27.array(z27.object({
    label: z27.string(),
    percentage: z27.number().min(0).max(100)
  })).optional().describe("Rarity labels and their percentages"),
  traits: z27.string().optional().describe(`Collection traits as JSON string of key-value pairs where values are arrays, e.g. '{"Background": ["Blue", "Red"], "Eyes": ["Big", "Small"]}'`),
  skipBroadcast: z27.boolean().optional().describe("Skip broadcasting transactions (for testing)")
});
async function getImageFiles(folderPath) {
  const files = await fs3.readdir(folderPath);
  const imageFiles = [];
  const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"];
  for (const file of files) {
    const filePath = path4.join(folderPath, file);
    const stat = await fs3.stat(filePath);
    if (stat.isFile()) {
      const ext = path4.extname(file).toLowerCase();
      if (imageExtensions.includes(ext)) {
        const data = await fs3.readFile(filePath);
        const contentType = {
          ".jpg": "image/jpeg",
          ".jpeg": "image/jpeg",
          ".png": "image/png",
          ".gif": "image/gif",
          ".webp": "image/webp",
          ".svg": "image/svg+xml"
        }[ext] || "application/octet-stream";
        imageFiles.push({
          path: filePath,
          name: path4.basename(file, ext),
          data,
          contentType
        });
      }
    }
  }
  return imageFiles.sort((a, b) => a.name.localeCompare(b.name));
}
function generateItemTraits(itemIndex, collectionTraits) {
  const traits = [];
  if (collectionTraits) {
    for (const [traitName, possibleValues] of Object.entries(collectionTraits)) {
      if (possibleValues.length > 0) {
        const valueIndex = itemIndex % possibleValues.length;
        traits.push({
          name: traitName,
          value: possibleValues[valueIndex]
        });
      }
    }
  }
  return traits;
}
function registerMintCollectionTool(server, wallet) {
  server.tool("wallet_mintCollection", "Mint a collection of ordinals from a folder of images with proper metadata. This tool creates a collection inscription first, then mints each image as a collection item with the appropriate metadata linking it to the collection.", { ...mintCollectionArgsSchema.shape }, async ({ folderPath, collectionName, description, rarityLabels, traits: traitsJson, skipBroadcast }) => {
    try {
      const traits = traitsJson ? JSON.parse(traitsJson) : undefined;
      const paymentPk = wallet.getPaymentKey();
      if (!paymentPk) {
        throw new Error("No payment key available in wallet");
      }
      const identityPk = wallet.getIdentityKey();
      const imageFiles = await getImageFiles(folderPath);
      if (imageFiles.length === 0) {
        throw new Error("No image files found in the specified folder");
      }
      console.error(`Found ${imageFiles.length} images to mint`);
      const collectionSubTypeData = {
        description,
        quantity: imageFiles.length,
        rarityLabels: rarityLabels?.map((r) => ({ label: r.label })) || [],
        traits: traits ? Object.entries(traits).reduce((acc, [key, values]) => {
          acc[key] = {
            values,
            occurancePercentages: values.map(() => String(100 / values.length))
          };
          return acc;
        }, {}) : {}
      };
      const collectionMetadata = {
        app: "ord",
        type: "ord",
        subType: "collection",
        name: collectionName,
        subTypeData: collectionSubTypeData
      };
      const svgString = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
            <rect width="100" height="100" fill="#f0f0f0"/>
            <text x="50" y="55" text-anchor="middle" font-family="Arial" font-size="16">${collectionName}</text>
          </svg>`;
      const collectionIconData = Utils10.toBase64(Utils10.toArray(svgString, "utf8"));
      const walletAddress = paymentPk.toAddress().toString();
      const { paymentUtxos: collectionUtxos } = await wallet.getUtxos();
      if (!collectionUtxos || collectionUtxos.length === 0) {
        throw new Error("No payment UTXOs available");
      }
      const collectionConfig = {
        utxos: collectionUtxos,
        destinations: [
          {
            address: walletAddress,
            inscription: {
              dataB64: collectionIconData,
              contentType: "image/svg+xml"
            }
          }
        ],
        paymentPk,
        changeAddress: walletAddress,
        metaData: collectionMetadata
      };
      if (identityPk) {
        collectionConfig.signer = { idKey: identityPk };
      }
      console.error("Creating collection inscription...");
      const collectionResult = await createOrdinals2(collectionConfig);
      let collectionTxid = "";
      const disableBroadcasting = skipBroadcast || process.env.DISABLE_BROADCASTING === "true";
      if (!disableBroadcasting) {
        const broadcaster = new V5Broadcaster;
        await collectionResult.tx.broadcast(broadcaster);
        collectionTxid = collectionResult.tx.id("hex");
        console.error(`✅ Collection created: ${collectionTxid}`);
        await wallet.refreshUtxos();
      } else {
        collectionTxid = collectionResult.tx.id("hex");
        console.error(`\uD83D\uDD38 Collection created (not broadcast): ${collectionTxid}`);
      }
      const results = {
        collectionTxid,
        itemTxids: [],
        errors: [],
        totalCost: collectionResult.tx.getFee()
      };
      for (let i = 0;i < imageFiles.length; i++) {
        const imageFile = imageFiles[i];
        if (!imageFile)
          continue;
        console.error(`Minting item ${i + 1}/${imageFiles.length}: ${imageFile.name}`);
        try {
          const itemTraits = generateItemTraits(i, traits);
          const itemSubTypeData = {
            collectionId: collectionTxid,
            mintNumber: i + 1,
            traits: itemTraits
          };
          if (rarityLabels && rarityLabels.length > 0) {
            const rarityIndex = Math.floor(i / imageFiles.length * rarityLabels.length);
            const rarityItem = rarityLabels[Math.min(rarityIndex, rarityLabels.length - 1)];
            if (rarityItem) {
              itemSubTypeData.rarityLabel = [
                { [rarityItem.label]: `${rarityItem.percentage}%` }
              ];
            }
          }
          const itemMetadata = {
            app: "ord",
            type: "ord",
            subType: "collectionItem",
            name: imageFile.name,
            subTypeData: itemSubTypeData
          };
          const { paymentUtxos: itemUtxos } = await wallet.getUtxos();
          if (!itemUtxos || itemUtxos.length === 0) {
            throw new Error("No payment UTXOs available for item");
          }
          const itemConfig = {
            utxos: itemUtxos,
            destinations: [
              {
                address: walletAddress,
                inscription: {
                  dataB64: Utils10.toBase64(Array.from(imageFile.data)),
                  contentType: imageFile.contentType
                }
              }
            ],
            paymentPk,
            changeAddress: walletAddress,
            metaData: itemMetadata
          };
          if (identityPk) {
            itemConfig.signer = { idKey: identityPk };
          }
          const itemResult = await createOrdinals2(itemConfig);
          if (!disableBroadcasting) {
            const broadcaster = new V5Broadcaster;
            await itemResult.tx.broadcast(broadcaster);
            const itemTxid = itemResult.tx.id("hex");
            results.itemTxids.push(itemTxid);
            console.error(`  ✅ Item minted: ${itemTxid}`);
            await wallet.refreshUtxos();
          } else {
            const itemTxid = itemResult.tx.id("hex");
            results.itemTxids.push(itemTxid);
            console.error(`  \uD83D\uDD38 Item minted (not broadcast): ${itemTxid}`);
          }
          results.totalCost += itemResult.tx.getFee();
        } catch (error2) {
          const errorMessage = error2 instanceof Error ? error2.message : String(error2);
          results.errors.push({ file: imageFile.name, error: errorMessage });
          console.error(`  ❌ Failed to mint ${imageFile.name}: ${errorMessage}`);
        }
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              collectionTxid: results.collectionTxid,
              itemsMinted: results.itemTxids.length,
              totalItems: imageFiles.length,
              errors: results.errors,
              totalCost: results.totalCost,
              summary: `Collection "${collectionName}" created with ${results.itemTxids.length}/${imageFiles.length} items successfully minted.${results.errors.length > 0 ? ` ${results.errors.length} items failed.` : ""}`
            }, null, 2)
          }
        ]
      };
    } catch (error2) {
      const errorMessage = error2 instanceof Error ? error2.message : String(error2);
      return {
        content: [
          {
            type: "text",
            text: `Error minting collection: ${errorMessage}`
          }
        ],
        isError: true
      };
    }
  });
}

// tools/wallet/purchaseListing.ts
import { purchaseBsv21, purchaseOrdinal } from "@1sat/actions";

// tools/wallet/schemas.ts
import { z as z28 } from "zod";
var emptyArgsSchema = z28.object({});
var getPublicKeyArgsSchema = z28.object({});
var walletEncryptionArgsSchema = z28.object({
  mode: z28.enum(["encrypt", "decrypt"]).describe("Operation mode: 'encrypt' to encrypt plaintext or 'decrypt' to decrypt data"),
  data: z28.union([
    z28.string().describe("Text data to encrypt or decrypt"),
    z28.array(z28.number()).describe("Binary data to encrypt or decrypt")
  ]).describe("Data to process: text/data for encryption or decryption"),
  encoding: z28.enum(["utf8", "hex", "base64"]).optional().default("utf8").describe("Encoding of text data (default: utf8)"),
  recipientPublicKeyHex: z28.string().length(66).regex(/^(02|03)[0-9a-fA-F]{64}$/).optional().describe("Recipient's public key in hex format (required for encryption mode)")
}).describe("Schema for encryption and decryption operations").superRefine((val, ctx) => {
  if (val.mode === "encrypt" && !val.recipientPublicKeyHex) {
    ctx.addIssue({
      code: z28.ZodIssueCode.custom,
      message: "recipientPublicKeyHex is required when mode is 'encrypt'",
      path: ["recipientPublicKeyHex"]
    });
  }
});
var getAddressArgsSchema = z28.object({});
var sendToAddressArgsSchema = z28.object({
  address: z28.string(),
  amount: z28.number(),
  currency: z28.enum(["BSV", "USD"]).optional().default("BSV"),
  description: z28.string().optional()
});
var purchaseListingArgsSchema = z28.object({
  listingOutpoint: z28.string().describe("The outpoint of the listing to purchase (txid_vout format)"),
  listingType: z28.enum(["nft", "token"]).default("nft").describe("Type of listing: 'nft' for ordinal NFTs, 'token' for BSV21 tokens"),
  tokenID: z28.string().optional().describe("Token ID (txid_vout of deploy transaction) — required when listingType is 'token'"),
  tokenAmount: z28.string().optional().describe("Amount of tokens in the listing (as string) — required when listingType is 'token'"),
  description: z28.string().optional().describe("Optional description for the transaction")
}).describe("Schema for the wallet_purchaseListing tool arguments (purchase NFTs or BSV21 tokens).");

// tools/wallet/purchaseListing.ts
function registerPurchaseListingTool(server, ctx) {
  server.tool("wallet_purchaseListing", "Purchases a listing from the Bitcoin SV ordinals marketplace. Supports both NFT purchases and BSV21 token purchases.", { ...purchaseListingArgsSchema.shape }, async ({ listingOutpoint, listingType, tokenID, tokenAmount, description }) => {
    if (!ctx) {
      return {
        content: [
          {
            type: "text",
            text: "Wallet not initialized. Please configure a wallet before purchasing."
          }
        ],
        isError: true
      };
    }
    try {
      let marketplaceRate = MARKET_FEE_PERCENTAGE;
      if (listingType === "token") {
        if (!tokenID) {
          throw new Error("tokenID is required for token listings");
        }
        if (!tokenAmount) {
          const response = await fetch(`https://ordinals.gorillapool.io/api/txos/${listingOutpoint}?script=true`);
          if (!response.ok) {
            throw new Error(`Failed to fetch listing data: ${response.statusText}`);
          }
          const listingData = await response.json();
          if (!listingData.data?.bsv20?.amt) {
            throw new Error("Token listing does not have an amount");
          }
          tokenAmount = listingData.data.bsv20.amt;
          if (listingData.data?.list?.price) {
            const fee = Math.round(listingData.data.list.price * MARKET_FEE_PERCENTAGE);
            marketplaceRate = Math.max(fee, MINIMUM_MARKET_FEE_SATOSHIS) / listingData.data.list.price;
          }
        }
        const result3 = await purchaseBsv21.execute(ctx, {
          tokenId: tokenID,
          outpoint: listingOutpoint,
          amount: tokenAmount,
          marketplaceAddress: MARKET_WALLET_ADDRESS,
          marketplaceRate
        });
        if (result3.error) {
          return {
            content: [{ type: "text", text: result3.error }],
            isError: true
          };
        }
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                status: "success",
                txid: result3.txid,
                listingOutpoint,
                listingType,
                tokenID
              })
            }
          ]
        };
      }
      const result2 = await purchaseOrdinal.execute(ctx, {
        outpoint: listingOutpoint,
        marketplaceAddress: MARKET_WALLET_ADDRESS,
        marketplaceRate
      });
      if (result2.error) {
        return {
          content: [{ type: "text", text: result2.error }],
          isError: true
        };
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              status: "success",
              txid: result2.txid,
              listingOutpoint,
              listingType
            })
          }
        ]
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { content: [{ type: "text", text: msg }], isError: true };
    }
  });
}

// tools/wallet/refreshUtxos.ts
import { syncAddresses } from "@1sat/actions";
var MCP_ADDRESS_PREFIX2 = "mcp";
function registerRefreshUtxosTool(server, ctx) {
  server.tool("wallet_refreshUtxos", "Syncs external payments sent to BRC-29 deposit addresses into the wallet. Triggers lazy indexing on the server, classifies outputs (funding, ordinals, tokens), and internalizes them.", {}, async () => {
    try {
      if (!ctx) {
        throw new Error("BRC-100 wallet context not available");
      }
      const result2 = await syncAddresses.execute(ctx, {
        prefix: MCP_ADDRESS_PREFIX2,
        count: 1
      });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              status: "success",
              processed: result2.processed,
              failed: result2.failed,
              lastScore: result2.lastScore,
              addresses: result2.addresses
            }, null, 2)
          }
        ]
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { content: [{ type: "text", text: msg }], isError: true };
    }
  });
}

// tools/wallet/sendToAddress.ts
import { sendBsv } from "@1sat/actions";
import { toSatoshi } from "satoshi-token";
function registerSendToAddressTool(server, ctx) {
  server.tool("wallet_sendToAddress", "Sends Bitcoin SV (BSV) to a specified address. This tool supports payments in both BSV and USD amounts (with automatic conversion using current exchange rates). Transaction fees are automatically calculated and a confirmation with transaction ID is returned upon success.", { ...sendToAddressArgsSchema.shape }, async ({ address, amount, currency = "BSV", description = "Send to address" }) => {
    if (!ctx) {
      return {
        content: [
          {
            type: "text",
            text: "Wallet not initialized. Please configure a wallet before sending."
          }
        ],
        isError: true
      };
    }
    try {
      let satoshis;
      if (currency === "USD") {
        const bsvPriceUsd = await getBsvPriceWithCache2();
        satoshis = toSatoshi(amount / bsvPriceUsd);
      } else {
        satoshis = toSatoshi(amount);
      }
      const result2 = await sendBsv.execute(ctx, {
        requests: [{ address, satoshis }]
      });
      if (result2.error) {
        return {
          content: [{ type: "text", text: result2.error }],
          isError: true
        };
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              status: "success",
              txid: result2.txid,
              satoshis
            })
          }
        ]
      };
    } catch (error2) {
      return {
        content: [
          {
            type: "text",
            text: error2 instanceof Error ? error2.message : String(error2)
          }
        ],
        isError: true
      };
    }
  });
}

// tools/wallet/signBsm.ts
import { signBsm } from "@1sat/actions";
import { z as z29 } from "zod";
function registerSignBsmTool(server, ctx) {
  server.tool("wallet_signBsm", "Sign a message using BSM (Bitcoin Signed Message) format", {
    message: z29.string().describe("The message to sign"),
    encoding: z29.enum(["utf8", "hex", "base64"]).optional().describe("Message encoding format")
  }, async (params) => {
    try {
      if (!ctx)
        throw new Error("BRC-100 wallet context not available");
      const result2 = await signBsm.execute(ctx, params);
      return {
        content: [{ type: "text", text: JSON.stringify(result2, null, 2) }]
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { content: [{ type: "text", text: msg }], isError: true };
    }
  });
}

// tools/wallet/transferOrdToken.ts
import { sendBsv21, transferOrdinals } from "@1sat/actions";
import { z as z30 } from "zod";
var walletOutputSchema = z30.object({
  outpoint: z30.string(),
  satoshis: z30.number().optional(),
  tags: z30.array(z30.string()).optional(),
  customInstructions: z30.string().optional(),
  lockingScript: z30.string().optional()
});
var transferOrdTokenArgsSchema = z30.object({
  type: z30.enum(["ordinal", "bsv21"]).describe("'ordinal' to transfer an inscription/NFT, 'bsv21' to send fungible BSV21 tokens"),
  ordinal: walletOutputSchema.optional().describe("WalletOutput of the ordinal to transfer (from wallet_getOrdinals). Required when type='ordinal'"),
  inputBEEF: z30.array(z30.number()).optional().describe("BEEF bytes from listOutputs (include: 'entire transactions'). Required when type='ordinal'"),
  tokenId: z30.string().optional().describe("Token ID (txid_vout format). Required when type='bsv21'"),
  amount: z30.string().optional().describe("Amount of tokens to send as a string integer. Required when type='bsv21'"),
  address: z30.string().optional().describe("Recipient P2PKH address"),
  counterparty: z30.string().optional().describe("Recipient identity public key (hex)")
});
function registerTransferOrdTokenTool(server, ctx) {
  server.tool("wallet_transferOrdToken", "Transfer an ordinal inscription or send BSV21 fungible tokens. Use type='ordinal' to transfer an NFT/inscription (requires the WalletOutput from wallet_getOrdinals and the BEEF). Use type='bsv21' to send fungible tokens by token ID and amount.", { ...transferOrdTokenArgsSchema.shape }, async ({ type, ordinal, inputBEEF, tokenId, amount, address, counterparty }) => {
    if (!ctx) {
      return {
        content: [
          {
            type: "text",
            text: "Wallet not initialized. Please configure a wallet before transferring."
          }
        ],
        isError: true
      };
    }
    try {
      if (type === "ordinal") {
        if (!ordinal) {
          return {
            content: [{ type: "text", text: "ordinal is required when type='ordinal'" }],
            isError: true
          };
        }
        if (!inputBEEF) {
          return {
            content: [{ type: "text", text: "inputBEEF is required when type='ordinal'" }],
            isError: true
          };
        }
        if (!address && !counterparty) {
          return {
            content: [{ type: "text", text: "address or counterparty is required" }],
            isError: true
          };
        }
        const result3 = await transferOrdinals.execute(ctx, {
          transfers: [
            {
              ordinal,
              address,
              counterparty
            }
          ],
          inputBEEF
        });
        if (result3.error) {
          return {
            content: [{ type: "text", text: result3.error }],
            isError: true
          };
        }
        return {
          content: [{ type: "text", text: JSON.stringify({ txid: result3.txid }) }]
        };
      }
      if (!tokenId) {
        return {
          content: [{ type: "text", text: "tokenId is required when type='bsv21'" }],
          isError: true
        };
      }
      if (!amount) {
        return {
          content: [{ type: "text", text: "amount is required when type='bsv21'" }],
          isError: true
        };
      }
      if (!address && !counterparty) {
        return {
          content: [{ type: "text", text: "address or counterparty is required" }],
          isError: true
        };
      }
      const result2 = await sendBsv21.execute(ctx, {
        tokenId,
        amount,
        address,
        counterparty
      });
      if (result2.error) {
        return {
          content: [{ type: "text", text: result2.error }],
          isError: true
        };
      }
      return {
        content: [{ type: "text", text: JSON.stringify({ txid: result2.txid }) }]
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: err instanceof Error ? err.message : String(err)
          }
        ],
        isError: true
      };
    }
  });
}

// tools/wallet/listOrdinal.ts
import { listOrdinal } from "@1sat/actions";
import { z as z31 } from "zod";
var walletOutputSchema2 = z31.object({
  outpoint: z31.string(),
  satoshis: z31.number().optional(),
  tags: z31.array(z31.string()).optional(),
  customInstructions: z31.string().optional(),
  lockingScript: z31.string().optional()
});
var listOrdinalArgsSchema = z31.object({
  ordinal: walletOutputSchema2.describe("WalletOutput of the ordinal to list (from wallet_getOrdinals)"),
  inputBEEF: z31.array(z31.number()).describe("BEEF bytes from listOutputs (include: 'entire transactions')"),
  price: z31.number().describe("Price in satoshis"),
  payAddress: z31.string().describe("Address to receive payment on purchase")
});
function registerListOrdinalTool(server, ctx) {
  server.tool("wallet_listOrdinal", "List an ordinal for sale on the marketplace", { ...listOrdinalArgsSchema.shape }, async ({ ordinal, inputBEEF, price, payAddress }) => {
    if (!ctx) {
      return {
        content: [
          {
            type: "text",
            text: "Wallet not initialized. Please configure a wallet before listing."
          }
        ],
        isError: true
      };
    }
    try {
      const result2 = await listOrdinal.execute(ctx, {
        ordinal,
        inputBEEF,
        price,
        payAddress
      });
      if (result2.error) {
        return {
          content: [{ type: "text", text: result2.error }],
          isError: true
        };
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result2, (_, v) => typeof v === "bigint" ? v.toString() : v, 2)
          }
        ]
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: err instanceof Error ? err.message : String(err)
          }
        ],
        isError: true
      };
    }
  });
}

// tools/wallet/cancelListing.ts
import { cancelListing } from "@1sat/actions";
import { z as z32 } from "zod";
var walletOutputSchema3 = z32.object({
  outpoint: z32.string(),
  satoshis: z32.number().optional(),
  tags: z32.array(z32.string()).optional(),
  customInstructions: z32.string().optional(),
  lockingScript: z32.string().optional()
});
var cancelListingArgsSchema = z32.object({
  listing: walletOutputSchema3.describe("WalletOutput of the listing to cancel (must include lockingScript)"),
  inputBEEF: z32.array(z32.number()).describe("BEEF bytes from listOutputs (include: 'entire transactions')")
});
function registerCancelListingTool(server, ctx) {
  server.tool("wallet_cancelListing", "Cancel an ordinal marketplace listing", { ...cancelListingArgsSchema.shape }, async ({ listing, inputBEEF }) => {
    if (!ctx) {
      return {
        content: [
          {
            type: "text",
            text: "Wallet not initialized. Please configure a wallet before cancelling."
          }
        ],
        isError: true
      };
    }
    try {
      const result2 = await cancelListing.execute(ctx, {
        listing,
        inputBEEF
      });
      if (result2.error) {
        return {
          content: [{ type: "text", text: result2.error }],
          isError: true
        };
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result2, (_, v) => typeof v === "bigint" ? v.toString() : v, 2)
          }
        ]
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: err instanceof Error ? err.message : String(err)
          }
        ],
        isError: true
      };
    }
  });
}

// tools/wallet/sendAllBsv.ts
import { sendAllBsv } from "@1sat/actions";
import { z as z33 } from "zod";
var sendAllBsvArgsSchema = z33.object({
  destination: z33.string().describe("Destination P2PKH address to send all funds to")
});
function registerSendAllBsvTool(server, ctx) {
  server.tool("wallet_sendAllBsv", "Send all BSV in the wallet to a single recipient", { ...sendAllBsvArgsSchema.shape }, async ({ destination }) => {
    if (!ctx) {
      return {
        content: [
          {
            type: "text",
            text: "Wallet not initialized. Please configure a wallet before sending."
          }
        ],
        isError: true
      };
    }
    try {
      const result2 = await sendAllBsv.execute(ctx, { destination });
      if (result2.error) {
        return {
          content: [{ type: "text", text: result2.error }],
          isError: true
        };
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result2, (_, v) => typeof v === "bigint" ? v.toString() : v, 2)
          }
        ]
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: err instanceof Error ? err.message : String(err)
          }
        ],
        isError: true
      };
    }
  });
}

// tools/wallet/lockBsv.ts
import { lockBsv } from "@1sat/actions";
import { z as z34 } from "zod";
var lockBsvArgsSchema = z34.object({
  requests: z34.array(z34.object({
    satoshis: z34.number().describe("Amount in satoshis to lock"),
    until: z34.number().describe("Block height until which to lock")
  })).describe("Array of lock requests")
});
function registerLockBsvTool(server, ctx) {
  server.tool("wallet_lockBsv", "Lock BSV until a specific block height", { ...lockBsvArgsSchema.shape }, async ({ requests }) => {
    if (!ctx) {
      return {
        content: [
          {
            type: "text",
            text: "Wallet not initialized. Please configure a wallet before locking."
          }
        ],
        isError: true
      };
    }
    try {
      const result2 = await lockBsv.execute(ctx, { requests });
      if (result2.error) {
        return {
          content: [{ type: "text", text: result2.error }],
          isError: true
        };
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result2, (_, v) => typeof v === "bigint" ? v.toString() : v, 2)
          }
        ]
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: err instanceof Error ? err.message : String(err)
          }
        ],
        isError: true
      };
    }
  });
}

// tools/wallet/unlockBsv.ts
import { unlockBsv } from "@1sat/actions";
function registerUnlockBsvTool(server, ctx) {
  server.tool("wallet_unlockBsv", "Unlock all matured time-locked BSV", {}, async () => {
    if (!ctx) {
      return {
        content: [
          {
            type: "text",
            text: "Wallet not initialized. Please configure a wallet before unlocking."
          }
        ],
        isError: true
      };
    }
    try {
      const result2 = await unlockBsv.execute(ctx, {});
      if (result2.error) {
        return {
          content: [{ type: "text", text: result2.error }],
          isError: true
        };
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result2, (_, v) => typeof v === "bigint" ? v.toString() : v, 2)
          }
        ]
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: err instanceof Error ? err.message : String(err)
          }
        ],
        isError: true
      };
    }
  });
}

// tools/wallet/opnsRegister.ts
import { opnsRegister } from "@1sat/actions";
import { z as z35 } from "zod";
var walletOutputSchema4 = z35.object({
  outpoint: z35.string(),
  satoshis: z35.number().optional(),
  tags: z35.array(z35.string()).optional(),
  customInstructions: z35.string().optional(),
  lockingScript: z35.string().optional()
});
var opnsRegisterArgsSchema = z35.object({
  ordinal: walletOutputSchema4.describe("WalletOutput of the OpNS ordinal to register (from listOutputs)"),
  inputBEEF: z35.array(z35.number()).describe("BEEF bytes from listOutputs (include: 'entire transactions')")
});
function registerOpnsRegisterTool(server, ctx) {
  server.tool("wallet_opnsRegister", "Register an OpNS name", { ...opnsRegisterArgsSchema.shape }, async ({ ordinal, inputBEEF }) => {
    if (!ctx) {
      return {
        content: [
          {
            type: "text",
            text: "Wallet not initialized. Please configure a wallet before registering."
          }
        ],
        isError: true
      };
    }
    try {
      const result2 = await opnsRegister.execute(ctx, {
        ordinal,
        inputBEEF
      });
      if (result2.error) {
        return {
          content: [{ type: "text", text: result2.error }],
          isError: true
        };
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result2, (_, v) => typeof v === "bigint" ? v.toString() : v, 2)
          }
        ]
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: err instanceof Error ? err.message : String(err)
          }
        ],
        isError: true
      };
    }
  });
}

// tools/wallet/opnsDeregister.ts
import { opnsDeregister } from "@1sat/actions";
import { z as z36 } from "zod";
var walletOutputSchema5 = z36.object({
  outpoint: z36.string(),
  satoshis: z36.number().optional(),
  tags: z36.array(z36.string()).optional(),
  customInstructions: z36.string().optional(),
  lockingScript: z36.string().optional()
});
var opnsDeregisterArgsSchema = z36.object({
  ordinal: walletOutputSchema5.describe("WalletOutput of the OpNS ordinal to deregister (from listOutputs)"),
  inputBEEF: z36.array(z36.number()).describe("BEEF bytes from listOutputs (include: 'entire transactions')")
});
function registerOpnsDeregisterTool(server, ctx) {
  server.tool("wallet_opnsDeregister", "Deregister an OpNS name", { ...opnsDeregisterArgsSchema.shape }, async ({ ordinal, inputBEEF }) => {
    if (!ctx) {
      return {
        content: [
          {
            type: "text",
            text: "Wallet not initialized. Please configure a wallet before deregistering."
          }
        ],
        isError: true
      };
    }
    try {
      const result2 = await opnsDeregister.execute(ctx, {
        ordinal,
        inputBEEF
      });
      if (result2.error) {
        return {
          content: [{ type: "text", text: result2.error }],
          isError: true
        };
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result2, (_, v) => typeof v === "bigint" ? v.toString() : v, 2)
          }
        ]
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: err instanceof Error ? err.message : String(err)
          }
        ],
        isError: true
      };
    }
  });
}

// tools/wallet/sweepBsv.ts
import { sweepBsv } from "@1sat/actions";
import { z as z37 } from "zod";
var sweepInputSchema = z37.object({
  outpoint: z37.string().describe("Outpoint (txid_vout)"),
  satoshis: z37.number().int().describe("Satoshis in output"),
  lockingScript: z37.string().describe("Locking script hex")
});
var sweepBsvSchema = z37.object({
  inputs: z37.array(sweepInputSchema).describe("UTXOs to sweep (use prepareSweepInputs to build these)"),
  wif: z37.string().describe("WIF private key controlling the inputs"),
  amount: z37.number().int().optional().describe("Amount to sweep (satoshis). If omitted, sweeps all input value.")
});
function registerSweepBsvTool(server, ctx) {
  server.tool("wallet_sweepBsv", "Sweep BSV from an external WIF private key into the wallet", { ...sweepBsvSchema.shape }, async ({ inputs, wif, amount }) => {
    if (!ctx) {
      return {
        content: [
          {
            type: "text",
            text: "BRC-100 wallet context not available"
          }
        ],
        isError: true
      };
    }
    try {
      const result2 = await sweepBsv.execute(ctx, { inputs, wif, amount });
      if (result2.error) {
        return {
          content: [{ type: "text", text: result2.error }],
          isError: true
        };
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result2, (_, v) => typeof v === "bigint" ? v.toString() : v, 2)
          }
        ]
      };
    } catch (error2) {
      return {
        content: [
          {
            type: "text",
            text: error2 instanceof Error ? error2.message : String(error2)
          }
        ],
        isError: true
      };
    }
  });
}

// tools/wallet/sweepOrdinals.ts
import { sweepOrdinals } from "@1sat/actions";
import { z as z38 } from "zod";
var sweepInputSchema2 = z38.object({
  outpoint: z38.string().describe("Outpoint (txid_vout)"),
  satoshis: z38.number().int().describe("Satoshis (should be 1)"),
  lockingScript: z38.string().describe("Locking script hex")
});
var sweepOrdinalsSchema = z38.object({
  inputs: z38.array(sweepInputSchema2).describe("Ordinal UTXOs to sweep"),
  wif: z38.string().describe("WIF private key controlling the inputs")
});
function registerSweepOrdinalsTool(server, ctx) {
  server.tool("wallet_sweepOrdinals", "Sweep ordinals from an external WIF private key into the wallet", { ...sweepOrdinalsSchema.shape }, async ({ inputs, wif }) => {
    if (!ctx) {
      return {
        content: [
          {
            type: "text",
            text: "BRC-100 wallet context not available"
          }
        ],
        isError: true
      };
    }
    try {
      const result2 = await sweepOrdinals.execute(ctx, { inputs, wif });
      if (result2.error) {
        return {
          content: [{ type: "text", text: result2.error }],
          isError: true
        };
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result2, (_, v) => typeof v === "bigint" ? v.toString() : v, 2)
          }
        ]
      };
    } catch (error2) {
      return {
        content: [
          {
            type: "text",
            text: error2 instanceof Error ? error2.message : String(error2)
          }
        ],
        isError: true
      };
    }
  });
}

// tools/wallet/sweepBsv21.ts
import { sweepBsv21 } from "@1sat/actions";
import { z as z39 } from "zod";
var sweepBsv21InputSchema = z39.object({
  outpoint: z39.string().describe("Outpoint (txid_vout)"),
  satoshis: z39.number().int().describe("Satoshis (should be 1)"),
  lockingScript: z39.string().describe("Locking script hex"),
  tokenId: z39.string().describe("Token ID (txid_vout format)"),
  amount: z39.string().describe("Token amount as string")
});
var sweepBsv21Schema = z39.object({
  inputs: z39.array(sweepBsv21InputSchema).describe("Token UTXOs to sweep (must all be same tokenId)"),
  wif: z39.string().describe("WIF private key controlling the inputs")
});
function registerSweepBsv21Tool(server, ctx) {
  server.tool("wallet_sweepBsv21", "Sweep BSV21 tokens from an external WIF private key into the wallet", { ...sweepBsv21Schema.shape }, async ({ inputs, wif }) => {
    if (!ctx) {
      return {
        content: [
          {
            type: "text",
            text: "BRC-100 wallet context not available"
          }
        ],
        isError: true
      };
    }
    try {
      const result2 = await sweepBsv21.execute(ctx, { inputs, wif });
      if (result2.error) {
        return {
          content: [{ type: "text", text: result2.error }],
          isError: true
        };
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result2, (_, v) => typeof v === "bigint" ? v.toString() : v, 2)
          }
        ]
      };
    } catch (error2) {
      return {
        content: [
          {
            type: "text",
            text: error2 instanceof Error ? error2.message : String(error2)
          }
        ],
        isError: true
      };
    }
  });
}

// tools/wallet/tools.ts
function registerWalletTools(server, wallet, config) {
  registerSendToAddressTool(server, config.ctx);
  registerGetAddressTool(server, config.ctx);
  registerPurchaseListingTool(server, config.ctx);
  registerTransferOrdTokenTool(server, config.ctx);
  registerRefreshUtxosTool(server, config.ctx);
  registerWalletGetBalanceTool(server, config.ctx);
  registerBrc100Tools(server, config.ctx);
  if (config.enableA2bTools) {
    registerA2bPublishMcpTool(server, wallet, config.identityPk, {
      disableBroadcasting: config.disableBroadcasting
    });
  }
  registerCreateOrdinalsTool(server, config.ctx);
  registerGatherCollectionInfoTool(server, wallet);
  registerMintCollectionTool(server, wallet);
  registerGetOrdinalsTool(server, config.ctx);
  registerListTokensTool(server, config.ctx);
  registerGetBsv21BalancesTool(server, config.ctx);
  registerGetLockDataTool(server, config.ctx);
  registerSignBsmTool(server, config.ctx);
  registerListOrdinalTool(server, config.ctx);
  registerCancelListingTool(server, config.ctx);
  registerSendAllBsvTool(server, config.ctx);
  registerLockBsvTool(server, config.ctx);
  registerUnlockBsvTool(server, config.ctx);
  registerOpnsRegisterTool(server, config.ctx);
  registerOpnsDeregisterTool(server, config.ctx);
  registerSweepBsvTool(server, config.ctx);
  registerSweepOrdinalsTool(server, config.ctx);
  registerSweepBsv21Tool(server, config.ctx);
}

// tools/index.ts
function registerAllTools(server, config = {}) {
  const enableBsvTools = process.env.DISABLE_BSV_TOOLS !== "true" && config.enableBsvTools !== false;
  const enableOrdinalsTools = process.env.DISABLE_ORDINALS_TOOLS !== "true" && config.enableOrdinalsTools !== false;
  const enableUtilsTools = process.env.DISABLE_UTILS_TOOLS !== "true" && config.enableUtilsTools !== false;
  const enableA2bTools = process.env.ENABLE_A2B_TOOLS === "true" && config.enableA2bTools !== false;
  const enableBapTools = process.env.DISABLE_BAP_TOOLS !== "true" && config.enableBapTools !== false;
  const enableWalletTools = process.env.DISABLE_WALLET_TOOLS !== "true" && config.enableWalletTools !== false;
  const enableMneeTools = process.env.DISABLE_MNEE_TOOLS !== "true" && config.enableMneeTools !== false;
  const enableBsocialTools = process.env.DISABLE_BSOCIAL_TOOLS !== "true" && config.enableBsocialTools !== false;
  if (enableBsvTools) {
    registerBsvTools(server);
  }
  if (enableOrdinalsTools) {
    registerOrdinalsTools(server, config.ctx);
  }
  if (enableUtilsTools) {
    registerUtilsTools(server);
  }
  if (enableA2bTools) {
    registerA2bDiscoverTool(server);
  }
  if (enableBapTools) {
    const bapConfig = {
      disableBroadcasting: config.disableBroadcasting,
      identityPk: config.identityPk,
      masterXprv: config.xprv,
      wallet: config.wallet
    };
    registerBapTools(server, bapConfig);
  }
  if (enableBsocialTools && config.wallet) {
    registerBsocialTools(server, { wallet: config.wallet });
  }
  if (enableWalletTools) {
    if (config.integratedWallet?.isDropletMode) {
      const dropletClient = config.integratedWallet.getDropletClient();
      if (dropletClient) {
        registerWalletGetBalanceDropletTool(server, dropletClient);
        if (config.integratedWallet) {
          registerSetupDropletTool(server, config.integratedWallet);
        }
        console.error("Registered Droplet mode wallet tools");
      }
    } else if (config.wallet) {
      const walletToolOptions = {
        disableBroadcasting: config.disableBroadcasting === true,
        enableA2bTools,
        identityPk: config.identityPk,
        ctx: config.ctx
      };
      registerWalletTools(server, config.wallet, walletToolOptions);
    }
  }
  if (enableMneeTools) {
    registerMneeTools(server);
  }
}

// tools/wallet/integratedWallet.ts
import { P2PKH as P2PKH6, Script as Script5 } from "@bsv/sdk";

// utils/droplet.ts
import { BSM as BSM2, Utils as Utils11 } from "@bsv/sdk";

class DropletClient {
  config;
  constructor(config) {
    this.config = config;
  }
  getConfig() {
    return this.config;
  }
  async getFaucetStatus() {
    const response = await fetch(`${this.config.apiUrl}/faucet/${this.config.faucetName}/status`);
    if (!response.ok) {
      const error2 = await response.json();
      throw new Error(error2.message || "Failed to get faucet status");
    }
    return response.json();
  }
  async tap(recipientAddress) {
    const response = await fetch(`${this.config.apiUrl}/faucet/${this.config.faucetName}/tap`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.config.authKey ? await this.getAuthHeaders("POST", `/faucet/${this.config.faucetName}/tap`, { recipient_address: recipientAddress }) : {}
      },
      body: JSON.stringify({ recipient_address: recipientAddress })
    });
    if (!response.ok) {
      const error2 = await response.json();
      throw new Error(error2.message || "Failed to tap faucet");
    }
    return response.json();
  }
  async push(data, encoding = "hex") {
    const response = await fetch(`${this.config.apiUrl}/faucet/${this.config.faucetName}/push`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.config.authKey ? await this.getAuthHeaders("POST", `/faucet/${this.config.faucetName}/push`, { data, encoding }) : {}
      },
      body: JSON.stringify({ data, encoding })
    });
    if (!response.ok) {
      const error2 = await response.json();
      throw new Error(error2.message || "Failed to push data");
    }
    return response.json();
  }
  async getAuthHeaders(method, path5, body) {
    if (!this.config.authKey) {
      return {};
    }
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const bodyStr = JSON.stringify(body);
    const message = `${path5}${timestamp}${bodyStr}`;
    const signature = BSM2.sign(Utils11.toArray(message, "utf8"), this.config.authKey);
    const pubkey = this.config.authKey.toPublicKey().toString();
    const authToken = `BSM ${pubkey} ${Utils11.toBase64(signature)} ${timestamp} ${path5}`;
    return {
      "X-Auth-Token": authToken
    };
  }
}

// tools/wallet/wallet.ts
import {
  fromUtxo as fromUtxo3,
  isBroadcastFailure as isBroadcastFailure4,
  isBroadcastResponse as isBroadcastResponse3,
  P2PKH as P2PKH5,
  PrivateKey as PrivateKey7,
  SatoshisPerKilobyte as SatoshisPerKilobyte2,
  Script as Script4,
  Transaction as Transaction7,
  Utils as Utils12
} from "@bsv/sdk";
import { fetchNftUtxos } from "js-1sat-ord";
class Wallet {
  paymentUtxos = [];
  nftUtxos = [];
  lastUtxoFetch = 0;
  utxoRefreshIntervalMs = 5 * 60 * 1000;
  paymentKey;
  identityKey;
  constructor(paymentKey, identityKey) {
    this.paymentKey = paymentKey;
    this.identityKey = identityKey;
    if (this.paymentKey) {
      this.refreshUtxos().catch((err) => console.error("Error initializing UTXOs:", err));
    }
  }
  async refreshUtxos() {
    const currentPaymentKey = this.getPaymentKey();
    if (!currentPaymentKey) {
      console.error("Wallet: refreshUtxos called without a payment key.");
      return;
    }
    const address = currentPaymentKey.toAddress();
    this.lastUtxoFetch = Date.now();
    console.error(`Wallet: Refreshing UTXOs for address ${address}...`);
    try {
      const newPaymentUtxos = await fetchPaymentUtxosFromV5(address);
      if (Array.isArray(newPaymentUtxos)) {
        this.paymentUtxos = newPaymentUtxos;
        console.error(`Wallet: Fetched ${this.paymentUtxos.length} payment UTXOs.`);
      } else {
        console.error("Wallet: fetchPaymentUtxos did not return an array. Keeping existing payment UTXOs.");
      }
    } catch (error2) {
      console.error("Wallet: Error fetching payment UTXOs:", error2);
    }
    try {
      const newNftUtxos = await fetchNftUtxos(address);
      if (Array.isArray(newNftUtxos)) {
        this.nftUtxos = newNftUtxos;
        console.error(`Wallet: Fetched ${this.nftUtxos.length} NFT UTXOs.`);
      } else {
        console.error("Wallet: fetchNftUtxos did not return an array. Keeping existing NFT UTXOs.");
      }
    } catch (error2) {
      console.error("Wallet: Error fetching NFT UTXOs:", error2);
    }
  }
  async getUtxos() {
    const now = Date.now();
    if (!this.paymentKey) {
      return { paymentUtxos: [], nftUtxos: [] };
    }
    if (now - this.lastUtxoFetch > this.utxoRefreshIntervalMs) {
      await this.refreshUtxos();
    }
    return { paymentUtxos: this.paymentUtxos, nftUtxos: this.nftUtxos };
  }
  getIdentityKey() {
    if (this.identityKey) {
      return this.identityKey;
    }
    const wif = process.env.IDENTITY_KEY_WIF;
    if (wif) {
      try {
        this.identityKey = PrivateKey7.fromWif(wif);
        return this.identityKey;
      } catch (e) {
        console.error("Wallet: Invalid Identity Key WIF from environment variable.", e);
      }
    }
    return;
  }
  getPaymentKey() {
    if (!this.paymentKey) {
      const wif = process.env.PRIVATE_KEY_WIF;
      if (wif) {
        try {
          this.paymentKey = PrivateKey7.fromWif(wif);
        } catch (e) {
          console.error("Wallet: Invalid WIF from environment variable.", e);
        }
      }
    }
    return this.paymentKey;
  }
  getAddress() {
    return this.getPaymentKey()?.toAddress();
  }
  async getPublicKey(args) {
    const currentPaymentKey = this.getPaymentKey();
    if (!currentPaymentKey) {
      throw new Error("No payment key available to derive public key.");
    }
    const publicKey = currentPaymentKey.toPublicKey();
    return {
      publicKey: publicKey.toDER("hex")
    };
  }
  async sendToAddress(address, amountSatoshis) {
    const pk = this.getPaymentKey();
    if (!pk)
      throw new Error("Payment key not available to send transaction.");
    const tx = new Transaction7;
    tx.addOutput({
      lockingScript: new P2PKH5().lock(address),
      satoshis: amountSatoshis
    });
    const { paymentUtxos } = await this.getUtxos();
    if (paymentUtxos.length === 0)
      throw new Error("No UTXOs available to send.");
    let totalInputSats = 0n;
    const feeModel = new SatoshisPerKilobyte2(10);
    let estimatedFee = await feeModel.computeFee(tx);
    for (const utxo of paymentUtxos) {
      if (totalInputSats >= BigInt(amountSatoshis) + BigInt(estimatedFee))
        break;
      const unlockingScriptTemplate = new P2PKH5().unlock(pk, "all", false, utxo.satoshis, Script4.fromBinary(Utils12.toArray(utxo.script, "hex")));
      const input = fromUtxo3(utxo, unlockingScriptTemplate);
      tx.addInput(input);
      totalInputSats += BigInt(utxo.satoshis);
      estimatedFee = await feeModel.computeFee(tx);
    }
    if (totalInputSats < BigInt(amountSatoshis) + BigInt(estimatedFee)) {
      throw new Error(`Not enough funds. Required: ${BigInt(amountSatoshis) + BigInt(estimatedFee)}, Available: ${totalInputSats}`);
    }
    const change = totalInputSats - (BigInt(amountSatoshis) + BigInt(estimatedFee));
    if (change > 0) {
      const changeAddress = this.getAddress();
      if (!changeAddress)
        throw new Error("Could not determine change address.");
      tx.addOutput({
        lockingScript: new P2PKH5().lock(changeAddress),
        satoshis: Number(change),
        change: true
      });
    }
    await tx.fee(feeModel);
    await tx.sign();
    const rawTx = tx.toHex();
    const txidFromTxObject = tx.id("hex");
    try {
      const broadcaster = new V5Broadcaster;
      const broadcastResult = await tx.broadcast(broadcaster);
      if (isBroadcastResponse3(broadcastResult)) {
        console.error(`Transaction broadcasted successfully: ${broadcastResult.txid}. Message: ${broadcastResult.message}`);
        return { txid: broadcastResult.txid, rawTx };
      }
      if (isBroadcastFailure4(broadcastResult)) {
        console.error(`Transaction broadcast failed: ${broadcastResult.description} (Code: ${broadcastResult.code}). TXID from object (if available): ${broadcastResult.txid ?? txidFromTxObject}`);
        throw new Error(`Broadcast failed: ${broadcastResult.description} (Code: ${broadcastResult.code})`);
      }
      console.error(`Transaction broadcast status uncertain. TXID from tx object: ${txidFromTxObject}. Unexpected broadcast result: `, broadcastResult);
      return { txid: txidFromTxObject, rawTx };
    } catch (error2) {
      console.error("Failed to broadcast transaction (exception caught):", error2);
      throw new Error(`Failed to broadcast transaction ${txidFromTxObject}: ${error2 instanceof Error ? error2.message : String(error2)}`);
    }
  }
}

// tools/wallet/integratedWallet.ts
class IntegratedWallet {
  config;
  localWallet;
  dropletClient;
  constructor(config) {
    this.config = config;
    if (config.useDropletApi && config.dropletConfig) {
      if (config.paymentKey) {
        config.dropletConfig.authKey = config.paymentKey;
      }
      this.dropletClient = new DropletClient(config.dropletConfig);
      console.error("IntegratedWallet: Using Droplet API mode");
    } else if (config.paymentKey) {
      this.localWallet = new Wallet(config.paymentKey, config.identityKey);
      console.error("IntegratedWallet: Using local wallet mode");
    } else {
      console.error("IntegratedWallet: No wallet configured (limited functionality)");
    }
  }
  get isDropletMode() {
    return !!this.dropletClient;
  }
  get hasWallet() {
    return !!this.localWallet || !!this.dropletClient;
  }
  async getBalance() {
    if (this.dropletClient) {
      const status = await this.dropletClient.getFaucetStatus();
      return status.balance_satoshis;
    }
    if (this.localWallet) {
      return this.localWallet.getTotalBalance();
    }
    throw new Error("No wallet configured");
  }
  async sendToAddress(address, satoshis, description) {
    if (this.dropletClient) {
      const response = await this.dropletClient.tap(address);
      return { txid: response.txid };
    }
    if (this.localWallet) {
      const tx = await this.localWallet.createAction({
        description: description || "Send to address",
        outputs: [
          {
            lockingScript: new P2PKH6().lock(address).toHex(),
            satoshis,
            outputDescription: `Payment to ${address}`
          }
        ]
      });
      return { txid: tx.txid };
    }
    throw new Error("No wallet configured");
  }
  async pushData(data, encoding = "hex") {
    if (this.dropletClient) {
      const response = await this.dropletClient.push(data, encoding);
      return { txid: response.txid };
    }
    if (this.localWallet) {
      const opReturnScript = Script5.fromASM(`OP_FALSE OP_RETURN ${data.join(" ")}`);
      const tx = await this.localWallet.createAction({
        description: "Push data",
        outputs: [
          {
            lockingScript: opReturnScript.toHex(),
            satoshis: 0,
            outputDescription: "OP_RETURN data"
          }
        ]
      });
      return { txid: tx.txid };
    }
    throw new Error("No wallet configured");
  }
  getLocalWallet() {
    return this.localWallet;
  }
  getDropletClient() {
    return this.dropletClient;
  }
}

// tools/wallet/wallet.ts
import {
  fromUtxo as fromUtxo4,
  isBroadcastFailure as isBroadcastFailure5,
  isBroadcastResponse as isBroadcastResponse4,
  P2PKH as P2PKH7,
  PrivateKey as PrivateKey8,
  SatoshisPerKilobyte as SatoshisPerKilobyte3,
  Script as Script6,
  Transaction as Transaction8,
  Utils as Utils13
} from "@bsv/sdk";
import { fetchNftUtxos as fetchNftUtxos2 } from "js-1sat-ord";
class Wallet2 {
  paymentUtxos = [];
  nftUtxos = [];
  lastUtxoFetch = 0;
  utxoRefreshIntervalMs = 5 * 60 * 1000;
  paymentKey;
  identityKey;
  constructor(paymentKey, identityKey) {
    this.paymentKey = paymentKey;
    this.identityKey = identityKey;
    if (this.paymentKey) {
      this.refreshUtxos().catch((err) => console.error("Error initializing UTXOs:", err));
    }
  }
  async refreshUtxos() {
    const currentPaymentKey = this.getPaymentKey();
    if (!currentPaymentKey) {
      console.error("Wallet: refreshUtxos called without a payment key.");
      return;
    }
    const address = currentPaymentKey.toAddress();
    this.lastUtxoFetch = Date.now();
    console.error(`Wallet: Refreshing UTXOs for address ${address}...`);
    try {
      const newPaymentUtxos = await fetchPaymentUtxosFromV5(address);
      if (Array.isArray(newPaymentUtxos)) {
        this.paymentUtxos = newPaymentUtxos;
        console.error(`Wallet: Fetched ${this.paymentUtxos.length} payment UTXOs.`);
      } else {
        console.error("Wallet: fetchPaymentUtxos did not return an array. Keeping existing payment UTXOs.");
      }
    } catch (error2) {
      console.error("Wallet: Error fetching payment UTXOs:", error2);
    }
    try {
      const newNftUtxos = await fetchNftUtxos2(address);
      if (Array.isArray(newNftUtxos)) {
        this.nftUtxos = newNftUtxos;
        console.error(`Wallet: Fetched ${this.nftUtxos.length} NFT UTXOs.`);
      } else {
        console.error("Wallet: fetchNftUtxos did not return an array. Keeping existing NFT UTXOs.");
      }
    } catch (error2) {
      console.error("Wallet: Error fetching NFT UTXOs:", error2);
    }
  }
  async getUtxos() {
    const now = Date.now();
    if (!this.paymentKey) {
      return { paymentUtxos: [], nftUtxos: [] };
    }
    if (now - this.lastUtxoFetch > this.utxoRefreshIntervalMs) {
      await this.refreshUtxos();
    }
    return { paymentUtxos: this.paymentUtxos, nftUtxos: this.nftUtxos };
  }
  getIdentityKey() {
    if (this.identityKey) {
      return this.identityKey;
    }
    const wif = process.env.IDENTITY_KEY_WIF;
    if (wif) {
      try {
        this.identityKey = PrivateKey8.fromWif(wif);
        return this.identityKey;
      } catch (e) {
        console.error("Wallet: Invalid Identity Key WIF from environment variable.", e);
      }
    }
    return;
  }
  getPaymentKey() {
    if (!this.paymentKey) {
      const wif = process.env.PRIVATE_KEY_WIF;
      if (wif) {
        try {
          this.paymentKey = PrivateKey8.fromWif(wif);
        } catch (e) {
          console.error("Wallet: Invalid WIF from environment variable.", e);
        }
      }
    }
    return this.paymentKey;
  }
  getAddress() {
    return this.getPaymentKey()?.toAddress();
  }
  async getPublicKey(args) {
    const currentPaymentKey = this.getPaymentKey();
    if (!currentPaymentKey) {
      throw new Error("No payment key available to derive public key.");
    }
    const publicKey = currentPaymentKey.toPublicKey();
    return {
      publicKey: publicKey.toDER("hex")
    };
  }
  async sendToAddress(address, amountSatoshis) {
    const pk = this.getPaymentKey();
    if (!pk)
      throw new Error("Payment key not available to send transaction.");
    const tx = new Transaction8;
    tx.addOutput({
      lockingScript: new P2PKH7().lock(address),
      satoshis: amountSatoshis
    });
    const { paymentUtxos } = await this.getUtxos();
    if (paymentUtxos.length === 0)
      throw new Error("No UTXOs available to send.");
    let totalInputSats = 0n;
    const feeModel = new SatoshisPerKilobyte3(10);
    let estimatedFee = await feeModel.computeFee(tx);
    for (const utxo of paymentUtxos) {
      if (totalInputSats >= BigInt(amountSatoshis) + BigInt(estimatedFee))
        break;
      const unlockingScriptTemplate = new P2PKH7().unlock(pk, "all", false, utxo.satoshis, Script6.fromBinary(Utils13.toArray(utxo.script, "hex")));
      const input = fromUtxo4(utxo, unlockingScriptTemplate);
      tx.addInput(input);
      totalInputSats += BigInt(utxo.satoshis);
      estimatedFee = await feeModel.computeFee(tx);
    }
    if (totalInputSats < BigInt(amountSatoshis) + BigInt(estimatedFee)) {
      throw new Error(`Not enough funds. Required: ${BigInt(amountSatoshis) + BigInt(estimatedFee)}, Available: ${totalInputSats}`);
    }
    const change = totalInputSats - (BigInt(amountSatoshis) + BigInt(estimatedFee));
    if (change > 0) {
      const changeAddress = this.getAddress();
      if (!changeAddress)
        throw new Error("Could not determine change address.");
      tx.addOutput({
        lockingScript: new P2PKH7().lock(changeAddress),
        satoshis: Number(change),
        change: true
      });
    }
    await tx.fee(feeModel);
    await tx.sign();
    const rawTx = tx.toHex();
    const txidFromTxObject = tx.id("hex");
    try {
      const broadcaster = new V5Broadcaster;
      const broadcastResult = await tx.broadcast(broadcaster);
      if (isBroadcastResponse4(broadcastResult)) {
        console.error(`Transaction broadcasted successfully: ${broadcastResult.txid}. Message: ${broadcastResult.message}`);
        return { txid: broadcastResult.txid, rawTx };
      }
      if (isBroadcastFailure5(broadcastResult)) {
        console.error(`Transaction broadcast failed: ${broadcastResult.description} (Code: ${broadcastResult.code}). TXID from object (if available): ${broadcastResult.txid ?? txidFromTxObject}`);
        throw new Error(`Broadcast failed: ${broadcastResult.description} (Code: ${broadcastResult.code})`);
      }
      console.error(`Transaction broadcast status uncertain. TXID from tx object: ${txidFromTxObject}. Unexpected broadcast result: `, broadcastResult);
      return { txid: txidFromTxObject, rawTx };
    } catch (error2) {
      console.error("Failed to broadcast transaction (exception caught):", error2);
      throw new Error(`Failed to broadcast transaction ${txidFromTxObject}: ${error2 instanceof Error ? error2.message : String(error2)}`);
    }
  }
}

// utils/walletInit.ts
import {
  createContext,
  deriveDepositAddresses as deriveDepositAddresses2
} from "@1sat/actions";
import {
  createRemoteWallet
} from "@1sat/wallet-remote";
import { PrivateKey as PrivateKey9 } from "@bsv/sdk";
import { homedir } from "node:os";
import { join } from "node:path";
var DEFAULT_REMOTE_STORAGE_URL = "https://1sat.shruggr.cloud/1sat/wallet";
var MCP_ADDRESS_PREFIX3 = "mcp";
var activeResult = null;
async function initWallet(privateKeyWif, chain = "main") {
  const remoteStorageUrl = process.env.REMOTE_STORAGE_URL ?? DEFAULT_REMOTE_STORAGE_URL;
  const result2 = await createRemoteWallet({
    privateKey: PrivateKey9.fromWif(privateKeyWif),
    chain,
    remoteStorageUrl
  });
  const dataDir = join(homedir(), ".bsv-mcp");
  const ctx = createContext(result2.wallet, {
    services: result2.services,
    chain,
    dataDir
  });
  const { derivations } = await deriveDepositAddresses2.execute(ctx, {
    prefix: MCP_ADDRESS_PREFIX3
  });
  const depositAddress = derivations[0].address;
  activeResult = { ...result2, ctx, depositAddress };
  return {
    wallet: result2.wallet,
    services: result2.services,
    ctx,
    depositAddress,
    destroy: result2.destroy
  };
}
async function destroyWallet() {
  if (activeResult) {
    await activeResult.destroy();
    activeResult = null;
  }
}

// index.ts
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

// utils/jwtValidator.ts
import { createRemoteJWKSet, jwtVerify } from "jose";

class JWTValidator {
  issuer;
  audience;
  jwksUrl;
  jwks;
  constructor(options) {
    this.issuer = options.issuer;
    this.audience = options.audience;
    this.jwksUrl = options.jwksUrl || `${options.issuer}/.well-known/jwks.json`;
    this.jwks = createRemoteJWKSet(new URL(this.jwksUrl), {
      cacheMaxAge: 3600000,
      cooldownDuration: 30000
    });
  }
  async validate(token) {
    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: this.issuer,
        audience: this.audience,
        requiredClaims: ["sub", "iss", "aud", "exp"]
      });
      return payload;
    } catch (error2) {
      if (error2 instanceof Error) {
        if (error2.message.includes("signature")) {
          throw new Error("Invalid token signature");
        }
        if (error2.message.includes("expired")) {
          throw new Error("Token has expired");
        }
        if (error2.message.includes("issuer")) {
          throw new Error(`Invalid issuer. Expected: ${this.issuer}`);
        }
        if (error2.message.includes("audience")) {
          throw new Error(`Invalid audience. Expected: ${this.audience}`);
        }
        throw new Error(`Token validation failed: ${error2.message}`);
      }
      throw error2;
    }
  }
  async validateFromHeader(authHeader) {
    if (!authHeader) {
      return null;
    }
    if (!authHeader.startsWith("Bearer ")) {
      throw new Error("Authorization header must use Bearer scheme");
    }
    const token = authHeader.substring(7).trim();
    if (!token) {
      throw new Error("Bearer token is empty");
    }
    return await this.validate(token);
  }
  async validateFromRequest(request) {
    const authHeader = request.headers.get("Authorization");
    return await this.validateFromHeader(authHeader);
  }
}
function createMCPJWTValidator(resourceUrl) {
  const issuer = process.env.OAUTH_ISSUER || "https://auth.sigmaidentity.com";
  const audience = resourceUrl || process.env.RESOURCE_URL || "http://localhost:3000";
  return new JWTValidator({
    issuer,
    audience
  });
}
function generateWWWAuthenticate(resourceUrl, error2, errorDescription) {
  let header = `Bearer realm="BSV-MCP", resource_metadata="${resourceUrl}/.well-known/oauth-protected-resource"`;
  if (error2) {
    header += `, error="${error2}"`;
  }
  if (errorDescription) {
    header += `, error_description="${errorDescription}"`;
  }
  return header;
}

// utils/keyManager.ts
import fs4 from "node:fs";
import os3 from "node:os";
import path5 from "node:path";
import { PrivateKey as PrivateKey10 } from "@bsv/sdk";
import {
  decryptBackup as decryptBackup2,
  encryptBackup as encryptBackup2
} from "bitcoin-backup";

class SecureKeyManager2 {
  keyDir;
  legacyFile;
  encryptedFile;
  backupFile;
  constructor(config = {}) {
    this.keyDir = config.keyDir || path5.join(os3.homedir(), ".bsv-mcp");
    this.legacyFile = path5.join(this.keyDir, "keys.json");
    this.encryptedFile = path5.join(this.keyDir, "keys.bep");
    this.backupFile = path5.join(this.keyDir, "keys.bep.backup");
  }
  async loadKeys(passphrase) {
    if (passphrase && this.hasEncryptedBackup()) {
      const keys = await this.loadEncryptedKeys(passphrase);
      return { keys, source: "encrypted" };
    }
    if (this.hasEncryptedBackup() && !passphrase) {
      console.error("Encrypted keys found (keys.bep). Provide a passphrase via loadKeys(passphrase) to decrypt, or use keys.json / PRIVATE_KEY_WIF instead.");
    }
    if (this.hasLegacyKeys()) {
      const keys = this.loadLegacyKeys();
      return { keys, source: "legacy" };
    }
    return { keys: {}, source: "none" };
  }
  async saveKeys(keys, options = {}) {
    if (options.passphrase) {
      await this.saveEncryptedKeys(keys, options.passphrase);
      return;
    }
    this.saveLegacyKeys(keys);
  }
  loadLegacyKeys() {
    try {
      const content = fs4.readFileSync(this.legacyFile, "utf8");
      const data = JSON.parse(content);
      return {
        payPk: data.payPk ? PrivateKey10.fromWif(data.payPk) : undefined,
        identityPk: data.identityPk ? PrivateKey10.fromWif(data.identityPk) : undefined,
        xprv: data.xprv
      };
    } catch (error2) {
      throw new Error(`Failed to load legacy keys: ${error2}`);
    }
  }
  saveLegacyKeys(keys) {
    const data = {
      payPk: keys.payPk?.toWif(),
      identityPk: keys.identityPk?.toWif(),
      xprv: keys.xprv
    };
    fs4.mkdirSync(this.keyDir, { recursive: true, mode: 448 });
    fs4.writeFileSync(this.legacyFile, JSON.stringify(data, null, 2), {
      mode: 384
    });
  }
  async loadEncryptedKeys(passphrase) {
    const encrypted = fs4.readFileSync(this.encryptedFile, "utf8");
    const decrypted = await decryptBackup2(encrypted, passphrase);
    if ("payPk" in decrypted && "identityPk" in decrypted) {
      const backup = decrypted;
      let xprv;
      if (fs4.existsSync(this.legacyFile)) {
        try {
          const legacyData = JSON.parse(fs4.readFileSync(this.legacyFile, "utf8"));
          xprv = legacyData.xprv;
        } catch (_e) {}
      }
      return {
        payPk: backup.payPk ? PrivateKey10.fromWif(backup.payPk) : undefined,
        identityPk: backup.identityPk ? PrivateKey10.fromWif(backup.identityPk) : undefined,
        xprv
      };
    }
    if ("xprv" in decrypted) {
      const backup = decrypted;
      return {
        payPk: undefined,
        identityPk: undefined,
        xprv: backup.xprv
      };
    }
    throw new Error("Unknown backup format");
  }
  async saveEncryptedKeys(keys, passphrase) {
    const data = {
      payPk: keys.payPk?.toWif() || "",
      identityPk: keys.identityPk?.toWif() || "",
      ordPk: "",
      label: "BSV MCP Keys",
      createdAt: new Date().toISOString()
    };
    if (keys.xprv) {
      const legacyData = {
        xprv: keys.xprv
      };
      fs4.mkdirSync(this.keyDir, { recursive: true, mode: 448 });
      fs4.writeFileSync(this.legacyFile, JSON.stringify(legacyData, null, 2), {
        mode: 384
      });
    }
    const encrypted = await encryptBackup2(data, passphrase);
    if (fs4.existsSync(this.encryptedFile)) {
      fs4.copyFileSync(this.encryptedFile, this.backupFile);
    }
    fs4.mkdirSync(this.keyDir, { recursive: true, mode: 448 });
    fs4.writeFileSync(this.encryptedFile, encrypted, { mode: 384 });
  }
  hasEncryptedBackup() {
    return fs4.existsSync(this.encryptedFile);
  }
  hasLegacyKeys() {
    return fs4.existsSync(this.legacyFile);
  }
  getStatus() {
    const hasEncrypted = this.hasEncryptedBackup();
    const hasLegacy = this.hasLegacyKeys();
    return {
      hasEncrypted,
      hasLegacy,
      isSecure: hasEncrypted && !hasLegacy
    };
  }
}
var keyManager2 = new SecureKeyManager2;

// utils/passphrasePrompt.ts
import { join as join2 } from "node:path";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
var LOCK_DIR = join2(process.env.HOME || "", ".bsv-mcp");
var LOCK_FILE = join2(LOCK_DIR, "prompt.lock");
var serverInstance = null;
function setServerInstance(server) {
  serverInstance = server;
}

// index.ts
var _isStdio = process.argv.includes("--stdio") || process.env.TRANSPORT?.toLowerCase() === "stdio";
if (_isStdio) {
  const _err = console.error.bind(console);
  console.log = (...a) => _err("[log]", ...a);
  console.warn = (...a) => _err("[warn]", ...a);
  console.info = (...a) => _err("[info]", ...a);
  console.debug = (...a) => _err("[debug]", ...a);
}
var server;
function createConfiguredServer(opts) {
  const srv = new McpServer({ name: package_default.name, version: package_default.version }, {
    capabilities: {
      prompts: {},
      resources: {},
      tools: {},
      experimental: {
        "io.modelcontextprotocol/ui": { version: "0.1" }
      }
    },
    instructions: `
				This server exposes Bitcoin SV helpers.
				Tools are idempotent unless marked destructive.
			`
  });
  registerAllTools(srv, opts.toolsConfig);
  registerMcpAppTools(srv, opts.wallet);
  if (opts.loadPrompts)
    registerAllPrompts(srv);
  if (opts.loadResources)
    registerResources(srv);
  return srv;
}
var CONFIG = {
  loadPrompts: process.env.DISABLE_PROMPTS !== "true",
  loadResources: process.env.DISABLE_RESOURCES !== "true",
  loadTools: process.env.DISABLE_TOOLS !== "true",
  loadWalletTools: process.env.DISABLE_WALLET_TOOLS !== "true",
  loadMneeTools: process.env.DISABLE_MNEE_TOOLS !== "true",
  loadBsvTools: process.env.DISABLE_BSV_TOOLS !== "true",
  loadOrdinalsTools: process.env.DISABLE_ORDINALS_TOOLS !== "true",
  loadUtilsTools: process.env.DISABLE_UTILS_TOOLS !== "true",
  loadA2bTools: process.env.ENABLE_A2B_TOOLS === "true",
  loadBapTools: process.env.DISABLE_BAP_TOOLS !== "true",
  loadBsocialTools: process.env.DISABLE_BSOCIAL_TOOLS !== "true",
  disableBroadcasting: process.env.DISABLE_BROADCASTING === "true",
  transportMode: process.argv.includes("--stdio") ? "stdio" : process.env.TRANSPORT?.toLowerCase() || "http",
  port: Number.parseInt(process.env.PORT || "3000", 10),
  useDropletApi: process.env.USE_DROPLET_API === "true",
  dropletApiUrl: process.env.DROPLET_API_URL || "http://127.0.0.1:4000",
  dropletFaucetName: process.env.DROPLET_FAUCET_NAME || "",
  enableOAuth: process.env.ENABLE_OAUTH !== "false",
  oauthIssuer: process.env.OAUTH_ISSUER || "https://auth.sigmaidentity.com",
  resourceUrl: process.env.RESOURCE_URL || ""
};
var logFunc2 = console.error;
var KEY_DIR2 = path6.join(os4.homedir(), ".bsv-mcp");
var KEY_FILE_PATH2 = path6.join(KEY_DIR2, "keys.json");
async function initializeKeys() {
  const keyManager3 = new SecureKeyManager2({ keyDir: KEY_DIR2 });
  const privateKeyWifEnv = process.env.PRIVATE_KEY_WIF;
  if (privateKeyWifEnv) {
    try {
      const payPk2 = PrivateKey11.fromWif(privateKeyWifEnv);
      console.error("\x1B[32mINFO: Using valid PRIVATE_KEY_WIF from environment for payment key.\x1B[0m");
      let xprvFromFile;
      try {
        const { keys } = await keyManager3.loadKeys();
        xprvFromFile = keys.xprv;
        if (xprvFromFile) {
          console.error("\x1B[32mINFO: Loaded BAP HD Master Key (xprv) from secure storage alongside ENV payPk.\x1B[0m");
        }
      } catch (_e) {}
      if (!xprvFromFile) {
        console.error("\x1B[33mWARN: No identity key (identityPk or xprv) found. BAP/A2B tools needing identity will be limited.\x1B[0m");
      }
      return {
        payPk: payPk2,
        identityPk: undefined,
        xprv: xprvFromFile,
        source: "env"
      };
    } catch (_error) {
      console.error("\x1B[33mWARN: Invalid PRIVATE_KEY_WIF format in environment variable. Checking secure storage next.\x1B[0m");
    }
  }
  try {
    const { keys, source } = await keyManager3.loadKeys();
    if (keys.payPk) {
      if (source === "encrypted") {
        console.error(`\x1B[32mINFO: Using encrypted keys from: ${KEY_DIR2}/keys.bep\x1B[0m`);
      } else if (source === "legacy") {
        console.error(`\x1B[32mINFO: Using legacy keys from: ${KEY_FILE_PATH2}\x1B[0m`);
        console.error("\x1B[33mWARN: Using unencrypted keys. Run the server again to encrypt them.\x1B[0m");
      }
      if (keys.identityPk) {
        console.error("\x1B[32mINFO: Loaded Identity Key (identityPk) from secure storage.\x1B[0m");
      }
      if (keys.xprv) {
        console.error("\x1B[32mINFO: Loaded BAP HD Master Key (xprv) from secure storage.\x1B[0m");
      }
      return {
        payPk: keys.payPk,
        identityPk: keys.identityPk,
        xprv: keys.xprv,
        source: source === "encrypted" ? "encrypted" : "file"
      };
    }
    console.error("\x1B[33mINFO: No keys found in secure storage.\x1B[0m");
  } catch (error2) {
    console.error(`\x1B[33mWARN: Error reading keys from secure storage: ${error2}\x1B[0m`);
  }
  console.error("\x1B[33mINFO: Generating new payment key ONLY.\x1B[0m");
  const payPk = PrivateKey11.fromRandom();
  const keyStore = {
    payPk,
    identityPk: undefined,
    xprv: undefined
  };
  try {
    await keyManager3.saveKeys(keyStore, { forceUnencrypted: true });
    const status = keyManager3.getStatus();
    if (status.hasEncrypted) {
      console.error(`\x1B[33mWARN: Saved newly generated payment key (encrypted) to: ${KEY_DIR2}/keys.bep\x1B[0m`);
    } else {
      console.error(`\x1B[33mWARN: Saved newly generated payment key (unencrypted) to: ${KEY_FILE_PATH2}\x1B[0m`);
      console.error("\x1B[33mWARN: Run the server again to encrypt your keys.\x1B[0m");
    }
    console.error("\x1B[33mWARN: Identity key (identityPk/xprv) not found or generated. Use 'bap_generate' tool to create one.\x1B[0m");
  } catch (writeError) {
    console.error(`\x1B[31mERROR: Failed to save newly generated payment key: ${writeError}\x1B[0m`);
    console.error("\x1B[31mERROR: Using the generated payment key for this session only. No identity key available.\x1B[0m");
  }
  return { payPk, identityPk: undefined, xprv: undefined, source: "generated" };
}
var APP_RESOURCE_URI = "ui://bsv-mcp/app.html";
var __appDirname = dirname(fileURLToPath(import.meta.url));
function registerMcpAppTools(server2, wallet) {
  registerAppTool(server2, "bsv_dashboard", {
    title: "BSV Dashboard",
    description: "Interactive BSV dashboard with Explorer, Wallet, and Ordinals tabs. Use this for any BSV-related query that benefits from visual display.",
    inputSchema: {},
    _meta: {
      ui: { resourceUri: APP_RESOURCE_URI }
    }
  }, async () => {
    return {
      content: [{ type: "text", text: "BSV Dashboard opened" }],
      structuredContent: { view: "dashboard", ready: true },
      _meta: { viewUUID: crypto.randomUUID() }
    };
  });
  registerAppTool(server2, "app_explorer_data", {
    title: "Explorer Data",
    description: "App-only: fetches BSV price, chain info, decodes transactions, and looks up addresses.",
    inputSchema: {
      txid: z40.string().optional().describe("Transaction ID to decode"),
      address: z40.string().optional().describe("Address to look up balance/history")
    },
    _meta: {
      ui: { resourceUri: APP_RESOURCE_URI, visibility: ["app"] }
    }
  }, async (args) => {
    const { txid, address } = args;
    if (txid) {
      try {
        const res = await fetch(`https://junglebus.gorillapool.io/v1/transaction/get/${txid}`);
        if (!res.ok)
          throw new Error(`Transaction not found: ${res.status}`);
        const jbData = await res.json();
        const { Transaction: Transaction9, Utils: Utils14 } = await import("@bsv/sdk");
        const rawTx = jbData.transaction;
        const isBase64 = /^[A-Za-z0-9+/=]+$/.test(rawTx);
        const txBytes = isBase64 ? Utils14.toArray(rawTx, "base64") : Utils14.toArray(rawTx, "hex");
        const tx = Transaction9.fromBinary(txBytes);
        return {
          content: [
            { type: "text", text: `Decoded transaction ${txid}` }
          ],
          structuredContent: {
            transaction: {
              txid,
              version: tx.version,
              lockTime: tx.lockTime,
              size: tx.toBinary().length,
              inputs: tx.inputs.map((inp) => ({
                txid: inp.sourceTXID,
                vout: inp.sourceOutputIndex,
                script: inp.unlockingScript?.toHex() || ""
              })),
              outputs: tx.outputs.map((out, i) => ({
                n: i,
                value: out.satoshis,
                scriptPubKey: {
                  hex: out.lockingScript.toHex(),
                  asm: out.lockingScript.toASM()
                }
              })),
              confirmations: jbData.block_height ? 1 : 0,
              block: jbData.block_hash ? {
                hash: jbData.block_hash,
                height: jbData.block_height
              } : null
            }
          },
          _meta: { viewUUID: crypto.randomUUID() }
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${err instanceof Error ? err.message : String(err)}`
            }
          ],
          structuredContent: { error: String(err) },
          _meta: { viewUUID: crypto.randomUUID() }
        };
      }
    }
    if (address) {
      try {
        const [balRes, histRes] = await Promise.all([
          fetch(`https://api.whatsonchain.com/v1/bsv/main/address/${address}/balance`),
          fetch(`https://api.whatsonchain.com/v1/bsv/main/address/${address}/history`)
        ]);
        const balance = balRes.ok ? await balRes.json() : null;
        const history = histRes.ok ? await histRes.json() : [];
        return {
          content: [
            { type: "text", text: `Address info for ${address}` }
          ],
          structuredContent: {
            addressInfo: { balance, history }
          },
          _meta: { viewUUID: crypto.randomUUID() }
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${err instanceof Error ? err.message : String(err)}`
            }
          ],
          structuredContent: { error: String(err) },
          _meta: { viewUUID: crypto.randomUUID() }
        };
      }
    }
    try {
      const [price, chainRes] = await Promise.all([
        getBsvPriceWithCache(),
        fetch("https://api.whatsonchain.com/v1/bsv/main/chain/info")
      ]);
      const chainInfo = chainRes.ok ? await chainRes.json() : null;
      return {
        content: [
          {
            type: "text",
            text: `BSV price: $${price.toFixed(2)}`
          }
        ],
        structuredContent: { price, chainInfo },
        _meta: { viewUUID: crypto.randomUUID() }
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${err instanceof Error ? err.message : String(err)}`
          }
        ],
        structuredContent: { error: String(err) },
        _meta: { viewUUID: crypto.randomUUID() }
      };
    }
  });
  registerAppTool(server2, "app_wallet_data", {
    title: "Wallet Data",
    description: "App-only: fetches wallet balance, UTXOs, and address.",
    inputSchema: {},
    _meta: {
      ui: { resourceUri: APP_RESOURCE_URI, visibility: ["app"] }
    }
  }, async () => {
    if (!wallet) {
      return {
        content: [
          {
            type: "text",
            text: "No wallet configured"
          }
        ],
        structuredContent: {
          error: "No wallet configured. Set PRIVATE_KEY_WIF or generate keys."
        },
        _meta: { viewUUID: crypto.randomUUID() }
      };
    }
    try {
      const { paymentUtxos } = await wallet.getUtxos();
      const address = wallet.getAddress();
      let totalSatoshis = 0;
      for (const utxo of paymentUtxos) {
        totalSatoshis += utxo.satoshis || 0;
      }
      let price;
      try {
        price = await getBsvPriceWithCache();
      } catch {}
      const { toBitcoin: toBitcoin2 } = await import("satoshi-token");
      const bsvAmount = toBitcoin2(totalSatoshis);
      return {
        content: [
          {
            type: "text",
            text: `Wallet balance: ${bsvAmount} BSV`
          }
        ],
        structuredContent: {
          balance: {
            satoshis: totalSatoshis,
            bsv: bsvAmount,
            utxoCount: paymentUtxos.length
          },
          address,
          utxos: paymentUtxos.slice(0, 50).map((u) => ({
            txid: u.txid,
            vout: u.vout,
            satoshis: u.satoshis
          })),
          price
        },
        _meta: { viewUUID: crypto.randomUUID() }
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${err instanceof Error ? err.message : String(err)}`
          }
        ],
        structuredContent: { error: String(err) },
        _meta: { viewUUID: crypto.randomUUID() }
      };
    }
  });
  registerAppTool(server2, "app_ordinals_data", {
    title: "Ordinals Data",
    description: "App-only: fetches ordinals/NFT marketplace listings and search results.",
    inputSchema: {
      query: z40.string().optional().describe("Search query")
    },
    _meta: {
      ui: { resourceUri: APP_RESOURCE_URI, visibility: ["app"] }
    }
  }, async (args) => {
    const { query } = args;
    try {
      if (query) {
        const url = new URL("https://ordinals.gorillapool.io/api/inscriptions/search");
        url.searchParams.set("limit", "20");
        url.searchParams.set("offset", "0");
        url.searchParams.set("dir", "desc");
        url.searchParams.set("terms", query);
        const res2 = await fetch(url.toString());
        if (!res2.ok)
          throw new Error(`Search failed: ${res2.status}`);
        const data2 = await res2.json();
        return {
          content: [
            {
              type: "text",
              text: `Found results for "${query}"`
            }
          ],
          structuredContent: {
            results: data2.results || [],
            total: data2.total || 0
          },
          _meta: { viewUUID: crypto.randomUUID() }
        };
      }
      const res = await fetch("https://ordinals.gorillapool.io/api/market?limit=20&offset=0&sort=recent&dir=desc");
      if (!res.ok)
        throw new Error(`Market fetch failed: ${res.status}`);
      const data = await res.json();
      return {
        content: [
          { type: "text", text: "Marketplace listings loaded" }
        ],
        structuredContent: {
          listings: data.results || [],
          total: data.total || 0
        },
        _meta: { viewUUID: crypto.randomUUID() }
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${err instanceof Error ? err.message : String(err)}`
          }
        ],
        structuredContent: { error: String(err) },
        _meta: { viewUUID: crypto.randomUUID() }
      };
    }
  });
  registerAppResource(server2, "BSV Dashboard", APP_RESOURCE_URI, { description: "Interactive BSV dashboard with Explorer, Wallet, and Ordinals tabs" }, async () => {
    const distPath = __appDirname.endsWith("dist") ? join3(__appDirname, "app.html") : join3(__appDirname, "dist", "app.html");
    let html;
    try {
      html = await readFile(distPath, "utf-8");
    } catch {
      html = "<html><body><p>Dashboard not built. Run <code>bun run build:view</code> to enable it.</p></body></html>";
    }
    return {
      contents: [
        {
          uri: APP_RESOURCE_URI,
          mimeType: RESOURCE_MIME_TYPE,
          text: html
        }
      ]
    };
  });
}
async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h") || args.includes("help")) {
    console.log(`
BSV MCP Server v${package_default.version}

Usage: bun run index.ts [options]

Options:
  --help, -h          Show this help message
  --version, -v       Show version information

Environment Variables:
  TRANSPORT           Transport mode: 'stdio' or 'http' (default: http)
  PORT               HTTP server port (default: 3000)
  PRIVATE_KEY_WIF    Payment private key in WIF format
  DISABLE_TOOLS      Disable all tools (default: false)
  DISABLE_WALLET_TOOLS   Disable wallet tools (default: false)
  DISABLE_BSV_TOOLS      Disable BSV tools (default: false)
  DISABLE_ORDINALS_TOOLS Disable ordinals tools (default: false)
  DISABLE_UTILS_TOOLS    Disable utility tools (default: false)
  DISABLE_BAP_TOOLS      Disable BAP tools (default: false)  
  DISABLE_BSOCIAL_TOOLS  Disable BSocial tools (default: false)
  ENABLE_A2B_TOOLS       Enable A2B tools (default: false)
  DISABLE_BROADCASTING   Disable transaction broadcasting (default: false)
  USE_DROPLET_API        Use Droplet API for transactions (default: false)

Tool Categories:
  BSV Tools:      Price lookup, transaction decoding, validation
  Wallet Tools:   Send payments, manage UTXOs (requires payment key)
  Ordinals Tools: Search listings, market data
  Utils Tools:    General utilities, conversions
  BAP Tools:      Identity management (requires identity key)
  BSocial Tools:  Social posts, likes, follows
  A2B Tools:      Advanced BSV operations (requires identity key)

Authentication:
  - Most tools work without authentication
  - Wallet operations require PRIVATE_KEY_WIF or generated keys
  - BAP/A2B tools require identity keys (generated via bap_generate tool)
		`);
    process.exit(0);
  }
  if (args.includes("--version") || args.includes("-v")) {
    console.log(`${package_default.name} v${package_default.version}`);
    process.exit(0);
  }
  const { payPk, identityPk, xprv, source: keySource } = await initializeKeys();
  const hasPersistentPayKey = keySource === "env" || keySource === "file" || keySource === "encrypted";
  const hasPersistentIdentityKey = !!identityPk && (keySource === "file" || keySource === "encrypted");
  const hasXprv = !!xprv && (keySource === "file" || keySource === "env" || keySource === "encrypted");
  const effectiveConfig = { ...CONFIG };
  logFunc2(`
--- BSV MCP Server Configuration ---`);
  logFunc2(`Server Version: ${package_default.version}`);
  logFunc2(`Server Name: ${package_default.name}`);
  logFunc2(`
Environment Variables:`);
  logFunc2(`  TRANSPORT:            ${process.env.TRANSPORT || "Not Set (http default)"}`);
  if (CONFIG.transportMode === "http") {
    logFunc2(`  PORT:                 ${process.env.PORT || "Not Set (3000 default)"}`);
  }
  logFunc2(`  PRIVATE_KEY_WIF:      ${process.env.PRIVATE_KEY_WIF ? "Set (using env key)" : "Not Set (using file/generating)"}`);
  logFunc2(`  IDENTITY_KEY_WIF:     ${process.env.IDENTITY_KEY_WIF ? "Set (using env key)" : "Not Set (using file/generating)"}`);
  if (process.env.BSV_MCP_PASSPHRASE) {
    logFunc2("  BSV_MCP_PASSPHRASE:   \x1B[31mDEPRECATED - Remove this!\x1B[0m");
  }
  logFunc2(`  DISABLE_PROMPTS:      ${process.env.DISABLE_PROMPTS === "true" ? "Set (true)" : "Not Set/false"}`);
  logFunc2(`  DISABLE_RESOURCES:    ${process.env.DISABLE_RESOURCES === "true" ? "Set (true)" : "Not Set/false"}`);
  logFunc2(`  DISABLE_TOOLS:        ${process.env.DISABLE_TOOLS === "true" ? "Set (true)" : "Not Set/false"}`);
  logFunc2(`  DISABLE_WALLET_TOOLS: ${process.env.DISABLE_WALLET_TOOLS === "true" ? "Set (true)" : "Not Set/false"}`);
  logFunc2(`  DISABLE_MNEE_TOOLS:   ${process.env.DISABLE_MNEE_TOOLS === "true" ? "Set (true)" : "Not Set/false"}`);
  logFunc2(`  DISABLE_BSV_TOOLS:    ${process.env.DISABLE_BSV_TOOLS === "true" ? "Set (true)" : "Not Set/false"}`);
  logFunc2(`  DISABLE_ORDINALS_TOOLS: ${process.env.DISABLE_ORDINALS_TOOLS === "true" ? "Set (true)" : "Not Set/false"}`);
  logFunc2(`  DISABLE_UTILS_TOOLS:  ${process.env.DISABLE_UTILS_TOOLS === "true" ? "Set (true)" : "Not Set/false"}`);
  logFunc2(`  ENABLE_A2B_TOOLS:     ${process.env.ENABLE_A2B_TOOLS === "true" ? "Set (true)" : "Not Set/false"}`);
  logFunc2(`  DISABLE_BAP_TOOLS:    ${process.env.DISABLE_BAP_TOOLS === "true" ? "Set (true)" : "Not Set/false"}`);
  logFunc2(`  DISABLE_BROADCASTING: ${process.env.DISABLE_BROADCASTING === "true" ? "Set (true)" : "Not Set/false"}`);
  logFunc2(`  USE_DROPLET_API:      ${CONFIG.useDropletApi ? "Set (true)" : "Not Set/false"}`);
  if (CONFIG.useDropletApi) {
    logFunc2(`  DROPLET_API_URL:      ${CONFIG.dropletApiUrl}`);
    logFunc2(`  DROPLET_FAUCET_NAME:  ${CONFIG.dropletFaucetName || "Not Set"}`);
  }
  logFunc2(`
Key Source:`);
  let payKeySourceInfo = `Payment Key (payPk): ${keySource}`;
  if (keySource === "env")
    payKeySourceInfo = "Payment Key (payPk): env";
  if (keySource === "file")
    payKeySourceInfo += ` (Loaded from ${KEY_FILE_PATH2})`;
  if (keySource === "encrypted")
    payKeySourceInfo += ` (Loaded from ${KEY_DIR2}/keys.bep)`;
  if (keySource === "generated")
    payKeySourceInfo += " (Generated & saved)";
  let identityKeySourceInfo = "Identity Key (identityPk): Not Loaded";
  if (identityPk && (keySource === "file" || keySource === "encrypted")) {
    identityKeySourceInfo = `Identity Key (identityPk): ${keySource} (Loaded from secure storage)`;
  } else if (identityPk) {
    identityKeySourceInfo = `Identity Key (identityPk): ${keySource} (Unexpected Source)`;
  }
  let xprvSourceInfo = "BAP Master Key (xprv): Not found";
  if (hasXprv) {
    xprvSourceInfo = "BAP Master Key (xprv): Loaded from secure storage";
  }
  logFunc2(`  ${payKeySourceInfo}`);
  logFunc2(`  ${identityKeySourceInfo}`);
  logFunc2(`  ${xprvSourceInfo}`);
  logFunc2(`
Effective Component Status:`);
  logFunc2(`  Transport Mode: ${CONFIG.transportMode.toUpperCase()}`);
  logFunc2(`  Prompts:        ${effectiveConfig.loadPrompts ? "\x1B[32mEnabled\x1B[0m" : "\x1B[31mDisabled\x1B[0m"}`);
  logFunc2(`  Resources:      ${effectiveConfig.loadResources ? "\x1B[32mEnabled\x1B[0m" : "\x1B[31mDisabled\x1B[0m"}`);
  logFunc2(`  Tools (Overall):  ${effectiveConfig.loadTools ? "\x1B[32mEnabled\x1B[0m" : "\x1B[31mDisabled\x1B[0m"}`);
  if (effectiveConfig.loadTools) {
    const walletStatus = effectiveConfig.loadWalletTools ? "\x1B[32mEnabled\x1B[0m" : "\x1B[31mDisabled\x1B[0m";
    const mneeStatus = effectiveConfig.loadMneeTools ? "\x1B[32mEnabled\x1B[0m" : "\x1B[31mDisabled\x1B[0m";
    const a2bStatus = effectiveConfig.loadA2bTools ? "\x1B[32mEnabled\x1B[0m" : "\x1B[31mDisabled\x1B[0m";
    const bapStatus = effectiveConfig.loadBapTools ? "\x1B[32mEnabled\x1B[0m" : "\x1B[31mDisabled\x1B[0m";
    let payKeyNote = "";
    if (!hasPersistentPayKey) {
      payKeyNote = " \x1B[33m(Using generated payPk)\x1B[0m";
    }
    let identityKeyNote = "";
    if (!hasPersistentIdentityKey) {
      identityKeyNote = " \x1B[33m(Using generated identityPk)\x1B[0m";
    }
    logFunc2(`    Wallet:       ${walletStatus}${payKeyNote}`);
    logFunc2(`    MNEE:         ${mneeStatus}${payKeyNote}`);
    logFunc2(`    BSV:          ${effectiveConfig.loadBsvTools ? "\x1B[32mEnabled\x1B[0m" : "\x1B[31mDisabled\x1B[0m"}`);
    logFunc2(`    Ordinals:     ${effectiveConfig.loadOrdinalsTools ? "\x1B[32mEnabled\x1B[0m" : "\x1B[31mDisabled\x1B[0m"}`);
    logFunc2(`    Utils:        ${effectiveConfig.loadUtilsTools ? "\x1B[32mEnabled\x1B[0m" : "\x1B[31mDisabled\x1B[0m"}`);
    logFunc2(`    A2B:          ${a2bStatus}${identityKeyNote}`);
    logFunc2(`    BAP:          ${bapStatus}${identityKeyNote}`);
    logFunc2(`    BSocial:      ${effectiveConfig.loadBsocialTools ? "\x1B[32mEnabled\x1B[0m" : "\x1B[31mDisabled\x1B[0m"}`);
    if (effectiveConfig.loadWalletTools) {
      logFunc2(`      Broadcasting: ${!effectiveConfig.disableBroadcasting ? "\x1B[32mEnabled\x1B[0m" : "\x1B[31mDisabled\x1B[0m"}`);
    }
  }
  logFunc2(`------------------------------------
`);
  let wallet;
  let integratedWallet;
  let remoteCtx;
  let remoteServices;
  if (CONFIG.loadTools) {
    if (CONFIG.useDropletApi && CONFIG.dropletFaucetName) {
      if (CONFIG.loadWalletTools) {
        try {
          integratedWallet = new IntegratedWallet({
            useDropletApi: true,
            dropletConfig: {
              apiUrl: CONFIG.dropletApiUrl,
              faucetName: CONFIG.dropletFaucetName
            },
            paymentKey: payPk,
            identityKey: identityPk
          });
          logFunc2(`\x1B[32mINFO: Droplet API mode initialized successfully (Faucet: ${CONFIG.dropletFaucetName}).\x1B[0m`);
          logFunc2(`\x1B[33mNOTE: Using Droplet API at ${CONFIG.dropletApiUrl}\x1B[0m`);
          logFunc2("\x1B[33mNOTE: Local keys are ignored in Droplet API mode\x1B[0m");
          wallet = integratedWallet.getLocalWallet();
          effectiveConfig.loadMneeTools = false;
          effectiveConfig.loadBapTools = false;
          effectiveConfig.loadA2bTools = false;
          effectiveConfig.loadBsocialTools = false;
        } catch (e) {
          logFunc2(`\x1B[31mERROR: Failed to initialize Droplet API mode: ${e instanceof Error ? e.message : String(e)}. Wallet-dependent tools will be unavailable.\x1B[0m`);
          integratedWallet = undefined;
          effectiveConfig.loadWalletTools = false;
          effectiveConfig.loadMneeTools = false;
          effectiveConfig.loadBapTools = false;
        }
      }
    } else if (payPk) {
      if (CONFIG.loadWalletTools) {
        try {
          wallet = new Wallet2(payPk, identityPk);
          integratedWallet = new IntegratedWallet({
            paymentKey: payPk,
            identityKey: identityPk
          });
          logFunc2("\x1B[32mINFO: Custom Wallet initialized successfully.\x1B[0m");
          if (!hasPersistentPayKey) {
            logFunc2("\x1B[33mWARN: Wallet is using a generated payment key for this session only. It will not persist.\x1B[0m");
          }
          if (identityPk && !hasPersistentIdentityKey && !hasXprv) {
            logFunc2("\x1B[33mWARN: Wallet is using an identity key that might not be from a persistent file source (keys.json xprv or identityPk field) for BAP operations.\x1B[0m");
          }
        } catch (e) {
          logFunc2(`\x1B[31mERROR: Failed to initialize custom wallet: ${e instanceof Error ? e.message : String(e)}. Wallet-dependent tools will be unavailable.\x1B[0m`);
          wallet = undefined;
          integratedWallet = undefined;
          effectiveConfig.loadWalletTools = false;
          effectiveConfig.loadMneeTools = false;
          effectiveConfig.loadBapTools = false;
        }
        try {
          const chain = process.env.BSV_CHAIN ?? "main";
          const remoteResult = await initWallet(payPk.toWif(), chain);
          remoteCtx = remoteResult.ctx;
          remoteServices = remoteResult.services;
          logFunc2(`\x1B[32mINFO: Remote BRC-100 wallet initialized. Deposit address: ${remoteResult.depositAddress}\x1B[0m`);
        } catch (e) {
          logFunc2(`\x1B[33mWARN: Remote BRC-100 wallet initialization failed: ${e instanceof Error ? e.message : String(e)}. Falling back to local wallet only.\x1B[0m`);
        }
      }
      if (effectiveConfig.loadMneeTools && !wallet && CONFIG.loadWalletTools) {
        logFunc2("\x1B[33mWARN: MNEE tools require a wallet but wallet initialization failed. MNEE tools disabled.\x1B[0m");
        effectiveConfig.loadMneeTools = false;
      }
    }
  }
  const toolsConfig = CONFIG.loadTools ? {
    enableBsvTools: effectiveConfig.loadBsvTools,
    enableOrdinalsTools: effectiveConfig.loadOrdinalsTools,
    enableUtilsTools: effectiveConfig.loadUtilsTools,
    enableA2bTools: effectiveConfig.loadA2bTools,
    enableBapTools: effectiveConfig.loadBapTools,
    enableBsocialTools: effectiveConfig.loadBsocialTools,
    enableWalletTools: effectiveConfig.loadWalletTools,
    enableMneeTools: effectiveConfig.loadMneeTools,
    identityPk,
    payPk,
    xprv,
    wallet,
    integratedWallet,
    disableBroadcasting: effectiveConfig.disableBroadcasting,
    ctx: remoteCtx,
    services: remoteServices
  } : {
    enableBsvTools: false,
    enableOrdinalsTools: false,
    enableUtilsTools: false,
    enableA2bTools: false,
    enableBapTools: false,
    enableBsocialTools: false,
    enableWalletTools: false,
    enableMneeTools: false,
    disableBroadcasting: true
  };
  const serverFactoryOpts = {
    toolsConfig,
    wallet,
    loadPrompts: effectiveConfig.loadPrompts,
    loadResources: effectiveConfig.loadResources
  };
  for (const sig of ["SIGINT", "SIGTERM"]) {
    process.once(sig, () => {
      destroyWallet().catch(() => {});
    });
  }
  if (CONFIG.transportMode === "stdio") {
    server = createConfiguredServer(serverFactoryOpts);
    setServerInstance(server);
    const transport = new StdioServerTransport2;
    await server.connect(transport);
    logFunc2("BSV MCP Server running on stdio");
  } else {
    const port = CONFIG.port;
    const resourceUrl = CONFIG.resourceUrl || `http://localhost:${port}`;
    const jwtValidator = CONFIG.enableOAuth ? createMCPJWTValidator(resourceUrl) : null;
    const sessions = new Map;
    logFunc2(`Starting BSV MCP Server in Streamable HTTP mode on port ${port}...`);
    if (CONFIG.enableOAuth) {
      logFunc2(`OAuth 2.1 authentication enabled`);
      logFunc2(`  Issuer: ${CONFIG.oauthIssuer}`);
      logFunc2(`  Resource: ${resourceUrl}`);
    }
    const authServer = process.env.OAUTH_ISSUER || "https://auth.sigmaidentity.com";
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, mcp-session-id, Last-Event-ID, mcp-protocol-version",
      "Access-Control-Expose-Headers": "mcp-session-id, mcp-protocol-version"
    };
    async function validateAuth(req) {
      if (!CONFIG.enableOAuth || !jwtValidator)
        return null;
      const userContext = await jwtValidator.validateFromRequest(req);
      if (!userContext) {
        const err = new Error("Authentication required");
        err.status = 401;
        throw err;
      }
      logFunc2(`Authenticated: ${userContext.sub} (pubkey: ${userContext.pubkey?.substring(0, 20)}...)`);
      return userContext;
    }
    Bun.serve({
      port,
      async fetch(req) {
        const url = new URL(req.url);
        if (req.method === "OPTIONS") {
          return new Response(null, { status: 204, headers: corsHeaders });
        }
        if (req.method === "GET" && url.pathname === "/.well-known/oauth-authorization-server") {
          return Response.json({
            issuer: authServer,
            authorization_endpoint: `${authServer}/api/oauth/authorize`,
            token_endpoint: `${authServer}/api/oauth/token`,
            userinfo_endpoint: `${authServer}/api/oauth/userinfo`,
            jwks_uri: `${authServer}/.well-known/jwks.json`,
            registration_endpoint: `${authServer}/api/oauth/register`,
            scopes_supported: [
              "openid",
              "profile",
              "email",
              "offline_access",
              "bsv:tools",
              "bsv:wallet",
              "bsv:ordinals",
              "bsv:tokens"
            ],
            response_types_supported: ["code"],
            grant_types_supported: [
              "authorization_code",
              "refresh_token"
            ],
            token_endpoint_auth_methods_supported: ["none"],
            code_challenge_methods_supported: ["S256"]
          }, {
            headers: {
              "Access-Control-Allow-Origin": "*",
              "Cache-Control": "public, max-age=3600"
            }
          });
        }
        if (req.method === "GET" && url.pathname === "/.well-known/oauth-protected-resource") {
          return Response.json({
            resource: resourceUrl,
            authorization_servers: [authServer],
            scopes_supported: [
              "openid",
              "profile",
              "email",
              "bsv:tools",
              "bsv:wallet",
              "bsv:ordinals",
              "bsv:tokens"
            ],
            bearer_methods_supported: ["header"],
            resource_signing_alg_values_supported: ["RS256", "ES256"]
          }, {
            headers: {
              "Access-Control-Allow-Origin": "*",
              "Cache-Control": "public, max-age=3600"
            }
          });
        }
        if (url.pathname === "/mcp") {
          let authInfo;
          try {
            const userCtx = await validateAuth(req);
            if (userCtx) {
              authInfo = {
                token: req.headers.get("Authorization")?.substring(7) || "",
                clientId: userCtx.sub,
                scopes: userCtx.scope?.split(" ") || []
              };
            }
          } catch (error2) {
            const msg = error2 instanceof Error ? error2.message : "Token validation failed";
            return new Response(JSON.stringify({ error: "invalid_token", message: msg }), {
              status: 401,
              headers: {
                "Content-Type": "application/json",
                "WWW-Authenticate": generateWWWAuthenticate(resourceUrl, "invalid_token", msg),
                ...corsHeaders
              }
            });
          }
          const sessionId = req.headers.get("mcp-session-id");
          if (sessionId) {
            const session = sessions.get(sessionId);
            if (!session) {
              return new Response(JSON.stringify({
                jsonrpc: "2.0",
                error: { code: -32001, message: "Session not found" },
                id: null
              }), { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } });
            }
            const response2 = await session.transport.handleRequest(req, { authInfo });
            for (const [k, v] of Object.entries(corsHeaders)) {
              if (!response2.headers.has(k))
                response2.headers.set(k, v);
            }
            return response2;
          }
          const transport = new WebStandardStreamableHTTPServerTransport({
            sessionIdGenerator: () => crypto.randomUUID(),
            onsessioninitialized: (id) => {
              sessions.set(id, { server: mcpServer, transport });
              logFunc2(`New MCP session: ${id}`);
            },
            onsessionclosed: (id) => {
              sessions.delete(id);
              logFunc2(`MCP session closed: ${id}`);
            }
          });
          const mcpServer = createConfiguredServer(serverFactoryOpts);
          await mcpServer.connect(transport);
          const response = await transport.handleRequest(req, { authInfo });
          for (const [k, v] of Object.entries(corsHeaders)) {
            if (!response.headers.has(k))
              response.headers.set(k, v);
          }
          return response;
        }
        return new Response("Not Found", { status: 404 });
      },
      error(error2) {
        logFunc2(`Bun server error: ${error2}
${error2.stack}`);
        return new Response("Internal Server Error", { status: 500 });
      }
    });
    logFunc2(`Bun server listening on http://localhost:${port}`);
    logFunc2("  MCP Endpoint: /mcp (Streamable HTTP)");
    logFunc2("  OAuth Discovery: /.well-known/oauth-protected-resource");
  }
}
main().catch((error2) => {
  logFunc2(`\x1B[31mFATAL: Server initialization failed: ${error2}\x1B[0m`);
  if (error2 instanceof Error && error2.stack) {
    logFunc2(error2.stack);
  }
  process.exit(1);
});
export {
  server
};

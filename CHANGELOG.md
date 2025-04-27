# BSV MCP Server Changelog

## v0.0.36 - A2B Overlay Integration & Improved MCP Server Publishing

### Features
- **A2B Overlay Integration**: Implemented a robust connection to the A2B Overlay API
  - Updated `a2b_discover` tool to search for on-chain MCP servers and agents
  - Enhanced search capabilities with relevance-based result ranking
  - User-friendly formatted output with command suggestions
  - Support for filtering by type (agent/tool/all), block range, and free text search
- **Improved MCP Server Publishing**: Enhanced the wallet_a2bPublishMcp tool
  - Better identity key integration via LocalSigner
  - More robust configuration for sigma signing
  - Improved transaction handling and error reporting

### Technical Improvements
- Updated API endpoint to use production overlay service
- Implemented enhanced search for better relevance scoring
- Better error handling for API responses
- Improved response formatting for readability
- Updated type definitions for consistency

## v0.0.34 - Transaction Broadcast Control

### Features
- Added `DISABLE_BROADCASTING` environment variable to control transaction broadcasting behavior
  - When set to "true", transactions are created but not broadcast to the network
  - Returns raw transaction hex instead of broadcasting, useful for testing and review
- Code cleanup and organization improvements

## v0.0.33 - Identity Key Sigma Signing

### Features
- Added optional `IDENTITY_KEY_WIF` environment variable for sigma-protocol signing.
-  `wallet_createOrdinals`, and `wallet_purchaseListing` tools now support signing with an identity key.
- Updated `README.md` to document `IDENTITY_KEY_WIF` usage and JSON configuration examples.

## v0.0.32 - Reliability Improvements

### Bug Fixes
- **Changelog Loading**: Improved changelog loading mechanism with multiple path resolution strategies
  - Added detailed logging for debugging path resolution issues
  - Better error reporting for troubleshooting in production environments
- **Package Structure**: Enhanced package.json to include all necessary files in npm package 
  - Added prompts, resources, and CHANGELOG.md to the published files list
  - Fixed import issues when running from installed npm package

## v0.0.29 - Enhanced Server Configuration & Maintenance

### Major Changes
- **Improved Changelog Management**: Added changelog as a MCP resource so you can just ask what has changed between versions
  - Simplified maintenance with single source of truth for version history
  - Automatic updates to MCP resources when changelog is modified
- **Expanded Component Configuration**: Can now configure which components of the MCP are loaded by setting env vars. See the readme for more information.

### Technical Improvements
- Removed duplicate changelog content in code
- Better error handling for resource loading
- Code cleanup and organization improvements

## v0.0.25 - Improved Error Handling & Optional Private Key

### Major Changes
- **Optional Private Key**: Server now starts without a PRIVATE_KEY_WIF environment variable
  - Educational resources and non-wallet tools remain available in limited mode
  - Wallet and MNEE tools gracefully fail with helpful error messages when no private key is provided
- **Component Configuration**: Added environment variables to enable/disable specific components
  - Selectively enable/disable prompts, resources, or tools
  - Fine-grained control over which tool categories are loaded
- **MNEE Token Support**: Added dedicated tools for MNEE token operations
  - Get balance, send tokens, and parse transactions
- **Enhanced Documentation**: Added detailed prompt examples and improved troubleshooting guidance
- **Resource Improvements**: Added BRC specifications and other reference materials

### Technical Improvements
- Improved error handling throughout the codebase
- Better initialization process for wallet component
- Standardized error messages across tools
- Expanded README with installation instructions for different platforms
- Added npm alternatives to Bun commands
- Added modular loading with configurable components

## v0.0.24 - Initial Public Release

### Features
- Bitcoin SV wallet operations (send, receive, manage keys)
- Ordinals creation and management
- BSV blockchain interaction (transactions, blocks, addresses)
- Cryptographic operations (signing, verification, encryption)
- Educational prompts for BSV SDK and Ordinals

### Toolkit Overview
- Wallet tools for core BSV operations
- Ordinals tools for NFT functionality
- BSV tools for blockchain interaction
- MNEE token tools
- Utility tools for data conversion 
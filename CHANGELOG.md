# BSV MCP Server Changelog

## [Unreleased]

### Fixed
- Fixed character encoding issues with emojis in console output
  - Replaced emoji characters with ASCII alternatives to prevent encoding issues
  - Added UTF-8 meta tag to HTML passphrase prompt

### Added
- Dynamic passphrase prompting system via web browser
- Secure key encryption with bitcoin-backup integration
- CloudFlare hosted frontend with enhanced onboarding
  - Tabbed interface for different deployment modes
  - Copy buttons for all configuration options
- Agent Master CLI integration tool

### Changed
- Improved key management with automatic encryption prompts
- Enhanced CloudFlare frontend UX

## [0.1.0] - 2025-01-20

### Security
- **BREAKING**: Removed `BSV_MCP_PASSPHRASE` environment variable (major security fix)
  - Passphrases are no longer stored in environment variables
  - System now prompts for passphrases dynamically when needed
  - Added web-based passphrase prompt for better UX
  - Migration script updated to work with new system

### Added
- **Dynamic Passphrase Prompting**: Secure passphrase entry via temporary web interface
  - Opens browser window for passphrase entry
  - Automatically closes after submission
  - Supports both new passphrase creation and unlocking
  - Timeout protection (5 minutes default)
  
- **Agent Master CLI Integration**: New tool for installing Agent Master CLI
  - `utils_installAgentMaster`: Installs the Agent Master CLI tool for managing MCP server configurations
  - Supports installation via Go or provides manual installation instructions
  - Helps users manage MCP servers across multiple platforms (Claude, VS Code, Cursor, etc.)
  - Repository: github.com/b-open-io/agent-master-cli

### Changed
- Key encryption now happens automatically on first run if keys are unencrypted
- Updated migration script to use dynamic prompting instead of env vars
- Improved security warnings and user guidance throughout the system
- Default `BSV_MCP_AUTO_MIGRATE` changed to `true`
- **Social Posts**: Create and read social posts on the BSV blockchain
  - `bsv_createPost`: Post text or markdown content using B:// and MAP protocols with AIP signing
  - `bsv_readPosts`: Read posts from the blockchain with filtering by author, txid, or recent posts
  - Permanent, uncensorable social content stored directly on-chain
  - Support for plain text and markdown content types
  - Integration with BSocial API for reading posts
- **Collection Minter**: Two-step process for minting ordinal collections from folders
  - `wallet_gatherCollectionInfo`: Analyzes folder contents, validates images, checks wallet balance, and estimates costs
  - `wallet_mintCollection`: Creates collection inscription and mints all items with proper metadata
  - Supports traits distribution, rarity labels, and automatic metadata generation
  - Validates images and provides detailed cost estimates before minting
  - Better error handling with pre-flight checks to minimize failures

- **Encrypted Key Storage**: Integration with bitcoin-backup for secure key management
  - AES-256-GCM encryption with 600,000 PBKDF2 iterations
  - Automatic migration from unencrypted to encrypted format
  - Backward compatibility with legacy JSON storage
  - Secure key backup management
  - New environment variable: `BSV_MCP_PASSPHRASE`
  - Migration script: `scripts/migrate-keys.ts`

### Changed
- Server name and version now imported from package.json
- Improved error handling with standardized error types
- Better code organization with new utility modules

## v0.1.0 - Droplet API Integration & Claude Code CLI Support

### Major Features
- **Droplet API Integration**: Added support for running without local keys using Droplet faucet API
  - New `IntegratedWallet` class supports both local and remote wallet modes
  - BSM (Bitcoin Signed Message) authentication for Droplet API communication
  - Environment variable configuration: `USE_DROPLET_API`, `DROPLET_API_URL`, `DROPLET_FAUCET_NAME`
  - Automatic faucet funding and transaction broadcasting through Droplet service
- **Claude Code CLI Compatibility**: Fixed stdio transport configuration for seamless Claude Code integration
  - Updated smithery.yaml configuration for proper MCP CLI operation
  - Enhanced testing and debugging workflows with Claude CLI

### Technical Improvements
- Created `DropletClient` class for robust API communication with go-faucet-api
- Added comprehensive error handling and validation for Droplet operations
- Enhanced documentation with testing instructions and troubleshooting guides
- Improved dual-mode wallet architecture maintaining backward compatibility
- Updated development documentation with detailed testing workflows

### Environment Variables
- `USE_DROPLET_API`: Enable Droplet API mode (default: false)
- `DROPLET_API_URL`: Droplet service endpoint (default: http://localhost:4000)
- `DROPLET_FAUCET_NAME`: Faucet name for API operations (required in Droplet mode)
- `TRANSPORT`: MCP transport mode (stdio/http) for Claude Code compatibility

## v0.0.37 - Resource Updates
- Added AIP protocol docs
- Added 1Sat Ordinals docs

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
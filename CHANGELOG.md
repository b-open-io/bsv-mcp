# BSV MCP Server Changelog

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
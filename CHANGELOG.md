# BSV MCP Server Changelog

## [0.6.1] - 2026-09-09

### Changed

- Consume published `bitcoin-backup@0.2.0` and `@opl.dev/vault@0.0.2` instead of
  `file:` checkouts. Unpin zod from `overrides` and take `zod@^4.6.1`.
- Raise `@1sat/actions` to `^0.0.208` and `@modelcontextprotocol/ext-apps` to
  `^2.0.0`. Refresh React 19.3 and related UI types.
- Import leftover plaintext key sources into Vault, then optionally erase the
  source files. Passphrase policy is enforced before Vault create or unlock.
- Stop tracking generated `dist/` in git. Work from source (`bun index.ts`).
  `prepack` and `pack:release` still build and ship `dist/` in the npm package.

### Fixed

- Keep MNEE tools off in context-only external-wallet catalogs.
- Accept a test Vault passphrase that meets the strength policy.

## [0.6.0] - 2026-09-09

### Changed

- Consolidate social tools into `bsocial_read` and `bsocial_publish` in both tool
  profiles. Replace `bsocial_readPosts`, `bsocial_createPost`, `bmap_readPosts`,
  `bmap_readLikes`, `bmap_readFollows`, and `bap_friend`; clients must refresh tools.
- Add canonical social actions, replies, reactions, relationships, messages,
  media, tags, and unsigned previews with one shared schema and signing path.
- Document action-specific inputs and BMAP backend configuration. Messages are
  public records; publishing does not encrypt them.

### Fixed

- Use social API routes and retain structured indexer records without claiming
  independent signature verification or derived relationship state.
- Sign legacy social records with an explicit identity key, fund with the payment
  key, estimate unsigned transaction fees, and report broadcast failures.

## [0.5.1] - 2026-09-08

### Changed

- Start local stdio when no transport is specified, with early stdout guards in
  both source and bundled entry points. Explicit `TRANSPORT=http` retains the
  existing HTTP server; the deployed hosted endpoint and OAuth routes are unchanged.
- Run the Codex plugin through the local npm executable instead of hosted MCP.
  The executable requires Bun; the npx installer also requires Node.js.
- Direct homepage tool links to a generated reference with 106 full tools and six
  compact families, category navigation, search, individual URLs and Markdown.
- Generate tool schemas and registration availability across isolated wallet
  configurations, preserving schema variants and conditional payment tools.
- Separate task examples from the tool reference and document wallet and backend
  settings in tables. Local installation needs no account sign-in.

### Fixed

- Reject invalid transport values before wallet initialization.
- Honor reduced-motion preferences while scrolling between homepage sections.

## [0.5.0] - 2026-09-08

### Added

- Build release tarballs with a separate consumer manifest so Bun installs
  do not try to resolve checkout-only wallet patches.

- Use separate identity and ordinals wallets for SIGMA-signed inscriptions
  through the existing 1Sat SDK local pipeline.

- Select existing private/WIF Vault entries and link them to local accounts
  without modifying the encrypted Vault.

- Import multiple wallets into one Vault and choose global payment, identity,
  and ordinals keys, with independent overrides in native project MCP settings.

- Create, import, and unlock an embedded wallet through private local browser
  setup. Activation refreshes the connected MCP session immediately; the ready
  screen shows a compact, animated tool collage from its enabled catalog, with
  pause controls and reduced-motion support.
- Receive selected PeerPay payments with `wallet_peerPayments` (or the compact
  `wallet_payments` family). Wallet acceptance precedes acknowledgement;
  automatic MessageBox service-fee spending is refused. Availability is limited
  to eligible embedded wallets.
- Discover skill metadata and links with `utils_find_skills`, using a bounded,
  cached remote index without installing or fetching skill contents.
- Preflight the published BAP identity before Sigma inscription signing when
  `wallet_createOrdinals` requests `signWithBAP`.

### Changed

- Read every default-basket output page when calculating wallet balance,
  and refuse partial totals when pagination is inconsistent.

- Supply a non-administrator MCP originator for local SDK calls that omit it,
  preserving spending approval while allowing key and signing operations.

- Restrict the hosted Next.js MCP route to public reads, regardless of key
  environment variables, and answer unauthenticated CORS preflight at both
  the root endpoint and `/api/mcp`.
- Discover custom wallet locations only from explicit local settings.

- Retire static tutorial prompts and BRC/BitCom resource entries. Changelog,
  JungleBus, and MCP App resources remain available.
- Produce consistent production bundles regardless of the caller’s
  `NODE_ENV`, and remove stale local UI build assets from packaged output.

- Migrate the server/client/core boundaries and the surrounding server
  lifecycle, stdio transport, hosted adapter, request routing, and
  prompt/resource registrations to the split MCP TypeScript SDK v2 packages.
- Make protocol `2026-07-28` primary across stdio, local HTTP, and hosted HTTP.
  Accept supported 2025 clients automatically; `MCP_LEGACY_COMPATIBILITY=false`
  explicitly requires modern clients.
- Execute modern approval-dependent tools through request-scoped continuations
  bound to the original operation, authenticated principal, arguments, and expiry.
  Cancellation and revocation reject pending approvals; replay cannot re-execute
  the callback. Legacy approvals also remain scoped to their requesting client.
- Open all configured project roles, including BRC-42 child and BRC-157/Yours
  profile derivations. Isolate child-key storage and preserve selected root
  databases and deposit prefixes.
- Support external per-role signer endpoints, identity pins, and project-specific
  permission origins without local key loading.
- Expose BRC-100 BAP publication, rotation, attestations, profiles, and signed
  BSocial posts through the selected identity wallet.
- Preserve ordinal outputs and token amounts in browser-signed dashboard sweeps.
  Verify source transactions and signatures, bind preparation to the user and
  wallet, and reject duplicate submission. Read all dashboard balance pages.
- Keep `@modelcontextprotocol/sdk` v1 in the staged dependency graph because
  `@modelcontextprotocol/ext-apps` 1.7.5 still declares it as a peer. A local
  MCP Apps adapter calls native SDK v2 `registerTool` and `registerResource`,
  preserving v2 schema conversion and request validation. ext-apps remains for
  shared constants and its browser `App` implementation; this does not make
  ext-apps itself v2-native.
- Keep the full tool catalog as the default and capability-derived. Add an
  explicit `MCP_TOOL_CATALOG=compact` opt-in profile for bounded read families;
  local compact catalog and routing tests pass; hosted and browser-host
  validation remain separate release gates.

### Compatibility

- The catalog is capability-derived. The checked-in manifest is a synthetic
  baseline for one configured server, while wallet mode, enabled modules,
  account context, and the selected profile determine actual tool exposure.
  Compact mode is an explicit opt-in.
- Modern protocol tests cover stdio and authenticated HTTP, approval accept,
  decline, cancellation, expiry, replay, external signer HTTP crypto, and
  project-role derivations. Installed clients that only negotiate 2025 connect through default legacy
  compatibility; their success is not modern acceptance.
- The hosted route remains public-read-only. Browser-host MCP Apps integration
  and deployed traffic require validation in their actual host environments.

See [MCP client protocol support](docs/mcp-client-protocol-support.md) for
endpoint contracts and the distinction between protocol and host validation.

## [0.4.0] - 2026-09-07

### Breaking changes
- Missing or invalid local keys now stop startup. Initialize an encrypted named account or configure an external signer; legacy plaintext files require explicit migration.
- Account passwords use `BSV_MCP_PASSWORD`. New keys are never saved as plaintext.

### Added
- Generic `x402_request` and `x402_payQuote` tools for BSV services, with quote approval, a total spending limit and protection against duplicate payment attempts.
- Named encrypted accounts, account management tools and terminal commands, migration with SQLite snapshots, and a local `signer-serve` wrapper.
- Server status and 1Sat capability checks, website documentation and a live GitHub star count.

### Changed
- Use configurable 1Sat services for marketplace and inscription reads. Default the mainnet explorer to BananaBlocks, with a vendor-neutral `EXPLORER_API_URL` setting.
- Keep per-service x402 credentials optional and scoped to their HTTPS origin.
- Move setup and workflow details out of the README and into the documentation. Link BRC references to Beersy.
- Align wallet dependencies with the 1Sat CLI runtime and isolate each account's database.

### Security
- Remove startup key generation, plaintext fallback and plaintext identity-key writes. Secret import stays in a local terminal or encrypted backup.
- Keep signer credentials out of the MCP child environment. Require human approval for account changes and signer transaction requests.
- Register the tool manifest with an in-memory test wallet, without touching real keys or wallet storage.

## [0.3.4] - 2026-09-06

### Added
- Discover owner-listed Droplit sponsors without a wallet or preselected faucet.
- Validate public responses and pagination; discovery never authorizes access or payment.


## [0.3.3] - 2026-09-06

### Fixed
- Honor `DROPLIT_SITE_URL` for sponsor approval links so staging requests reach the correct owner UI.
- Build approval links from the configured sponsor and verified wallet identity; reject unsafe site origins.

## [0.3.2] - 2026-09-06

### Added
- Reveal a human-issued Sigma delegation with the connected agent wallet, using standard certificate acquisition and proof.
- Reject redirects, automatic payments, and ambiguous mutation retries; submit only verifier-specific keys.

## [0.3.1] - 2026-09-05

### Added
- Connect an existing BRC-100 HTTP signer without loading local private keys or provisioning wallet storage.
- Inspect sponsor access and submit sponsored push/fund operations with the connected signer.

### Fixed
- Preserve wallet permission arguments through MCP schemas.
- Block automatic HTTP payment during sponsor authentication and avoid ambiguous write retries.
- Preserve explicitly requested satoshi amounts in legacy Droplit taps.

## [0.3.0] - 2026-07-30

### Breaking Changes

- **Spending now requires approval.** `WalletPermissionsManager` was constructed
  with `seekSpendingPermissions: false`, so no spend was ever gated. It is armed,
  and a handler is bound to `onSpendingAuthorizationRequested`. Clients that
  support elicitation prompt the user with the exact satoshi amount and itemised
  line items; approval grants that amount ephemerally. **On a client without
  elicitation support, spends are denied.** The refusal names the amount and the
  reason. This is deliberate — a confirmation gate that silently passes when the
  client cannot be asked is not a gate.
- `wallet_setupDroplit` is replaced by three tools —
  `wallet_registerDroplitKey`, `wallet_createDroplitFaucet`, and
  `wallet_checkDroplitFaucetStatus`. It had put three unrelated operations behind
  an `action` enum, which made every argument conditional.
- `wallet_purchaseListing` no longer accepts `description`. The underlying
  purchase actions have no parameter for it, so it was advertised and discarded.

### Security

- **`DISABLE_BROADCASTING` did nothing for the tools that move money.** The
  startup banner printed `Broadcasting: Disabled` while the flag reached only the
  BAP tools; `wallet_sendBsv`, `sendAllBsv`, the three sweeps, `purchaseListing`
  and `sendMnee` never received it. Setting the variable, reading "Disabled", and
  calling `wallet_sendBsv` moved real money. Sixteen transaction-submitting tools
  now assert through one guard that reads the same environment variable the
  banner reads.
- **WIF redaction covered one of three exit paths.** The sweep tools each defined
  a sanitizer commented "sanitize WIF from any error output" and applied it only
  in the `catch`. The `result.error` branch and the serialised success payload
  both returned raw, on tools that take a raw WIF as an argument. One shared
  redactor now covers all three exits in all three tools, and additionally
  catches testnet WIFs and xprvs.
- The admin originator was the package name, `bsv-mcp` — the exact string a
  caller reaches for when a parameter named `originator` wants a value. Passing
  it would have bypassed the spending gate while the configuration reported it
  armed.
- Two identity-key paths caught an invalid WIF, logged a warning, and continued
  unsigned. Both now fail.

### Added

- Audit log at `~/.bsv-mcp/audit.log` (JSON Lines, directory `0700`, file
  `0600`), routed through the key redactor. A failed write reports to stderr and
  does not break a payment the user already approved.
- Amount validation on the money-moving tools. `sendBsv`, `sendMnee`, `lockBsv`
  and `listOrdinal` took a bare `z.number()`, so negative, zero and NaN amounts
  reached the SDK; a negative USD amount converted to a negative satoshi count.

### Fixed

- `wallet_createOrdinals` accepted `destinationAddress` and never forwarded it,
  so an ordinal minted to a named address silently locked to a wallet-derived
  self key.
- Droplit authentication was hand-rolled and could never have succeeded. It is
  now BRC-103/104 via `AuthFetch`, verified against the live service.
- Five packages the code imports were never declared, `zod` among them, so a
  clean install of the published package could not resolve them.
- The stdio guard was dead code. Its replacement is a first-position side-effect
  import, since ES imports evaluate before any top-level statement.
- `purchaseListing`'s marketplace-rate arithmetic is a pure function, so a fee
  bug can be told apart from an execution bug.

### Changed

- Core SDKs to current: `@modelcontextprotocol/sdk` 1.27.1 → 1.29.0,
  `@modelcontextprotocol/ext-apps` 1.2.0 → 1.7.5, `@1sat/actions` 0.0.41 →
  0.0.192, `@bsv/sdk` 2.0.6 → 2.2.0, `bsv-bap` 0.1.23 → 0.3.4.
- `Droplet` is spelled `Droplit` throughout, matching droplit.dev. Environment
  variables are now `DROPLIT_API_URL` and `DROPLIT_FAUCET_NAME`.
- Test coverage 15 → 45.

## [0.2.15] - 2026-03-10

### Fixed
- Dashboard wallet tab now uses BRC-100 context (same as direct tools) for address and balance
- `app_wallet_data` was returning raw P2PKH address instead of BRC-29 derived deposit address
- Client-side error handling: wallet errors now display properly instead of rendering empty/zero data

## [0.2.12] - 2026-03-10

### Changed
- Redesigned MCP App dashboard with new dark theme, segmented pill tabs, wallet/explorer/ordinals views
- Explorer view: search bar, stat cards (block height, price, difficulty, best block), recent blocks table
- Wallet view: large monospace balance, info pill with sats/USD/UTXOs, address row, UTXO table
- Ordinals view: collection grid with image previews, listed badges, mint button

## [0.2.11] - 2026-03-10

### Added
- Cloudflare Worker deployment (`cloudflare/`) with Droplit API integration and OAuth 2.1 via sigma-auth
- `createConfiguredServer()` factory for per-session McpServer instances

### Changed
- Replaced `BunSSEServerTransport` with `WebStandardStreamableHTTPServerTransport` (MCP 2025-03-26 Streamable HTTP spec)
- Single `/mcp` endpoint replaces old `/sse` + `/messages` pattern
- Migrated ordinals tools from GorillaPool to 1sat-stack

### Fixed
- Per-session server bug where `server.connect(transport)` replaced previous transport (only latest session worked)
- `bap_generate` test assertion to match current `server.tool()` API shape

## [0.2.7] - 2026-03-09

### Added
- BRC-100 wallet integration via `@1sat/actions` for standardized wallet operations
- MCP App views: tool results now include a `viewUUID` field so MCP App clients can render interactive dashboard tabs (Explorer, Wallet, Ordinals)

### Changed
- Inline stdio guard in index.ts — no more `--preload` flag needed
- Simplified build script — uses `--banner` instead of post-build injection
- Consolidated bundle output to `dist/index.js` (removed `build/server.js`)
- Clean `start.sh` — just `bun run index.ts --stdio` for local dev

### Fixed
- Flattened tool schemas for Claude Desktop compatibility
- Fixed stdio transport stdout pollution via console redirect guard
- Fixed transport mode detection

## [0.2.0] - 2026-03-09

### Breaking Changes
- **@bsv/sdk upgraded from v1 to v2** - All Buffer usage replaced with SDK Utils
- **SecureKeyManager no longer auto-prompts** - No browser popups on server startup
  - `loadKeys(passphrase?)` accepts optional passphrase; skips .bep silently without one
  - `saveKeys(keys, opts?)` saves unencrypted by default; encryption is opt-in
  - Removed `autoMigrate` and `keepLegacy` config options

### Changed
- Updated 27+ dependencies (biome v2, zod 4.x, MCP SDK 1.27, next 16.1)
- All `Buffer.from()`/`.toString()` replaced with `Utils.toArray()`/`toBase64()`/`toHex()`
- All `console.log` replaced with `console.error` for MCP stdio transport safety
- Dynamic imports replaced with static imports
- tsconfig target ES2017 to ES2022
- Biome migrated to v2 schema with CSS exclusions
- `@types/node` and `bun` moved to devDependencies
- `export default` replaced with named exports

### Removed
- Dead code: `tools/a2b/call.ts`, unused HD import, redundant default exports
- `.next` directory removed from git tracking
- `promptForPassphraseWithFallback` removed from keyManager (kept in passphrasePrompt.ts for future CLI use)

### Fixed
- 3 failing BAP generate tests (proper SecureKeyManager mocking)
- BigblocksAuthProvider updated for renamed bigblocks exports
- Encrypted key storage preserved but no longer blocks server startup

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

## v0.1.0 - Droplit API Integration & Claude Code CLI Support

### Major Features
- **Droplit API Integration**: Added support for running without local keys using Droplit faucet API
  - New `IntegratedWallet` class supports both local and remote wallet modes
  - BSM (Bitcoin Signed Message) authentication for Droplit API communication
  - Environment variable configuration: `USE_DROPLIT_API`, `DROPLIT_API_URL`, `DROPLIT_FAUCET_NAME`
  - Automatic faucet funding and transaction broadcasting through Droplit service
- **Claude Code CLI Compatibility**: Fixed stdio transport configuration for seamless Claude Code integration
  - Updated smithery.yaml configuration for proper MCP CLI operation
  - Enhanced testing and debugging workflows with Claude CLI

### Technical Improvements
- Created `DroplitClient` class for robust API communication with go-faucet-api
- Added comprehensive error handling and validation for Droplit operations
- Enhanced documentation with testing instructions and troubleshooting guides
- Improved dual-mode wallet architecture maintaining backward compatibility
- Updated development documentation with detailed testing workflows

### Environment Variables
- `USE_DROPLIT_API`: Enable Droplit API mode (default: false)
- `DROPLIT_API_URL`: Droplit service endpoint (default: http://localhost:4000)
- `DROPLIT_FAUCET_NAME`: Faucet name for API operations (required in Droplit mode)
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

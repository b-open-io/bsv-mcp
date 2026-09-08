# CLAUDE.md

Contributor guidance for the BSV MCP repository.

## Project overview

BSV MCP is an open-source Model Context Protocol server for Bitcoin SV. It
contains the published MCP package and the Next.js site that documents and hosts
the remote MCP endpoint.

The supported deployment modes are:

1. **Local stdio**: an AI client launches `bunx bsv-mcp@latest --stdio` on the
   user’s computer. Wallet keys stay local or the client connects to an external
   BRC-100 signer. Sigma Auth is not involved.
2. **Self-hosted HTTP**: the package can run its Streamable HTTP server with
   `TRANSPORT=http`.
3. **Hosted Vercel site**: the Next.js app serves `https://bsvmcp.com` and its
   protected MCP endpoint. Sigma Auth is a separate, generic OAuth authorization
   server. It authenticates the account and issues a token; it does not hold
   wallet keys or become BSV MCP.

The retired Cloudflare worker and OpenNext configuration were removed. Do not
reintroduce a Cloudflare deployment path unless the product owner explicitly
requests one.

## Essential commands

```sh
bun install
bun test
bun run lint
bun run build:all       # Vite MCP app, then the published server bundle
bun run build:next      # Next.js site
bun run dev             # Next.js site locally
bun dist/index.js --stdio
```

The package version is defined in `package.json`. The published package includes
the built `dist/` bundle, README, changelog, license, and Smithery manifest.

For a local MCP connection:

```sh
bunx bsv-mcp@latest --stdio
```

The server must never write protocol data to stdout in stdio mode. Keep the
stdio guard as the first loaded module and send diagnostics to stderr.

## Repository layout

- `index.ts`, `server.ts`: package entrypoint and MCP server factory.
- `tools/`: BSV, wallet, ordinals, BAP, BSocial, MNEE, x402, and utility tools.
- `utils/`: key management, wallet initialization, backend configuration, signing,
  redaction, spending approval, and protocol helpers.
- `app/`, `components/`, `lib/`: Next.js site, hosted MCP route, OAuth
  protected-resource metadata, documentation, and landing page.
- `prompts/`, `resources/`: MCP prompts and BRC/protocol resources.
- `src/views/`: the Vite-built MCP App dashboard bundled into `dist/app.html`.
- `scripts/`: package build and tool-manifest generation.
- `docs/`: focused technical documentation. The website is the human-facing
  documentation source.
- `skills/bsv-mcp/SKILL.md`: the package skill used by supported clients.

## OAuth boundary

Sigma Auth is generic. Never add `bsvmcp.com`, BSV MCP tool names, wallet
configuration, or BSV-specific defaults to the Sigma Auth product.

For the hosted flow:

1. BSV MCP publishes OAuth protected-resource metadata and names Sigma as an
   authorization server.
2. The MCP client discovers Sigma’s authorization endpoints and authenticates the
   user there.
3. Sigma issues a short-lived token for the BSV MCP resource.
4. BSV MCP validates the token’s signature, issuer, audience, expiry, and subject.

The token only proves account authentication and consent to call the hosted
resource. It does not connect a wallet on the user’s computer, derive a private
key, approve a payment, or unlock a user-specific tool set. Tool availability is
controlled by the BSV MCP deployment configuration. Do not infer wallet authority
from an OAuth subject or scope.

When changing hosted OAuth behavior, read the current MCP authorization
specification and Better Auth MCP guidance first. Verify the complete client flow,
not just a discovery endpoint or an empty DCR request.

## Wallet and key safety

- Never generate keys silently during startup.
- New accounts live under `~/.bsv-mcp/accounts/<name>/` with encrypted
  `keys.bep`, `config.json`, and the network-specific wallet database.
- `BSV_MCP_ACCOUNT` selects the account and `BSV_MCP_PASSWORD` unlocks it in
  the server process. `PRIVATE_KEY_WIF` is an explicit override.
- Existing wallets should use `BRC100_WALLET_URL`; the wallet controls its keys
  and approval policy.
- Keep WIFs, mnemonics, OAuth secrets, bearer tokens, and database credentials
  out of logs, tests, fixtures, commits, and chat.
- Wallet mutations and broadcasts must respect `DISABLE_BROADCASTING` and the
  existing spending-approval flow.
- Use the redaction helpers for errors and tool responses that may contain key
  material.
- Do not create wallet directories outside `~/.bsv-mcp` without an explicit
  design decision.

See `docs/keys.md` and `docs/external-signer.md` before changing custody or
migration code.

## Backend configuration

The default 1Sat service is `https://api.1sat.app` on mainnet and
`https://testnet.api.1sat.app` on testnet. `ONESAT_API_URL` selects a
compatible deployment. Explorer, JungleBus, ordinals, content, sponsorship,
and remote wallet storage settings are separate.

Use `utils/backends.ts` as the source of truth for backend defaults. Do not
silently fall back between providers when a configured service fails.

## Tool conventions

- Validate every tool input with Zod.
- Register tools through the category registration functions in `tools/`.
- Keep tool names stable and prefixed by category.
- Return actionable, sanitized errors.
- Treat writes, payments, inscriptions, and broadcasts as non-idempotent unless
  the tool explicitly proves otherwise.
- Support both local-wallet and external-signer modes where the tool needs a
  wallet. Do not add a new wallet mode for a single feature.
- Update `lib/tool-manifest.json` through
  `bun run tools:manifest` when registration changes.
- Keep documentation in `lib/docs.ts` and generated Markdown aligned.

## Testing

Run the smallest relevant test first, then the full suite for changes that cross
module boundaries:

```sh
bun test
bun run lint
```

Tests may create random in-memory keys. They must not write real key material or
use a funded wallet. Network tests should use local request handlers or explicit
read-only public endpoints.

When changing hosted MCP behavior, test:

- RFC 9728 protected-resource metadata;
- OAuth challenge and audience validation;
- MCP initialize and tool discovery;
- unauthenticated and malformed credentials;
- walletless and external-signer startup paths.

## Maintenance rules

- Prefer deleting retired deployment code and contradictory documentation over
  preserving compatibility that no longer has a supported consumer.
- Use Knip as a report, not an automatic delete list. Configure real entrypoints
  before acting on unused-file or unused-export findings; MCP registration,
  Next.js routing, Vite HTML entries, and tests are often discovered dynamically.
- Keep historical release notes in `CHANGELOG.md`, even when the implementation
  they describe has been retired.
- Before deleting a branch, directory, or generated artifact, check for
  uncommitted or unpushed work and verify that no deployment references it.
- Make focused commits with tests and describe any production or protocol impact.

## Current documentation

- Human docs and hosted onboarding: `https://bsvmcp.com/docs` and
  `https://bsvmcp.com/connect`.
- Wallet custody: `docs/keys.md`, `docs/external-signer.md`.
- BSV MCP system design: `docs/system-design.svg`.
- Sigma/Auth boundary handoff: `docs/sigma-auth-handoff.md`.

# CLAUDE.md

Contributor guidance for the BSV MCP repository.

## Project overview

BSV MCP is an open-source Model Context Protocol server for Bitcoin SV. It
contains the published MCP package and the Next.js site that documents and hosts
the remote MCP endpoint.

## Current product decisions — September 8, 2026

These decisions supersede older OAuth and architecture proposals.

- Local stdio MCP is the default and active product. It requires no Sigma sign-in.
- Keep existing MCP HTTP transport opt-in and leave the deployed endpoint unchanged. Do not retire either as part of local installation or documentation work.
- Hosted MCP, its authorization server, and HTTP spending approval are deferred.
  Existing HTTP code is legacy implementation, not an instruction to finish it.
- Sigma Connect is optional and requires explicit user consent. It is separate
  from MCP authentication and from the wallet. Do not change Sigma Auth or its
  database to make BSV MCP work.
- A future hosted authorization server would belong to bsvmcp.com itself.
  This is a deferred direction, not an active implementation task.
- Local browser setup, an external wallet's signing API, and 1Sat service calls
  may use HTTP. They do not make BSV MCP a remotely hosted MCP product.
- Local signing keys live in Vault. Plaintext WIFs in env files or MCP client
  config are import sources to remove after a verified Vault import, not a
  supported runtime.
- The latest user decisions govern. Internal WORKLIST and the recent Sigma
  handoff are supporting references; old checkboxes are not authorization.

The website and legacy HTTP routes still contain contradictions with these
choices. Correct them through the current reconciliation plan; do not treat
passing tests or deployed behavior as proof of the intended product scope.

The retired Cloudflare worker and OpenNext configuration were removed. Do not
reintroduce a Cloudflare deployment path unless the product owner explicitly
requests one.

## Essential commands

```sh
bun install
bun test
bun run lint
bun index.ts --stdio    # work from source
bun run build:all       # npm bundle under dist/ (gitignored; built by prepack)
bun run build:next      # Next.js site
bun run dev             # Next.js site locally
```

The package version is defined in `package.json`. Git tracks source. The
published npm package includes the built `dist/` bundle via `"files"` and
`prepack` / `pack:release`, plus README, changelog, license, and Smithery
manifest.

For a local MCP connection to the published package:

```sh
bunx bsv-mcp@latest --stdio
```

The server must write only protocol data to stdout in stdio mode. Keep the
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

## Authentication and transport boundary

The supported local stdio flow is: AI client → local BSV MCP → an unlocked
local Vault wallet or an explicitly connected external BRC-100 wallet. No
OAuth account is required to start or use that local connection.

A web page or loopback signing API is not a hosted MCP endpoint. Preserve
those local capabilities when isolating legacy HTTP transport code.

OAuth tokens never grant wallet authority, select signing keys, or approve a
payment. Do not expand hosted auth, modify Sigma, or add remote spending as
part of local onboarding, docs, packaging, or protocol compatibility work.

## Wallet and key safety

- Never generate keys silently during startup.
- Local signing keys belong in the encrypted Vault at `VAULT_PATH` or
  `~/.bsv/vault.bep`. Account metadata and wallet databases live under
  `~/.bsv-mcp/accounts/<name>/`. `config.json` may store a public
  `vaultBinding`; it never stores a password or private key.
- `wallet_onboarding` is the supported create, import, and unlock path. The
  Vault password is entered in a private loopback browser. Do not collect it in
  chat, MCP tool arguments, command lines, or saved MCP configuration.
- New Vault files use Argon2id (64 MiB, t=3, p=1) for the recovery passphrase
  slot. On Apple silicon Macs, create also wraps a Secure Enclave / Touch ID
  slot when the helper is available. The passphrase remains the recovery wrap;
  do not create an enclave-only Vault.
- Vault passwords must be at least 12 characters, or 16+ as a passphrase.
  Do not trim passwords. Common passwords are rejected.
- `BSV_MCP_ACCOUNT` selects the account. `BSV_MCP_PASSWORD` is only for
  headless agents (CI, cloud, no display). It must live in the process
  environment for that session, never in MCP client config, argv, or git.
  Interactive Mac use should unlock in the browser (and Enclave when present).
- `PRIVATE_KEY_WIF` and `IDENTITY_KEY_WIF` are migration sources, not live
  signing keys. Detected env and MCP-client WIFs must be imported into Vault
  through local setup, then the plaintext copy should be erased when the user
  confirms. Do not treat them as an override.
- Existing wallets should use `BRC100_WALLET_URL`; the wallet controls its keys
  and approval policy.
- Keep WIFs, mnemonics, OAuth secrets, bearer tokens, and database credentials
  out of logs, tests, fixtures, commits, and chat.
- Wallet mutations and broadcasts must respect `DISABLE_BROADCASTING` and the
  existing spending-approval flow.
- Use the redaction helpers for errors and tool responses that may contain key
  material.
- Do not create wallet directories outside `~/.bsv-mcp` without an explicit
  design decision. The Vault file at `~/.bsv/vault.bep` is the existing
  exception.

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
- Current worklist: `internal/planning/WORKLIST.md` (local, Git-ignored).
- Recent Sigma handoff: `internal/planning/sigma-auth-handoff.md` (amended by the worklist and latest user decisions).
- Review plan: `internal/planning/current-product-plan.html` (local draft).

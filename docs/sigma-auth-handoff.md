# Handoff: BSV MCP authentication and the key vault

Date: 2026-09-07

## Decisions

- The user's key is the identity. Local stdio mode needs no sign-in.
- Hosted bsvmcp.com will be its own OAuth authorization server. Sigma Identity is an optional account connection and the cloud warehouse for encrypted masters, never a requirement and never the wallet. Connecting Sigma is an explicit BSV MCP tool flow, not the authentication step for using the MCP server.
- A product-neutral key vault now exists as `@opl.dev/vault` (repository `opldotdev/vault`). BSV MCP will consume it and delete its own key manager and passphrase prompt server.
- Sigma must not carry a BSV MCP-specific protected-resource default. The resource plumbing merged in Sigma PR #387 is to be removed with new commits, not reverts.
- A Vault can hold several project identities. BSV MCP should bind a project to a public Vault profile selector, while keeping all signing material in the Vault and outside the repository.

The distinction is deliberate: OAuth answers whether a client may use a BSV MCP
endpoint, while the Sigma connection flow lets a user bring an encrypted identity
or profile backup to a device they control. The hosted service may coordinate the
consent and return an encrypted payload, but it must not receive the plaintext
master or become the signing wallet.

The full plan with scoring and the decision record lives on BitPlan, not in this repository.

## Shipped today

- `bitcoin-backup` 0.1.0 on npm, repository moved to `opldotdev/bitcoin-backup`: versioned envelope with key slots, device-p256 wrapping matching the Secure Enclave helper, `updateBackupPayload`, derivation descriptor, and CLI slot commands.
- `@opl.dev/vault` on `master`: document model, BRC-157 and BRC-42 derivation, session-bound signer, BRC-140 shares, passphrase, device, enclave, and passkey PRF providers, file and IndexedDB storage, persistence, import and export, and the `vault` CLI. 87 tests. Not yet published to npm.

## Next work, in order

1. BSV MCP adopts `@opl.dev/vault`: delete `utils/keyManager.ts` and `utils/passphrasePrompt.ts`, read keys from `~/.bsv/vault.bep`, derive payment and ordinals keys per BRC-42 from the selected profile, migrate an existing `~/.bsv-mcp/keys.bep` into standalone entries on first run.
2. The setup page: one component reached from local first run and from a hosted OAuth login; choices are create a fresh agent identity, bring an identity from Sigma, use a wallet app, or advanced import.
3. Sigma cleanup: remove the `OAUTH_RESOURCE_URLS` and `OAUTH_DEFAULT_RESOURCE_URLS` plumbing and the deployment variables; keep client-ID metadata discovery.
4. bsvmcp.com authorization server: Better Auth with the OAuth provider, passkey, and Sigma sign-in plugins; protected-resource metadata points at bsvmcp.com; hosted accounts hold one agent profile root in a server-side vault.
5. Sigma agent-account consent page: allocate the next BRC-157 profile index and return it encrypted to the requesting device's vault key.
6. Sigma Connect tool and device authorization flow: the user asks the agent to connect Sigma, approves in a local browser, and the encrypted profile is imported into the device Vault.
7. Vault browser persistence (Linear OPL-4593): `prf` slot type in the envelope and a storage-agnostic store.
8. Project-scoped profile binding: choose a Vault profile for the current project, persist only its non-secret selector in user configuration, and show the selected public identity in `bsv_status`.

## Constraints

- Secrets never pass through the model, argv, or logs. Read env vars verbatim; empty is an error, never a fallback.
- Roots never sign. Agents hold profile roots, never the master.
- Commits carry a Linear issue id. Run lint, tests, and build unpiped before pushing.

# Wallet setup verification

Initial scenarios verified September 8, 2026 against the bundled executable in the canonical checkout. Browser scenarios used computer use against the local wizard, disposable home directories, and synthetic keys. Successful MCP scenarios were followed by a real SDK client tool-list refresh and wallet address request over stdio.

| Browser scenario | Result |
| --- | --- |
| Create a fresh wallet | Password mismatch rejected; corrected submission created and activated the wallet. |
| Restart and unlock | Wrong password rejected; correct password unlocked the account and enabled an address read. |
| Import a detected plaintext account | Imported into Vault and activated successfully. |
| Import a detected encrypted account | Wrong source password rejected; correct source password imported and activated. |
| Recover a database-only account | Unrelated backup rejected; matching backup accepted, address read succeeded, and an existing SQLite test record remained intact. |
| Import a detected Sigma-lab account | Imported and activated successfully. |
| Add a new wallet to an existing Vault | Wrong Vault password rejected; correct password added and activated the account. |
| Upload an encrypted backup | Imported and activated successfully. |
| Upload a plaintext JSON backup | Existing account-name conflict rejected; a new name imported and activated successfully. |
| Browser Back and Forward | Restored the appropriate form without restoring password values. |
| Start with a selected encrypted account | Opened the migration wizard; imported into a fresh Vault and enabled an MCP address read. |
| Standalone vault-setup command | Created the account and displayed the correct instruction to unlock through the MCP client setup. |

These checks establish local setup, import, persistence, and MCP activation. They do not establish funded transaction execution or remote storage availability. Four real-Vault project-profile tests are opt-in and remain skipped in the default suite. They were also run separately against the installed Vault package: all four passed, with 47 assertions, using synthetic fixtures.

Initial onboarding validation: 584 tests passed, 4 opt-in tests skipped, 0 failures across 84 files (3,176 assertions). TypeScript and production bundle builds passed. The canonical test helpers now isolate subprocess working directories and restore wallet environment variables so local checkout settings do not interfere with synthetic tests.

After integrating skill discovery, reference retirement, and PeerPay receive, the full suite passed 659 tests with 4 opt-in skips and 0 failures (3,400 assertions across 91 files). A fresh browser-created synthetic wallet activated successfully, returned an address, and exposed the PeerPay and skill-discovery tools in the refreshed session. This follow-up did not send or receive funded payments.

The tool-cloud follow-up passed 661 tests with 4 opt-in skips and 0 failures
(3,424 assertions across 92 files), plus TypeScript and production builds.
A fresh synthetic browser wallet displayed 83 live tools; selecting PeerPay
showed its registered description. Full and compact metadata parity with
`tools/list` is covered by the new catalog tests. An actual Codex 0.153.4 run
against commit `0fed5be` negotiated `2025-06-18` and completed initialization,
tool discovery, and a dashboard call with `ready: true`. Its server artifact
SHA-256 was `3ffa3a7ee8af8f6ed31bc104bccc274a98895e18dbfefbbb4d65f4da5389491d`.
Modern Codex negotiation was not observed.

The role-defaults follow-up saves newly created and imported wallets before
activation. A browser-created synthetic wallet reached the role selector,
saved its defaults, unlocked, and refreshed the real stdio connection to 78
tools; the address read succeeded. An isolated integration test imported two
wallets in one setup session and verified that payment and identity operations
used distinct public keys. Custom discovery now uses explicit local settings;
the earlier Sigma-lab fixture is not an automatically scanned location.

Final local checks: 679 tests passed, 4 opt-in tests skipped, 0 failures
(3,640 assertions across 97 files). TypeScript, production bundles, and the
Next.js production build passed. The package dry run contains 12 files.
Hosted route tests cover read-only registration even with key-like environment
values, unauthenticated CORS preflight, and OAuth challenges. A local production
Next.js process returned 204 with CORS at both MCP URLs and 401 with CORS and
resource metadata for an unauthenticated POST. Synthetic signed JWTs also
verified live Bun session isolation across two independently valid principals.
These checks do not establish deployed OAuth login or current MCP App host
acceptance.

The existing-key picker follow-up passed 681 tests with 4 opt-in skips and
0 failures (3,666 assertions). The real encrypted-Vault integration verifies
wrong-password and key-pin rejection, account overwrite refusal, byte-exact
Vault preservation, distinct role public keys, and identity signature creation
and verification without an administrator caller identity. Browser verification
started with a Vault containing an unlinked key and no accounts, linked the key,
saved defaults, unlocked, and completed an MCP address read with 78 tools.

The real wallet permission manager was exercised over an MCP connection with
synthetic transaction storage: acceptance returned a signable action; decline,
cancel, and a client without form elicitation aborted the action. No funded
transaction was signed or broadcast. TypeScript and production bundle builds
passed. Current desktop-host acceptance still requires reconnecting the client
so it launches the rebuilt executable.

## Funded SIGMA verification — September 8, 2026

The user-authorized Sigma-lab wallet was tested after a SQLite backup. Its
expected deposit address was confirmed as
`1MGJY5npit7vwQ95zA7fm6RT3WSP3ktXLb`. A local MCP test client exercised the
actual wallet permission manager and inscription tool with a 500-satoshi cap.
The SDK published the minimal BAP identity record needed by its `signWithBAP`
option, then created a SIGMA-signed test inscription retained by the wallet.

- Identity record: `83a9ccb06c2abe0a6428f20308c806f0d3d970675a6174dda8f0fca3c7c4acea`
- Inscription: `bb7941d1a30518988a126af9ffd21be022501082fb7c4db97262ac9b0a0dfe66`
- Approved requests: 70, 49, and 84 satoshis; 203 total.
- Spendable default-basket balance: 9,956 before; 9,753 after.

Both transaction hex payloads were retrieved from the mainnet explorer. The
inscription's SIGMA signature verified and its signer matched the current
identity key. The first explorer lookup returned 404 before indexing; no
transaction was resubmitted. This live test used one wallet with separately
derived funding and identity keys. Distinct root-key role routing is covered
by the SDK pipeline regression test. It does not establish current Codex
MCP App host acceptance or separate-role external permission-module support.

After integrating separate-role SIGMA routing, the full suite passed 684 tests
with 4 opt-in skips and 0 failures (3,684 assertions across 98 files).
TypeScript and production builds passed. The focused signature and tool
preflight tests also cover an explicitly disabled identity and refuse fallback
to an available funding identity before any transaction creation.

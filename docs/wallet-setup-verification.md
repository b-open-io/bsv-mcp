# Wallet setup verification

Verified September 8, 2026 against the bundled executable in the canonical checkout. Browser scenarios used computer use against the local wizard, disposable home directories, and synthetic keys. Successful MCP scenarios were followed by a real SDK client tool-list refresh and wallet address request over stdio.

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

Final automated validation: 584 tests passed, 4 opt-in tests skipped, 0 failures across 84 files (3,176 assertions). TypeScript and production bundle builds passed. The canonical test helpers now isolate subprocess working directories and restore wallet environment variables so local checkout settings do not interfere with synthetic tests.

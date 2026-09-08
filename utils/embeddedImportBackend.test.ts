import { afterEach, describe, expect, it } from "bun:test";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	realpathSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { P1SAT_PROTOCOL } from "@1sat/actions";
import { HD, PrivateKey, ProtoWallet, PublicKey } from "@bsv/sdk";
import { encryptBackup } from "bitcoin-backup";
import { readAccount, writeAccount } from "./accounts";
import { createEmbeddedImportBackend } from "./embeddedImportBackend";
import { SecureKeyManager } from "./keyManager";

// Real Vault module only: installed package or explicit test seam. The IO
// core itself is never mocked.
const specifier = process.env.BSV_MCP_TEST_VAULT_MODULE ?? "@opl.dev/vault";
const actual = await import(specifier).catch(() => undefined);
const loadModule = async () => actual;

const roots: string[] = [];
afterEach(() => {
	for (const root of roots.splice(0))
		rmSync(root, { recursive: true, force: true });
});

function freshRoot(): string {
	// Resolve symlinked ancestors (/var, /tmp on macOS): the vault IO
	// facade rejects symlink path components.
	const root = realpathSync(mkdtempSync(join(tmpdir(), "embedded-import-")));
	roots.push(root);
	return root;
}

const PAY = PrivateKey.fromHex("10");
const IDENTITY = PrivateKey.fromHex("20");
const XPRV = HD.fromSeed(new Array(32).fill(7)).toString();
const SOURCE_PASSWORD = "source-password-1";
const VAULT_PASSWORD = "destination-password-1";

async function writeEncryptedAccount(home: string, name: string) {
	const dir = join(home, ".bsv-mcp", "accounts", name);
	await new SecureKeyManager({ keyDir: dir }).saveKeys(
		{ payPk: PAY, identityPk: IDENTITY, xprv: XPRV },
		{ passphrase: SOURCE_PASSWORD },
	);
	return dir;
}

function writeLegacyRoot(home: string) {
	const dir = join(home, ".bsv-mcp");
	mkdirSync(dir, { recursive: true, mode: 0o700 });
	writeFileSync(
		join(dir, "keys.json"),
		JSON.stringify({ payPk: PAY.toWif() }),
		{ mode: 0o600 },
	);
	writeFileSync(join(dir, "wallet-main.db"), "synthetic-legacy-database");
	return dir;
}

function writeSigmaLab(home: string) {
	const dir = join(home, ".local", "share", "sigma-brc169-lab");
	mkdirSync(dir, { recursive: true, mode: 0o700 });
	writeFileSync(join(dir, "root.wif"), `${PAY.toWif()}\n`, { mode: 0o600 });
	return dir;
}

async function depositAddress(
	key: PrivateKey,
	prefix: string,
	chain: "main" | "test",
): Promise<string> {
	const derived = await new ProtoWallet(key).getPublicKey({
		protocolID: P1SAT_PROTOCOL,
		keyID: `${prefix} 0`,
		forSelf: true,
	});
	return chain === "test"
		? PublicKey.fromString(derived.publicKey).toAddress([0x6f])
		: PublicKey.fromString(derived.publicKey).toAddress();
}

describe("embedded import backend scope", () => {
	it("rejects unknown sources without touching the filesystem", async () => {
		const root = freshRoot();
		const home = join(root, "home");
		mkdirSync(home, { recursive: true });
		const backend = createEmbeddedImportBackend({
			vaultPath: join(root, "vault.bep"),
			home,
			loadModule,
		});
		await expect(
			backend.import({
				source: {
					account: "ghost",
					location: "account",
					encryptedBackup: true,
					plaintextKeys: false,
					walletDatabases: [],
				},
				password: VAULT_PASSWORD,
				passwordConfirmation: VAULT_PASSWORD,
				sourcePassphrase: SOURCE_PASSWORD,
				confirmation: "IMPORT_WALLET_CONFIRMED",
			}),
		).rejects.toThrow("not found");
		expect(existsSync(join(root, "vault.bep"))).toBe(false);
	});

	it("requires exact confirmation before reading private material", async () => {
		const root = freshRoot();
		const home = join(root, "home");
		await writeEncryptedAccount(home, "alice");
		const backend = createEmbeddedImportBackend({
			vaultPath: join(root, "vault.bep"),
			home,
			loadModule,
		});
		await expect(
			backend.import({
				source: {
					account: "alice",
					location: "account",
					encryptedBackup: true,
					plaintextKeys: false,
					walletDatabases: [],
				},
				password: VAULT_PASSWORD,
				passwordConfirmation: VAULT_PASSWORD,
				sourcePassphrase: SOURCE_PASSWORD,
				confirmation: "WRONG" as "IMPORT_WALLET_CONFIRMED",
			}),
		).rejects.toThrow("confirmation");
		expect(existsSync(join(root, "vault.bep"))).toBe(false);
	});
});

describe.skipIf(!actual)("embedded import with real Vault files", () => {
	it("imports an encrypted account and preserves config, source and DB", async () => {
		const root = freshRoot();
		const home = join(root, "home");
		const sourceDir = await writeEncryptedAccount(home, "alice");
		const sourceBytes = readFileSync(join(sourceDir, "keys.bep"));
		writeFileSync(join(sourceDir, "wallet-test.db"), "synthetic-db-alice");
		const dbBytes = readFileSync(join(sourceDir, "wallet-test.db"));
		const destRoot = join(home, ".bsv-mcp", "accounts");
		const rootAddress = PAY.toAddress([0x6f]);
		writeAccount(
			"alice",
			{
				chain: "test",
				address: rootAddress,
				storageIdentityKey: "keep-storage-id",
				activeRemote: "https://wallet.1sat.app",
				depositPrefix: "mcp",
			},
			destRoot,
		);
		const vaultPath = join(root, "vault", "keys.bep");
		const backend = createEmbeddedImportBackend({
			vaultPath,
			home,
			loadModule,
		});
		const result = await backend.import({
			source: {
				account: "alice",
				location: "account",
				encryptedBackup: true,
				plaintextKeys: false,
				walletDatabases: ["wallet-test.db"],
			},
			password: VAULT_PASSWORD,
			passwordConfirmation: VAULT_PASSWORD,
			sourcePassphrase: SOURCE_PASSWORD,
			confirmation: "IMPORT_WALLET_CONFIRMED",
		});
		expect(result.accountName).toBe("alice");
		expect(result.address).toBe(rootAddress);
		expect(result.binding.contract).toBe("embedded-roots-v1");
		expect(result.binding.version).toBe(1);
		expect(result.binding.payment.publicKey).toBe(PAY.toPublicKey().toString());
		expect(result.binding.identity?.publicKey).toBe(
			IDENTITY.toPublicKey().toString(),
		);
		expect(result.binding.hd?.expectedXpub).toBe(
			HD.fromString(XPRV).toPublic().toString(),
		);
		const stored = readAccount("alice", destRoot);
		expect(stored?.address).toBe(rootAddress);
		expect(stored?.storageIdentityKey).toBe("keep-storage-id");
		expect(stored?.activeRemote).toBe("https://wallet.1sat.app");
		expect(stored?.chain).toBe("test");
		expect(stored?.vaultBinding).toEqual(result.binding);
		expect(readFileSync(join(sourceDir, "keys.bep")).equals(sourceBytes)).toBe(
			true,
		);
		expect(
			readFileSync(join(sourceDir, "wallet-test.db")).equals(dbBytes),
		).toBe(true);
		expect(existsSync(vaultPath)).toBe(true);
	});

	it("ignores forged source directories and flags", async () => {
		const root = freshRoot();
		const home = join(root, "home");
		await writeEncryptedAccount(home, "alice");
		writeAccount(
			"alice",
			{
				chain: "test",
				address: PAY.toAddress([0x6f]),
				storageIdentityKey: "keep-storage-id",
				depositPrefix: "mcp",
			},
			join(home, ".bsv-mcp", "accounts"),
		);
		const backend = createEmbeddedImportBackend({
			vaultPath: join(root, "vault.bep"),
			home,
			loadModule,
		});
		const result = await backend.import({
			source: {
				directory: "/tmp/evil-forged",
				account: "alice",
				location: "account",
				encryptedBackup: false,
				plaintextKeys: false,
				walletDatabases: [],
			},
			password: VAULT_PASSWORD,
			passwordConfirmation: VAULT_PASSWORD,
			sourcePassphrase: SOURCE_PASSWORD,
			confirmation: "IMPORT_WALLET_CONFIRMED",
		});
		expect(result.accountName).toBe("alice");
		expect(existsSync("/tmp/evil-forged")).toBe(false);
	});

	it("imports a legacy plaintext root and copies its database", async () => {
		const root = freshRoot();
		const home = join(root, "home");
		const sourceDir = writeLegacyRoot(home);
		const keysBytes = readFileSync(join(sourceDir, "keys.json"));
		const dbBytes = readFileSync(join(sourceDir, "wallet-main.db"));
		const backend = createEmbeddedImportBackend({
			vaultPath: join(root, "vault.bep"),
			home,
			loadModule,
		});
		const result = await backend.import({
			source: {
				account: "default",
				location: "legacy-root",
				encryptedBackup: false,
				plaintextKeys: true,
				walletDatabases: ["wallet-main.db"],
			},
			password: VAULT_PASSWORD,
			passwordConfirmation: VAULT_PASSWORD,
			confirmation: "IMPORT_WALLET_CONFIRMED",
		});
		expect(result.accountName).toBe("default");
		expect(result.address).toBe(PAY.toAddress());
		expect(result.binding.identity).toBeUndefined();
		expect(result.binding.hd).toBeUndefined();
		const destDb = join(
			home,
			".bsv-mcp",
			"accounts",
			"default",
			"wallet-main.db",
		);
		expect(readFileSync(destDb).equals(dbBytes)).toBe(true);
		expect(readFileSync(join(sourceDir, "keys.json")).equals(keysBytes)).toBe(
			true,
		);
		expect(
			readFileSync(join(sourceDir, "wallet-main.db")).equals(dbBytes),
		).toBe(true);
	});

	it("imports a sigma-lab root.wif without synthesizing identity", async () => {
		const root = freshRoot();
		const home = join(root, "home");
		const labDir = writeSigmaLab(home);
		const wifBytes = readFileSync(join(labDir, "root.wif"));
		const backend = createEmbeddedImportBackend({
			vaultPath: join(root, "vault.bep"),
			home,
			loadModule,
		});
		const result = await backend.import({
			source: {
				account: "sigma-lab",
				location: "sigma-lab",
				encryptedBackup: false,
				plaintextKeys: true,
				walletDatabases: [],
			},
			password: VAULT_PASSWORD,
			passwordConfirmation: VAULT_PASSWORD,
			confirmation: "IMPORT_WALLET_CONFIRMED",
		});
		expect(result.accountName).toBe("sigma-lab");
		expect(result.address).toBe(PAY.toAddress());
		expect(result.binding.identity).toBeUndefined();
		expect(readFileSync(join(labDir, "root.wif")).equals(wifBytes)).toBe(true);
	});

	it("accepts a configured deterministic deposit address and preserves it", async () => {
		const root = freshRoot();
		const home = join(root, "home");
		await writeEncryptedAccount(home, "alice");
		const destRoot = join(home, ".bsv-mcp", "accounts");
		const deposit = await depositAddress(PAY, "mcp", "test");
		expect(deposit).not.toBe(PAY.toAddress([0x6f]));
		writeAccount(
			"alice",
			{
				chain: "test",
				address: deposit,
				storageIdentityKey: "keep-storage-id",
				depositPrefix: "mcp",
			},
			destRoot,
		);
		const backend = createEmbeddedImportBackend({
			vaultPath: join(root, "vault.bep"),
			home,
			loadModule,
		});
		const result = await backend.import({
			source: {
				account: "alice",
				location: "account",
				encryptedBackup: true,
				plaintextKeys: false,
				walletDatabases: [],
			},
			password: VAULT_PASSWORD,
			passwordConfirmation: VAULT_PASSWORD,
			sourcePassphrase: SOURCE_PASSWORD,
			confirmation: "IMPORT_WALLET_CONFIRMED",
		});
		expect(result.address).toBe(deposit);
		expect(readAccount("alice", destRoot)?.address).toBe(deposit);
	});

	it("rejects an unrelated configured address without changing config", async () => {
		const root = freshRoot();
		const home = join(root, "home");
		const sourceDir = await writeEncryptedAccount(home, "alice");
		const sourceBytes = readFileSync(join(sourceDir, "keys.bep"));
		const destRoot = join(home, ".bsv-mcp", "accounts");
		const other = PrivateKey.fromHex("99").toAddress([0x6f]);
		writeAccount(
			"alice",
			{
				chain: "test",
				address: other,
				storageIdentityKey: "keep-storage-id",
				depositPrefix: "mcp",
			},
			destRoot,
		);
		const configBytes = readFileSync(join(destRoot, "alice", "config.json"));
		const backend = createEmbeddedImportBackend({
			vaultPath: join(root, "vault.bep"),
			home,
			loadModule,
		});
		await expect(
			backend.import({
				source: {
					account: "alice",
					location: "account",
					encryptedBackup: true,
					plaintextKeys: false,
					walletDatabases: [],
				},
				password: VAULT_PASSWORD,
				passwordConfirmation: VAULT_PASSWORD,
				sourcePassphrase: SOURCE_PASSWORD,
				confirmation: "IMPORT_WALLET_CONFIRMED",
			}),
		).rejects.toThrow("do not match");
		expect(
			readFileSync(join(destRoot, "alice", "config.json")).equals(configBytes),
		).toBe(true);
		expect(readFileSync(join(sourceDir, "keys.bep")).equals(sourceBytes)).toBe(
			true,
		);
		expect(existsSync(join(root, "vault.bep"))).toBe(false);
	});

	it("fails closed on a concurrent config change and retains the vault", async () => {
		const root = freshRoot();
		const home = join(root, "home");
		await writeEncryptedAccount(home, "alice");
		const destRoot = join(home, ".bsv-mcp", "accounts");
		writeAccount(
			"alice",
			{
				chain: "test",
				address: PAY.toAddress([0x6f]),
				storageIdentityKey: "keep-storage-id",
				depositPrefix: "mcp",
			},
			destRoot,
		);
		const vaultPath = join(root, "vault.bep");
		const backend = createEmbeddedImportBackend({
			vaultPath,
			home,
			loadModule,
		});
		const pending = backend.import({
			source: {
				account: "alice",
				location: "account",
				encryptedBackup: true,
				plaintextKeys: false,
				walletDatabases: [],
			},
			password: VAULT_PASSWORD,
			passwordConfirmation: VAULT_PASSWORD,
			sourcePassphrase: SOURCE_PASSWORD,
			confirmation: "IMPORT_WALLET_CONFIRMED",
		});
		writeAccount(
			"alice",
			{
				chain: "test",
				address: PrivateKey.fromHex("98").toAddress([0x6f]),
				storageIdentityKey: "keep-storage-id",
				depositPrefix: "mcp",
			},
			destRoot,
		);
		await expect(pending).rejects.toThrow("changed");
		expect(readAccount("alice", destRoot)?.address).toBe(
			PrivateKey.fromHex("98").toAddress([0x6f]),
		);
		expect(readAccount("alice", destRoot)?.vaultBinding).toBeUndefined();
	});

	it("fails closed on a differing destination database", async () => {
		const root = freshRoot();
		const home = join(root, "home");
		const sourceDir = writeLegacyRoot(home);
		const sourceDb = readFileSync(join(sourceDir, "wallet-main.db"));
		const destDir = join(home, ".bsv-mcp", "accounts", "default");
		mkdirSync(destDir, { recursive: true, mode: 0o700 });
		writeFileSync(join(destDir, "wallet-main.db"), "different-destination-db", {
			mode: 0o600,
		});
		const backend = createEmbeddedImportBackend({
			vaultPath: join(root, "vault.bep"),
			home,
			loadModule,
		});
		await expect(
			backend.import({
				source: {
					account: "default",
					location: "legacy-root",
					encryptedBackup: false,
					plaintextKeys: true,
					walletDatabases: ["wallet-main.db"],
				},
				password: VAULT_PASSWORD,
				passwordConfirmation: VAULT_PASSWORD,
				confirmation: "IMPORT_WALLET_CONFIRMED",
			}),
		).rejects.toThrow("already exists");
		expect(readFileSync(join(destDir, "wallet-main.db")).toString()).toBe(
			"different-destination-db",
		);
		expect(
			readFileSync(join(sourceDir, "wallet-main.db")).equals(sourceDb),
		).toBe(true);
		expect(existsSync(join(root, "vault.bep"))).toBe(false);
	});

	it("writes nothing for a wrong source passphrase", async () => {
		const root = freshRoot();
		const home = join(root, "home");
		const sourceDir = await writeEncryptedAccount(home, "alice");
		const sourceBytes = readFileSync(join(sourceDir, "keys.bep"));
		const backend = createEmbeddedImportBackend({
			vaultPath: join(root, "vault.bep"),
			home,
			loadModule,
		});
		await expect(
			backend.import({
				source: {
					account: "alice",
					location: "account",
					encryptedBackup: true,
					plaintextKeys: false,
					walletDatabases: [],
				},
				password: VAULT_PASSWORD,
				passwordConfirmation: VAULT_PASSWORD,
				sourcePassphrase: "wrong-password-1",
				confirmation: "IMPORT_WALLET_CONFIRMED",
			}),
		).rejects.toThrow();
		expect(existsSync(join(root, "vault.bep"))).toBe(false);
		expect(readFileSync(join(sourceDir, "keys.bep")).equals(sourceBytes)).toBe(
			true,
		);
	});

	it("lets an already-imported account re-import with an unchanged address", async () => {
		const root = freshRoot();
		const home = join(root, "home");
		await writeEncryptedAccount(home, "alice");
		const destRoot = join(home, ".bsv-mcp", "accounts");
		const rootAddress = PAY.toAddress([0x6f]);
		writeAccount(
			"alice",
			{
				chain: "test",
				address: rootAddress,
				storageIdentityKey: "keep-storage-id",
				depositPrefix: "mcp",
			},
			destRoot,
		);
		const backend = createEmbeddedImportBackend({
			vaultPath: join(root, "vault.bep"),
			home,
			loadModule,
		});
		const first = await backend.import({
			source: {
				account: "alice",
				location: "account",
				encryptedBackup: true,
				plaintextKeys: false,
				walletDatabases: [],
			},
			password: VAULT_PASSWORD,
			passwordConfirmation: VAULT_PASSWORD,
			sourcePassphrase: SOURCE_PASSWORD,
			confirmation: "IMPORT_WALLET_CONFIRMED",
		});
		const second = await backend.import({
			source: {
				account: "alice",
				location: "account",
				encryptedBackup: true,
				plaintextKeys: false,
				walletDatabases: [],
			},
			password: VAULT_PASSWORD,
			passwordConfirmation: VAULT_PASSWORD,
			sourcePassphrase: SOURCE_PASSWORD,
			confirmation: "IMPORT_WALLET_CONFIRMED",
		});
		expect(second.address).toBe(rootAddress);
		expect(second.address).toBe(first.address);
		expect(readAccount("alice", destRoot)?.address).toBe(rootAddress);
	});
});

describe.skipIf(!actual)("embedded backup upload with real Vault files", () => {
	it("creates a fresh account from a plaintext structured backup", async () => {
		const root = freshRoot();
		const home = join(root, "home");
		mkdirSync(home, { recursive: true });
		const backend = createEmbeddedImportBackend({
			vaultPath: join(root, "vault.bep"),
			home,
			loadModule,
		});
		const result = await backend.importBackup({
			backupText: JSON.stringify({
				payPk: PAY.toWif(),
				identityPk: IDENTITY.toWif(),
				xprv: XPRV,
			}),
			backupName: "wallet-backup.json",
			accountName: "uploaded",
			destinationPassphrase: VAULT_PASSWORD,
			passwordConfirmation: VAULT_PASSWORD,
			confirmation: "IMPORT_WALLET_CONFIRMED",
		});
		expect(result.accountName).toBe("uploaded");
		expect(result.address).toBe(PAY.toAddress());
		expect(result.binding.payment.publicKey).toBe(PAY.toPublicKey().toString());
		expect(result.binding.identity?.publicKey).toBe(
			IDENTITY.toPublicKey().toString(),
		);
		expect(result.binding.hd?.expectedXpub).toBe(
			HD.fromString(XPRV).toPublic().toString(),
		);
	});

	it("attaches an encrypted backup with the source passphrase", async () => {
		const root = freshRoot();
		const home = join(root, "home");
		mkdirSync(home, { recursive: true });
		const backup = {
			wif: PAY.toWif(),
			bsvMcp: { identityPk: IDENTITY.toWif(), xprv: XPRV },
			label: "synthetic",
			createdAt: new Date().toISOString(),
		};
		const encrypted = await encryptBackup(backup, SOURCE_PASSWORD);
		const backend = createEmbeddedImportBackend({
			vaultPath: join(root, "vault.bep"),
			home,
			loadModule,
		});
		const result = await backend.importBackup({
			backupText: encrypted,
			backupName: "wallet-backup.bep",
			accountName: "uploaded",
			sourcePassphrase: SOURCE_PASSWORD,
			destinationPassphrase: VAULT_PASSWORD,
			passwordConfirmation: VAULT_PASSWORD,
			confirmation: "IMPORT_WALLET_CONFIRMED",
		});
		expect(result.accountName).toBe("uploaded");
		expect(result.address).toBe(PAY.toAddress());
		expect(result.binding.identity?.publicKey).toBe(
			IDENTITY.toPublicKey().toString(),
		);
	});

	it("rejects oversized backups before parsing", async () => {
		const root = freshRoot();
		const home = join(root, "home");
		mkdirSync(home, { recursive: true });
		const backend = createEmbeddedImportBackend({
			vaultPath: join(root, "vault.bep"),
			home,
			loadModule,
		});
		await expect(
			backend.importBackup({
				backupText: "x".repeat(1024 * 1024 + 1),
				backupName: "big.json",
				accountName: "uploaded",
				destinationPassphrase: VAULT_PASSWORD,
				confirmation: "IMPORT_WALLET_CONFIRMED",
			}),
		).rejects.toThrow("exceeds");
		expect(existsSync(join(root, "vault.bep"))).toBe(false);
	});

	it("rejects unknown formats and invalid keys", async () => {
		const root = freshRoot();
		const home = join(root, "home");
		mkdirSync(home, { recursive: true });
		const backend = createEmbeddedImportBackend({
			vaultPath: join(root, "vault.bep"),
			home,
			loadModule,
		});
		await expect(
			backend.importBackup({
				backupText: "not-a-backup",
				backupName: "backup.json",
				accountName: "uploaded",
				destinationPassphrase: VAULT_PASSWORD,
				confirmation: "IMPORT_WALLET_CONFIRMED",
			}),
		).rejects.toThrow("not a supported");
		await expect(
			backend.importBackup({
				backupText: JSON.stringify({ wif: "not-a-wif" }),
				backupName: "backup.json",
				accountName: "uploaded",
				destinationPassphrase: VAULT_PASSWORD,
				confirmation: "IMPORT_WALLET_CONFIRMED",
			}),
		).rejects.toThrow("not a supported");
		await expect(
			backend.importBackup({
				backupText: JSON.stringify({ mnemonic: "abandon abandon" }),
				backupName: "backup.json",
				accountName: "uploaded",
				destinationPassphrase: VAULT_PASSWORD,
				confirmation: "IMPORT_WALLET_CONFIRMED",
			}),
		).rejects.toThrow("not a supported");
		expect(existsSync(join(root, "vault.bep"))).toBe(false);
	});

	it("never opens a path-like backup name as a file", async () => {
		const root = freshRoot();
		const home = join(root, "home");
		mkdirSync(home, { recursive: true });
		const backend = createEmbeddedImportBackend({
			vaultPath: join(root, "vault.bep"),
			home,
			loadModule,
		});
		const result = await backend.importBackup({
			backupText: JSON.stringify({ payPk: PAY.toWif() }),
			backupName: "../../evil-backup-path",
			accountName: "uploaded",
			destinationPassphrase: VAULT_PASSWORD,
			passwordConfirmation: VAULT_PASSWORD,
			confirmation: "IMPORT_WALLET_CONFIRMED",
		});
		expect(result.accountName).toBe("uploaded");
		expect(existsSync(join(home, "evil-backup-path"))).toBe(false);
		expect(existsSync(join(home, ".bsv-mcp", "evil-backup-path"))).toBe(false);
	});

	it("requires exact confirmation before decrypting uploads", async () => {
		const root = freshRoot();
		const home = join(root, "home");
		mkdirSync(home, { recursive: true });
		const backend = createEmbeddedImportBackend({
			vaultPath: join(root, "vault.bep"),
			home,
			loadModule,
		});
		await expect(
			backend.importBackup({
				backupText: "unparseable-secret-contents",
				backupName: "backup.json",
				accountName: "uploaded",
				destinationPassphrase: VAULT_PASSWORD,
				confirmation: "WRONG" as "IMPORT_WALLET_CONFIRMED",
			}),
		).rejects.toThrow("confirmation");
		expect(existsSync(join(root, "vault.bep"))).toBe(false);
	});

	it("preserves config and DB on an upload address mismatch", async () => {
		const root = freshRoot();
		const home = join(root, "home");
		mkdirSync(home, { recursive: true });
		const destRoot = join(home, ".bsv-mcp", "accounts");
		const other = PrivateKey.fromHex("77").toAddress();
		writeAccount(
			"desk",
			{
				chain: "main",
				address: other,
				storageIdentityKey: "keep-storage-id",
				depositPrefix: "mcp",
			},
			destRoot,
		);
		const destDir = join(destRoot, "desk");
		writeFileSync(join(destDir, "wallet-main.db"), "synthetic-db-desk");
		const configBytes = readFileSync(join(destDir, "config.json"));
		const backend = createEmbeddedImportBackend({
			vaultPath: join(root, "vault.bep"),
			home,
			loadModule,
		});
		await expect(
			backend.importBackup({
				backupText: JSON.stringify({ payPk: PAY.toWif() }),
				backupName: "backup.json",
				accountName: "desk",
				destinationPassphrase: VAULT_PASSWORD,
				confirmation: "IMPORT_WALLET_CONFIRMED",
			}),
		).rejects.toThrow("do not match");
		expect(readFileSync(join(destDir, "config.json")).equals(configBytes)).toBe(
			true,
		);
		expect(readFileSync(join(destDir, "wallet-main.db")).toString()).toBe(
			"synthetic-db-desk",
		);
		expect(existsSync(join(root, "vault.bep"))).toBe(false);
	});

	it("attaches matching keys while leaving databases untouched", async () => {
		const root = freshRoot();
		const home = join(root, "home");
		mkdirSync(home, { recursive: true });
		const destRoot = join(home, ".bsv-mcp", "accounts");
		writeAccount(
			"desk",
			{
				chain: "main",
				address: PAY.toAddress(),
				storageIdentityKey: "keep-storage-id",
				depositPrefix: "mcp",
			},
			destRoot,
		);
		const destDir = join(destRoot, "desk");
		writeFileSync(join(destDir, "wallet-main.db"), "synthetic-db-desk");
		const backend = createEmbeddedImportBackend({
			vaultPath: join(root, "vault.bep"),
			home,
			loadModule,
		});
		const result = await backend.importBackup({
			backupText: JSON.stringify({ payPk: PAY.toWif() }),
			backupName: "backup.json",
			accountName: "desk",
			destinationPassphrase: VAULT_PASSWORD,
			passwordConfirmation: VAULT_PASSWORD,
			confirmation: "IMPORT_WALLET_CONFIRMED",
		});
		expect(result.address).toBe(PAY.toAddress());
		expect(readAccount("desk", destRoot)?.storageIdentityKey).toBe(
			"keep-storage-id",
		);
		expect(readFileSync(join(destDir, "wallet-main.db")).toString()).toBe(
			"synthetic-db-desk",
		);
	});

	it("fails honestly for a database-only destination without a known address", async () => {
		const root = freshRoot();
		const home = join(root, "home");
		mkdirSync(home, { recursive: true });
		const destRoot = join(home, ".bsv-mcp", "accounts");
		writeAccount(
			"desk",
			{
				chain: "main",
				storageIdentityKey: "keep-storage-id",
				depositPrefix: "mcp",
			},
			destRoot,
		);
		const destDir = join(destRoot, "desk");
		writeFileSync(join(destDir, "wallet-main.db"), "synthetic-db-desk");
		const backend = createEmbeddedImportBackend({
			vaultPath: join(root, "vault.bep"),
			home,
			loadModule,
		});
		await expect(
			backend.importBackup({
				backupText: JSON.stringify({ payPk: PAY.toWif() }),
				backupName: "backup.json",
				accountName: "desk",
				destinationPassphrase: VAULT_PASSWORD,
				confirmation: "IMPORT_WALLET_CONFIRMED",
			}),
		).rejects.toThrow("matching-key");
		expect(readAccount("desk", destRoot)?.vaultBinding).toBeUndefined();
		expect(existsSync(join(root, "vault.bep"))).toBe(false);
	});
});

describe.skipIf(!actual)("embedded import correction regressions", () => {
	const OTHER_IDENTITY = PrivateKey.fromHex("21");
	const OTHER_XPRV = HD.fromSeed(new Array(32).fill(8)).toString();

	async function writeCustomEncryptedAccount(
		home: string,
		name: string,
		keys: { payPk: PrivateKey; identityPk?: PrivateKey; xprv?: string },
	) {
		const dir = join(home, ".bsv-mcp", "accounts", name);
		await new SecureKeyManager({ keyDir: dir }).saveKeys(keys, {
			passphrase: SOURCE_PASSWORD,
		});
		return dir;
	}

	it("rejects a symlink sidecar for an actual copy before any vault write", async () => {
		const root = freshRoot();
		const home = join(root, "home");
		const sourceDir = writeLegacyRoot(home);
		const target = join(sourceDir, "wallet-main.db");
		symlinkSync(target, join(sourceDir, "wallet-main.db-wal"));
		const backend = createEmbeddedImportBackend({
			vaultPath: join(root, "vault.bep"),
			home,
			loadModule,
		});
		await expect(
			backend.import({
				source: {
					account: "default",
					location: "legacy-root",
					encryptedBackup: false,
					plaintextKeys: true,
					walletDatabases: ["wallet-main.db"],
				},
				password: VAULT_PASSWORD,
				passwordConfirmation: VAULT_PASSWORD,
				confirmation: "IMPORT_WALLET_CONFIRMED",
			}),
		).rejects.toThrow("safely");
		expect(existsSync(join(root, "vault.bep"))).toBe(false);
		expect(existsSync(join(home, ".bsv-mcp", "accounts", "default"))).toBe(
			false,
		);
	});

	it("preserves same-directory DB and sidecars without denial", async () => {
		const root = freshRoot();
		const home = join(root, "home");
		const sourceDir = await writeEncryptedAccount(home, "alice");
		const dbPath = join(sourceDir, "wallet-test.db");
		writeFileSync(dbPath, "synthetic-same-dir-db");
		writeFileSync(join(sourceDir, "wallet-test.db-wal"), "synthetic-wal");
		const dbBytes = readFileSync(dbPath);
		const destRoot = join(home, ".bsv-mcp", "accounts");
		writeAccount(
			"alice",
			{
				chain: "test",
				address: PAY.toAddress([0x6f]),
				storageIdentityKey: "keep-storage-id",
				depositPrefix: "mcp",
			},
			destRoot,
		);
		const backend = createEmbeddedImportBackend({
			vaultPath: join(root, "vault.bep"),
			home,
			loadModule,
		});
		const result = await backend.import({
			source: {
				account: "alice",
				location: "account",
				encryptedBackup: true,
				plaintextKeys: false,
				walletDatabases: ["wallet-test.db"],
			},
			password: VAULT_PASSWORD,
			passwordConfirmation: VAULT_PASSWORD,
			sourcePassphrase: SOURCE_PASSWORD,
			confirmation: "IMPORT_WALLET_CONFIRMED",
		});
		expect(result.address).toBe(PAY.toAddress([0x6f]));
		expect(readFileSync(dbPath).equals(dbBytes)).toBe(true);
		expect(existsSync(join(sourceDir, "wallet-test.db-wal"))).toBe(true);
	});

	it("rejects a changed pinned identity before any vault write and preserves config", async () => {
		const root = freshRoot();
		const home = join(root, "home");
		await writeEncryptedAccount(home, "alice");
		const destRoot = join(home, ".bsv-mcp", "accounts");
		writeAccount(
			"alice",
			{
				chain: "test",
				address: PAY.toAddress([0x6f]),
				storageIdentityKey: "keep-storage-id",
				depositPrefix: "mcp",
			},
			destRoot,
		);
		const first = createEmbeddedImportBackend({
			vaultPath: join(root, "vault-one.bep"),
			home,
			loadModule,
		});
		await first.import({
			source: {
				account: "alice",
				location: "account",
				encryptedBackup: true,
				plaintextKeys: false,
				walletDatabases: [],
			},
			password: VAULT_PASSWORD,
			passwordConfirmation: VAULT_PASSWORD,
			sourcePassphrase: SOURCE_PASSWORD,
			confirmation: "IMPORT_WALLET_CONFIRMED",
		});
		const configBytes = readFileSync(join(destRoot, "alice", "config.json"));
		await writeCustomEncryptedAccount(home, "alice", {
			payPk: PAY,
			identityPk: OTHER_IDENTITY,
			xprv: XPRV,
		});
		const second = createEmbeddedImportBackend({
			vaultPath: join(root, "vault-two.bep"),
			home,
			loadModule,
		});
		await expect(
			second.import({
				source: {
					account: "alice",
					location: "account",
					encryptedBackup: true,
					plaintextKeys: false,
					walletDatabases: [],
				},
				password: VAULT_PASSWORD,
				passwordConfirmation: VAULT_PASSWORD,
				sourcePassphrase: SOURCE_PASSWORD,
				confirmation: "IMPORT_WALLET_CONFIRMED",
			}),
		).rejects.toThrow("do not match");
		expect(existsSync(join(root, "vault-two.bep"))).toBe(false);
		expect(
			readFileSync(join(destRoot, "alice", "config.json")).equals(configBytes),
		).toBe(true);
	});

	it("rejects an omitted pinned HD before any vault write and preserves config", async () => {
		const root = freshRoot();
		const home = join(root, "home");
		await writeEncryptedAccount(home, "alice");
		const destRoot = join(home, ".bsv-mcp", "accounts");
		writeAccount(
			"alice",
			{
				chain: "test",
				address: PAY.toAddress([0x6f]),
				storageIdentityKey: "keep-storage-id",
				depositPrefix: "mcp",
			},
			destRoot,
		);
		const first = createEmbeddedImportBackend({
			vaultPath: join(root, "vault-one.bep"),
			home,
			loadModule,
		});
		await first.import({
			source: {
				account: "alice",
				location: "account",
				encryptedBackup: true,
				plaintextKeys: false,
				walletDatabases: [],
			},
			password: VAULT_PASSWORD,
			passwordConfirmation: VAULT_PASSWORD,
			sourcePassphrase: SOURCE_PASSWORD,
			confirmation: "IMPORT_WALLET_CONFIRMED",
		});
		const configBytes = readFileSync(join(destRoot, "alice", "config.json"));
		await writeCustomEncryptedAccount(home, "alice", {
			payPk: PAY,
			identityPk: IDENTITY,
		});
		const second = createEmbeddedImportBackend({
			vaultPath: join(root, "vault-two.bep"),
			home,
			loadModule,
		});
		await expect(
			second.import({
				source: {
					account: "alice",
					location: "account",
					encryptedBackup: true,
					plaintextKeys: false,
					walletDatabases: [],
				},
				password: VAULT_PASSWORD,
				passwordConfirmation: VAULT_PASSWORD,
				sourcePassphrase: SOURCE_PASSWORD,
				confirmation: "IMPORT_WALLET_CONFIRMED",
			}),
		).rejects.toThrow("do not match");
		expect(existsSync(join(root, "vault-two.bep"))).toBe(false);
		expect(
			readFileSync(join(destRoot, "alice", "config.json")).equals(configBytes),
		).toBe(true);
	});

	it("rejects a changed pinned identity on backup attach before any vault write", async () => {
		const root = freshRoot();
		const home = join(root, "home");
		mkdirSync(home, { recursive: true });
		const first = createEmbeddedImportBackend({
			vaultPath: join(root, "vault-one.bep"),
			home,
			loadModule,
		});
		await first.importBackup({
			backupText: JSON.stringify({
				payPk: PAY.toWif(),
				identityPk: IDENTITY.toWif(),
				xprv: XPRV,
			}),
			backupName: "backup.json",
			accountName: "uploaded",
			destinationPassphrase: VAULT_PASSWORD,
			passwordConfirmation: VAULT_PASSWORD,
			confirmation: "IMPORT_WALLET_CONFIRMED",
		});
		const destRoot = join(home, ".bsv-mcp", "accounts");
		const configBytes = readFileSync(join(destRoot, "uploaded", "config.json"));
		const second = createEmbeddedImportBackend({
			vaultPath: join(root, "vault-two.bep"),
			home,
			loadModule,
		});
		await expect(
			second.importBackup({
				backupText: JSON.stringify({
					payPk: PAY.toWif(),
					identityPk: OTHER_IDENTITY.toWif(),
					xprv: OTHER_XPRV,
				}),
				backupName: "backup.json",
				accountName: "uploaded",
				destinationPassphrase: VAULT_PASSWORD,
				passwordConfirmation: VAULT_PASSWORD,
				confirmation: "IMPORT_WALLET_CONFIRMED",
			}),
		).rejects.toThrow("do not match");
		expect(existsSync(join(root, "vault-two.bep"))).toBe(false);
		expect(
			readFileSync(join(destRoot, "uploaded", "config.json")).equals(
				configBytes,
			),
		).toBe(true);
	});

	it("requires a matching-key backup for a database-only source", async () => {
		const root = freshRoot();
		const home = join(root, "home");
		const dir = join(home, ".bsv-mcp", "accounts", "dbonly");
		mkdirSync(dir, { recursive: true, mode: 0o700 });
		writeFileSync(join(dir, "wallet-test.db"), "synthetic-db-only");
		const backend = createEmbeddedImportBackend({
			vaultPath: join(root, "vault.bep"),
			home,
			loadModule,
		});
		await expect(
			backend.import({
				source: {
					account: "dbonly",
					location: "account",
					encryptedBackup: false,
					plaintextKeys: false,
					walletDatabases: ["wallet-test.db"],
				},
				password: VAULT_PASSWORD,
				passwordConfirmation: VAULT_PASSWORD,
				confirmation: "IMPORT_WALLET_CONFIRMED",
			}),
		).rejects.toThrow("matching-key");
		expect(existsSync(join(root, "vault.bep"))).toBe(false);
	});
});

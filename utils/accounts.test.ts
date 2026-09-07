import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	statSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HD, PrivateKey } from "@bsv/sdk";
import { createAccount, migrateAccount } from "./accountCommands";
import {
	accountDir,
	accountName,
	listAccounts,
	newAccountConfig,
	readAccount,
} from "./accounts";
import { initializeSecureKeys, SecureKeyManager } from "./keyManager";
import { signerChildEnvironment, signerRequestAllowed } from "./signer";

const password = "test-only-password";
test("encrypted accounts preserve all keys, isolate accounts and never fall back to plaintext", async () => {
	const root = mkdtempSync(join(tmpdir(), "bsv-accounts-"));
	try {
		const key = PrivateKey.fromString("1", 16),
			identity = PrivateKey.fromString("2", 16),
			xprv = HD.fromRandom().toString();
		await createAccount(
			"default",
			{ payPk: key, identityPk: identity, xprv },
			password,
			newAccountConfig("main", key.toAddress()),
			root,
		);
		await createAccount(
			"second",
			{ payPk: identity },
			password,
			newAccountConfig("test", identity.toAddress([0x6f])),
			root,
		);
		const dir = accountDir("default", root),
			manager = new SecureKeyManager({ keyDir: dir });
		const encrypted = readFileSync(join(dir, "keys.bep"), "utf8");
		for (const secret of [key.toWif(), identity.toWif(), xprv])
			expect(encrypted).not.toContain(secret);
		const loaded = await manager.loadKeys(password);
		expect(loaded.keys.payPk?.toWif() === key.toWif()).toBe(true);
		expect(loaded.keys.xprv === xprv).toBe(true);
		expect(loaded.keys.identityPk?.toWif() === identity.toWif()).toBe(true);
		expect(listAccounts(root).map((a) => a.name)).toEqual([
			"default",
			"second",
		]);
		const listing = JSON.stringify(listAccounts(root));
		for (const secret of [key.toWif(), identity.toWif(), xprv])
			expect(listing.includes(secret)).toBe(false);
		expect(readdirSync(dir).sort()).toEqual(["config.json", "keys.bep"]);
		expect(statSync(dir).mode & 0o777).toBe(0o700);
		for (const f of readdirSync(dir))
			expect(statSync(join(dir, f)).mode & 0o777).toBe(0o600);
		await expect(
			createAccount(
				"default",
				{ payPk: identity },
				password,
				newAccountConfig("main", identity.toAddress()),
				root,
			),
		).rejects.toThrow("already exists");
		writeFileSync(
			join(dir, "keys.json"),
			JSON.stringify({ payPk: identity.toWif() }),
		);
		await expect(manager.loadKeys("wrong-password")).rejects.toThrow(
			"Cannot unlock",
		);
		await expect(
			manager.saveKeys({ payPk: key }, { passphrase: "short" }),
		).rejects.toThrow("plaintext saving is disabled");
		expect(
			(
				await initializeSecureKeys(manager, {
					PRIVATE_KEY_WIF: identity.toWif(),
				})
			).source,
		).toBe("env");
		await expect(
			initializeSecureKeys(manager, { PRIVATE_KEY_WIF: "invalid" }),
		).rejects.toThrow("no fallback");
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
test("cold key resolution writes nothing and errors never echo malformed secret data", async () => {
	const root = mkdtempSync(join(tmpdir(), "bsv-empty-"));
	try {
		const dir = join(root, "missing");
		await expect(
			initializeSecureKeys(new SecureKeyManager({ keyDir: dir }), {}),
		).rejects.toThrow(join(dir, "keys.bep"));
		expect(existsSync(dir)).toBe(false);
		mkdirSync(dir);
		writeFileSync(join(dir, "keys.json"), "malformed private material");
		const manager = new SecureKeyManager({ keyDir: dir });
		await expect(manager.loadKeys()).rejects.toThrow("require migration");
		expect(() => manager.loadLegacyKeys()).toThrow("Cannot read legacy keys");
		expect(() => accountName("../escape")).toThrow();
		symlinkSync(dir, join(root, "linked"));
		expect(() => readAccount("linked", root)).toThrow("not a link");
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
test("migration preserves source, storage identity and SQLite data and is idempotent", async () => {
	const root = mkdtempSync(join(tmpdir(), "bsv-migrate-"));
	try {
		const source = join(root, "source"),
			accounts = join(root, "accounts");
		mkdirSync(source);
		const key = PrivateKey.fromString("3", 16);
		writeFileSync(join(source, "root.wif"), key.toWif(), { mode: 0o600 });
		const db = new Database(join(source, "wallet.db"));
		db.exec(
			"CREATE TABLE retained (n INTEGER); INSERT INTO retained VALUES (9956)",
		);
		db.close();
		expect(
			(
				await migrateAccount(
					"sigma-lab",
					"sigma-lab",
					password,
					accounts,
					source,
				)
			).alreadyMigrated,
		).toBe(false);
		expect(
			(
				await migrateAccount(
					"sigma-lab",
					"sigma-lab",
					password,
					accounts,
					source,
				)
			).alreadyMigrated,
		).toBe(true);
		expect(readAccount("sigma-lab", accounts)?.storageIdentityKey).toBe(
			"sigma-brc169-lab",
		);
		expect(existsSync(join(source, "root.wif"))).toBe(true);
		const copied = new Database(join(accounts, "sigma-lab", "wallet-main.db"), {
			readonly: true,
		});
		expect(copied.query("SELECT n FROM retained").get()).toEqual({ n: 9956 });
		copied.close();
		expect(
			statSync(join(accounts, "sigma-lab", "wallet-main.db")).mode & 0o777,
		).toBe(0o600);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
test("signer boundary rejects wrong origin/token/method and strips key credentials", () => {
	const allowed = new Set(["getPublicKey"]);
	const url = "http://127.0.0.1/token/getPublicKey";
	expect(
		signerRequestAllowed(
			new Request(url, {
				method: "POST",
				headers: { origin: "http://bsv-mcp.local" },
			}),
			"token",
			allowed,
		),
	).toBe("getPublicKey");
	expect(
		signerRequestAllowed(
			new Request(url, { method: "POST" }),
			"token",
			allowed,
		),
	).toBeUndefined();
	expect(
		signerRequestAllowed(
			new Request(url, {
				method: "POST",
				headers: { origin: "http://evil.example" },
			}),
			"token",
			allowed,
		),
	).toBeUndefined();
	const child = signerChildEnvironment("http://127.0.0.1/token", {
		PRIVATE_KEY_WIF: "secret",
		PRIVATE_KEY_WIF_BACKUP: "secret",
		IDENTITY_KEY_WIF: "secret",
		BSV_MCP_PASSWORD: "secret",
		ONESAT_PASSWORD: "secret",
	});
	expect(JSON.stringify(child)).not.toContain("secret");
});

test("actual cold stdio startup fails without writing a wallet directory", async () => {
	const home = mkdtempSync(join(tmpdir(), "bsv-cold-"));
	try {
		const child = Bun.spawn(
			[process.execPath, join(import.meta.dir, "../index.ts"), "--stdio"],
			{
				cwd: home,
				env: {
					PATH: process.env.PATH ?? "",
					HOME: home,
					BUN_RUNTIME_TRANSPILER_CACHE_PATH: "0",
				},
				stdout: "pipe",
				stderr: "pipe",
			},
		);
		const [code, out, err] = await Promise.all([
			child.exited,
			new Response(child.stdout).text(),
			new Response(child.stderr).text(),
		]);
		expect(code).toBe(1);
		expect(out).toBe("");
		expect(err).toContain(join(home, ".bsv-mcp/accounts/default/keys.bep"));
		expect(readdirSync(home)).toEqual([]);
	} finally {
		rmSync(home, { recursive: true, force: true });
	}
});

import { afterEach, expect, test } from "bun:test";
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inspectMigration } from "./vaultMigration";
import { startVaultSetup } from "./vaultSetup";

const homes: string[] = [];
function fixture() {
	const home = mkdtempSync(join(tmpdir(), "bsv-vault-preview-"));
	homes.push(home);
	return home;
}
afterEach(() => {
	for (const home of homes.splice(0))
		rmSync(home, { recursive: true, force: true });
});

test("inventory detects old and named accounts without reading or changing secrets", () => {
	const home = fixture();
	const root = join(home, ".bsv-mcp");
	const account = join(root, "accounts", "alice");
	mkdirSync(account, { recursive: true });
	writeFileSync(join(root, "keys.json"), "unparseable secret sentinel");
	writeFileSync(join(account, "keys.bep"), "encrypted sentinel");
	writeFileSync(join(account, "wallet-main.db"), "database sentinel");
	const inventory = inspectMigration({ home, env: {} });
	expect(inventory.sources).toEqual([
		{
			account: "default",
			directory: root,
			location: "legacy-root",
			encryptedBackup: false,
			plaintextKeys: true,
			walletDatabases: [],
		},
		{
			account: "alice",
			directory: account,
			location: "account",
			encryptedBackup: true,
			plaintextKeys: false,
			walletDatabases: ["wallet-main.db"],
		},
	]);
	expect(inventory.migrationRequired).toBe(true);
	expect(JSON.stringify(inventory)).not.toContain("sentinel");
	expect(readFileSync(join(root, "keys.json"), "utf8")).toBe(
		"unparseable secret sentinel",
	);
	expect(readFileSync(join(account, "wallet-main.db"), "utf8")).toBe(
		"database sentinel",
	);
});

test("empty environment overrides are surfaced without falling back", () => {
	const home = fixture();
	expect(
		inspectMigration({ home, env: { PRIVATE_KEY_WIF: "" } }).environmentKeys,
	).toEqual({ payment: true, identity: false, empty: true });
	expect(() => inspectMigration({ home, env: { VAULT_PATH: "" } })).toThrow(
		"empty",
	);
	expect(inspectMigration({ home, env: {} }).migrationRequired).toBe(false);
});

test("rejects linked account directories and dangling key links", () => {
	const home = fixture();
	const account = join(home, ".bsv-mcp", "accounts", "alice");
	mkdirSync(account, { recursive: true });
	symlinkSync(join(home, "missing"), join(account, "keys.json"));
	expect(() => inspectMigration({ home, env: {} })).toThrow("regular");
});

test("local preview restricts inventory to the capability and origin and never accepts writes", async () => {
	const home = fixture();
	const setup = await startVaultSetup({
		inspect: () => inspectMigration({ home, env: {} }),
	});
	try {
		const url = new URL(setup.url);
		const headers = { Authorization: `Bearer ${url.hash.slice(1)}` };
		expect((await fetch(`${url.origin}/api/inventory`)).status).toBe(403);
		expect(
			(
				await fetch(`${url.origin}/api/inventory`, {
					headers: { ...headers, Origin: "https://example.com" },
				})
			).status,
		).toBe(403);
		expect(
			(
				await fetch(`${url.origin}/api/inventory`, {
					headers: { ...headers, Host: "attacker.example" },
				})
			).status,
		).toBe(403);
		expect(
			(await fetch(`${url.origin}/api/inventory`, { headers, method: "POST" }))
				.status,
		).toBe(405);
		const result = await fetch(`${url.origin}/api/inventory`, { headers });
		expect(result.status).toBe(200);
		expect(result.headers.get("cache-control")).toBe("no-store");
		expect((await result.json()).migrationRequired).toBe(false);
		const page = await fetch(url.origin);
		expect(await page.text()).not.toContain(url.hash.slice(1));
		expect(page.headers.get("content-security-policy")).toContain(
			"frame-ancestors 'none'",
		);
	} finally {
		await setup.close();
	}
});

test("inventory includes Sigma lab keys and legacy wallet databases without reading them", () => {
	const home = fixture();
	const legacy = join(home, ".bsv-mcp");
	const lab = join(home, ".local/share/sigma-brc169-lab");
	mkdirSync(legacy, { recursive: true });
	mkdirSync(lab, { recursive: true });
	for (const file of [
		join(legacy, "keys.bep"),
		join(legacy, "wallet.db"),
		join(lab, "root.wif"),
		join(lab, "wallet.db"),
	])
		writeFileSync(file, "secret sentinel");
	const result = inspectMigration({ home, env: {} });
	expect(result.sources).toEqual([
		{
			account: "default",
			directory: legacy,
			location: "legacy-root",
			encryptedBackup: true,
			plaintextKeys: false,
			walletDatabases: ["wallet.db"],
		},
		{
			account: "sigma-lab",
			directory: lab,
			location: "sigma-lab",
			encryptedBackup: false,
			plaintextKeys: true,
			walletDatabases: ["wallet.db"],
		},
	]);
	expect(JSON.stringify(result)).not.toContain("sentinel");
});

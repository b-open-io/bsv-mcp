import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrivateKey } from "@bsv/sdk";
import { eraseImportedPlaintextSource } from "./plaintextSourceErase";

const homes: string[] = [];
afterEach(() => {
	for (const home of homes.splice(0))
		rmSync(home, { recursive: true, force: true });
});

test("overwrites a legacy keys.json after import", () => {
	const dir = mkdtempSync(join(tmpdir(), "bsv-mcp-erase-"));
	homes.push(dir);
	const wif = PrivateKey.fromRandom().toWif();
	const file = join(dir, "keys.json");
	writeFileSync(file, JSON.stringify({ payPk: wif }));
	const result = eraseImportedPlaintextSource({
		account: "legacy",
		location: "legacy-root",
		directory: dir,
		keyFile: "keys.json",
		encryptedBackup: false,
		plaintextKeys: true,
		walletDatabases: [],
	});
	expect(result).toEqual({ erased: true, kind: "file" });
	expect(() => readFileSync(file)).toThrow();
});

test("leaves environment-only sources in place", () => {
	expect(
		eraseImportedPlaintextSource({
			account: "env-payment",
			location: "environment",
			encryptedBackup: false,
			plaintextKeys: true,
			walletDatabases: [],
			envVar: "PRIVATE_KEY_WIF",
		}),
	).toEqual({ erased: false, kind: "none" });
});

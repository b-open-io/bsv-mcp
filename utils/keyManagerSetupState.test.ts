import { expect, test } from "bun:test";
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	initializeSecureKeys,
	isLegacyWalletMigrationRequiredError,
	isMissingWalletKeysError,
	SecureKeyManager,
} from "./keyManager";

function tempKeyDir(): string {
	return mkdtempSync(join(tmpdir(), "bsv-mcp-setup-state-"));
}

function cleanEnv(): Record<string, string | undefined> {
	return {
		PRIVATE_KEY_WIF: undefined,
		IDENTITY_KEY_WIF: undefined,
		BSV_MCP_PASSWORD: undefined,
	};
}

function listFiles(dir: string): string[] {
	return readdirSync(dir).sort();
}

test("empty keydir raises MissingWalletKeysError", async () => {
	const dir = tempKeyDir();
	try {
		const manager = new SecureKeyManager({ keyDir: dir });
		const before = listFiles(dir);
		let error: unknown;
		try {
			await initializeSecureKeys(manager, cleanEnv());
		} catch (err) {
			error = err;
		}
		expect(error).toBeInstanceOf(Error);
		expect(isMissingWalletKeysError(error)).toBe(true);
		expect(isLegacyWalletMigrationRequiredError(error)).toBe(false);
		expect((error as Error).message).toContain("No key found at");
		expect(listFiles(dir)).toEqual(before);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test("keys.json metadata raises Legacy without reading key content", async () => {
	const dir = tempKeyDir();
	try {
		writeFileSync(join(dir, "keys.json"), "synthetic-garbage-not-json{{{");
		const manager = new SecureKeyManager({ keyDir: dir });
		const before = listFiles(dir);
		let error: unknown;
		try {
			await initializeSecureKeys(manager, cleanEnv());
		} catch (err) {
			error = err;
		}
		expect(isLegacyWalletMigrationRequiredError(error)).toBe(true);
		expect(isMissingWalletKeysError(error)).toBe(false);
		expect((error as Error).message).toContain("Legacy plaintext keys");
		expect(listFiles(dir)).toEqual(before);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test("encrypted present without password is fatal, not expected setup state", async () => {
	const dir = tempKeyDir();
	try {
		writeFileSync(join(dir, "keys.bep"), "synthetic-encrypted-material");
		const manager = new SecureKeyManager({ keyDir: dir });
		let error: unknown;
		try {
			await initializeSecureKeys(manager, cleanEnv());
		} catch (err) {
			error = err;
		}
		expect(error).toBeInstanceOf(Error);
		expect(isMissingWalletKeysError(error)).toBe(false);
		expect(isLegacyWalletMigrationRequiredError(error)).toBe(false);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test("invalid encrypted password is fatal, not expected setup state", async () => {
	const dir = tempKeyDir();
	try {
		writeFileSync(join(dir, "keys.bep"), "synthetic-corrupt-encrypted");
		const manager = new SecureKeyManager({ keyDir: dir });
		let error: unknown;
		try {
			await initializeSecureKeys(manager, {
				...cleanEnv(),
				BSV_MCP_PASSWORD: "synthetic-wrong-password-123",
			});
		} catch (err) {
			error = err;
		}
		expect(error).toBeInstanceOf(Error);
		expect(isMissingWalletKeysError(error)).toBe(false);
		expect(isLegacyWalletMigrationRequiredError(error)).toBe(false);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test("malformed WIF is fatal, not expected setup state", async () => {
	const dir = tempKeyDir();
	try {
		const manager = new SecureKeyManager({ keyDir: dir });
		let error: unknown;
		try {
			await initializeSecureKeys(manager, {
				...cleanEnv(),
				PRIVATE_KEY_WIF: "not-a-valid-wif",
			});
		} catch (err) {
			error = err;
		}
		expect(error).toBeInstanceOf(Error);
		expect(isMissingWalletKeysError(error)).toBe(false);
		expect(isLegacyWalletMigrationRequiredError(error)).toBe(false);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test("exact instanceof guards reject plain errors", () => {
	expect(isMissingWalletKeysError(new Error("No key found"))).toBe(false);
	expect(isLegacyWalletMigrationRequiredError(new Error("Legacy"))).toBe(false);
	expect(isMissingWalletKeysError(undefined)).toBe(false);
	expect(isLegacyWalletMigrationRequiredError(null)).toBe(false);
});

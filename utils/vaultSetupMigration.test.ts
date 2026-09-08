import { expect, test } from "bun:test";
import { inspectMigration, type MigrationInventory } from "./vaultMigration";
import type {
	MigrationPreview,
	VaultMigrationBackend,
	VaultMigrationDestination,
} from "./vaultMigrationWizard";
import { startVaultSetup } from "./vaultSetup";

const source = {
	account: "legacy",
	location: "legacy-root" as const,
	encryptedBackup: true,
	plaintextKeys: false,
	walletDatabases: ["wallet.db"],
};
const inventory: MigrationInventory = {
	sources: [source],
	vaultExists: true,
	environmentKeys: { payment: false, identity: false, empty: false },
	migrationRequired: true,
};
const destination: VaultMigrationDestination = {
	accountName: "legacy",
	vaultPath: "/tmp/vault.bep",
	vaultEntryId: "payment-entry",
};
const preview: MigrationPreview = {
	source: {
		account: "legacy",
		location: "legacy-root",
		addresses: ["1source"],
		databaseFiles: ["wallet.db"],
	},
	destination: {
		accountName: "legacy",
		vaultPath: destination.vaultPath,
		vaultEntryId: destination.vaultEntryId,
		addresses: ["1source"],
		existingVaultEntries: [],
	},
	preservation: {
		identity: "match",
		addresses: "match",
		databases: ["wallet.db"],
		vaultEntries: "retain",
	},
	conflicts: [],
};

function fakeBackend(): VaultMigrationBackend {
	return {
		available: true,
		beginUnlock: async (input) => ({
			sessionId: "http-session",
			expiresAt: Date.now() + 60_000,
			vaultPath: input.vaultPath,
			vaultEntryId: input.vaultEntryId,
		}),
		preview: async () => preview,
		cutover: async () => ({
			completed: true,
			verified: true,
			accountName: "legacy",
			preserved: {
				identity: true,
				addresses: true,
				databases: ["wallet.db"],
				vaultEntries: [],
			},
		}),
		lock: async () => {},
	};
}

test("local migration routes expose capability state and complete only after explicit cutover", async () => {
	const setup = await startVaultSetup({
		inspect: () => inventory,
		migrationBackend: fakeBackend(),
	});
	try {
		const url = new URL(setup.url);
		const headers = { Authorization: `Bearer ${url.hash.slice(1)}` };
		const page = await fetch(url.origin);
		const pageText = await page.text();
		expect(pageText).toContain("Choose a Vault destination");
		expect(pageText).toContain("MIGRATE_AND_SWITCH");
		expect(pageText).not.toContain("privateKey");
		const csp = page.headers.get("content-security-policy") ?? "";
		const nonce = csp.match(/script-src 'nonce-([^']+)'/)?.[1];
		expect(nonce).toBeTruthy();
		expect(pageText).toContain(`<script nonce="${nonce}">`);
		expect(pageText).toContain(`<style nonce="${nonce}">`);
		const capabilities = await fetch(
			`${url.origin}/api/migration/capabilities`,
			{ headers },
		);
		expect(await capabilities.json()).toMatchObject({ available: true });
		const unlocked = await fetch(`${url.origin}/api/migration/unlock`, {
			method: "POST",
			headers: { ...headers, "Content-Type": "application/json" },
			body: JSON.stringify({
				source,
				destination,
				sourcePassphrase: "local-secret",
				destinationPassphrase: "destination-secret",
			}),
		});
		expect(unlocked.status).toBe(200);
		const unlockData = await unlocked.json();
		expect(unlockData.preview.preservation.addresses).toBe("match");
		expect(JSON.stringify(unlockData)).not.toContain("local-secret");
		const cutover = await fetch(`${url.origin}/api/migration/cutover`, {
			method: "POST",
			headers: { ...headers, "Content-Type": "application/json" },
			body: JSON.stringify({
				sessionId: "http-session",
				confirmation: "MIGRATE_AND_SWITCH",
			}),
		});
		expect(cutover.status).toBe(200);
		expect(await cutover.json()).toMatchObject({
			completed: true,
			verified: true,
		});
		const repeated = await fetch(`${url.origin}/api/migration/cutover`, {
			method: "POST",
			headers: { ...headers, "Content-Type": "application/json" },
			body: JSON.stringify({
				sessionId: "http-session",
				confirmation: "MIGRATE_AND_SWITCH",
			}),
		});
		expect(repeated.status).toBe(200);
		expect(await repeated.json()).toMatchObject({
			completed: true,
			verified: true,
		});
	} finally {
		await setup.close();
	}
});

test("local migration routes return unavailable instead of pretending to migrate", async () => {
	const setup = await startVaultSetup({
		inspect: () =>
			inspectMigration({ home: "/tmp/bsv-vault-missing-home", env: {} }),
	});
	try {
		const url = new URL(setup.url);
		const headers = { Authorization: `Bearer ${url.hash.slice(1)}` };
		const capabilities = await fetch(
			`${url.origin}/api/migration/capabilities`,
			{ headers },
		);
		expect(await capabilities.json()).toMatchObject({ available: false });
		const attempt = await fetch(`${url.origin}/api/migration/cutover`, {
			method: "POST",
			headers: { ...headers, "Content-Type": "application/json" },
			body: JSON.stringify({ confirmation: "MIGRATE_AND_SWITCH" }),
		});
		expect(attempt.status).toBe(503);
		expect(await attempt.json()).toEqual({
			error: "Vault migration backend is unavailable.",
		});
	} finally {
		await setup.close();
	}
});

test("local setup initializes a trusted backend factory before listening", async () => {
	let initialized = false;
	const setup = await startVaultSetup({
		inspect: () => inventory,
		migrationBackendFactory: async () => {
			initialized = true;
			return fakeBackend();
		},
	});
	try {
		expect(initialized).toBe(true);
		const url = new URL(setup.url);
		const result = await fetch(`${url.origin}/api/migration/capabilities`, {
			headers: { Authorization: `Bearer ${url.hash.slice(1)}` },
		});
		expect(await result.json()).toMatchObject({ available: true });
	} finally {
		await setup.close();
	}
});

test("failed backend factory is unavailable with a sanitized actionable reason", async () => {
	const setup = await startVaultSetup({
		migrationBackendFactory: async () => {
			throw new Error("sourcePassphrase secret");
		},
	});
	try {
		const url = new URL(setup.url);
		const result = await fetch(`${url.origin}/api/migration/capabilities`, {
			headers: { Authorization: `Bearer ${url.hash.slice(1)}` },
		});
		const body = await result.json();
		expect(body.available).toBe(false);
		expect(body.reason).toContain("project configuration");
		expect(JSON.stringify(body)).not.toContain("sourcePassphrase");
	} finally {
		await setup.close();
	}
});

test("setup rejects ambiguous backend injection", async () => {
	await expect(
		startVaultSetup({
			migrationBackend: fakeBackend(),
			migrationBackendFactory: async () => fakeBackend(),
		}),
	).rejects.toThrow("either migrationBackend or migrationBackendFactory");
});

test("setup preserves the trusted no-effect recovery marker", async () => {
	const backend = fakeBackend();
	backend.cutover = async () => {
		const error = new Error("Destination precondition failed");
		Object.assign(error, { code: "PRECONDITION_FAILED", noEffect: true });
		throw error;
	};
	const setup = await startVaultSetup({
		inspect: () => inventory,
		migrationBackend: backend,
	});
	try {
		const url = new URL(setup.url);
		const headers = { Authorization: `Bearer ${url.hash.slice(1)}` };
		const unlocked = await fetch(`${url.origin}/api/migration/unlock`, {
			method: "POST",
			headers: { ...headers, "Content-Type": "application/json" },
			body: JSON.stringify({
				source,
				destination,
				sourcePassphrase: "local-secret",
				destinationPassphrase: "destination-secret",
			}),
		});
		const sessionId = (await unlocked.json()).session.sessionId;
		const failed = await fetch(`${url.origin}/api/migration/cutover`, {
			method: "POST",
			headers: { ...headers, "Content-Type": "application/json" },
			body: JSON.stringify({ sessionId, confirmation: "MIGRATE_AND_SWITCH" }),
		});
		expect(failed.status).toBe(409);
		expect(await failed.json()).toMatchObject({
			noEffect: true,
			error: "Destination precondition failed",
		});
	} finally {
		await setup.close();
	}
});

import { afterEach, expect, test } from "bun:test";
import { signerRequestAllowed } from "./signer";
import type { MigrationSource } from "./vaultMigration";
import type {
	MigrationInventory,
	MigrationPreview,
	MigrationProgress,
	MigrationReconciliation,
	VaultMigrationBackend,
	VaultMigrationCutoverResult,
	VaultMigrationDestination,
	VaultMigrationSession,
} from "./vaultMigrationWizard";
import { startVaultSetup } from "./vaultSetup";

/**
 * Browser contract for the shared local UI. Keep this matrix beside the
 * integration fixtures when moving the page into React so route behavior,
 * authentication, and approval boundaries remain reviewable.
 */
export const SHARED_LOCAL_UI_HTTP_CONTRACT = {
	public: ["GET /", "GET /setup.js"],
	bearerReads: ["GET /api/inventory", "GET /api/migration/capabilities"],
	bearerWrites: [
		"POST /api/migration/unlock",
		"POST /api/migration/preview",
		"POST /api/migration/resolve",
		"POST /api/migration/cutover",
		"POST /api/migration/reconcile",
		"POST /api/migration/lock",
	],
	approval: "POST /<ephemeral-token>/<HTTPWalletJSON-method>",
	security: {
		localHostOnly: true,
		bearerHeader: "Authorization: Bearer <setup-token>",
		noStore: true,
		migrationSession:
			"body.sessionId must equal the current local unlock session",
		cutoverConfirmation: "MIGRATE_AND_SWITCH",
		signerOrigin: "http://bsv-mcp.local",
	},
} as const;

const PASSPHRASE = "synthetic-local-passphrase";
const DESTINATION_PASSPHRASE = "synthetic-destination-passphrase";
const source: MigrationSource = {
	account: "synthetic",
	location: "account",
	encryptedBackup: true,
	plaintextKeys: false,
	walletDatabases: ["wallet-test.db"],
};
const destination: VaultMigrationDestination = {
	accountName: source.account,
	vaultPath: "/tmp/shared-local-ui-vault.bep",
	vaultEntryId: "new",
};
const inventory: MigrationInventory = {
	sources: [source],
	vaultExists: false,
	environmentKeys: { payment: false, identity: false, empty: false },
	migrationRequired: true,
};
const roleSelection = {
	expectedProjectId: "synthetic-project",
	expectedRevision: null,
	roleAssignments: {
		"identity-signing": "select:identity",
		payments: "select:payment",
		"one-sat": "select:payment",
		encryption: "select:identity",
	},
};
const completeResult: VaultMigrationCutoverResult = {
	completed: true,
	verified: true,
	accountName: source.account,
	preserved: {
		identity: true,
		addresses: true,
		databases: source.walletDatabases,
		vaultEntries: [],
	},
};

function preview(): MigrationPreview {
	return {
		projectRoles: {
			projectId: "synthetic-project",
			current: null,
			candidates: [
				{
					candidateId: "payment",
					label: "Synthetic payment key",
					supportedRoles: ["payments", "one-sat"],
				},
				{
					candidateId: "identity",
					label: "Synthetic identity key",
					supportedRoles: ["identity-signing", "encryption"],
				},
			],
		},
		source: {
			account: source.account,
			location: source.location,
			identity: "synthetic-identity",
			addresses: ["synthetic-address"],
			databaseFiles: source.walletDatabases,
		},
		destination: {
			accountName: destination.accountName,
			vaultPath: destination.vaultPath,
			vaultEntryId: destination.vaultEntryId,
			identity: "synthetic-identity",
			addresses: ["synthetic-address"],
			existingVaultEntries: [],
		},
		preservation: {
			identity: "match",
			addresses: "match",
			databases: source.walletDatabases,
			vaultEntries: "retain",
		},
		conflicts: [
			{
				id: "synthetic-conflict",
				kind: "vault-entry",
				message: "Synthetic existing entry requires an explicit resolution",
			},
		],
	};
}

class UiContractBackend implements VaultMigrationBackend {
	readonly available = true;
	readonly calls: string[] = [];
	roleSelection: unknown;
	reconcileStatus: MigrationReconciliation["status"] = "unknown";

	async beginUnlock(
		input: Parameters<VaultMigrationBackend["beginUnlock"]>[0],
	): Promise<VaultMigrationSession> {
		this.calls.push("unlock");
		return {
			sessionId: "synthetic-ui-session",
			expiresAt: Date.now() + 300_000,
			vaultPath: input.vaultPath,
			vaultEntryId: input.vaultEntryId,
			publicKey: "02synthetic",
		};
	}

	async preview(): Promise<MigrationPreview> {
		this.calls.push("preview");
		return preview();
	}

	async cutover(
		input: Parameters<VaultMigrationBackend["cutover"]>[0],
		onProgress?: (progress: MigrationProgress) => void,
	): Promise<VaultMigrationCutoverResult> {
		this.calls.push("cutover");
		this.roleSelection = input.roleSelection;
		onProgress?.({
			stage: "verify",
			completed: 3,
			total: 4,
			message: "Synthetic encrypted destination verified",
		});
		return completeResult;
	}

	async reconcile(): Promise<MigrationReconciliation> {
		this.calls.push("reconcile");
		return { status: this.reconcileStatus };
	}

	async lock(): Promise<void> {
		this.calls.push("lock");
	}
}

const setups: Array<{ close: () => Promise<void> }> = [];
afterEach(async () => {
	for (const setup of setups.splice(0)) await setup.close();
});

function auth(setup: { url: string }) {
	const url = new URL(setup.url);
	return {
		url,
		headers: { Authorization: `Bearer ${url.hash.slice(1)}` },
	};
}

async function request(
	setup: { url: string },
	path: string,
	init: RequestInit = {},
) {
	const { url, headers } = auth(setup);
	return fetch(`${url.origin}${path}`, {
		...init,
		headers: { ...headers, ...(init.headers ?? {}) },
	});
}

async function post(setup: { url: string }, path: string, body: unknown) {
	return request(setup, path, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
}

async function setupWith(backend?: VaultMigrationBackend) {
	const setup = await startVaultSetup({
		inspect: () => inventory,
		migrationBackend: backend,
	});
	setups.push(setup);
	return setup;
}

test("serves a nonce-protected shell and keeps inventory reads bearer guarded", async () => {
	const setup = await setupWith(new UiContractBackend());
	const { url, headers } = auth(setup);

	const page = await fetch(`${url.origin}/`);
	expect(page.status).toBe(200);
	expect(page.headers.get("cache-control")).toBe("no-store");
	expect(page.headers.get("x-content-type-options")).toBe("nosniff");
	const csp = page.headers.get("content-security-policy") ?? "";
	expect(csp).toContain("default-src 'none'");
	expect(csp).toContain("script-src 'nonce-");
	expect(csp).toContain("connect-src 'self'");
	const pageText = await page.text();
	expect(pageText).not.toContain(PASSPHRASE);
	expect(pageText).not.toContain(DESTINATION_PASSPHRASE);

	const script = await fetch(`${url.origin}/setup.js`);
	expect(script.status).toBe(200);
	expect(script.headers.get("cache-control")).toBe("no-store");

	expect((await fetch(`${url.origin}/api/inventory`)).status).toBe(403);
	expect(
		(
			await fetch(`${url.origin}/api/inventory`, {
				headers: { Authorization: "Bearer invalid" },
			})
		).status,
	).toBe(403);
	expect(
		(
			await fetch(`${url.origin}/api/inventory`, {
				headers: { ...headers, Origin: "http://evil.example" },
			})
		).status,
	).toBe(403);
	const hostMismatch = await fetch(
		`http://localhost:${url.port}/api/inventory`,
		{ headers },
	);
	expect(hostMismatch.status).toBe(403);

	const inventoryResponse = await request(setup, "/api/inventory");
	expect(inventoryResponse.status).toBe(200);
	expect(await inventoryResponse.json()).toEqual(inventory);
	const wrongMethod = await request(setup, "/api/inventory", {
		method: "POST",
	});
	expect(wrongMethod.status).toBe(405);
	expect(wrongMethod.headers.get("allow")).toBe("GET");
});

test("keeps capability and migration writes disabled when the backend is unavailable", async () => {
	const setup = await setupWith();
	const capabilities = await request(setup, "/api/migration/capabilities");
	expect(capabilities.status).toBe(200);
	expect(await capabilities.json()).toMatchObject({ available: false });
	const attempt = await post(setup, "/api/migration/unlock", {
		source,
		destination,
		sourcePassphrase: PASSPHRASE,
		destinationPassphrase: DESTINATION_PASSPHRASE,
	});
	expect(attempt.status).toBe(503);
	expect(await attempt.json()).toEqual({
		error: "Vault migration backend is unavailable.",
	});
	const capabilityMethod = await request(setup, "/api/migration/capabilities", {
		method: "POST",
	});
	expect(capabilityMethod.status).toBe(405);
});

test("supports the shared UI unlock, preview, conflict, role, and cutover contract", async () => {
	const backend = new UiContractBackend();
	const setup = await setupWith(backend);
	const missing = await post(setup, "/api/migration/unlock", {});
	expect(missing.status).toBe(400);
	expect(backend.calls).toEqual([]);

	const unlocked = await post(setup, "/api/migration/unlock", {
		source,
		destination,
		sourcePassphrase: PASSPHRASE,
		destinationPassphrase: DESTINATION_PASSPHRASE,
	});
	expect(unlocked.status).toBe(200);
	const unlockedBody = await unlocked.json();
	expect(unlockedBody.session.sessionId).toBe("synthetic-ui-session");
	expect(JSON.stringify(unlockedBody)).not.toContain(PASSPHRASE);
	expect(JSON.stringify(unlockedBody)).not.toContain(DESTINATION_PASSPHRASE);
	expect(backend.calls).toEqual(["unlock", "preview"]);
	const sessionId = unlockedBody.session.sessionId;

	const wrongSession = await post(setup, "/api/migration/preview", {
		sessionId: "wrong-session",
	});
	expect(wrongSession.status).toBe(409);
	expect(backend.calls).toEqual(["unlock", "preview"]);

	const unresolved = await post(setup, "/api/migration/cutover", {
		sessionId,
		confirmation: "MIGRATE_AND_SWITCH",
		roleSelection,
	});
	expect(unresolved.status).toBe(409);
	expect(backend.calls).toEqual(["unlock", "preview"]);

	const resolved = await post(setup, "/api/migration/resolve", {
		sessionId,
		conflictId: "synthetic-conflict",
		resolution: "keep-existing",
	});
	expect(resolved.status).toBe(200);
	const resolvedBody = await resolved.json();
	expect(resolvedBody.preview.conflicts[0].resolution).toBe("keep-existing");

	const cutover = await post(setup, "/api/migration/cutover", {
		sessionId,
		confirmation: "MIGRATE_AND_SWITCH",
		roleSelection,
	});
	expect(cutover.status).toBe(200);
	expect(await cutover.json()).toEqual(completeResult);
	expect(backend.calls).toEqual(["unlock", "preview", "cutover"]);
	expect(backend.roleSelection).toEqual(roleSelection);
});

test("lock cancellation invalidates the browser session before any cutover", async () => {
	const backend = new UiContractBackend();
	const setup = await setupWith(backend);
	const unlocked = await post(setup, "/api/migration/unlock", {
		source,
		destination,
		sourcePassphrase: PASSPHRASE,
		destinationPassphrase: DESTINATION_PASSPHRASE,
	});
	const sessionId = (await unlocked.json()).session.sessionId;
	const locked = await post(setup, "/api/migration/lock", { sessionId });
	expect(locked.status).toBe(200);
	expect(await locked.json()).toEqual({ locked: true });
	const cutover = await post(setup, "/api/migration/cutover", {
		sessionId,
		confirmation: "MIGRATE_AND_SWITCH",
		roleSelection,
	});
	expect(cutover.status).toBe(409);
	expect(backend.calls).toEqual(["unlock", "preview", "lock"]);
});

test("approval HTTP boundary requires an ephemeral token, POST, allowlisted method, and exact origin", () => {
	const allowed = new Set(["createAction", "signAction"]);
	const valid = new Request(
		"http://127.0.0.1:1234/synthetic-token/createAction",
		{
			method: "POST",
			headers: { Origin: "http://bsv-mcp.local" },
		},
	);
	expect(signerRequestAllowed(valid, "synthetic-token", allowed)).toBe(
		"createAction",
	);
	expect(
		signerRequestAllowed(
			new Request(valid, { method: "GET" }),
			"synthetic-token",
			allowed,
		),
	).toBeUndefined();
	expect(
		signerRequestAllowed(
			new Request("http://127.0.0.1:1234/other-token/createAction", {
				method: "POST",
				headers: { Origin: "http://bsv-mcp.local" },
			}),
			"synthetic-token",
			allowed,
		),
	).toBeUndefined();
	expect(
		signerRequestAllowed(
			new Request(valid, {
				method: "POST",
				headers: { Origin: "http://evil.example" },
			}),
			"synthetic-token",
			allowed,
		),
	).toBeUndefined();
	expect(
		signerRequestAllowed(
			new Request("http://127.0.0.1:1234/synthetic-token/unknown", {
				method: "POST",
				headers: { Origin: "http://bsv-mcp.local" },
			}),
			"synthetic-token",
			allowed,
		),
	).toBeUndefined();
});

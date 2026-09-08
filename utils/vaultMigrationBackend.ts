import { createHash, randomUUID } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import {
	chmod,
	copyFile,
	link,
	mkdir,
	open,
	readFile,
	rename,
	rm,
} from "node:fs/promises";
import { dirname, isAbsolute, join, sep } from "node:path";
import { HD, PrivateKey } from "@bsv/sdk";
import {
	type AccountConfig,
	accountDir,
	accountNameSchema,
	accountsRoot,
	readAccount,
	regularPath,
} from "./accounts";
import { decodeEncryptedKeys } from "./keyManager";
import {
	changeProjectRoleBindings,
	projectRoleBindingsSchema,
	type ProjectKeyRole,
	type ProjectRoleBindings,
} from "./projectRoleBindings";
import {
	loadProjectRoleBindings,
	saveProjectRoleBindings,
} from "./projectRoleBindingsStore";
import {
	prepareProjectRoleSelection,
	type ProjectRoleCandidate,
	type ProjectRoleSelectionRequest,
} from "./projectRoleSelection";
import {
	canonicalMigrationPath,
	type MigrationJournal,
	migrationJournalPaths,
	readMigrationJournal,
	writeMigrationJournal,
} from "./vaultMigrationJournal";
import type {
	MigrationPreview,
	VaultMigrationBackend,
	VaultMigrationCutoverResult,
	VaultMigrationDestination,
	VaultMigrationSession,
	VaultMigrationUnlockRequest,
} from "./vaultMigrationWizard";
import { VaultWalletError } from "./vaultWallet";
import { loadInstalledVaultModule } from "./vaultWalletController";

interface Entry {
	id: string;
	kind: string;
	label: string;
	publicKey?: string;
	value: string;
	[key: string]: unknown;
}
interface MigrationVault {
	toDocument(): {
		id: string;
		entries: Entry[];
		settings: { revealEnabled: boolean };
	};
	list(): Omit<Entry, "value">[];
	unlock(reason: string, ttlSeconds?: number): void;
	lock(): void;
	reveal(id: string, reason: string): string;
	importPlain(payload: unknown, label: string): Entry[];
	adoptEntry(entry: Entry, detail?: string): Entry;
}
interface MigrationModule {
	PassphraseProvider: new (passphrase: string) => unknown;
	Vault: new (document: unknown) => MigrationVault;
	createVaultDocument(settings?: { revealEnabled?: boolean }): unknown;
	openVault(path: string, provider: unknown): Promise<MigrationVault>;
	createVault(path: string, providers: unknown[]): Promise<MigrationVault>;
	saveVault(
		path: string,
		vault: MigrationVault,
		provider: unknown,
	): Promise<void>;
}
export interface AccountVaultMigrationOptions {
	projectRoot: string;
	expectedProjectId: string;
	/** Trusted destination selected in the local command configuration. */
	vaultPath: string;
	accountsDirectory?: string;
	/** Explicit role choices; no key role is inferred from labels or entry flags. */
	roleAssignments?: Partial<Record<ProjectKeyRole, "payment" | "identity">>;
	loadModule?: () => Promise<unknown>;
	now?: () => number;
}
function roleCandidates(prepared: Prepared): ProjectRoleCandidate[] {
	return Object.entries(prepared.entries).flatMap(([candidateId, entry]) =>
		entry?.publicKey
			? [
					{
						candidateId,
						label:
							candidateId === "payment"
								? "Imported payment key"
								: "Imported identity key",
						accountId: prepared.accountName,
						key: {
							vaultId: prepared.vault.toDocument().id,
							entryId: entry.id,
							expectedPublicKey: entry.publicKey,
						},
						keyUseContract: "direct-v1" as const,
						supportedRoles:
							candidateId === "payment"
								? (["payments", "one-sat"] as const)
								: (["identity-signing", "encryption"] as const),
					},
				]
			: [],
	);
}

interface LocalCredentials {
	sourcePassphrase: string;
	destinationPassphrase: string;
}
interface Prepared {
	session: VaultMigrationSession;
	accountName: string;
	vault: MigrationVault;
	password: string;
	vaultBefore: Buffer | null;
	sourceBytes: Buffer;
	sourceDir: string;
	sourceHashes: Map<string, string>;
	config: AccountConfig;
	projectConfig: unknown;
	projectRevision: number | null;
	entries: { payment: Entry; identity?: Entry };
	originalEntries: Omit<Entry, "value">[];
	timer: ReturnType<typeof setTimeout>;
	busy: boolean;
}
const digest = (data: Uint8Array | string) =>
	createHash("sha256").update(data).digest("hex");
const failure = (code: string, message: string) =>
	new VaultWalletError(code, message);
const noSecrets = (error: unknown) =>
	error instanceof VaultWalletError
		? error
		: failure(
				"MIGRATION_FAILED",
				"Migration did not complete. The original account files remain available; unlock again to inspect recovery state.",
			);
async function syncFile(path: string) {
	const file = await open(path, "r");
	try {
		await file.sync();
	} finally {
		await file.close();
	}
}
async function syncDirectory(path: string) {
	const directory = await open(path, "r");
	try {
		await directory.sync();
	} finally {
		await directory.close();
	}
}
function sameDestination(
	prepared: Prepared,
	destination: VaultMigrationDestination,
) {
	return (
		destination.accountName === prepared.accountName &&
		canonicalMigrationPath(destination.vaultPath) ===
			prepared.session.vaultPath &&
		destination.vaultEntryId === prepared.session.vaultEntryId &&
		(destination.expectedPublicKey === undefined ||
			destination.expectedPublicKey === prepared.session.publicKey)
	);
}

/** Existing encrypted named accounts only. No source deletion or live-wallet switch. */
export async function createAccountVaultMigrationBackend(
	options: AccountVaultMigrationOptions,
): Promise<VaultMigrationBackend> {
	if (
		!isAbsolute(options.projectRoot) ||
		!isAbsolute(options.vaultPath) ||
		!options.expectedProjectId
	)
		throw failure(
			"PROJECT_REQUIRED",
			"Configure an explicit project root, project ID and absolute Vault path.",
		);
	const projectRoot = canonicalMigrationPath(options.projectRoot);
	const expectedProjectId = options.expectedProjectId;
	const roleAssignments = Object.freeze({ ...options.roleAssignments });
	const vaultPath = canonicalMigrationPath(options.vaultPath);
	const root = canonicalMigrationPath(
		options.accountsDirectory ?? accountsRoot(),
	);
	if (!isAbsolute(root))
		throw failure(
			"PROJECT_REQUIRED",
			"The account directory must be an explicit absolute path.",
		);
	const now = options.now ?? Date.now;
	if (
		vaultPath === root ||
		vaultPath === dirname(vaultPath) ||
		vaultPath.startsWith(`${root}${sep}`)
	)
		throw failure(
			"INVALID_DESTINATION",
			"The Vault destination must be outside the original account directory tree.",
		);
	let module: MigrationModule;
	try {
		const candidate = await (options.loadModule ?? loadInstalledVaultModule)();
		if (
			!candidate ||
			typeof candidate !== "object" ||
			![
				"PassphraseProvider",
				"Vault",
				"createVaultDocument",
				"openVault",
				"createVault",
				"saveVault",
			].every(
				(name) =>
					name in candidate &&
					typeof (candidate as Record<string, unknown>)[name] === "function",
			)
		)
			throw failure(
				"VAULT_PACKAGE_INCOMPATIBLE",
				"The installed Vault package does not provide encrypted migration support.",
			);
		module = candidate as MigrationModule;
	} catch (error) {
		const safe = noSecrets(error);
		return {
			available: false,
			unavailableReason: safe.message,
			beginUnlock: async () => {
				throw safe;
			},
			preview: async () => {
				throw safe;
			},
			cutover: async () => {
				throw safe;
			},
			lock: async () => {},
		};
	}
	const sessions = new Map<string, Prepared>();
	const outcomes = new Map<
		string,
		{ activationAttempted: boolean; result?: VaultMigrationCutoverResult }
	>();
	const close = async (id: string) => {
		const prepared = sessions.get(id);
		if (!prepared) return;
		sessions.delete(id);
		clearTimeout(prepared.timer);
		prepared.password = "";
		prepared.vault.lock();
	};
	const current = (id: string) => {
		const prepared = sessions.get(id);
		if (!prepared || now() >= prepared.session.expiresAt) {
			void close(id);
			throw failure(
				"SESSION_EXPIRED",
				"Unlock the account and Vault again before migrating.",
			);
		}
		return prepared;
	};
	const checkSource = (prepared: Prepared) => {
		for (const [name, hash] of prepared.sourceHashes) {
			const path = join(prepared.sourceDir, name);
			regularPath(path);
			if (!existsSync(path) || digest(readFileSync(path)) !== hash)
				throw failure(
					"SOURCE_CHANGED",
					"The account changed since preview. Close its wallet and unlock again before migration.",
				);
		}
	};
	const assertRequest = (
		prepared: Prepared,
		input: {
			source: { account: string; location: string };
			destination: VaultMigrationDestination;
		},
	) => {
		if (
			input.source.location !== "account" ||
			input.source.account !== prepared.accountName ||
			!sameDestination(prepared, input.destination)
		)
			throw failure(
				"INVALID_SELECTION",
				"Migration must preserve the explicitly selected existing account and Vault destination.",
			);
	};
	return {
		available: true,
		async beginUnlock(input: VaultMigrationUnlockRequest) {
			let vault: MigrationVault | undefined;
			try {
				const credentials = input as VaultMigrationUnlockRequest &
					Partial<LocalCredentials>;
				if (
					typeof credentials.sourcePassphrase !== "string" ||
					!credentials.sourcePassphrase ||
					typeof credentials.destinationPassphrase !== "string" ||
					credentials.destinationPassphrase.length < 8
				)
					throw failure(
						"CREDENTIALS_REQUIRED",
						"Enter the account passphrase and a Vault passphrase of at least eight characters separately.",
					);
				const name = accountNameSchema.parse(input.accountName);
				if (
					input.source.location !== "account" ||
					input.source.account !== name
				)
					throw failure(
						"SOURCE_UNSUPPORTED",
						"Choose the same existing encrypted named account as source and destination.",
					);
				if (canonicalMigrationPath(input.vaultPath) !== vaultPath)
					throw failure(
						"INVALID_DESTINATION",
						"Choose the locally configured Vault destination.",
					);
				const ttl = input.ttlMs ?? 300_000;
				if (!Number.isSafeInteger(ttl) || ttl < 1000 || ttl > 3_600_000)
					throw failure(
						"INVALID_TTL",
						"Migration unlock duration must be between one second and one hour.",
					);
				regularPath(root, true);
				const sourceDir = accountDir(name, root);
				regularPath(sourceDir, true);
				const configPath = join(sourceDir, "config.json");
				regularPath(configPath);
				const configBytes = readFileSync(configPath);
				const config = readAccount(name, root);
				if (!config)
					throw failure(
						"ACCOUNT_UNAVAILABLE",
						"The selected existing account configuration is unavailable.",
					);
				const sourcePath = join(sourceDir, "keys.bep");
				regularPath(sourcePath);
				const sourceBytes = readFileSync(sourcePath);
				const keys = await decodeEncryptedKeys(
					sourceBytes.toString("utf8"),
					credentials.sourcePassphrase,
				);
				if (!keys.payPk)
					throw failure(
						"SOURCE_UNSUPPORTED",
						"The encrypted account has no payment key.",
					);
				const paymentPublicKey = keys.payPk.toPublicKey().toString();
				if (
					input.expectedPublicKey &&
					input.expectedPublicKey !== paymentPublicKey
				)
					throw failure(
						"IDENTITY_MISMATCH",
						"The account payment key does not match the approved public key.",
					);
				regularPath(dirname(vaultPath), true);
				regularPath(vaultPath);
				const vaultBefore = existsSync(vaultPath)
					? readFileSync(vaultPath)
					: null;
				vault = vaultBefore
					? await module.openVault(
							vaultPath,
							new module.PassphraseProvider(credentials.destinationPassphrase),
						)
					: new module.Vault(
							module.createVaultDocument({ revealEnabled: true }),
						);
				if (!vault.toDocument().settings.revealEnabled)
					throw failure(
						"REVEAL_DISABLED",
						"Enable Vault reveal locally before choosing in-memory wallet use.",
					);
				const originalEntries = vault.list();
				vault.unlock(
					"Review encrypted account migration",
					Math.ceil(ttl / 1000),
				);
				// New imports receive Vault-generated IDs. 'new' is only a UI selection marker.
				if (input.vaultEntryId !== "new")
					throw failure(
						"DESTINATION_UNSUPPORTED",
						"Choose a new Vault entry; existing entries are retained without replacement.",
					);
				const payment = vault.importPlain(
					{ wif: keys.payPk.toWif() },
					`${name} payment`,
				)[0];
				if (!payment)
					throw failure(
						"IMPORT_FAILED",
						"Vault did not create the payment entry.",
					);
				const identity = keys.identityPk
					? vault.importPlain(
							{ wif: keys.identityPk.toWif() },
							`${name} identity`,
						)[0]
					: undefined;
				if (keys.xprv) {
					const at = new Date(now()).toISOString();
					vault.adoptEntry(
						{
							id: randomUUID(),
							kind: "hd-private",
							label: `${name} retained HD identity`,
							tags: [],
							createdAt: at,
							updatedAt: at,
							value: keys.xprv,
							publicKey: HD.fromString(keys.xprv).pubKey.toString(),
							metadata: { purpose: "legacy identity recovery" },
						},
						"Preserve encrypted legacy HD identity",
					);
				}
				for (const source of Object.values(roleAssignments)) {
					if (source !== "payment" && source !== "identity")
						throw failure(
							"ROLE_SELECTION_REQUIRED",
							"Choose explicit supported project key roles.",
						);
					if (source === "identity" && !identity)
						throw failure(
							"IDENTITY_UNAVAILABLE",
							"This account has no standalone identity key for the selected role.",
						);
				}
				const projectConfig = await loadProjectRoleBindings(
					projectRoot,
					expectedProjectId,
				);
				const sourceHashes = new Map<string, string>();
				for (const file of readdirSync(sourceDir)) {
					if (
						file === "keys.bep" ||
						file === "config.json" ||
						/^wallet(?:-(main|test))?\.db(?:-wal|-shm)?$/.test(file)
					) {
						const path = join(sourceDir, file);
						regularPath(path);
						sourceHashes.set(file, digest(readFileSync(path)));
					}
				}
				if (
					digest(sourceBytes) !== sourceHashes.get("keys.bep") ||
					digest(configBytes) !== sourceHashes.get("config.json")
				)
					throw failure(
						"SOURCE_CHANGED",
						"The source changed while unlocking. Try again.",
					);
				const session: VaultMigrationSession = {
					sessionId: randomUUID(),
					expiresAt: now() + ttl,
					vaultPath,
					vaultEntryId: "new",
					publicKey: paymentPublicKey,
					expectedPublicKey: input.expectedPublicKey,
				};
				const timer = setTimeout(() => {
					void close(session.sessionId);
				}, ttl);
				timer.unref?.();
				sessions.set(session.sessionId, {
					session,
					accountName: name,
					vault,
					password: credentials.destinationPassphrase,
					vaultBefore,
					sourceBytes,
					sourceDir,
					sourceHashes,
					config,
					projectConfig,
					projectRevision: projectConfig?.revision ?? null,
					entries: { payment, identity },
					originalEntries,
					timer,
					busy: false,
				});
				return { ...session };
			} catch (error) {
				vault?.lock();
				throw noSecrets(error);
			}
		},
		async preview(input) {
			const prepared = current(input.sessionId);
			assertRequest(prepared, input);
			checkSource(prepared);
			const addresses = prepared.config.address
				? [prepared.config.address]
				: [];
			const databases = [...prepared.sourceHashes.keys()].filter((name) =>
				name.includes(".db"),
			);
			const preview: MigrationPreview & {
				projectRoles: {
					current: unknown;
					projectId: string;
					candidates: ProjectRoleCandidate[];
				};
			} = {
				projectRoles: {
					current: prepared.projectConfig,
					projectId: expectedProjectId,
					candidates: roleCandidates(prepared),
				},
				source: {
					account: prepared.accountName,
					location: "account",
					identity: prepared.session.publicKey,
					addresses,
					databaseFiles: databases,
				},
				destination: {
					accountName: prepared.accountName,
					vaultPath,
					vaultEntryId: prepared.session.vaultEntryId,
					identity: prepared.session.publicKey,
					addresses,
					existingVaultEntries: prepared.originalEntries.map((entry) => ({
						entryId: String(entry.id),
						publicKey:
							typeof entry.publicKey === "string" ? entry.publicKey : undefined,
						label: String(entry.label),
					})),
				},
				preservation: {
					identity: "match",
					addresses: addresses.length ? "match" : "unknown",
					databases,
					vaultEntries: "retain",
				},
				conflicts: [],
			};
			return preview;
		},
		async cutover(input, onProgress) {
			const prepared = current(input.sessionId);
			assertRequest(prepared, input);
			if (input.confirmation !== "MIGRATE_AND_SWITCH")
				throw failure(
					"CONFIRMATION_REQUIRED",
					"Confirm migration before writing the encrypted destination.",
				);
			if (prepared.busy)
				throw failure("MIGRATION_BUSY", "This migration is already running.");
			const selectionRequest = (
				input as typeof input & { roleSelection?: ProjectRoleSelectionRequest }
			).roleSelection;
			if (!selectionRequest && Object.keys(roleAssignments).length === 0)
				throw failure(
					"ROLE_SELECTION_REQUIRED",
					"Choose explicit project key roles before cutover.",
				);
			if (selectionRequest)
				prepareProjectRoleSelection(
					prepared.projectConfig,
					roleCandidates(prepared),
					selectionRequest,
					{
						createBindingId: () => randomUUID(),
						now: new Date(now()).toISOString(),
						expectedProjectId,
					},
				);
			prepared.busy = true;
			const outcome = { activationAttempted: false } as {
				activationAttempted: boolean;
				result?: VaultMigrationCutoverResult;
			};
			outcomes.set(input.sessionId, outcome);
			let stageDirectory: string | undefined;
			const journal: MigrationJournal = {
				version: 1,
				sessionId: input.sessionId,
				projectRoot,
				projectId: expectedProjectId,
				vaultPath,
				accountName: prepared.accountName,
				phase: "prepared",
				sourceHashes: Object.fromEntries(prepared.sourceHashes),
				beforeVaultHash: prepared.vaultBefore
					? digest(prepared.vaultBefore)
					: null,
				beforeConfigHash:
					prepared.projectConfig === null
						? null
						: digest(JSON.stringify(prepared.projectConfig)),
				preserved: {
					identity: true,
					addresses: true,
					databases: [...prepared.sourceHashes.keys()].filter((name) =>
						name.includes(".db"),
					),
					vaultEntries: prepared.originalEntries.map((entry) =>
						String(entry.id),
					),
				},
			};
			let lockHandle: Awaited<ReturnType<typeof open>> | undefined;
			const lockPath = `${vaultPath}.lock`;
			const progress = (
				stage: "backup" | "import" | "verify" | "cutover" | "complete",
				completed: number,
				message: string,
			) => onProgress?.({ stage, completed, total: 5, message });
			try {
				checkSource(prepared);
				current(input.sessionId);
				await mkdir(dirname(vaultPath), { recursive: true, mode: 0o700 });
				regularPath(dirname(vaultPath), true);
				regularPath(lockPath);
				lockHandle = await open(lockPath, "wx", 0o600);
				await lockHandle.writeFile(
					JSON.stringify({
						pid: process.pid,
						at: now(),
						sessionId: input.sessionId,
					}),
				);
				await lockHandle.sync();
				await writeMigrationJournal(journal);
				regularPath(vaultPath);
				const actual = existsSync(vaultPath) ? await readFile(vaultPath) : null;
				if (
					(actual === null) !== (prepared.vaultBefore === null) ||
					(actual &&
						prepared.vaultBefore &&
						digest(actual) !== digest(prepared.vaultBefore))
				)
					throw failure(
						"VAULT_CHANGED",
						"The destination Vault changed after preview. Unlock again to preserve its current entries.",
					);
				progress(
					"backup",
					0,
					"Preserving the original encrypted account and destination.",
				);
				stageDirectory = migrationJournalPaths(
					vaultPath,
					input.sessionId,
				).stageDirectory;
				await mkdir(stageDirectory, { mode: 0o700 });
				await chmod(stageDirectory, 0o700);
				const backup = join(stageDirectory, "source-keys.bep");
				const backupHandle = await open(backup, "wx", 0o600);
				try {
					await backupHandle.writeFile(prepared.sourceBytes);
					await backupHandle.sync();
				} finally {
					await backupHandle.close();
				}
				const stage = join(stageDirectory, "destination.bep");
				if (prepared.vaultBefore) {
					const previousBackup = join(stageDirectory, "previous-vault.bep");
					await copyFile(vaultPath, previousBackup);
					await chmod(previousBackup, 0o600);
					await syncFile(previousBackup);
					await copyFile(vaultPath, stage);
					await chmod(stage, 0o600);
				} else {
					const empty = await module.createVault(stage, [
						new module.PassphraseProvider(prepared.password),
					]);
					empty.lock();
				}
				current(input.sessionId);
				progress("import", 1, "Writing only encrypted Vault data.");
				await module.saveVault(
					stage,
					prepared.vault,
					new module.PassphraseProvider(prepared.password),
				);
				await syncFile(stage);
				await syncDirectory(stageDirectory);
				current(input.sessionId);
				progress(
					"verify",
					2,
					"Reopening the encrypted destination to verify all imported and retained entries.",
				);
				const verified = await module.openVault(
					stage,
					new module.PassphraseProvider(prepared.password),
				);
				try {
					if (
						JSON.stringify(verified.toDocument().entries) !==
						JSON.stringify(prepared.vault.toDocument().entries)
					)
						throw failure(
							"VERIFICATION_FAILED",
							"The encrypted destination did not preserve every Vault entry.",
						);
					verified.unlock("Verify migrated payment identity", 30);
					if (
						PrivateKey.fromWif(
							verified.reveal(
								prepared.entries.payment.id,
								"Verify migrated payment identity",
							),
						)
							.toPublicKey()
							.toString() !== prepared.session.publicKey
					)
						throw failure(
							"VERIFICATION_FAILED",
							"The encrypted payment identity could not be verified.",
						);
				} finally {
					verified.lock();
				}
				checkSource(prepared);
				current(input.sessionId);
				const base: ProjectRoleBindings =
					prepared.projectConfig === null
						? {
								schemaVersion: 1,
								projectId: expectedProjectId,
								revision: 0,
								current: {
									"identity-signing": null,
									payments: null,
									"one-sat": null,
									encryption: null,
								},
								bindings: [],
								retained: [],
							}
						: (prepared.projectConfig as ProjectRoleBindings);
				const changes = Object.entries(roleAssignments).map(
					([role, source]) => {
						const entry = prepared.entries[source];
						if (!entry?.publicKey)
							throw failure(
								"VERIFICATION_FAILED",
								"A selected project role has no verified public key.",
							);
						return {
							role: role as ProjectKeyRole,
							binding: {
								bindingId: randomUUID(),
								accountId: prepared.accountName,
								key: {
									vaultId: prepared.vault.toDocument().id,
									entryId: entry.id,
									expectedPublicKey: entry.publicKey,
								},
								keyUseContract: "direct-v1" as const,
								createdAt: new Date(now()).toISOString(),
							},
						};
					},
				);
				const selection = (
					input as typeof input & {
						roleSelection?: ProjectRoleSelectionRequest;
					}
				).roleSelection;
				const next = selection
					? prepareProjectRoleSelection(
							prepared.projectConfig,
							roleCandidates(prepared),
							selection,
							{
								createBindingId: () => randomUUID(),
								now: new Date(now()).toISOString(),
								expectedProjectId,
							},
						)
					: changeProjectRoleBindings(base, {
							expectedProjectId: expectedProjectId,
							expectedRevision: base.revision,
							changes,
						});
				journal.nextProjectConfig = projectRoleBindingsSchema.parse(
					prepared.projectRevision === null ? { ...next, revision: 0 } : next,
				);
				journal.stagedVaultHash = digest(await readFile(stage));
				journal.phase = "stage-verified";
				await writeMigrationJournal(journal);
				const latest = await loadProjectRoleBindings(
					projectRoot,
					expectedProjectId,
				);
				if ((latest?.revision ?? null) !== prepared.projectRevision)
					throw failure(
						"PROJECT_CHANGED",
						"Project roles changed after preview. Unlock again before cutover.",
					);
				current(input.sessionId);
				progress(
					"cutover",
					3,
					"Activating the verified encrypted Vault; original account files stay in place.",
				);
				outcome.activationAttempted = true;
				journal.phase = "activation-pending";
				await writeMigrationJournal(journal);
				if (prepared.vaultBefore) await rename(stage, vaultPath);
				else {
					await link(stage, vaultPath);
					await rm(stage);
				}
				await syncDirectory(dirname(vaultPath));
				journal.phase = "vault-activated";
				await writeMigrationJournal(journal);
				// A failed config CAS leaves a verified encrypted Vault and every original
				// source intact. Do not overwrite either side to guess at rollback.
				current(input.sessionId);
				await saveProjectRoleBindings(
					projectRoot,
					prepared.projectRevision === null ? { ...next, revision: 0 } : next,
					{
						expectedProjectId: expectedProjectId,
						expectedRevision: prepared.projectRevision,
					},
				);
				journal.phase = "bindings-committed";
				await writeMigrationJournal(journal);
				if (
					digest(await readFile(vaultPath)) !== journal.stagedVaultHash ||
					JSON.stringify(
						await loadProjectRoleBindings(projectRoot, expectedProjectId),
					) !== JSON.stringify(journal.nextProjectConfig)
				)
					throw failure(
						"POST_COMMIT_CHANGED",
						"Migration state changed after activation. Preserve the recovery files and reconcile before retrying.",
					);
				checkSource(prepared);
				journal.phase = "complete";
				await writeMigrationJournal(journal);
				await rm(stageDirectory, { recursive: true });
				await syncDirectory(dirname(vaultPath));
				const result = {
					completed: true as const,
					verified: true as const,
					accountName: prepared.accountName,
					preserved: {
						identity: true,
						addresses: true,
						databases: [...prepared.sourceHashes.keys()].filter((name) =>
							name.includes(".db"),
						),
						vaultEntries: prepared.originalEntries.map((entry) =>
							String(entry.id),
						),
					},
				};
				outcome.result = result;
				progress(
					"complete",
					5,
					"Encrypted migration verified. Restart or unlock the configured project wallet to use the new bindings.",
				);
				await close(input.sessionId);
				return result;
			} catch (error) {
				throw noSecrets(error);
			} finally {
				prepared.busy = false;
				if (lockHandle) {
					await lockHandle.close();
					await rm(lockPath, { force: true });
				}
			}
		},
		async reconcile(input) {
			const outcome = outcomes.get(input.sessionId);
			if (outcome?.result)
				return { status: "complete", result: outcome.result };
			const prepared = sessions.get(input.sessionId);
			if (prepared?.busy) return { status: "unknown" };
			if (prepared) assertRequest(prepared, input);
			if (
				input.source.location !== "account" ||
				input.source.account !== input.destination.accountName ||
				canonicalMigrationPath(input.destination.vaultPath) !== vaultPath ||
				input.destination.vaultEntryId !== "new"
			)
				throw failure(
					"INVALID_SELECTION",
					"Recovery must use the same project, account and Vault destination.",
				);
			const recovered = readMigrationJournal({
				projectRoot,
				projectId: expectedProjectId,
				vaultPath,
				sessionId: input.sessionId,
				accountName: input.source.account,
			});
			if (!recovered) return { status: "unknown" };
			const sourceDir = accountDir(recovered.accountName, root);
			regularPath(sourceDir, true);
			for (const [name, hash] of Object.entries(recovered.sourceHashes)) {
				const path = join(sourceDir, name);
				regularPath(path);
				if (!existsSync(path) || digest(readFileSync(path)) !== hash)
					return { status: "unknown" };
			}
			regularPath(vaultPath);
			const actualVaultHash = existsSync(vaultPath)
				? digest(readFileSync(vaultPath))
				: null;
			const config = await loadProjectRoleBindings(
				projectRoot,
				expectedProjectId,
			);
			if (
				recovered.stagedVaultHash &&
				actualVaultHash === recovered.stagedVaultHash &&
				recovered.nextProjectConfig &&
				JSON.stringify(config) === JSON.stringify(recovered.nextProjectConfig)
			)
				return {
					status: "complete",
					result: {
						completed: true,
						verified: true,
						accountName: recovered.accountName,
						preserved: recovered.preserved,
					},
				};
			const actualConfigHash =
				config === null ? null : digest(JSON.stringify(config));
			if (
				!existsSync(`${vaultPath}.lock`) &&
				actualVaultHash === recovered.beforeVaultHash &&
				actualConfigHash === recovered.beforeConfigHash &&
				["prepared", "stage-verified"].includes(recovered.phase)
			)
				return { status: "safe-to-retry" };
			return { status: "unknown" };
		},
		lock: close,
	};
}

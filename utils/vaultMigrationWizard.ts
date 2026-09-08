import type { MigrationInventory, MigrationSource } from "./vaultMigration";

export const PROJECT_KEY_ROLES = [
	"identity-signing",
	"payments",
	"one-sat",
	"encryption",
] as const;
export type ProjectKeyRole = (typeof PROJECT_KEY_ROLES)[number];
export type ProjectRoleChoice =
	| "unassigned"
	| `keep:${string}`
	| `select:${string}`;
export type ProjectRoleAssignments = Readonly<
	Record<ProjectKeyRole, ProjectRoleChoice>
>;

/** Browser-submitted role references. The backend resolves candidate IDs. */
export interface ProjectRoleSelectionRequest {
	expectedProjectId: string;
	expectedRevision: number | null;
	roleAssignments: ProjectRoleAssignments;
}

/** Public, non-secret role candidate metadata supplied by the trusted backend. */
export interface MigrationProjectRoleCandidate {
	candidateId: string;
	label: string;
	supportedRoles: readonly ProjectKeyRole[];
	unavailableReason?: string;
	publicDerivationLabel?: string;
}

/** Public project role snapshot. Key material is resolved by the backend. */
export interface MigrationProjectRoles {
	projectId: string;
	/** Full bindings are retained on the trusted server; the UI receives a sanitized projection. */
	current: unknown;
	candidates: readonly MigrationProjectRoleCandidate[];
}

/**
 * The text entered in the unlock field is deliberately absent from every
 * wizard object.  Callers should pass it only to `unlock` from a local UI and
 * clear their input immediately after the promise settles.
 */
export interface VaultMigrationUnlockRequest {
	source: MigrationSource;
	vaultPath: string;
	vaultEntryId: string;
	expectedPublicKey?: string;
	accountName: string;
	/** Runtime-only source backup passphrase; absent for plaintext sources. */
	sourcePassphrase: string;
	/** Runtime-only destination Vault passphrase for a new/unlocked Vault. */
	destinationPassphrase?: string;
	ttlMs?: number;
}

export interface VaultMigrationSession {
	sessionId: string;
	expiresAt: number;
	vaultPath: string;
	vaultEntryId: string;
	expectedPublicKey?: string;
	publicKey?: string;
}

export interface VaultMigrationDestination {
	accountName: string;
	vaultPath: string;
	vaultEntryId: string;
	expectedPublicKey?: string;
}

export interface VaultEntrySummary {
	entryId: string;
	publicKey?: string;
	label?: string;
}

export type MigrationConflictKind =
	| "identity"
	| "address"
	| "database"
	| "vault-entry";

export type MigrationConflictResolution =
	| "keep-existing"
	| "import-source"
	| "skip";

export interface MigrationConflict {
	id: string;
	kind: MigrationConflictKind;
	message: string;
	resolution?: MigrationConflictResolution;
}

export interface MigrationPreview {
	source: {
		account: string;
		location: MigrationSource["location"];
		identity?: string;
		addresses: readonly string[];
		databaseFiles: readonly string[];
	};
	destination: {
		accountName: string;
		vaultPath: string;
		vaultEntryId: string;
		identity?: string;
		addresses: readonly string[];
		existingVaultEntries: readonly VaultEntrySummary[];
	};
	preservation: {
		identity: "match" | "mismatch" | "unknown";
		addresses: "match" | "mismatch" | "unknown";
		databases: readonly string[];
		vaultEntries: "retain" | "conflict" | "unknown";
	};
	conflicts: readonly MigrationConflict[];
	projectRoles?: MigrationProjectRoles;
}

export interface MigrationProgress {
	stage: "backup" | "import" | "verify" | "cutover" | "complete";
	completed: number;
	total: number;
	message: string;
}

export interface VaultMigrationCutoverRequest {
	sessionId: string;
	source: MigrationSource;
	destination: VaultMigrationDestination;
	confirmation: typeof CUTOVER_CONFIRMATION;
	resolutions: Readonly<Record<string, MigrationConflictResolution>>;
	roleSelection?: ProjectRoleSelectionRequest;
}

export interface VaultMigrationCutoverResult {
	completed: true;
	verified: true;
	accountName: string;
	preserved: {
		identity: boolean;
		addresses: boolean;
		databases: readonly string[];
		vaultEntries: readonly string[];
	};
}

export type MigrationReconciliationStatus =
	| "safe-to-retry"
	| "complete"
	| "unknown";

export interface MigrationReconciliation {
	status: MigrationReconciliationStatus;
	preview?: MigrationPreview;
	result?: VaultMigrationCutoverResult;
}

export interface VaultMigrationBackend {
	/** Capability is explicit; the UI must never infer it from connectivity. */
	readonly available: boolean;
	readonly unavailableReason?: string;
	beginUnlock(
		input: VaultMigrationUnlockRequest,
	): Promise<VaultMigrationSession>;
	preview(input: {
		sessionId: string;
		source: MigrationSource;
		destination: VaultMigrationDestination;
	}): Promise<MigrationPreview>;
	cutover(
		input: VaultMigrationCutoverRequest,
		onProgress?: (progress: MigrationProgress) => void,
	): Promise<VaultMigrationCutoverResult>;
	/** Required before retrying an interrupted or unknown cutover. */
	reconcile?(input: {
		sessionId: string;
		source: MigrationSource;
		destination: VaultMigrationDestination;
	}): Promise<MigrationReconciliation>;
	lock(sessionId: string): Promise<void>;
}

export const CUTOVER_CONFIRMATION = "MIGRATE_AND_SWITCH" as const;

export type MigrationWizardPhase =
	| "inventory"
	| "source"
	| "destination"
	| "unlock"
	| "preview"
	| "conflict-review"
	| "ready"
	| "cutover"
	| "complete"
	| "locked"
	| "expired"
	| "error"
	| "interrupted";

export type MigrationWizardStatus =
	| "idle"
	| "working"
	| "blocked"
	| "complete"
	| "failed";

export interface MigrationWizardError {
	code:
		| "backend-unavailable"
		| "invalid-selection"
		| "locked"
		| "expired"
		| "interrupted"
		| "conflict"
		| "cutover-not-confirmed"
		| "backend-error";
	message: string;
	retryable: boolean;
	/** Set only by a trusted backend when it proves no destination write occurred. */
	noEffect?: true;
}

export interface MigrationWizardState {
	phase: MigrationWizardPhase;
	status: MigrationWizardStatus;
	inventory: MigrationInventory;
	backend: { available: boolean; reason?: string };
	source?: MigrationSource;
	destination?: VaultMigrationDestination;
	/** Session metadata only. It never contains a private key or passphrase. */
	session?: Pick<
		VaultMigrationSession,
		"sessionId" | "expiresAt" | "vaultEntryId" | "publicKey"
	>;
	preview?: MigrationPreview;
	roleSelection?: ProjectRoleSelectionRequest;
	cutoverConfirmed: boolean;
	progress?: MigrationProgress;
	result?: VaultMigrationCutoverResult;
	error?: MigrationWizardError;
}

type WizardListener = (state: MigrationWizardState) => void;

export class VaultMigrationWizard {
	private readonly backend?: VaultMigrationBackend;
	private readonly now: () => number;
	private readonly ttlMs: number;
	private readonly listeners = new Set<WizardListener>();
	private state: MigrationWizardState;
	private operation = 0;
	private cutoverInFlight = false;

	constructor(options: {
		inventory: MigrationInventory;
		backend?: VaultMigrationBackend;
		now?: () => number;
		ttlMs?: number;
	}) {
		this.backend = options.backend;
		this.now = options.now ?? Date.now;
		this.ttlMs = options.ttlMs ?? 300_000;
		const available = options.backend?.available === true;
		this.state = {
			phase: options.inventory.sources.length > 0 ? "source" : "inventory",
			status: available ? "idle" : "blocked",
			inventory: options.inventory,
			backend: {
				available,
				reason: available
					? undefined
					: (options.backend?.unavailableReason ??
						"Vault migration is unavailable until the local Vault backend is enabled."),
			},
			cutoverConfirmed: false,
		};
	}

	snapshot(): MigrationWizardState {
		return cloneState(this.state);
	}

	subscribe(listener: WizardListener): () => void {
		this.listeners.add(listener);
		listener(this.snapshot());
		return () => this.listeners.delete(listener);
	}

	selectSource(source: MigrationSource | string): MigrationWizardState {
		if (this.state.phase === "cutover" || this.state.phase === "complete")
			return this.snapshot();
		const selected =
			typeof source === "string"
				? this.state.inventory.sources.find(
						(item) => sourceKey(item) === source,
					)
				: this.state.inventory.sources.find(
						(item) => sourceKey(item) === sourceKey(source),
					);
		if (!selected)
			return this.fail(
				"invalid-selection",
				"Select an eligible local source.",
				false,
			);
		this.operation += 1;
		this.update({
			phase: "destination",
			status: this.state.backend.available ? "idle" : "blocked",
			source: selected,
			destination: undefined,
			session: undefined,
			preview: undefined,
			roleSelection: undefined,
			cutoverConfirmed: false,
			error: undefined,
		});
		return this.snapshot();
	}

	selectDestination(
		destination: VaultMigrationDestination,
	): MigrationWizardState {
		if (this.state.phase === "cutover" || this.state.phase === "complete")
			return this.snapshot();
		if (!isDestination(destination))
			return this.fail(
				"invalid-selection",
				"Choose a Vault path, entry, and account name before continuing.",
				false,
			);
		if (!this.state.source)
			return this.fail(
				"invalid-selection",
				"Select a source before choosing a destination.",
				false,
			);
		this.operation += 1;
		this.update({
			phase: "unlock",
			status: this.state.backend.available ? "idle" : "blocked",
			destination: { ...destination },
			session: undefined,
			preview: undefined,
			roleSelection: undefined,
			cutoverConfirmed: false,
			error: undefined,
		});
		return this.snapshot();
	}

	/** Unlocks through the local backend. The secret is never copied into state. */
	async unlock(
		secrets:
			| string
			| { sourcePassphrase: string; destinationPassphrase?: string },
	): Promise<MigrationWizardState> {
		if (!this.state.backend.available || !this.backend)
			return this.fail(
				"backend-unavailable",
				this.state.backend.reason ?? "Vault migration backend is unavailable.",
				false,
			);
		if (!this.state.source || !this.state.destination)
			return this.fail(
				"invalid-selection",
				"Choose a source and destination before unlocking.",
				false,
			);
		const sourcePassphrase =
			typeof secrets === "string" ? secrets : secrets.sourcePassphrase;
		const destinationPassphrase =
			typeof secrets === "string" ? undefined : secrets.destinationPassphrase;
		if (
			typeof sourcePassphrase !== "string" ||
			(typeof destinationPassphrase !== "undefined" &&
				typeof destinationPassphrase !== "string") ||
			(sourcePassphrase.length === 0 &&
				(destinationPassphrase === undefined ||
					destinationPassphrase.length === 0))
		)
			return this.fail(
				"invalid-selection",
				"Enter the local unlock passphrase.",
				true,
			);

		this.update({ phase: "unlock", status: "working", error: undefined });
		const operation = ++this.operation;
		let ephemeralSourcePassphrase = sourcePassphrase;
		let ephemeralDestinationPassphrase = destinationPassphrase;
		try {
			const session = await this.backend.beginUnlock({
				...this.state.destination,
				accountName: this.state.destination.accountName,
				source: this.state.source,
				sourcePassphrase: ephemeralSourcePassphrase,
				destinationPassphrase: ephemeralDestinationPassphrase,
				ttlMs: this.ttlMs,
			});
			ephemeralSourcePassphrase = "";
			ephemeralDestinationPassphrase = undefined;
			if (!isSession(session))
				throw new Error("Vault backend returned an invalid session");
			if (
				session.vaultPath !== this.state.destination.vaultPath ||
				(this.state.destination.vaultEntryId !== "new" &&
					session.vaultEntryId !== this.state.destination.vaultEntryId) ||
				(this.state.destination.expectedPublicKey !== undefined &&
					session.publicKey !== this.state.destination.expectedPublicKey)
			)
				throw new Error(
					"Vault backend returned a session for a different destination",
				);
			if (operation !== this.operation) {
				await this.backend.lock(session.sessionId).catch(() => undefined);
				return this.snapshot();
			}
			this.update({
				phase: "preview",
				status: "working",
				session: {
					sessionId: session.sessionId,
					expiresAt: session.expiresAt,
					vaultEntryId: session.vaultEntryId,
					publicKey: session.publicKey,
				},
			});
			return await this.loadPreview(++this.operation);
		} catch (error) {
			ephemeralSourcePassphrase = "";
			ephemeralDestinationPassphrase = undefined;
			if (operation !== this.operation) return this.snapshot();
			return this.failFromError(error);
		}
	}

	async loadPreview(
		operation = ++this.operation,
	): Promise<MigrationWizardState> {
		if (
			this.state.phase === "cutover" ||
			this.state.phase === "complete" ||
			this.state.phase === "interrupted"
		)
			return this.snapshot();
		if (!this.backend || !this.state.backend.available)
			return this.fail(
				"backend-unavailable",
				this.state.backend.reason ?? "Vault migration backend is unavailable.",
				false,
			);
		if (!this.state.source || !this.state.destination || !this.state.session)
			return this.fail(
				"invalid-selection",
				"Unlock a destination before previewing migration.",
				true,
			);
		if (!this.sessionIsActive()) return this.expire();
		this.update({ phase: "preview", status: "working", error: undefined });
		try {
			const rawPreview = await this.backend.preview({
				sessionId: this.state.session.sessionId,
				source: this.state.source,
				destination: this.state.destination,
			});
			if (operation !== this.operation) return this.snapshot();
			const preview = sanitizePreview(rawPreview);
			if (!preview)
				throw new Error("Vault backend returned an invalid preview");
			this.update({
				phase: preview.conflicts.length > 0 ? "conflict-review" : "ready",
				status: "idle",
				preview,
				cutoverConfirmed: false,
			});
			return this.snapshot();
		} catch (error) {
			if (operation !== this.operation) return this.snapshot();
			return this.failFromError(error);
		}
	}

	resolveConflict(
		conflictId: string,
		resolution: MigrationConflictResolution,
	): MigrationWizardState {
		if (
			this.state.phase === "cutover" ||
			this.state.phase === "complete" ||
			this.state.phase === "interrupted"
		)
			return this.snapshot();
		if (!isConflictResolution(resolution))
			return this.fail(
				"conflict",
				"Choose a supported conflict resolution.",
				true,
			);
		const preview = this.state.preview;
		if (!preview)
			return this.fail("conflict", "Load a migration preview first.", true);
		const conflicts = preview.conflicts;
		if (!conflicts.some((conflict) => conflict.id === conflictId))
			return this.fail(
				"conflict",
				"That migration conflict is no longer present.",
				true,
			);
		const next = conflicts.map((conflict) =>
			conflict.id === conflictId ? { ...conflict, resolution } : conflict,
		);
		this.update({
			phase: next.every((conflict) => conflict.resolution)
				? "ready"
				: "conflict-review",
			status: "idle",
			preview: { ...preview, conflicts: next },
			cutoverConfirmed: false,
			error: undefined,
		});
		return this.snapshot();
	}

	confirmCutover(
		confirmation: string,
		roleSelection?: unknown,
	): MigrationWizardState {
		if (
			this.state.phase === "cutover" ||
			this.state.phase === "complete" ||
			this.state.phase === "interrupted"
		)
			return this.snapshot();
		if (confirmation !== CUTOVER_CONFIRMATION)
			return this.fail(
				"cutover-not-confirmed",
				`Type ${CUTOVER_CONFIRMATION} to authorize the wallet switch.`,
				false,
			);
		if (!this.state.preview || !this.state.session)
			return this.fail(
				"invalid-selection",
				"Review the migration preview before continuing.",
				false,
			);
		if (this.state.preview.conflicts.some((conflict) => !conflict.resolution))
			return this.fail(
				"conflict",
				"Resolve every existing Vault conflict before continuing.",
				false,
			);
		let selectedRoles: ProjectRoleSelectionRequest | undefined;
		if (this.state.preview.projectRoles) {
			selectedRoles = parseProjectRoleSelection(roleSelection);
			if (!selectedRoles)
				return this.fail(
					"invalid-selection",
					"Choose an explicit project role for each key before continuing.",
					false,
				);
			const roles = this.state.preview.projectRoles;
			if (
				selectedRoles.expectedProjectId !== roles.projectId ||
				selectedRoles.expectedRevision !== projectRoleRevision(roles.current)
			)
				return this.fail(
					"invalid-selection",
					"The project role inventory changed. Reload the preview before continuing.",
					true,
				);
		}
		if (!this.sessionIsActive()) return this.expire();
		this.update({
			roleSelection: selectedRoles,
			cutoverConfirmed: true,
			phase: "ready",
			status: "idle",
			error: undefined,
		});
		return this.snapshot();
	}

	async cutover(): Promise<MigrationWizardState> {
		if (
			["complete", "interrupted", "locked", "expired"].includes(
				this.state.phase,
			)
		)
			return this.snapshot();
		if (this.cutoverInFlight) return this.snapshot();
		if (!this.backend || !this.state.backend.available)
			return this.fail(
				"backend-unavailable",
				this.state.backend.reason ?? "Vault migration backend is unavailable.",
				false,
			);
		if (
			!this.state.source ||
			!this.state.destination ||
			!this.state.session ||
			!this.state.preview
		)
			return this.fail(
				"invalid-selection",
				"Review the migration before switching to Vault.",
				false,
			);
		if (!this.state.cutoverConfirmed)
			return this.fail(
				"cutover-not-confirmed",
				"Explicit cutover confirmation is required.",
				false,
			);
		if (!this.sessionIsActive()) return this.expire();

		this.cutoverInFlight = true;
		const operation = ++this.operation;
		this.update({
			phase: "cutover",
			status: "working",
			progress: {
				stage: "backup",
				completed: 0,
				total: 4,
				message: "Preparing a recoverable backup",
			},
			error: undefined,
		});
		try {
			const resolutions = Object.fromEntries(
				this.state.preview.conflicts
					.filter(
						(
							conflict,
						): conflict is MigrationConflict & {
							resolution: MigrationConflictResolution;
						} => Boolean(conflict.resolution),
					)
					.map((conflict) => [conflict.id, conflict.resolution]),
			);
			const rawResult = await this.backend.cutover(
				{
					sessionId: this.state.session.sessionId,
					source: this.state.source,
					destination: this.state.destination,
					confirmation: CUTOVER_CONFIRMATION,
					resolutions,
					...(this.state.roleSelection
						? { roleSelection: this.state.roleSelection }
						: {}),
				},
				(progress) => {
					const safeProgress = sanitizeProgress(progress);
					if (safeProgress)
						this.update({
							phase: "cutover",
							status: "working",
							progress: safeProgress,
						});
				},
			);
			if (operation !== this.operation) return this.snapshot();
			const result = sanitizeCutoverResult(rawResult);
			if (!result)
				throw new Error("Vault backend returned an invalid cutover result");
			this.update({
				phase: "complete",
				status: "complete",
				progress: {
					stage: "complete",
					completed: 4,
					total: 4,
					message: "Vault migration verified",
				},
				result,
			});
			return this.snapshot();
		} catch (error) {
			if (operation !== this.operation) return this.snapshot();
			const code = String(
				(error as { code?: unknown; name?: unknown }).code ??
					(error as { name?: unknown }).name ??
					"",
			).toLowerCase();
			if (code.includes("expire") || code.includes("lock"))
				return this.failFromError(error);
			if (isNoEffectFailure(error)) return this.failFromError(error);
			return this.interrupt(
				"Cutover status is unknown. Check the local backup and Vault entries before retrying.",
			);
		} finally {
			this.cutoverInFlight = false;
		}
	}

	async lock(): Promise<MigrationWizardState> {
		if (this.backend && this.state.session) {
			try {
				await this.backend.lock(this.state.session.sessionId);
			} catch (error) {
				return this.failFromError(error);
			}
		}
		this.update({
			phase: "locked",
			status: "blocked",
			session: undefined,
			roleSelection: undefined,
			cutoverConfirmed: false,
		});
		return this.snapshot();
	}

	/**
	 * Resolve an interrupted cutover through backend evidence. An unknown
	 * outcome stays blocked when the adapter cannot prove it is safe to retry.
	 */
	async reconcile(): Promise<MigrationWizardState> {
		if (this.state.phase !== "interrupted") return this.snapshot();
		if (
			!this.backend?.reconcile ||
			!this.state.source ||
			!this.state.destination ||
			!this.state.session
		)
			return this.snapshot();
		const operation = ++this.operation;
		try {
			const raw = await this.backend.reconcile({
				sessionId: this.state.session.sessionId,
				source: this.state.source,
				destination: this.state.destination,
			});
			if (operation !== this.operation) return this.snapshot();
			if (!raw || typeof raw !== "object")
				return this.interrupt(
					"Cutover status remains unknown. Keep the source and backup until it is reconciled.",
				);
			if (raw.status === "complete") {
				const result = sanitizeCutoverResult(raw.result);
				if (!result)
					return this.interrupt(
						"Cutover status remains unknown. Keep the source and backup until it is reconciled.",
					);
				this.update({
					phase: "complete",
					status: "complete",
					result,
					error: undefined,
				});
				return this.snapshot();
			}
			if (raw.status === "safe-to-retry") {
				this.update({
					phase: "destination",
					status: "idle",
					session: undefined,
					preview: undefined,
					roleSelection: undefined,
					progress: undefined,
					cutoverConfirmed: false,
					error: undefined,
				});
				return this.snapshot();
			}
			return this.interrupt(
				"Cutover status remains unknown. Keep the source and backup until it is reconciled.",
			);
		} catch {
			return this.interrupt(
				"Cutover status remains unknown. Keep the source and backup until it is reconciled.",
			);
		}
	}

	interrupt(
		message = "Migration was interrupted. Resume only after checking the source and backup.",
	): MigrationWizardState {
		this.update({
			phase: "interrupted",
			status: "failed",
			// An interrupted cutover has an unknown write outcome. Require
			// reconciliation before retrying, even when the source still appears
			// usable locally.
			error: { code: "interrupted", message, retryable: false },
			cutoverConfirmed: false,
		});
		return this.snapshot();
	}

	async retry(): Promise<MigrationWizardState> {
		if (this.cutoverInFlight) return this.snapshot();
		if (this.state.phase === "complete") return this.snapshot();
		if (this.state.phase === "interrupted") return this.reconcile();
		if (this.state.session && this.sessionIsActive() && this.state.preview)
			return this.loadPreview();
		this.update({
			phase: this.state.source ? "destination" : "source",
			status: this.state.backend.available ? "idle" : "blocked",
			session: undefined,
			preview: undefined,
			roleSelection: undefined,
			progress: undefined,
			cutoverConfirmed: false,
			error: undefined,
		});
		return this.snapshot();
	}

	private sessionIsActive() {
		return Boolean(
			this.state.session && this.now() < this.state.session.expiresAt,
		);
	}

	private expire(): MigrationWizardState {
		this.update({
			phase: "expired",
			status: "blocked",
			session: undefined,
			roleSelection: undefined,
			cutoverConfirmed: false,
			error: {
				code: "expired",
				message: "The local unlock session expired. Unlock again to continue.",
				retryable: true,
			},
		});
		return this.snapshot();
	}

	private fail(
		code: MigrationWizardError["code"],
		message: string,
		retryable: boolean,
		noEffect = false,
	): MigrationWizardState {
		this.update({
			phase: code === "backend-unavailable" ? this.state.phase : "error",
			status: code === "backend-unavailable" ? "blocked" : "failed",
			error: {
				code,
				message,
				retryable,
				...(noEffect ? { noEffect: true as const } : {}),
			},
		});
		return this.snapshot();
	}

	private failFromError(error: unknown): MigrationWizardState {
		const value = error as {
			code?: unknown;
			name?: unknown;
			message?: unknown;
			noEffect?: unknown;
		};
		const code = String(value.code ?? value.name ?? "").toLowerCase();
		const noEffect = value.noEffect === true;
		if (code.includes("expire")) return this.expire();
		if (code.includes("lock")) {
			this.update({
				phase: "locked",
				status: "blocked",
				session: undefined,
				cutoverConfirmed: false,
				error: {
					code: "locked",
					message: "Vault is locked. Unlock it locally to continue.",
					retryable: true,
				},
			});
			return this.snapshot();
		}
		if (code.includes("abort") || code.includes("interrupt"))
			return this.interrupt(
				"Migration was interrupted before completion. Check the backup before retrying.",
			);
		const rawMessage =
			typeof value.message === "string" && value.message.length > 0
				? value.message
				: "Vault migration failed. No cutover was confirmed.";
		const message =
			/passphrase|password|secret|private\s*key|\bwif\b|mnemonic/i.test(
				rawMessage,
			)
				? "Vault migration failed. No cutover was confirmed."
				: rawMessage.slice(0, 500);
		// A generic backend failure may have happened after a durable write was
		// attempted. Only a trusted adapter's explicit noEffect marker proves
		// that retrying is safe.
		return this.fail("backend-error", message, noEffect, noEffect);
	}

	private update(patch: Partial<MigrationWizardState>) {
		this.state = { ...this.state, ...patch };
		for (const listener of this.listeners) listener(this.snapshot());
	}
}

export function sourceKey(
	source: Pick<MigrationSource, "account" | "location">,
) {
	return `${source.location}:${source.account}`;
}

export function isDestination(
	value: unknown,
): value is VaultMigrationDestination {
	if (!value || typeof value !== "object") return false;
	const item = value as Record<string, unknown>;
	return (
		typeof item.accountName === "string" &&
		/^[a-z0-9][a-z0-9_-]{0,63}$/.test(item.accountName) &&
		typeof item.vaultPath === "string" &&
		item.vaultPath.length > 0 &&
		item.vaultPath.length <= 4096 &&
		typeof item.vaultEntryId === "string" &&
		item.vaultEntryId.length > 0 &&
		item.vaultEntryId.length <= 200 &&
		(item.expectedPublicKey === undefined ||
			typeof item.expectedPublicKey === "string")
	);
}

/** Strictly validates browser role references; key material is never accepted. */
export function parseProjectRoleSelection(
	value: unknown,
): ProjectRoleSelectionRequest | undefined {
	if (!isRecord(value)) return undefined;
	if (
		Object.keys(value).length !== 3 ||
		!["expectedProjectId", "expectedRevision", "roleAssignments"].every((key) =>
			Object.hasOwn(value, key),
		)
	)
		return undefined;
	if (
		typeof value.expectedProjectId !== "string" ||
		value.expectedProjectId.length === 0 ||
		value.expectedProjectId.length > 128
	)
		return undefined;
	const expectedRevision = value.expectedRevision;
	if (
		expectedRevision !== null &&
		(typeof expectedRevision !== "number" ||
			!Number.isSafeInteger(expectedRevision) ||
			expectedRevision < 0)
	)
		return undefined;
	const assignments = value.roleAssignments;
	if (!isRecord(assignments)) return undefined;
	if (
		Object.keys(assignments).length !== PROJECT_KEY_ROLES.length ||
		!PROJECT_KEY_ROLES.every((role) => Object.hasOwn(assignments, role))
	)
		return undefined;
	const safeAssignments = {} as Record<ProjectKeyRole, ProjectRoleChoice>;
	for (const role of PROJECT_KEY_ROLES) {
		const choice = assignments[role];
		if (
			typeof choice !== "string" ||
			(choice !== "unassigned" &&
				!/^(?:keep|select):[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/.test(choice))
		)
			return undefined;
		safeAssignments[role] = choice as ProjectRoleChoice;
	}
	return {
		expectedProjectId: value.expectedProjectId,
		expectedRevision,
		roleAssignments: safeAssignments,
	};
}

function isSession(value: unknown): value is VaultMigrationSession {
	if (!value || typeof value !== "object") return false;
	const item = value as Record<string, unknown>;
	return (
		typeof item.sessionId === "string" &&
		item.sessionId.length > 0 &&
		typeof item.expiresAt === "number" &&
		Number.isFinite(item.expiresAt) &&
		typeof item.vaultPath === "string" &&
		typeof item.vaultEntryId === "string"
	);
}

function sanitizePreview(value: unknown): MigrationPreview | undefined {
	if (!value || typeof value !== "object") return undefined;
	const item = value as Record<string, unknown>;
	const source = item.source;
	const destination = item.destination;
	const preservation = item.preservation;
	if (!isRecord(source) || !isRecord(destination) || !isRecord(preservation))
		return undefined;
	if (
		typeof source.account !== "string" ||
		!isLocation(source.location) ||
		!stringArray(source.addresses) ||
		!stringArray(source.databaseFiles) ||
		typeof destination.accountName !== "string" ||
		typeof destination.vaultPath !== "string" ||
		typeof destination.vaultEntryId !== "string" ||
		!stringArray(destination.addresses) ||
		!Array.isArray(destination.existingVaultEntries) ||
		!isPreservationStatus(preservation.identity, [
			"match",
			"mismatch",
			"unknown",
		]) ||
		!isPreservationStatus(preservation.addresses, [
			"match",
			"mismatch",
			"unknown",
		]) ||
		!stringArray(preservation.databases) ||
		!isPreservationStatus(preservation.vaultEntries, [
			"retain",
			"conflict",
			"unknown",
		]) ||
		!Array.isArray(item.conflicts)
	)
		return undefined;
	const conflicts: MigrationConflict[] = [];
	for (const value of item.conflicts) {
		if (
			!isRecord(value) ||
			typeof value.id !== "string" ||
			typeof value.message !== "string"
		)
			return undefined;
		if (!isConflictKind(value.kind)) return undefined;
		const resolution = value.resolution;
		if (resolution !== undefined && !isConflictResolution(resolution))
			return undefined;
		conflicts.push({
			id: value.id,
			kind: value.kind,
			message: value.message.slice(0, 500),
			...(resolution ? { resolution } : {}),
		});
	}
	const entries: VaultEntrySummary[] = [];
	for (const value of destination.existingVaultEntries) {
		if (!isRecord(value) || typeof value.entryId !== "string") return undefined;
		entries.push({
			entryId: value.entryId,
			...(typeof value.publicKey === "string"
				? { publicKey: value.publicKey }
				: {}),
			...(typeof value.label === "string"
				? { label: value.label.slice(0, 200) }
				: {}),
		});
	}
	let projectRoles: MigrationProjectRoles | undefined;
	if (Object.hasOwn(item, "projectRoles")) {
		projectRoles = sanitizeProjectRoles(item.projectRoles);
		if (!projectRoles) return undefined;
	}
	return {
		source: {
			account: source.account,
			location: source.location,
			...(typeof source.identity === "string"
				? { identity: source.identity }
				: {}),
			addresses: [...source.addresses],
			databaseFiles: [...source.databaseFiles],
		},
		destination: {
			accountName: destination.accountName,
			vaultPath: destination.vaultPath,
			vaultEntryId: destination.vaultEntryId,
			...(typeof destination.identity === "string"
				? { identity: destination.identity }
				: {}),
			addresses: [...destination.addresses],
			existingVaultEntries: entries,
		},
		preservation: {
			identity: preservation.identity,
			addresses: preservation.addresses,
			databases: [...preservation.databases],
			vaultEntries: preservation.vaultEntries,
		},
		conflicts,
		...(projectRoles ? { projectRoles } : {}),
	};
}

function sanitizeProjectRoles(
	value: unknown,
): MigrationProjectRoles | undefined {
	if (!isRecord(value) || typeof value.projectId !== "string") return undefined;
	if (
		value.projectId.length === 0 ||
		value.projectId.length > 128 ||
		!Array.isArray(value.candidates)
	)
		return undefined;
	const current = value.current;
	let safeCurrent: MigrationProjectRoles["current"];
	if (current === null) safeCurrent = null;
	else {
		if (!isRecord(current)) return undefined;
		if (
			typeof current.projectId !== "string" ||
			current.projectId !== value.projectId ||
			typeof current.revision !== "number" ||
			!Number.isSafeInteger(current.revision) ||
			current.revision < 0 ||
			!isRecord(current.current)
		)
			return undefined;
		const assignments = {} as Record<ProjectKeyRole, string | null>;
		for (const role of PROJECT_KEY_ROLES) {
			const selected = current.current[role];
			if (selected !== null && typeof selected !== "string") return undefined;
			assignments[role] = selected;
		}
		safeCurrent = {
			projectId: current.projectId,
			revision: current.revision,
			current: assignments,
		};
	}
	const candidates: MigrationProjectRoleCandidate[] = [];
	const ids = new Set<string>();
	for (const candidate of value.candidates) {
		if (
			!isRecord(candidate) ||
			typeof candidate.candidateId !== "string" ||
			!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/.test(candidate.candidateId) ||
			ids.has(candidate.candidateId) ||
			typeof candidate.label !== "string" ||
			!Array.isArray(candidate.supportedRoles) ||
			!candidate.supportedRoles.every((role) =>
				PROJECT_KEY_ROLES.includes(role as ProjectKeyRole),
			)
		)
			return undefined;
		ids.add(candidate.candidateId);
		candidates.push({
			candidateId: candidate.candidateId,
			label: candidate.label.slice(0, 200),
			supportedRoles: [
				...new Set(candidate.supportedRoles as ProjectKeyRole[]),
			],
			...(typeof candidate.unavailableReason === "string"
				? { unavailableReason: candidate.unavailableReason.slice(0, 300) }
				: {}),
			...(typeof candidate.publicDerivationLabel === "string"
				? {
						publicDerivationLabel: candidate.publicDerivationLabel.slice(
							0,
							200,
						),
					}
				: {}),
		});
	}
	return { projectId: value.projectId, current: safeCurrent, candidates };
}

function projectRoleRevision(value: unknown): number | null {
	return isRecord(value) &&
		typeof value.revision === "number" &&
		Number.isSafeInteger(value.revision) &&
		value.revision >= 0
		? value.revision
		: null;
}

function cloneProjectRoleCurrent(value: unknown): unknown {
	if (!isRecord(value)) return value;
	return {
		...value,
		...(isRecord(value.current) ? { current: { ...value.current } } : {}),
	};
}

function sanitizeCutoverResult(
	value: unknown,
): VaultMigrationCutoverResult | undefined {
	if (
		!isRecord(value) ||
		value.completed !== true ||
		value.verified !== true ||
		typeof value.accountName !== "string" ||
		!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(value.accountName)
	)
		return undefined;
	const preserved = value.preserved;
	if (
		!isRecord(preserved) ||
		preserved.identity !== true ||
		preserved.addresses !== true ||
		!stringArray(preserved.databases) ||
		!stringArray(preserved.vaultEntries)
	)
		return undefined;
	return {
		completed: true,
		verified: true,
		accountName: value.accountName,
		preserved: {
			identity: true,
			addresses: true,
			databases: [...preserved.databases],
			vaultEntries: [...preserved.vaultEntries],
		},
	};
}

function sanitizeProgress(value: unknown): MigrationProgress | undefined {
	if (
		!isRecord(value) ||
		!isProgressStage(value.stage) ||
		typeof value.completed !== "number" ||
		typeof value.total !== "number" ||
		typeof value.message !== "string"
	)
		return undefined;
	const message =
		/passphrase|password|secret|private\s*key|\bwif\b|mnemonic/i.test(
			value.message,
		)
			? "Migration is continuing"
			: value.message.slice(0, 300);
	return {
		stage: value.stage,
		completed: Math.max(0, Math.min(value.total, Math.floor(value.completed))),
		total: Math.max(1, Math.floor(value.total)),
		message,
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** Only an explicit backend discriminant can prove that retrying is harmless. */
function isNoEffectFailure(value: unknown): value is { noEffect: true } {
	return isRecord(value) && value.noEffect === true;
}

function stringArray(value: unknown): value is string[] {
	return (
		Array.isArray(value) && value.every((item) => typeof item === "string")
	);
}

function isLocation(value: unknown): value is MigrationSource["location"] {
	return (
		value === "account" || value === "legacy-root" || value === "sigma-lab"
	);
}

function isConflictKind(value: unknown): value is MigrationConflictKind {
	return (
		value === "identity" ||
		value === "address" ||
		value === "database" ||
		value === "vault-entry"
	);
}

export function isConflictResolution(
	value: unknown,
): value is MigrationConflictResolution {
	return (
		value === "keep-existing" || value === "import-source" || value === "skip"
	);
}

function isPreservationStatus<T extends string>(
	value: unknown,
	statuses: readonly T[],
): value is T {
	return typeof value === "string" && statuses.includes(value as T);
}

function isProgressStage(value: unknown): value is MigrationProgress["stage"] {
	return (
		value === "backup" ||
		value === "import" ||
		value === "verify" ||
		value === "cutover" ||
		value === "complete"
	);
}

function cloneState(state: MigrationWizardState): MigrationWizardState {
	return {
		...state,
		inventory: {
			...state.inventory,
			sources: state.inventory.sources.map((source) => ({
				...source,
				walletDatabases: [...source.walletDatabases],
			})),
			environmentKeys: { ...state.inventory.environmentKeys },
		},
		backend: { ...state.backend },
		source: state.source
			? { ...state.source, walletDatabases: [...state.source.walletDatabases] }
			: undefined,
		destination: state.destination ? { ...state.destination } : undefined,
		session: state.session ? { ...state.session } : undefined,
		preview: state.preview
			? {
					...state.preview,
					source: {
						...state.preview.source,
						addresses: [...state.preview.source.addresses],
						databaseFiles: [...state.preview.source.databaseFiles],
					},
					destination: {
						...state.preview.destination,
						addresses: [...state.preview.destination.addresses],
						existingVaultEntries:
							state.preview.destination.existingVaultEntries.map((entry) => ({
								...entry,
							})),
					},
					preservation: {
						...state.preview.preservation,
						databases: [...state.preview.preservation.databases],
					},
					conflicts: state.preview.conflicts.map((conflict) => ({
						...conflict,
					})),
					...(state.preview.projectRoles
						? {
								projectRoles: {
									...state.preview.projectRoles,
									current: cloneProjectRoleCurrent(
										state.preview.projectRoles.current,
									),
									candidates: state.preview.projectRoles.candidates.map(
										(candidate) => ({
											...candidate,
											supportedRoles: [...candidate.supportedRoles],
										}),
									),
								},
							}
						: {}),
				}
			: undefined,
		roleSelection: state.roleSelection
			? {
					expectedProjectId: state.roleSelection.expectedProjectId,
					expectedRevision: state.roleSelection.expectedRevision,
					roleAssignments: { ...state.roleSelection.roleAssignments },
				}
			: undefined,
		progress: state.progress ? { ...state.progress } : undefined,
		result: state.result
			? {
					...state.result,
					preserved: {
						...state.result.preserved,
						databases: [...state.result.preserved.databases],
						vaultEntries: [...state.result.preserved.vaultEntries],
					},
				}
			: undefined,
		error: state.error ? { ...state.error } : undefined,
	};
}

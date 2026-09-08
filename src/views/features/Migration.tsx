import {
	type Dispatch,
	type FormEvent,
	type SetStateAction,
	useCallback,
	useEffect,
	useState,
} from "react";
import type { MigrationSource } from "../../../utils/vaultMigration";
import {
	type MigrationPreview,
	PROJECT_KEY_ROLES,
	type ProjectKeyRole,
	type ProjectRoleChoice,
	type ProjectRoleSelectionRequest,
	type VaultMigrationDestination,
} from "../../../utils/vaultMigrationWizard";
import {
	Button,
	LocalShell,
	Notice,
	PageHeader,
	Spinner,
	Surface,
} from "../components/LocalShell";

type Json = Record<string, unknown>;
type Inventory = {
	migrationRequired: boolean;
	sources: Array<
		MigrationSource & {
			encryptedBackup?: boolean;
			plaintextKeys?: boolean;
			walletDatabases: string[];
		}
	>;
	environmentKeys: { payment?: boolean; identity?: boolean; empty?: boolean };
	vaultExists?: boolean;
};
type Session = {
	sessionId: string;
	expiresAt: number;
	vaultEntryId: string;
	publicKey?: string;
};

const roleLabels: Record<ProjectKeyRole, string> = {
	"identity-signing": "Identity signing",
	payments: "Payments",
	"one-sat": "OneSat assets",
	encryption: "Encryption",
};

function asJson(value: unknown): Json {
	return value && typeof value === "object" && !Array.isArray(value)
		? (value as Json)
		: {};
}
function errorText(reason: unknown) {
	return reason instanceof Error ? reason.message : String(reason);
}

export function Migration({ token }: { token: string }) {
	const [inventory, setInventory] = useState<Inventory>();
	const [backend, setBackend] = useState<{
		available: boolean;
		reason?: string;
	}>();
	const [source, setSource] = useState<MigrationSource>();
	const [destination, setDestination] = useState<VaultMigrationDestination>();
	const [session, setSession] = useState<Session>();
	const [preview, setPreview] = useState<MigrationPreview>();
	const [roles, setRoles] = useState<
		Partial<Record<ProjectKeyRole, ProjectRoleChoice>>
	>({});
	const [sourcePassphrase, setSourcePassphrase] = useState("");
	const [destinationPassphrase, setDestinationPassphrase] = useState("");
	const [confirmation, setConfirmation] = useState("");
	const [status, setStatus] = useState("Inspecting local setup…");
	const [error, setError] = useState<string>();
	const [errorNoEffect, setErrorNoEffect] = useState(false);
	const [busy, setBusy] = useState(false);

	const api = useCallback(
		async (path: string, init: RequestInit = {}) => {
			const response = await fetch(path, {
				...init,
				headers: {
					Authorization: `Bearer ${token}`,
					...(init.body ? { "Content-Type": "application/json" } : {}),
					...init.headers,
				},
			});
			let data: unknown = null;
			try {
				data = await response.json();
			} catch {
				/* empty response */
			}
			if (!response.ok) {
				const value = asJson(data);
				const failure = new Error(
					typeof value.error === "string"
						? value.error
						: "Local setup request failed",
				);
				Object.assign(failure, { noEffect: value.noEffect === true });
				throw failure;
			}
			return asJson(data);
		},
		[token],
	);

	useEffect(() => {
		if (!token) {
			setError(
				"This setup link is missing its local authorization token. Reopen it from BSV MCP.",
			);
			return;
		}
		void Promise.all([
			api("/api/inventory"),
			api("/api/migration/capabilities"),
		])
			.then(([nextInventory, nextBackend]) => {
				setInventory(nextInventory as unknown as Inventory);
				setBackend(nextBackend as { available: boolean; reason?: string });
				setStatus("Select a source to begin the local migration.");
			})
			.catch((reason) => setError(errorText(reason)));
	}, [api, token]);

	function chooseSource(next: MigrationSource) {
		if (busy) return;
		setSource(next);
		setDestination(undefined);
		setSession(undefined);
		setPreview(undefined);
		setRoles({});
		setConfirmation("");
		setError(undefined);
		setStatus(`Source selected: ${next.account}. Choose a Vault destination.`);
	}
	function submitDestination(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = new FormData(event.currentTarget);
		setDestination({
			accountName: String(form.get("accountName") ?? ""),
			vaultPath: String(form.get("vaultPath") ?? ""),
			vaultEntryId: String(form.get("vaultEntryId") ?? ""),
			expectedPublicKey:
				String(form.get("expectedPublicKey") ?? "") || undefined,
		});
		setConfirmation("");
		setPreview(undefined);
		setRoles({});
		setError(undefined);
		setStatus(
			"Destination selected. Unlock the Vault locally to preview preservation.",
		);
	}

	async function unlock(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!source || !destination || !backend?.available) return;
		setBusy(true);
		setError(undefined);
		setErrorNoEffect(false);
		const sourceSecret = sourcePassphrase;
		const destinationSecret = destinationPassphrase;
		setSourcePassphrase("");
		setDestinationPassphrase("");
		setConfirmation("");
		setStatus("Unlocking locally…");
		try {
			const value = await api("/api/migration/unlock", {
				method: "POST",
				body: JSON.stringify({
					source,
					destination,
					sourcePassphrase: sourceSecret,
					destinationPassphrase: destinationSecret || undefined,
				}),
			});
			setSession(value.session as Session);
			setPreview(value.preview as MigrationPreview);
			setRoles(defaultRoles(value.preview as MigrationPreview));
			setStatus("Preview ready. Review preservation before cutover.");
		} catch (reason) {
			showError(reason);
		} finally {
			setSourcePassphrase("");
			setDestinationPassphrase("");
			setBusy(false);
		}
	}

	function showError(reason: unknown) {
		const value = reason as { noEffect?: unknown };
		setError(errorText(reason));
		setErrorNoEffect(value?.noEffect === true);
		setStatus("Action needs attention.");
	}
	async function lock() {
		setSourcePassphrase("");
		setDestinationPassphrase("");
		setConfirmation("");
		if (!session) {
			setStatus("Unlock fields cleared.");
			return;
		}
		setBusy(true);
		try {
			await api("/api/migration/lock", {
				method: "POST",
				body: JSON.stringify({ sessionId: session.sessionId }),
			});
			setSession(undefined);
			setPreview(undefined);
			setRoles({});
			setStatus("Vault session locked. Unlock again locally to continue.");
		} catch (reason) {
			showError(reason);
		} finally {
			setBusy(false);
		}
	}
	async function refreshPreview() {
		if (!session) return;
		setBusy(true);
		try {
			const value = await api("/api/migration/preview", {
				method: "POST",
				body: JSON.stringify({ sessionId: session.sessionId }),
			});
			setPreview(value.preview as MigrationPreview);
			setRoles(defaultRoles(value.preview as MigrationPreview));
			setConfirmation("");
			setError(undefined);
			setStatus(
				"Preview refreshed. Review it before trying the cutover again.",
			);
		} catch (reason) {
			showError(reason);
		} finally {
			setBusy(false);
		}
	}
	async function resolveConflict(conflictId: string, resolution: string) {
		if (
			!session ||
			!["keep-existing", "import-source", "skip"].includes(resolution)
		)
			return;
		setBusy(true);
		try {
			const value = await api("/api/migration/resolve", {
				method: "POST",
				body: JSON.stringify({
					sessionId: session.sessionId,
					conflictId,
					resolution,
				}),
			});
			const nextPreview = value.preview as MigrationPreview;
			setPreview(nextPreview);
			setRoles(defaultRoles(nextPreview));
			setConfirmation("");
			setError(undefined);
			setStatus(
				"Conflict resolution saved. Review the updated preservation preview.",
			);
		} catch (reason) {
			showError(reason);
		} finally {
			setBusy(false);
		}
	}
	async function reconcile() {
		if (!session) return;
		setBusy(true);
		try {
			const value = await api("/api/migration/reconcile", {
				method: "POST",
				body: JSON.stringify({ sessionId: session.sessionId }),
			});
			if (value.phase === "destination") {
				setSession(undefined);
				setPreview(undefined);
				setRoles({});
				setConfirmation("");
				setStatus(
					"Backend confirmed the source is safe to retry. Unlock again locally.",
				);
			} else if (value.phase === "complete") {
				setConfirmation("");
				setStatus("Vault cutover complete and verified.");
			} else
				setStatus(
					"Cutover status is still unknown. Keep the source and backup until reconciliation succeeds.",
				);
		} catch (reason) {
			showError(reason);
		} finally {
			setBusy(false);
		}
	}
	async function cutover() {
		if (!session || !preview || !canCutover(preview, roles, confirmation))
			return;
		setBusy(true);
		setError(undefined);
		setStatus("Preparing a recoverable backup…");
		try {
			const value = await api("/api/migration/cutover", {
				method: "POST",
				body: JSON.stringify({
					sessionId: session.sessionId,
					confirmation: "MIGRATE_AND_SWITCH",
					roleSelection: preview.projectRoles
						? toRoleSelection(preview, roles)
						: undefined,
				}),
			});
			if (value.error) throw new Error(String(value.error));
			setStatus(
				`Migration verified. Account ${String(asJson(value).accountName ?? destination?.accountName ?? "")} is ready in Vault.`,
			);
			setPreview(undefined);
		} catch (reason) {
			showError(reason);
		} finally {
			setBusy(false);
		}
	}

	return (
		<LocalShell navigation={false}>
			<PageHeader
				eyebrow="vault migration"
				title="Move an existing identity into local Vault"
				description="Review first, unlock only through the local process, and switch after preservation is verified."
			/>
			{error ? (
				<Surface>
					<div className="surface-body">
						<Notice tone="error">
							{error}
							{errorNoEffect
								? " No destination write or source change was reported; retry the preview when ready."
								: ""}
						</Notice>
						<div className="form-actions">
							<Button
								variant="secondary"
								disabled={busy || !session}
								onClick={errorNoEffect ? refreshPreview : reconcile}
							>
								{errorNoEffect ? "Retry preview" : "Reconcile cutover"}
							</Button>
						</div>
					</div>
				</Surface>
			) : null}
			<InventoryStep
				inventory={inventory}
				source={source}
				onSelect={chooseSource}
				disabled={busy}
			/>
			<DestinationStep
				source={source}
				destination={destination}
				onSubmit={submitDestination}
				disabled={busy}
			/>
			<UnlockStep
				source={source}
				destination={destination}
				backend={backend}
				sourcePassphrase={sourcePassphrase}
				destinationPassphrase={destinationPassphrase}
				setSourcePassphrase={setSourcePassphrase}
				setDestinationPassphrase={setDestinationPassphrase}
				onSubmit={unlock}
				onLock={lock}
				busy={busy}
			/>
			<PreviewStep
				preview={preview}
				roles={roles}
				setRoles={setRoles}
				confirmation={confirmation}
				setConfirmation={setConfirmation}
				onRefresh={refreshPreview}
				onResolve={resolveConflict}
				onCutover={cutover}
				canCutover={Boolean(
					preview && canCutover(preview, roles, confirmation),
				)}
				busy={busy}
				status={status}
			/>
			<RecoveryNote status={status} inventory={inventory} />
		</LocalShell>
	);
}

function InventoryStep({
	inventory,
	source,
	onSelect,
	disabled,
}: {
	inventory?: Inventory;
	source?: MigrationSource;
	onSelect: (source: MigrationSource) => void;
	disabled: boolean;
}) {
	return (
		<Surface>
			<div className="surface-header">
				<div>
					<p className="section-label">01 / inventory</p>
					<h2>Review local sources</h2>
				</div>
			</div>
			<div className="surface-body">
				{!inventory ? (
					<Spinner label="Inspecting local setup" />
				) : inventory.sources.length ? (
					inventory.sources.map((item) => (
						<div
							className="source-row"
							key={`${item.location}:${item.account}`}
						>
							<div className="source-meta">
								<span className="source-title">{item.account}</span>
								<span className="source-detail">
									{item.location} ·{" "}
									{[
										item.encryptedBackup && "encrypted backup",
										item.plaintextKeys && "plaintext keys",
										item.walletDatabases?.length
											? `${item.walletDatabases.length} database(s)`
											: "",
									]
										.filter(Boolean)
										.join(" · ") || "source detected"}
								</span>
							</div>
							<Button
								variant={
									source?.account === item.account &&
									source.location === item.location
										? "secondary"
										: "primary"
								}
								disabled={disabled}
								onClick={() => onSelect(item)}
							>
								{source?.account === item.account &&
								source.location === item.location
									? "Selected"
									: "Select"}
							</Button>
						</div>
					))
				) : (
					<Notice tone="info">
						No eligible legacy source files were found.
					</Notice>
				)}
				{inventory ? (
					<p className="dim">
						{inventory.vaultExists
							? "An existing Vault was found; its entries will be preserved."
							: "No Vault file was found."}
					</p>
				) : null}
			</div>
		</Surface>
	);
}

function DestinationStep({
	source,
	destination,
	onSubmit,
	disabled,
}: {
	source?: MigrationSource;
	destination?: VaultMigrationDestination;
	onSubmit: (event: FormEvent<HTMLFormElement>) => void;
	disabled: boolean;
}) {
	return (
		<Surface className="stack-surface">
			<div className="surface-header">
				<div>
					<p className="section-label">02 / destination</p>
					<h2>Choose a Vault destination</h2>
				</div>
			</div>
			<div className="surface-body">
				<form
					key={`${source?.location ?? "none"}:${source?.account ?? "none"}`}
					onSubmit={onSubmit}
				>
					<label className="field-label">
						Account name
						<input
							className="field"
							name="accountName"
							defaultValue={destination?.accountName}
							pattern="[a-z0-9][a-z0-9_-]{0,63}"
							required
							disabled={!source || disabled}
						/>
					</label>
					<label className="field-label">
						Vault file path
						<input
							className="field"
							name="vaultPath"
							defaultValue={destination?.vaultPath}
							required
							disabled={!source || disabled}
						/>
					</label>
					<label className="field-label">
						Vault entry ID
						<input
							className="field"
							name="vaultEntryId"
							defaultValue={destination?.vaultEntryId}
							required
							disabled={!source || disabled}
						/>
					</label>
					<label className="field-label">
						Expected public key (optional)
						<input
							className="field"
							name="expectedPublicKey"
							defaultValue={destination?.expectedPublicKey}
							disabled={!source || disabled}
						/>
					</label>
					<div className="form-actions">
						<Button type="submit" disabled={!source || disabled}>
							Use destination
						</Button>
					</div>
				</form>
			</div>
		</Surface>
	);
}

function UnlockStep({
	source,
	destination,
	backend,
	sourcePassphrase,
	destinationPassphrase,
	setSourcePassphrase,
	setDestinationPassphrase,
	onSubmit,
	onLock,
	busy,
}: {
	source?: MigrationSource;
	destination?: VaultMigrationDestination;
	backend?: { available: boolean; reason?: string };
	sourcePassphrase: string;
	destinationPassphrase: string;
	setSourcePassphrase: (value: string) => void;
	setDestinationPassphrase: (value: string) => void;
	onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
	onLock: () => void;
	busy: boolean;
}) {
	return (
		<Surface className="stack-surface">
			<div className="surface-header">
				<div>
					<p className="section-label">03 / unlock</p>
					<h2>Unlock locally and preview</h2>
				</div>
			</div>
			<div className="surface-body">
				{backend ? (
					<Notice tone={backend.available ? "success" : "warning"}>
						{backend.available
							? "Vault migration backend is ready. Unlock stays on this device."
							: (backend.reason ?? "Vault migration is unavailable.")}
					</Notice>
				) : (
					<Spinner label="Checking Vault migration support" />
				)}
				<form onSubmit={onSubmit}>
					<label className="field-label">
						Source backup passphrase
						<input
							className="field"
							type="password"
							value={sourcePassphrase}
							onChange={(event) => setSourcePassphrase(event.target.value)}
							autoComplete="current-password"
							disabled={!backend?.available || !source || !destination || busy}
						/>
					</label>
					<label className="field-label">
						Destination Vault passphrase
						<input
							className="field"
							type="password"
							value={destinationPassphrase}
							onChange={(event) => setDestinationPassphrase(event.target.value)}
							autoComplete="new-password"
							disabled={!backend?.available || !source || !destination || busy}
						/>
					</label>
					<div className="form-actions">
						<Button
							type="submit"
							disabled={!backend?.available || !source || !destination || busy}
						>
							Unlock locally
						</Button>
						<Button variant="secondary" onClick={onLock} disabled={busy}>
							Lock session
						</Button>
					</div>
				</form>
				<p className="dim">
					Passphrases are sent only to the loopback setup server and cleared
					after each request.
				</p>
			</div>
		</Surface>
	);
}

function PreviewStep({
	preview,
	roles,
	setRoles,
	confirmation,
	setConfirmation,
	onRefresh,
	onResolve,
	onCutover,
	canCutover,
	busy,
	status,
}: {
	preview?: MigrationPreview;
	roles: Partial<Record<ProjectKeyRole, ProjectRoleChoice>>;
	setRoles: Dispatch<
		SetStateAction<Partial<Record<ProjectKeyRole, ProjectRoleChoice>>>
	>;
	confirmation: string;
	setConfirmation: (value: string) => void;
	onRefresh: () => void;
	onResolve: (conflictId: string, resolution: string) => void;
	onCutover: () => void;
	canCutover: boolean;
	busy: boolean;
	status: string;
}) {
	if (!preview) return null;
	const current = asJson(preview.projectRoles?.current);
	const assignments = asJson(current.current);
	return (
		<Surface className="stack-surface">
			<div className="surface-header">
				<div>
					<p className="section-label">04 / verify</p>
					<h2>Review preservation</h2>
				</div>
				<Button variant="secondary" onClick={onRefresh} disabled={busy}>
					Refresh preview
				</Button>
			</div>
			<div className="surface-body">
				<Notice tone="info">{status}</Notice>
				<div className="grid grid-two">
					<div className="data-list">
						<Summary
							label="Source"
							value={`${preview.source.account} · ${preview.source.location}`}
						/>
						<Summary label="Identity" value={preview.preservation.identity} />
						<Summary label="Addresses" value={preview.preservation.addresses} />
						<Summary
							label="Databases"
							value={
								preview.preservation.databases.length
									? preview.preservation.databases.join(", ")
									: "none"
							}
						/>
						<Summary
							label="Vault entries"
							value={preview.preservation.vaultEntries}
						/>
					</div>
					<pre className="json-preview">
						{JSON.stringify(
							{
								source: preview.source,
								destination: preview.destination,
								conflicts: preview.conflicts,
							},
							null,
							2,
						)}
					</pre>
				</div>
				{preview.projectRoles ? (
					<RoleSelector
						projectRoles={preview.projectRoles}
						assignments={assignments}
						roles={roles}
						setRoles={setRoles}
					/>
				) : null}
				{preview.conflicts.length ? (
					<div className="conflict-list">
						{preview.conflicts.map((conflict) => (
							<div className="role-row" key={conflict.id}>
								<span className="role-label">{conflict.message}</span>
								<select
									className="select"
									value={conflict.resolution ?? ""}
									onChange={(event) =>
										onResolve(conflict.id, event.target.value)
									}
									disabled={busy}
								>
									<option value="">Choose a resolution</option>
									<option value="keep-existing">
										Keep existing Vault entry
									</option>
									<option value="import-source">Import source material</option>
									<option value="skip">Skip this item</option>
								</select>
							</div>
						))}
					</div>
				) : (
					<p className="dim">No conflicts reported.</p>
				)}
				<label className="field-label">
					Type <strong>MIGRATE_AND_SWITCH</strong> to authorize
					<input
						className="field"
						value={confirmation}
						onChange={(event) => setConfirmation(event.target.value)}
						autoComplete="off"
						disabled={busy}
					/>
				</label>
				<div className="form-actions">
					<Button onClick={onCutover} disabled={!canCutover || busy}>
						Import and switch to Vault
					</Button>
				</div>
			</div>
		</Surface>
	);
}
function Summary({ label, value }: { label: string; value: string }) {
	return (
		<div className="data-row">
			<span className="data-label">{label}</span>
			<span className="data-value">{value}</span>
		</div>
	);
}
function RoleSelector({
	projectRoles,
	assignments,
	roles,
	setRoles,
}: {
	projectRoles: NonNullable<MigrationPreview["projectRoles"]>;
	assignments: Json;
	roles: Partial<Record<ProjectKeyRole, ProjectRoleChoice>>;
	setRoles: Dispatch<
		SetStateAction<Partial<Record<ProjectKeyRole, ProjectRoleChoice>>>
	>;
}) {
	const publicView = asJson(projectRoles).presentation;
	const publicRoles = Array.isArray(publicView && (publicView as Json).roles)
		? ((publicView as Json).roles as unknown[]).filter((entry): entry is Json =>
				Boolean(entry && typeof entry === "object"),
			)
		: [];
	const rows = publicRoles.length
		? publicRoles.map((entry) => ({
				role: String(entry.role),
				label: String(
					entry.label ?? roleLabels[entry.role as ProjectKeyRole] ?? entry.role,
				),
				current: entry.current,
				selectedValue:
					typeof entry.selectedValue === "string"
						? entry.selectedValue
						: undefined,
				choices: Array.isArray(entry.choices)
					? (entry.choices as unknown[]).filter((choice): choice is Json =>
							Boolean(choice && typeof choice === "object"),
						)
					: [],
			}))
		: PROJECT_KEY_ROLES.map((role) => ({
				role,
				label: roleLabels[role],
				current: assignments[role],
				selectedValue: undefined,
				choices: [],
			}));
	return (
		<div className="stack-surface">
			<p className="section-label">project roles</p>
			<h3>Choose a verified key for each role</h3>
			<p className="dim">
				Only candidate IDs are sent when you continue. Key material and paths
				stay in the trusted backend.
			</p>
			<div className="role-grid">
				{rows.map((row) => {
					const role = row.role as ProjectKeyRole;
					const currentValue =
						typeof row.current === "string"
							? `keep:${row.current}`
							: "unassigned";
					const value = roles[role] ?? row.selectedValue ?? currentValue;
					return (
						<label className="role-row" key={role}>
							<span className="role-label">{row.label}</span>
							<span className="role-help">
								{typeof row.current === "string"
									? `Current: ${String(row.current)}`
									: "No current assignment"}
							</span>
							<select
								className="select"
								value={value}
								onChange={(event) =>
									setRoles((previous) => ({
										...previous,
										[role]: event.target.value as ProjectRoleChoice,
									}))
								}
							>
								<option value="unassigned">Leave unassigned</option>
								{typeof row.current === "string" ? (
									<option value={currentValue}>Keep current selection</option>
								) : null}
								{row.choices.length
									? row.choices.map((choice) => (
											<option
												key={String(choice.value)}
												value={String(choice.value)}
												disabled={choice.disabled === true}
											>
												{String(choice.label ?? choice.value)}
											</option>
										))
									: projectRoles.candidates.map((candidate) => (
											<option
												key={candidate.candidateId}
												value={`select:${candidate.candidateId}`}
												disabled={
													Boolean(candidate.unavailableReason) ||
													!candidate.supportedRoles.includes(role)
												}
											>
												{candidate.label}
												{candidate.publicDerivationLabel
													? ` · ${candidate.publicDerivationLabel}`
													: ""}
												{candidate.unavailableReason
													? ` · ${candidate.unavailableReason}`
													: ""}
											</option>
										))}
							</select>
						</label>
					);
				})}
			</div>
		</div>
	);
}

function RecoveryNote({
	status,
	inventory,
}: {
	status: string;
	inventory?: Inventory;
}) {
	return (
		<p className="dim migration-footnote">
			{inventory?.migrationRequired
				? "No source is erased and the running wallet is not switched until explicit cutover completes and verifies."
				: status}
		</p>
	);
}
function defaultRoles(
	preview: MigrationPreview,
): Partial<Record<ProjectKeyRole, ProjectRoleChoice>> {
	const presentation = asJson(preview.projectRoles).presentation;
	if (presentation && Array.isArray((presentation as Json).roles)) {
		const selected = Object.fromEntries(
			((presentation as Json).roles as unknown[])
				.filter((entry): entry is Json =>
					Boolean(entry && typeof entry === "object"),
				)
				.map((entry) => [entry.role, entry.selectedValue]),
		);
		return Object.fromEntries(
			PROJECT_KEY_ROLES.map((role) => [
				role,
				typeof selected[role] === "string" ? selected[role] : "unassigned",
			]),
		) as Partial<Record<ProjectKeyRole, ProjectRoleChoice>>;
	}
	const current = asJson(preview.projectRoles?.current);
	const assignments = asJson(current.current);
	return Object.fromEntries(
		PROJECT_KEY_ROLES.map((role) => [
			role,
			typeof assignments[role] === "string"
				? `keep:${assignments[role]}`
				: "unassigned",
		]),
	) as Partial<Record<ProjectKeyRole, ProjectRoleChoice>>;
}
function toRoleSelection(
	preview: MigrationPreview,
	roles: Partial<Record<ProjectKeyRole, ProjectRoleChoice>>,
): ProjectRoleSelectionRequest {
	const presentation = asJson(preview.projectRoles).presentation;
	const current = asJson(preview.projectRoles?.current);
	const revision =
		presentation && typeof (presentation as Json).revision === "number"
			? ((presentation as Json).revision as number)
			: typeof current.revision === "number"
				? (current.revision as number)
				: null;
	return {
		expectedProjectId: preview.projectRoles?.projectId ?? "",
		expectedRevision: revision,
		roleAssignments: Object.fromEntries(
			PROJECT_KEY_ROLES.map((role) => [role, roles[role] ?? "unassigned"]),
		) as Record<ProjectKeyRole, ProjectRoleChoice>,
	};
}
function canCutover(
	preview: MigrationPreview,
	roles: Partial<Record<ProjectKeyRole, ProjectRoleChoice>>,
	confirmation: string,
) {
	return (
		confirmation === "MIGRATE_AND_SWITCH" &&
		preview.conflicts.every((conflict) => Boolean(conflict.resolution)) &&
		(!preview.projectRoles ||
			PROJECT_KEY_ROLES.every((role) => typeof roles[role] === "string"))
	);
}

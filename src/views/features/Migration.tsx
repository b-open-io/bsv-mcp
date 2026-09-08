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

import {
	SETUP_STEPS,
	type SetupStep,
	useSetupNavigation,
} from "../hooks/useSetupNavigation";

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

export function Migration({
	token,
	onWelcome,
}: {
	token: string;
	onWelcome?: () => void;
}) {
	const [inventory, setInventory] = useState<Inventory>();
	const [backend, setBackend] = useState<{
		available: boolean;
		reason?: string;
		destinationDefaults?: { vaultPath: string };
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
	const [pending, setPending] = useState<string>();
	const [unlockValidationError, setUnlockValidationError] = useState<string>();
	const maxStep = preview
		? "review"
		: destination
			? "unlock"
			: source
				? "destination"
				: "source";
	const { step, goToStep } = useSetupNavigation({
		maxStep,
		busy: pending !== undefined,
	});
	const [requestedStep, setRequestedStep] = useState<SetupStep>();
	useEffect(() => {
		if (!requestedStep || pending !== undefined) return;
		goToStep(requestedStep);
		setRequestedStep(undefined);
	}, [requestedStep, pending, goToStep]);
	function goBack() {
		setSourcePassphrase("");
		setDestinationPassphrase("");
		setUnlockValidationError(undefined);
		const index = SETUP_STEPS.indexOf(step);
		if (index > 0) goToStep(SETUP_STEPS[index - 1]);
	}

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
		if (pending !== undefined) return;
		setSource(next);
		setRequestedStep("destination");
		setDestination(undefined);
		setSession(undefined);
		setPreview(undefined);
		setRoles({});
		setConfirmation("");
		setError(undefined);
		setUnlockValidationError(undefined);
		setStatus(`Source selected: ${next.account}. Choose a Vault destination.`);
	}
	function submitDestination(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!source || !backend?.destinationDefaults) return;
		setDestination({
			accountName: source.account,
			vaultPath: backend.destinationDefaults.vaultPath,
			vaultEntryId: "new",
		});
		setRequestedStep("unlock");
		setConfirmation("");
		setPreview(undefined);
		setRoles({});
		setError(undefined);
		setUnlockValidationError(undefined);
		setStatus(
			"Destination selected. Unlock the Vault locally to preview preservation.",
		);
	}

	async function unlock(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!source || !destination || !backend?.available) return;
		const sourceSecret = sourcePassphrase;
		const destinationSecret = destinationPassphrase;
		setSourcePassphrase("");
		setDestinationPassphrase("");
		setConfirmation("");
		if (!sourceSecret.trim() && !destinationSecret.trim()) {
			setUnlockValidationError(
				"Enter the source backup passphrase or the destination Vault passphrase to unlock locally.",
			);
			setStatus("Action needs attention. Enter at least one passphrase.");
			return;
		}
		setUnlockValidationError(undefined);
		setPending("unlock");
		setError(undefined);
		setErrorNoEffect(false);
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
			setRequestedStep("review");
			setPreview(value.preview as MigrationPreview);
			setRoles(defaultRoles(value.preview as MigrationPreview));
			setStatus("Preview ready. Review preservation before cutover.");
		} catch (reason) {
			showError(reason);
		} finally {
			setSourcePassphrase("");
			setDestinationPassphrase("");
			setPending(undefined);
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
		setUnlockValidationError(undefined);
		if (!session) {
			setStatus("Unlock fields cleared.");
			return;
		}
		setPending("lock");
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
			setPending(undefined);
		}
	}
	async function refreshPreview() {
		if (!session) return;
		setPending("refresh");
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
			setPending(undefined);
		}
	}
	async function resolveConflict(conflictId: string, resolution: string) {
		if (
			!session ||
			!["keep-existing", "import-source", "skip"].includes(resolution)
		)
			return;
		setPending(`resolve:${conflictId}`);
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
			setPending(undefined);
		}
	}
	async function reconcile() {
		if (!session) return;
		setPending("reconcile");
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
			setPending(undefined);
		}
	}
	async function cutover() {
		if (!session || !preview || !canCutover(preview, roles, confirmation))
			return;
		setPending("cutover");
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
			setPending(undefined);
		}
	}

	return (
		<LocalShell navigation={false}>
			<PageHeader
				eyebrow={`Step ${SETUP_STEPS.indexOf(step) + 1} of ${SETUP_STEPS.length}`}
				title="Set up your wallet"
				description="Bring an existing wallet into your local encrypted Vault."
			/>
			{step === "source" && onWelcome ? (
				<div className="form-actions">
					<Button
						variant="secondary"
						onClick={onWelcome}
						disabled={pending !== undefined}
					>
						Back
					</Button>
				</div>
			) : null}
			{step !== "source" ? (
				<div className="form-actions">
					<Button
						variant="secondary"
						onClick={goBack}
						disabled={pending !== undefined}
					>
						Back
					</Button>
					<span className="dim">Wallet: {source?.account}</span>
				</div>
			) : null}
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
								disabled={pending !== undefined || !session}
								aria-busy={pending !== undefined || undefined}
								onClick={errorNoEffect ? refreshPreview : reconcile}
							>
								{pending !== undefined
									? errorNoEffect
										? "Retrying preview…"
										: "Reconciling cutover…"
									: errorNoEffect
										? "Retry preview"
										: "Reconcile cutover"}
							</Button>
						</div>
					</div>
				</Surface>
			) : null}
			{step === "source" ? (
				<InventoryStep
					inventory={inventory}
					source={source}
					onSelect={chooseSource}
					disabled={pending !== undefined}
				/>
			) : null}
			{step === "destination" ? (
				<DestinationStep
					source={source}
					destination={destination}
					defaults={backend?.destinationDefaults}
					onSubmit={submitDestination}
					pending={pending}
				/>
			) : null}
			{step === "unlock" ? (
				<UnlockStep
					source={source}
					destination={destination}
					backend={backend}
					sourcePassphrase={sourcePassphrase}
					destinationPassphrase={destinationPassphrase}
					setSourcePassphrase={setSourcePassphrase}
					setDestinationPassphrase={setDestinationPassphrase}
					validationError={unlockValidationError}
					onSubmit={unlock}
					onLock={lock}
					pending={pending}
				/>
			) : null}
			{step === "review" ? (
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
					pending={pending}
					status={status}
				/>
			) : null}
			<p role="status" aria-live="polite" className="dim migration-footnote">
				{status}
			</p>
			<RecoveryNote inventory={inventory} />
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
	const origins = {
		"legacy-root": "Earlier BSV MCP wallet",
		account: "BSV MCP account",
		custom: "Configured wallet",
	};
	return (
		<Surface>
			<div className="surface-header">
				<h2>Choose a wallet to bring into Vault</h2>
			</div>
			<div className="surface-body">
				<p>
					These files were found on this computer. Choose the wallet you want to
					keep using.
				</p>
				{!inventory ? (
					<Spinner label="Finding local wallets" />
				) : inventory.sources.length ? (
					inventory.sources.map((item) => {
						const selected =
							source?.account === item.account &&
							source.location === item.location;
						const hasKeys = item.encryptedBackup || item.plaintextKeys;
						const files = [
							...(item.encryptedBackup
								? ["keys.bep — encrypted key backup"]
								: []),
							...(item.plaintextKeys
								? [`${item.keyFile ?? "keys.json"} — unencrypted key file`]
								: []),
							...item.walletDatabases.map(
								(name) => `${name} — wallet database`,
							),
						];
						return (
							<div
								className="source-row"
								key={`${item.location}:${item.account}`}
							>
								<div className="source-meta">
									<span className="source-title">{item.account}</span>
									<span className="source-detail">
										{origins[item.location]}
									</span>
									<p className="source-detail">
										{item.encryptedBackup
											? "An encrypted key backup was found. You’ll need its password."
											: item.plaintextKeys
												? "An unencrypted key file was found. Importing will add an encrypted copy to Vault."
												: "Wallet data was found, but no key backup. This source cannot be imported on its own."}
									</p>
									<div className="source-location">{item.directory}</div>
									<details className="source-files">
										<summary>Files found ({files.length})</summary>
										<ul className="file-list">
											{files.map((file) => (
												<li key={file}>{file}</li>
											))}
										</ul>
									</details>
								</div>
								{hasKeys ? (
									<Button
										variant={selected ? "secondary" : "primary"}
										disabled={disabled}
										onClick={() => onSelect(item)}
									>
										{selected ? "Selected" : "Use this wallet"}
									</Button>
								) : (
									<span className="source-detail">Key backup needed</span>
								)}
							</div>
						);
					})
				) : (
					<Notice tone="info">No existing wallet files were found.</Notice>
				)}
				{inventory ? (
					<p className="dim">
						{inventory.vaultExists
							? "A Vault file was found. Its contents can be checked after you unlock it."
							: "No Vault file was found on this computer."}
					</p>
				) : null}
			</div>
		</Surface>
	);
}

function DestinationStep({
	source,
	destination,
	defaults,
	onSubmit,
	pending,
}: {
	source?: MigrationSource;
	destination?: VaultMigrationDestination;
	defaults?: { vaultPath: string };
	onSubmit: (event: FormEvent<HTMLFormElement>) => void;
	pending?: string;
}) {
	return (
		<Surface className="stack-surface">
			<div className="surface-header">
				<h2>Where your wallet will be saved</h2>
			</div>
			<div className="surface-body">
				<p>
					Your wallet will be added to the local encrypted Vault. Its existing
					keys and address will be checked before anything is switched.
				</p>
				{defaults && source ? (
					<form onSubmit={onSubmit}>
						<dl className="stack-surface">
							<div>
								<dt className="field-label">Wallet</dt>
								<dd>{source.account}</dd>
							</div>
							<div>
								<dt className="field-label">Vault location</dt>
								<dd style={{ overflowWrap: "anywhere" }}>
									{destination?.vaultPath ?? defaults.vaultPath}
								</dd>
							</div>
						</dl>
						<p className="dim">
							A new entry will be created for this wallet. Existing Vault
							entries are kept.
						</p>
						<div className="form-actions">
							<Button type="submit" disabled={pending !== undefined}>
								Continue
							</Button>
						</div>
					</form>
				) : (
					<Notice tone="info">
						The local server has not provided a Vault destination. Reopen setup
						after its configuration is complete.
					</Notice>
				)}
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
	validationError,
	onSubmit,
	onLock,
	pending,
}: {
	source?: MigrationSource;
	destination?: VaultMigrationDestination;
	backend?: { available: boolean; reason?: string };
	sourcePassphrase: string;
	destinationPassphrase: string;
	setSourcePassphrase: (value: string) => void;
	setDestinationPassphrase: (value: string) => void;
	validationError?: string;
	onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
	onLock: () => void;
	pending?: string;
}) {
	if (!backend?.available)
		return (
			<Surface>
				<div className="surface-header">
					<h2>Setup is not ready to continue</h2>
				</div>
				<div className="surface-body">
					<p>
						The local server cannot import this wallet yet. Your existing files
						have not been changed.
					</p>
					{backend?.reason ? (
						<details>
							<summary>Connection details</summary>
							<p>{backend.reason}</p>
						</details>
					) : null}
				</div>
			</Surface>
		);

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
							pattern=".*\S.*"
							title="Use at least one non-whitespace character."
							aria-invalid={validationError ? true : undefined}
							aria-describedby={
								validationError ? "unlock-validation-error" : undefined
							}
							disabled={
								!backend?.available ||
								!source ||
								!destination ||
								pending !== undefined
							}
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
							pattern=".*\S.*"
							title="Use at least one non-whitespace character."
							aria-invalid={validationError ? true : undefined}
							aria-describedby={
								validationError ? "unlock-validation-error" : undefined
							}
							disabled={
								!backend?.available ||
								!source ||
								!destination ||
								pending !== undefined
							}
						/>
					</label>
					{validationError ? (
						<div id="unlock-validation-error">
							<Notice tone="error">{validationError}</Notice>
						</div>
					) : null}
					<div className="form-actions">
						<Button
							type="submit"
							aria-busy={pending === "unlock" || undefined}
							disabled={
								!backend?.available ||
								!source ||
								!destination ||
								pending !== undefined
							}
						>
							{pending === "unlock" ? "Unlocking…" : "Unlock locally"}
						</Button>
						<Button
							type="button"
							variant="secondary"
							onClick={onLock}
							aria-busy={pending === "lock" || undefined}
							disabled={pending !== undefined}
						>
							{pending === "lock" ? "Locking…" : "Lock session"}
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
	pending,
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
	pending?: string;
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
				<Button
					variant="secondary"
					onClick={onRefresh}
					aria-busy={pending === "refresh" || undefined}
					disabled={pending !== undefined}
				>
					{pending === "refresh" ? "Refreshing preview…" : "Refresh preview"}
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
						onRefresh={onRefresh}
						pending={pending}
					/>
				) : null}
				{preview.conflicts.length ? (
					<div className="conflict-list">
						{preview.conflicts.map((conflict) => (
							<div className="role-row" key={conflict.id}>
								<label
									className="role-label"
									htmlFor={`conflict-resolution-${conflict.id}`}
								>
									{conflict.message}
								</label>
								<select
									id={`conflict-resolution-${conflict.id}`}
									className="select"
									aria-label={`Resolve conflict: ${conflict.message}`}
									value={conflict.resolution ?? ""}
									onChange={(event) =>
										onResolve(conflict.id, event.target.value)
									}
									disabled={pending !== undefined}
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
						disabled={pending !== undefined}
					/>
				</label>
				<div className="form-actions">
					<Button
						onClick={onCutover}
						aria-busy={pending === "cutover" || undefined}
						disabled={!canCutover || pending !== undefined}
					>
						{pending === "cutover"
							? "Migrating to Vault…"
							: "Import and switch to Vault"}
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
	onRefresh,
	pending,
}: {
	projectRoles: NonNullable<MigrationPreview["projectRoles"]>;
	assignments: Json;
	roles: Partial<Record<ProjectKeyRole, ProjectRoleChoice>>;
	setRoles: Dispatch<
		SetStateAction<Partial<Record<ProjectKeyRole, ProjectRoleChoice>>>
	>;
	onRefresh: () => void;
	pending?: string;
}) {
	const publicView = asJson(projectRoles).presentation;
	const items = projectRoles.candidates;
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
			{items.length === 0 ? (
				<div className="stack-surface">
					<Notice tone="info">
						No verified keys are available for project roles. Refresh the
						preview to check again.
					</Notice>
					<div className="form-actions">
						<Button
							variant="secondary"
							onClick={onRefresh}
							aria-busy={pending === "refresh" || undefined}
							disabled={pending !== undefined}
						>
							{pending === "refresh"
								? "Refreshing preview…"
								: "Refresh preview"}
						</Button>
					</div>
				</div>
			) : null}
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
								disabled={pending !== undefined}
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
									: items.map((candidate) => (
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

function RecoveryNote({ inventory }: { inventory?: Inventory }) {
	if (!inventory?.migrationRequired) return null;
	return (
		<p className="dim migration-footnote">
			No source is erased and the running wallet is not switched until explicit
			cutover completes and verifies.
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

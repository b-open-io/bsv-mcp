import { type FormEvent, useEffect, useState } from "react";
import type { MigrationSource } from "../../../utils/vaultMigration";
import type { AvailableSetupTool } from "../../../utils/vaultSetup";
import { AvailableTools } from "../components/AvailableTools";
import {
	CheckboxField,
	Field,
	PasswordInput,
	TextInput,
} from "../components/FormFields";
import {
	Button,
	LocalShell,
	Notice,
	PageHeader,
	Surface,
} from "../components/LocalShell";
import { WalletReady } from "../components/WalletReady";
import { migrationSourceCopy } from "../lib/migrationLabels";
import { friendlySetupError, unusedAccountName } from "../lib/setupCopy";
import { vaultPasswordIssue } from "../lib/vaultPassphrase";

export function ExistingWallet({
	token,
	onWelcome,
	onUnlock,
	standalone = false,
}: {
	token: string;
	standalone?: boolean;
	onWelcome: () => void;
	onUnlock: (name: string) => void;
}) {
	const [boundAccounts, setBoundAccounts] = useState<Array<{ name: string }>>(
		[],
	);
	const [sources, setSources] = useState<MigrationSource[]>();
	const [source, setSource] = useState<MigrationSource>();
	const [file, setFile] = useState<File>();
	const [accountName, setAccountName] = useState("imported-wallet");
	const [sourcePassphrase, setSourcePassphrase] = useState("");
	const [destinationPassphrase, setDestinationPassphrase] = useState("");
	const [passwordConfirmation, setPasswordConfirmation] = useState("");
	const [confirmed, setConfirmed] = useState(false);
	const [eraseSources, setEraseSources] = useState(true);
	const [pending, setPending] = useState(false);
	const [ready, setReady] = useState(false);
	const [savedAccount, setSavedAccount] = useState("");
	const [inventoryRevision, setInventoryRevision] = useState(0);
	const [error, setError] = useState("");
	const [tools, setTools] = useState<AvailableSetupTool[]>();
	const takenNames = boundAccounts.map((account) => account.name);
	const remapped =
		Boolean(source) &&
		source !== undefined &&
		takenNames.includes(source.account) &&
		accountName !== source.account;
	useEffect(() => {
		if (!token) return;
		fetch(`/api/inventory?revision=${inventoryRevision}`, {
			headers: { Authorization: `Bearer ${token}` },
		})
			.then(async (response) => {
				if (!response.ok)
					throw new Error(
						"Could not inspect your wallets. Reopen setup and try again.",
					);
				return response.json();
			})
			.then((value) => {
				const saved = value.boundAccounts ?? [];
				setBoundAccounts(saved);
				setSources(
					(value.sources ?? []).filter(
						(item: MigrationSource) =>
							item.location !== "account" ||
							!saved.some(
								(account: { name: string }) => account.name === item.account,
							),
					),
				);
			})
			.catch((reason) => setError(reason.message));
	}, [token, inventoryRevision]);
	function resetSelection() {
		setSource(undefined);
		setFile(undefined);
		setConfirmed(false);
		setSourcePassphrase("");
		setDestinationPassphrase("");
		setPasswordConfirmation("");
		setError("");
	}
	function chooseSource(item: MigrationSource) {
		setSource(item);
		setFile(undefined);
		setAccountName(
			unusedAccountName(
				item.account,
				boundAccounts.map((account) => account.name),
			),
		);
		setError("");
	}
	async function submit(event: FormEvent) {
		event.preventDefault();
		if (pending || !confirmed || (!source && !file)) return;
		const passwordIssue = vaultPasswordIssue(destinationPassphrase);
		if (passwordIssue) {
			setError(passwordIssue);
			return;
		}
		if (destinationPassphrase !== passwordConfirmation) {
			setError("The Vault passwords don’t match.");
			return;
		}
		if (file && file.size > 1024 * 1024) {
			setError("Choose a key backup smaller than 1 MB.");
			return;
		}
		setPending(true);
		setError("");
		try {
			const response = await fetch("/api/embedded/import", {
				method: "POST",
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					source,
					accountName,
					activate: false,
					sourcePassphrase,
					destinationPassphrase,
					passwordConfirmation,
					confirmation: "IMPORT_WALLET_CONFIRMED",
					eraseSources,
					...(file
						? { backupText: await file.text(), backupName: file.name }
						: {}),
				}),
			});
			const value = await response.json();
			if (!response.ok)
				throw new Error(value.error || "The wallet could not be imported.");
			if (value.saved === true && value.ready === false) {
				resetSelection();
				setSavedAccount(value.accountName);
				setInventoryRevision((value) => value + 1);
				return;
			}
			if (value.ready !== true)
				throw new Error(
					"The wallet was saved, but could not be activated. Reopen setup to unlock it.",
				);
			setSourcePassphrase("");
			setDestinationPassphrase("");
			setPasswordConfirmation("");
			setTools(value.tools);
			setReady(true);
		} catch (reason) {
			setError(
				friendlySetupError(
					reason instanceof Error
						? reason.message
						: "The wallet could not be imported.",
					accountName,
				),
			);
		} finally {
			setPending(false);
		}
	}
	if (ready && !standalone)
		return (
			<LocalShell navigation={false}>
				<WalletReady tools={tools} />
			</LocalShell>
		);

	return (
		<LocalShell navigation={false}>
			<PageHeader
				eyebrow="Existing wallet"
				title={
					ready
						? standalone
							? "Your wallet is saved"
							: "Your wallet is ready"
						: "Bring your wallet with you"
				}
				description={
					ready
						? standalone
							? "Your keys are protected in your local Vault."
							: "Your keys are protected in your local Vault and your wallet is available in this session."
						: "Choose a wallet found on this computer, or browse for a key backup."
				}
			/>
			{error ? <Notice tone="error">{error}</Notice> : null}
			{savedAccount ? (
				<Notice tone="success">
					{savedAccount} is saved in your Vault. Import another wallet below, or
					choose your default keys to continue.
				</Notice>
			) : null}
			{ready ? (
				<>
					<Notice tone="success">
						{standalone
							? "Open wallet setup in your MCP client to unlock and use your saved wallet."
							: "Return to your MCP client to use your wallet."}
					</Notice>
					{!standalone && <AvailableTools tools={tools} />}
				</>
			) : !source && !file ? (
				<Surface>
					<div className="surface-body form-stack">
						<h2>Choose your wallet</h2>
						<div className="choice-stack">
							{boundAccounts.map((account) => (
								<button
									className="setup-choice wallet-source-choice"
									type="button"
									key={account.name}
									onClick={() => onUnlock(account.name)}
								>
									<strong>{account.name}</strong>
									<span>Saved in your Vault · choose default keys</span>
								</button>
							))}
							{sources === undefined ? (
								<p>Looking for local wallets…</p>
							) : sources.length === 0 ? (
								<p>
									No additional local wallets were found. You can choose a
									backup below.
								</p>
							) : (
								sources.map((item) => {
									const copy = migrationSourceCopy(item);
									return (
										<button
											key={`${item.location}:${item.account}`}
											type="button"
											className="setup-choice wallet-source-choice"
											onClick={() => chooseSource(item)}
										>
											<strong>{copy.title}</strong>
											<span>{copy.origin}</span>
											<span>{copy.detail}</span>
											{(item.configPath || item.directory) && (
												<span>{item.configPath || item.directory}</span>
											)}
										</button>
									);
								})
							)}
						</div>
						<Field label="Browse for a key backup" htmlFor="key-backup">
							<TextInput
								id="key-backup"
								type="file"
								disabled={pending}
								accept=".bep,.json"
								onChange={(event) => {
									setFile(event.target.files?.[0]);
									setSource(undefined);
									setError("");
								}}
							/>
						</Field>
						<div className="form-actions">
							<Button variant="secondary" onClick={onWelcome}>
								Back
							</Button>
						</div>
					</div>
				</Surface>
			) : (
				<Surface>
					<div className="surface-body form-stack">
						<h2>Protect and import</h2>
						<p>{file?.name || source?.account}</p>
						{source && !source.encryptedBackup && !source.plaintextKeys ? (
							<Notice>
								These databases contain wallet records. Select the matching key
								backup to recover signing access.
							</Notice>
						) : null}
						{remapped ? (
							<Notice>
								A wallet named {source?.account} is already saved. These keys
								will be imported as {accountName}.
							</Notice>
						) : null}
						<form className="form-stack" onSubmit={submit}>
							{source && !source.encryptedBackup && !source.plaintextKeys ? (
								<Field label="Matching key backup" htmlFor="matching-backup">
									<TextInput
										id="matching-backup"
										required
										type="file"
										disabled={pending}
										accept=".bep,.json"
										onChange={(event) => setFile(event.target.files?.[0])}
									/>
								</Field>
							) : null}
							<Field
								label="Wallet name"
								htmlFor="import-wallet-name"
								hint="Use a new name if this wallet is already saved under a different key."
							>
								<TextInput
									id="import-wallet-name"
									required
									value={accountName}
									onChange={(event) => setAccountName(event.target.value)}
									disabled={pending}
									autoComplete="off"
									pattern="[a-z0-9][a-z0-9_-]{0,63}"
								/>
							</Field>
							<Field
								label="Backup password, if encrypted"
								htmlFor="backup-password"
							>
								<PasswordInput
									id="backup-password"
									autoComplete="off"
									value={sourcePassphrase}
									onValueChange={setSourcePassphrase}
									disabled={pending}
								/>
							</Field>
							<Field
								label="Vault password"
								htmlFor="vault-password"
								hint="Use your existing Vault password, or choose one if this is your first wallet."
							>
								<PasswordInput
									id="vault-password"
									required
									autoComplete="new-password"
									minLength={8}
									value={destinationPassphrase}
									onValueChange={setDestinationPassphrase}
									disabled={pending}
								/>
							</Field>
							<Field
								label="Confirm Vault password"
								htmlFor="vault-password-confirm"
							>
								<PasswordInput
									id="vault-password-confirm"
									required
									autoComplete="new-password"
									value={passwordConfirmation}
									onValueChange={setPasswordConfirmation}
									disabled={pending}
								/>
							</Field>
							<CheckboxField
								checked={confirmed}
								onCheckedChange={setConfirmed}
								required
								disabled={pending}
							>
								Import this wallet into my local encrypted Vault.
							</CheckboxField>
							{source?.plaintextKeys || source?.location === "mcp-client" ? (
								<CheckboxField
									checked={eraseSources}
									onCheckedChange={setEraseSources}
									disabled={pending}
								>
									After import, overwrite and remove the plaintext copy that was
									imported. This cannot erase SSD snapshots or other backups.
								</CheckboxField>
							) : null}
							<div className="form-actions">
								<Button
									variant="secondary"
									type="button"
									onClick={resetSelection}
									disabled={pending}
								>
									Back
								</Button>
								<Button type="submit" disabled={pending || !confirmed}>
									{pending ? "Importing…" : "Import wallet"}
								</Button>
							</div>
						</form>
					</div>
				</Surface>
			)}
		</LocalShell>
	);
}

import { type FormEvent, useEffect, useState } from "react";
import type { MigrationSource } from "../../../utils/vaultMigration";
import {
	Button,
	LocalShell,
	Notice,
	PageHeader,
	Surface,
} from "../components/LocalShell";

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
	const [pending, setPending] = useState(false);
	const [ready, setReady] = useState(false);
	const [error, setError] = useState("");
	useEffect(() => {
		if (!token) return;
		fetch("/api/inventory", { headers: { Authorization: `Bearer ${token}` } })
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
	}, [token]);
	function resetSelection() {
		setSource(undefined);
		setFile(undefined);
		setConfirmed(false);
		setSourcePassphrase("");
		setDestinationPassphrase("");
		setPasswordConfirmation("");
		setError("");
	}
	async function submit(event: FormEvent) {
		event.preventDefault();
		if (pending || !confirmed || (!source && !file)) return;
		if (destinationPassphrase.length < 8) {
			setError("Choose a Vault password with at least 8 characters.");
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
					sourcePassphrase,
					destinationPassphrase,
					passwordConfirmation,
					confirmation: "IMPORT_WALLET_CONFIRMED",
					...(file
						? { backupText: await file.text(), backupName: file.name }
						: {}),
				}),
			});
			const value = await response.json();
			if (!response.ok)
				throw new Error(value.error || "The wallet could not be imported.");
			if (value.ready !== true)
				throw new Error(
					"The wallet was saved, but could not be activated. Reopen setup to unlock it.",
				);
			setSourcePassphrase("");
			setDestinationPassphrase("");
			setPasswordConfirmation("");
			setReady(true);
		} catch (reason) {
			setError(
				reason instanceof Error
					? reason.message
					: "The wallet could not be imported.",
			);
		} finally {
			setPending(false);
		}
	}
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
			{error && <Notice tone="error">{error}</Notice>}
			{ready ? (
				<Notice tone="success">
					{standalone
						? "Open wallet setup in your MCP client to unlock and use your saved wallet."
						: "Return to your MCP client to use your wallet."}
				</Notice>
			) : !source && !file ? (
				<Surface>
					<div className="surface-body">
						<h2>Choose your wallet</h2>
						{boundAccounts.map((account) => (
							<button
								className="setup-choice wallet-source-choice"
								type="button"
								key={account.name}
								onClick={() => onUnlock(account.name)}
							>
								<strong>{account.name}</strong>
								<span>Already in your Vault — unlock to continue</span>
							</button>
						))}
						{sources === undefined ? (
							<p>Looking for local wallets…</p>
						) : sources.length === 0 ? (
							<p>
								No additional local wallets were found. You can choose a backup
								below.
							</p>
						) : (
							sources.map((item) => (
								<button
									key={`${item.location}:${item.account}`}
									type="button"
									className="setup-choice wallet-source-choice"
									onClick={() => {
										setSource(item);
										setAccountName(item.account);
										setError("");
									}}
								>
									<strong>{item.account}</strong>
									<span>{item.directory || item.location}</span>
									<span>
										{item.encryptedBackup
											? "Encrypted key backup"
											: item.plaintextKeys
												? "Local key file"
												: "Wallet database — matching key backup needed"}
									</span>
									{item.walletDatabases.length > 0 && (
										<span>{item.walletDatabases.join(", ")}</span>
									)}
								</button>
							))
						)}
						<label className="field-label">
							Browse for a key backup
							<input
								className="field"
								type="file"
								disabled={pending}
								accept=".bep,.json"
								onChange={(event) => {
									setFile(event.target.files?.[0]);
									setSource(undefined);
									setError("");
								}}
							/>
						</label>
						<Button variant="secondary" onClick={onWelcome}>
							Back
						</Button>
					</div>
				</Surface>
			) : (
				<Surface>
					<div className="surface-body">
						<h2>Protect and import</h2>
						<p>{file?.name || source?.account}</p>
						{source && !source.encryptedBackup && !source.plaintextKeys && (
							<Notice>
								These databases contain wallet records. Select the matching key
								backup to recover signing access.
							</Notice>
						)}
						<form className="stack-surface" onSubmit={submit}>
							{source && !source.encryptedBackup && !source.plaintextKeys && (
								<label className="field-label">
									Matching key backup
									<input
										className="field"
										required
										type="file"
										disabled={pending}
										accept=".bep,.json"
										onChange={(event) => setFile(event.target.files?.[0])}
									/>
								</label>
							)}
							<label className="field-label">
								Wallet name
								<input
									className="field"
									required
									value={accountName}
									onChange={(event) => setAccountName(event.target.value)}
									disabled={pending || !!source}
								/>
							</label>
							<label className="field-label">
								Backup password, if encrypted
								<input
									className="field"
									type="password"
									autoComplete="off"
									value={sourcePassphrase}
									onChange={(event) => setSourcePassphrase(event.target.value)}
									disabled={pending}
								/>
							</label>
							<label className="field-label">
								Vault password
								<input
									className="field"
									required
									type="password"
									autoComplete="new-password"
									minLength={8}
									value={destinationPassphrase}
									onChange={(event) =>
										setDestinationPassphrase(event.target.value)
									}
									disabled={pending}
								/>
							</label>
							<p>
								Use your existing Vault password, or choose one if this is your
								first wallet.
							</p>
							<label className="field-label">
								Confirm Vault password
								<input
									className="field"
									required
									type="password"
									autoComplete="new-password"
									value={passwordConfirmation}
									onChange={(event) =>
										setPasswordConfirmation(event.target.value)
									}
									disabled={pending}
								/>
							</label>
							<label className="checkbox-field">
								<input
									required
									type="checkbox"
									checked={confirmed}
									onChange={(event) => setConfirmed(event.target.checked)}
									disabled={pending}
								/>{" "}
								Import this wallet into my local encrypted Vault.
							</label>
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

import { type FormEvent, useEffect, useState } from "react";
import type { AvailableSetupTool } from "../../../utils/vaultSetup";
import { AvailableTools } from "../components/AvailableTools";
import { Field, PasswordInput, TextInput } from "../components/FormFields";
import {
	Button,
	LocalShell,
	Notice,
	PageHeader,
	Surface,
} from "../components/LocalShell";
import { WalletReady } from "../components/WalletReady";
import { friendlySetupError } from "../lib/setupCopy";
import { vaultPasswordIssue } from "../lib/vaultPassphrase";
import { ExistingWallet } from "./ExistingWallet";
import { WalletRoleSettings } from "./WalletRoleSettings";

export function FirstRun({
	token,
	standalone = false,
}: {
	token: string;
	standalone?: boolean;
}) {
	const [choice, setChoice] = useState<
		"welcome" | "create" | "existing" | "unlock" | "roles"
	>("welcome");
	const [boundAccounts, setBoundAccounts] = useState<Array<{ name: string }>>(
		[],
	);
	const [name, setName] = useState("default");
	const [preferredAccount, setPreferredAccount] = useState<string>();
	const [password, setPassword] = useState("");
	const [confirmation, setConfirmation] = useState("");
	const [pending, setPending] = useState(false);
	const [error, setError] = useState("");
	const [tools, setTools] = useState<AvailableSetupTool[]>();
	const [vaultExists, setVaultExists] = useState(false);
	const [created, setCreated] = useState(false);
	const [foundClientKeys, setFoundClientKeys] = useState(false);
	useEffect(() => {
		if (!token) return;
		fetch("/api/inventory", { headers: { Authorization: `Bearer ${token}` } })
			.then((response) => (response.ok ? response.json() : undefined))
			.then((value) => {
				if (value?.sources?.length) setName("new-wallet");
				setBoundAccounts(value?.boundAccounts ?? []);
				setVaultExists(value?.vaultExists === true);
				setFoundClientKeys(
					Array.isArray(value?.sources) &&
						value.sources.some(
							(item: { location?: string }) =>
								item.location === "mcp-client" ||
								item.location === "environment",
						),
				);
			})
			.catch(() => {});
	}, [token]);

	function navigate(next: typeof choice) {
		if (pending || created) return;
		setChoice(next);
		window.history.pushState(
			{ view: next },
			"",
			`/setup/source?mode=migration&view=${next}`,
		);
	}
	useEffect(() => {
		const onBack = () => {
			if (pending || created) {
				window.history.replaceState(
					{ view: choice },
					"",
					`/setup/source?mode=migration&view=${choice}`,
				);
				return;
			}
			const view = window.history.state?.view;
			setChoice(
				view === "create" ||
					view === "existing" ||
					view === "unlock" ||
					view === "roles"
					? view
					: "welcome",
			);
			setPassword("");
			setConfirmation("");
			setError("");
		};
		window.addEventListener("popstate", onBack);
		return () => window.removeEventListener("popstate", onBack);
	}, [pending, created, choice]);

	function back() {
		setPassword("");
		setConfirmation("");
		setError("");
		if (choice === "unlock") {
			navigate("roles");
			return;
		}
		navigate("welcome");
	}
	function rememberAccount(account: string) {
		setName(account);
		setPreferredAccount(account);
		setBoundAccounts((current) =>
			current.some((item) => item.name === account)
				? current
				: [...current, { name: account }],
		);
	}
	async function create(event: FormEvent) {
		event.preventDefault();
		if (pending) return;
		if (choice === "unlock") {
			if (!password) {
				setError("Enter your Vault password.");
				return;
			}
		} else {
			const passwordIssue = vaultPasswordIssue(password);
			if (passwordIssue) {
				setError(passwordIssue);
				return;
			}
		}
		if (choice !== "unlock" && password !== confirmation) {
			setError("The passwords don’t match. Try again.");
			return;
		}
		setPending(true);
		setError("");
		try {
			const response = await fetch(
				choice === "unlock" ? "/api/embedded/unlock" : "/api/embedded/create",
				{
					method: "POST",
					headers: {
						Authorization: `Bearer ${token}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						accountName: name,
						activate: false,
						password,
						passwordConfirmation: confirmation,
						confirmation: "CREATE_NEW_CONFIRMED",
					}),
				},
			);
			const value = await response.json();
			if (!response.ok)
				throw new Error(
					value.error || "Your wallet could not be created. Please try again.",
				);
			setPassword("");
			setConfirmation("");
			if (value.saved === true) {
				rememberAccount(name);
				setChoice("roles");
				window.history.pushState(
					{ view: "roles" },
					"",
					"/setup/source?mode=migration&view=roles",
				);
				return;
			}
			if (value.ready !== true)
				throw new Error(
					"Your wallet was saved, but could not be activated. Reopen setup to unlock it.",
				);
			setTools(value.tools);
			setCreated(true);
		} catch (reason) {
			setError(
				friendlySetupError(
					reason instanceof Error
						? reason.message
						: "Your wallet could not be created.",
					name,
				),
			);
		} finally {
			setPending(false);
		}
	}
	if (!token)
		return (
			<LocalShell navigation={false}>
				<PageHeader
					eyebrow="Setup connection"
					title="Reopen wallet setup"
					description="Open wallet setup from your MCP client to start a private local session."
				/>
			</LocalShell>
		);
	if (choice === "roles")
		return (
			<WalletRoleSettings
				token={token}
				preferredAccount={preferredAccount}
				onBack={() => navigate("existing")}
				onUnlock={(account) => {
					rememberAccount(account);
					navigate("unlock");
				}}
			/>
		);
	if (choice === "existing")
		return (
			<ExistingWallet
				token={token}
				standalone={standalone}
				onWelcome={back}
				onUnlock={(account) => {
					rememberAccount(account);
					navigate("roles");
				}}
			/>
		);
	if (created && !standalone)
		return (
			<LocalShell navigation={false}>
				<WalletReady tools={tools} />
			</LocalShell>
		);

	return (
		<LocalShell navigation={false}>
			<PageHeader
				eyebrow={
					created
						? "Wallet saved"
						: choice === "welcome"
							? "Welcome"
							: choice === "unlock"
								? "Saved wallet"
								: "New wallet"
				}
				title={
					created
						? standalone
							? "Your wallet is saved"
							: "Your wallet is ready"
						: choice === "welcome"
							? "Your wallet starts here"
							: choice === "unlock"
								? "Unlock your wallet"
								: "Make it yours"
				}
				description={
					created
						? "Your keys are saved in your encrypted local Vault."
						: choice === "welcome"
							? "Start fresh, or bring a wallet you already use."
							: choice === "unlock"
								? "Enter your Vault password to use your wallet in this session."
								: vaultExists
									? "Give your new wallet a name and enter your existing Vault password."
									: "Give your wallet a name and choose a password to protect it."
				}
			/>
			{created ? (
				<>
					<Notice tone="success">
						{standalone
							? "Open wallet setup in your MCP client to unlock and use your saved wallet."
							: "Your wallet is ready to use. Return to your MCP client to continue."}
					</Notice>
					{!standalone && <AvailableTools tools={tools} />}
				</>
			) : choice === "welcome" ? (
				<div className="setup-choices">
					{foundClientKeys ? (
						<Notice>
							An AI client on this computer still has a payment key in its
							settings. Import it into Vault rather than leaving it there.
						</Notice>
					) : null}
					{(boundAccounts.length > 0 || vaultExists) && (
						<Button onClick={() => navigate("roles")}>
							Choose default keys
						</Button>
					)}

					<button
						type="button"
						className="setup-choice"
						onClick={() => navigate("create")}
					>
						<span className="choice-icon" aria-hidden="true">
							+
						</span>
						<span>
							<strong>Create a new wallet</strong>
							<span>Get a fresh wallet, protected by your password.</span>
						</span>
						<span className="choice-arrow" aria-hidden="true">
							→
						</span>
					</button>
					<button
						type="button"
						className="setup-choice"
						onClick={() => navigate("existing")}
					>
						<span className="choice-icon" aria-hidden="true">
							↗
						</span>
						<span>
							<strong>Use an existing wallet</strong>
							<span>Bring your existing keys and account with you.</span>
						</span>
						<span className="choice-arrow" aria-hidden="true">
							→
						</span>
					</button>
					<p className="setup-reassurance">
						Your keys stay on this computer, encrypted in your Vault.
					</p>
				</div>
			) : (
				<Surface>
					<form className="surface-body form-stack" onSubmit={create}>
						<Field
							label="Wallet name"
							htmlFor="wallet-name"
							hint={
								choice === "unlock"
									? "This is the payment key you chose. Go back to pick a different wallet."
									: undefined
							}
						>
							<TextInput
								id="wallet-name"
								value={name}
								onChange={(event) => setName(event.target.value)}
								autoComplete="off"
								pattern="[a-z0-9][a-z0-9_-]{0,63}"
								required
								disabled={pending || choice === "unlock"}
							/>
						</Field>
						<Field
							label="Password"
							htmlFor="new-password"
							hint={
								choice === "unlock"
									? "Use the password for your existing Vault."
									: vaultExists
										? "Use the password for your existing Vault."
										: "Use at least 12 characters, or 16+ as a passphrase. On this Mac, Touch ID can wrap the Vault as well. Keep the recovery password somewhere safe."
							}
						>
							<PasswordInput
								id="new-password"
								value={password}
								onValueChange={setPassword}
								autoComplete={
									choice === "unlock" ? "current-password" : "new-password"
								}
								minLength={choice === "unlock" ? undefined : 8}
								required
								disabled={pending}
								aria-invalid={Boolean(error)}
							/>
						</Field>
						{choice !== "unlock" && (
							<Field label="Confirm password" htmlFor="confirm-password">
								<PasswordInput
									id="confirm-password"
									value={confirmation}
									onValueChange={setConfirmation}
									autoComplete="new-password"
									required
									disabled={pending}
									aria-invalid={Boolean(error)}
								/>
							</Field>
						)}
						{error ? <Notice tone="error">{error}</Notice> : null}
						<div className="form-actions">
							<Button variant="secondary" onClick={back} disabled={pending}>
								Back
							</Button>
							<Button type="submit" disabled={pending} aria-busy={pending}>
								{pending
									? "Please wait…"
									: choice === "unlock"
										? "Unlock wallet"
										: "Create wallet"}
							</Button>
						</div>
					</form>
				</Surface>
			)}
		</LocalShell>
	);
}

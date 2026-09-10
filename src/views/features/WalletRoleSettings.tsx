import { useEffect, useState } from "react";
import type {
	WalletRole,
	WalletRoleDefaults,
} from "../../../utils/walletRoleDefaults";
import { Field, SelectInput } from "../components/FormFields";
import {
	Button,
	LocalShell,
	Notice,
	PageHeader,
	Surface,
} from "../components/LocalShell";
import { defaultPaymentSelector, friendlySetupError } from "../lib/setupCopy";
import { VaultKeyPicker } from "./VaultKeyPicker";

const roles = [
	{ id: "payments", label: "Payment key" },
	{ id: "identity", label: "Identity key" },
	{ id: "ordinals", label: "Ordinals key" },
] as const;
type Settings = {
	defaults: WalletRoleDefaults;
	effective: WalletRoleDefaults;
	revision: number;
	overrides: WalletRole[];
	keys: Array<{ selector: string; publicKey: string }>;
};
export function WalletRoleSettings({
	token,
	preferredAccount,
	onBack,
	onUnlock,
}: {
	token: string;
	preferredAccount?: string;
	onBack: () => void;
	onUnlock: (account: string) => void;
}) {
	const [settings, setSettings] = useState<Settings>();
	const [defaults, setDefaults] = useState<WalletRoleDefaults>({});
	const [error, setError] = useState("");
	const [pending, setPending] = useState(false);
	const [showVaultKeys, setShowVaultKeys] = useState(false);
	const [revision, setRevision] = useState(0);
	useEffect(() => {
		fetch(`/api/embedded/roles?revision=${revision}`, {
			headers: { Authorization: `Bearer ${token}` },
		})
			.then(async (response) => {
				if (!response.ok) throw new Error("Could not load key settings.");
				const value = await response.json();
				setSettings(value);
				setDefaults({
					payments: defaultPaymentSelector(
						value.keys,
						value.defaults.payments,
						preferredAccount,
					),
					identity:
						value.defaults.identity === undefined
							? undefined
							: value.defaults.identity,
					ordinals:
						value.defaults.ordinals === undefined
							? undefined
							: value.defaults.ordinals,
				});
			})
			.catch((error) => setError(error.message));
	}, [token, revision, preferredAccount]);
	async function save() {
		if (!settings || pending) return;
		setPending(true);
		setError("");
		try {
			const response = await fetch("/api/embedded/roles", {
				method: "POST",
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ defaults, revision: settings.revision }),
			});
			if (!response.ok)
				throw new Error("Could not save key settings. Reload and try again.");
			const value: Settings = await response.json();
			setSettings(value);
			if (!value.effective.payments)
				throw new Error("Select a payment key to continue.");
			onUnlock(value.effective.payments.split(":")[0]);
		} catch (error) {
			setError(
				friendlySetupError(
					error instanceof Error ? error.message : "Could not save settings.",
				),
			);
		} finally {
			setPending(false);
		}
	}
	return (
		<LocalShell navigation={false}>
			<PageHeader
				eyebrow="Your Vault"
				title="Choose your default keys"
				description="Keep all your keys in one Vault. Choose which key each role uses; project MCP settings can override individual roles."
			/>
			{error ? <Notice tone="error">{error}</Notice> : null}
			{showVaultKeys ? (
				<VaultKeyPicker
					token={token}
					onLinked={() => {
						setShowVaultKeys(false);
						setRevision((value) => value + 1);
					}}
				/>
			) : (
				<Button variant="secondary" onClick={() => setShowVaultKeys(true)}>
					Choose another key from Vault
				</Button>
			)}
			<Surface>
				<form
					className="surface-body form-stack"
					onSubmit={(event) => {
						event.preventDefault();
						void save();
					}}
				>
					<p>
						Import several wallets before unlocking. Choosing a default does not
						move keys or funds. If more than one wallet is listed, choose the
						one you just created or imported.
					</p>
					{roles.map((role) => (
						<Field
							label={role.label}
							htmlFor={`role-${role.id}`}
							key={role.id}
							hint={
								settings?.overrides.includes(role.id)
									? `Project configuration overrides this role: ${settings.effective[role.id] ?? "disabled"}.`
									: undefined
							}
						>
							<SelectInput
								id={`role-${role.id}`}
								value={
									defaults[role.id] === undefined
										? "inherit"
										: (defaults[role.id] ?? "")
								}
								disabled={!settings || pending}
								onChange={(event) =>
									setDefaults({
										...defaults,
										[role.id]:
											event.target.value === "inherit"
												? undefined
												: event.target.value || null,
									})
								}
							>
								{role.id !== "payments" && (
									<option value="inherit">Use payment key</option>
								)}
								<option value="">
									{role.id === "payments" ? "Choose a key" : "Disabled"}
								</option>
								{settings?.keys.map((key) => (
									<option key={key.selector} value={key.selector}>
										{key.selector} · {key.publicKey.slice(-8)}
									</option>
								))}
							</SelectInput>
						</Field>
					))}
					<div className="form-actions">
						<Button variant="secondary" onClick={onBack} disabled={pending}>
							Import more wallets
						</Button>
						<Button
							type="submit"
							disabled={!settings || pending || !defaults.payments}
						>
							Save defaults and unlock
						</Button>
					</div>
				</form>
			</Surface>
		</LocalShell>
	);
}

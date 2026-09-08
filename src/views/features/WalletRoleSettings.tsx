import { useEffect, useState } from "react";
import { VaultKeyPicker } from "./VaultKeyPicker";
import type {
	WalletRole,
	WalletRoleDefaults,
} from "../../../utils/walletRoleDefaults";
import {
	Button,
	LocalShell,
	Notice,
	PageHeader,
	Surface,
} from "../components/LocalShell";

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
	onBack,
	onUnlock,
}: {
	token: string;
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
		fetch("/api/embedded/roles", {
			headers: { Authorization: `Bearer ${token}` },
		})
			.then(async (response) => {
				if (!response.ok) throw new Error("Could not load key settings.");
				const value = await response.json();
				setSettings(value);
				setDefaults({
					payments: value.defaults.payments ?? value.keys[0]?.selector ?? null,
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
	}, [token, revision]);
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
				error instanceof Error ? error.message : "Could not save settings.",
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
			{error && <Notice tone="error">{error}</Notice>}
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
				<div className="surface-body">
					<p>
						Import several wallets before unlocking. Choosing a default does not
						move keys or funds.
					</p>
					{roles.map((role) => (
						<label className="field-label" key={role.id}>
							{role.label}
							<select
								className="field"
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
							</select>
							{settings?.overrides.includes(role.id) && (
								<span className="source-detail">
									Project configuration overrides this role:{" "}
									{settings.effective[role.id] ?? "disabled"}.
								</span>
							)}
						</label>
					))}
					<div className="form-actions">
						<Button variant="secondary" onClick={onBack} disabled={pending}>
							Import more wallets
						</Button>
						<Button onClick={save} disabled={!settings || pending}>
							Save defaults and unlock
						</Button>
					</div>
				</div>
			</Surface>
		</LocalShell>
	);
}

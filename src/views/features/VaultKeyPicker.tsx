import { useState } from "react";
import type { EmbeddedVaultKeyList } from "../../../utils/embeddedVaultIo";
import {
	Field,
	PasswordInput,
	SelectInput,
	TextInput,
} from "../components/FormFields";
import { Button, Notice, Surface } from "../components/LocalShell";
import { friendlySetupError } from "../lib/setupCopy";

export function VaultKeyPicker({
	token,
	onLinked,
}: {
	token: string;
	onLinked: () => void;
}) {
	const [password, setPassword] = useState("");
	const [inventory, setInventory] = useState<EmbeddedVaultKeyList>();
	const [entryId, setEntryId] = useState("");
	const [name, setName] = useState("vault-key");
	const [error, setError] = useState("");
	const [pending, setPending] = useState(false);
	async function submit() {
		if (pending) return;
		setPending(true);
		setError("");
		try {
			const key = inventory?.keys.find((key) => key.entryId === entryId);
			if (inventory && !key) throw new Error("Choose a private key.");
			const response = await fetch(
				inventory ? "/api/embedded/link-key" : "/api/embedded/vault-keys",
				{
					method: "POST",
					headers: {
						Authorization: `Bearer ${token}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify(
						inventory
							? {
									password,
									accountName: name,
									vaultId: inventory.vaultId,
									entryId: key?.entryId,
									publicKey: key?.publicKey,
								}
							: { password },
					),
				},
			);
			const value = await response.json();
			if (!response.ok)
				throw new Error(value.error || "Could not open the Vault.");
			if (inventory) {
				setPassword("");
				setInventory(undefined);
				onLinked();
			} else {
				setInventory(value);
				setEntryId(value.keys[0]?.entryId ?? "");
			}
		} catch (error) {
			setError(
				friendlySetupError(
					error instanceof Error ? error.message : "Could not use this key.",
				),
			);
		} finally {
			setPending(false);
		}
	}
	return (
		<Surface>
			<div className="surface-body form-stack">
				<h2>Use a key already in your Vault</h2>
				<p>
					Link an existing private key to a new wallet account, then assign it
					to a role. This does not import another wallet’s transaction history.
				</p>
				{error ? <Notice tone="error">{error}</Notice> : null}
				{!inventory ? (
					<Field label="Vault password" htmlFor="vault-key-password">
						<PasswordInput
							id="vault-key-password"
							autoComplete="off"
							value={password}
							onValueChange={setPassword}
							disabled={pending}
						/>
					</Field>
				) : (
					<>
						<Field label="Private key" htmlFor="vault-private-key">
							<SelectInput
								id="vault-private-key"
								value={entryId}
								onChange={(event) => setEntryId(event.target.value)}
								disabled={pending}
							>
								{inventory.keys.map((key) => (
									<option key={key.entryId} value={key.entryId}>
										{key.label} · {key.publicKey.slice(-8)}
									</option>
								))}
							</SelectInput>
						</Field>
						{!inventory.keys.length ? (
							<Notice>
								No compatible private keys found. HD roots and non-key entries
								cannot be used directly.
							</Notice>
						) : null}
						<Field label="Account name" htmlFor="vault-account-name">
							<TextInput
								id="vault-account-name"
								value={name}
								onChange={(event) => setName(event.target.value)}
								disabled={pending}
								autoComplete="off"
								pattern="[a-z0-9][a-z0-9_-]{0,63}"
							/>
						</Field>
					</>
				)}
				<div className="form-actions">
					<Button
						onClick={submit}
						disabled={pending || !password || (!!inventory && !entryId)}
					>
						{pending
							? "Please wait…"
							: inventory
								? "Link selected key"
								: "Show Vault keys"}
					</Button>
				</div>
			</div>
		</Surface>
	);
}

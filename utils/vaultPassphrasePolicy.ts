import { assertPassphrase } from "bitcoin-backup";

export {
	assertPassphrase,
	LONG_PASSPHRASE_LENGTH,
	MIN_PASSPHRASE_LENGTH,
} from "bitcoin-backup";

/** Map library passphrase errors onto the local setup UI copy. */
export function vaultPassphraseIssue(password: unknown): string | undefined {
	try {
		assertPassphrase(password);
		return undefined;
	} catch (error) {
		return error instanceof Error
			? error.message.replace(/^Invalid passphrase: /, "")
			: "Choose a stronger Vault password.";
	}
}

export const MIN_VAULT_PASSWORD = 12;
export const LONG_VAULT_PASSWORD = 16;

/** Client-side check; the server enforces the same rules. Do not trim. */
export function vaultPasswordIssue(password: string): string | undefined {
	if (password.length === 0) return "Enter a Vault password.";
	if (password.length < MIN_VAULT_PASSWORD)
		return `Use at least ${MIN_VAULT_PASSWORD} characters.`;
	if (/^\s+$/u.test(password)) return "The password cannot be only spaces.";
	const classes = [
		/[a-z]/u.test(password),
		/[A-Z]/u.test(password),
		/[0-9]/u.test(password),
		/[^A-Za-z0-9]/u.test(password),
	].filter(Boolean).length;
	if (password.length < LONG_VAULT_PASSWORD && classes < 3)
		return `Use at least ${LONG_VAULT_PASSWORD} characters, or mix upper, lower, and digits.`;
	return undefined;
}

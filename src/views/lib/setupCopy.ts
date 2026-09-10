/** Pick an unused wallet name when the source’s name is already saved. */
export function unusedAccountName(
	desired: string,
	taken: readonly string[],
): string {
	if (!taken.includes(desired)) return desired;
	const stem = desired === "default" ? "imported-wallet" : desired;
	if (!taken.includes(stem)) return stem;
	const maxStem = 60;
	const clipped = stem.length > maxStem ? stem.slice(0, maxStem) : stem;
	for (let n = 2; n < 100; n++) {
		const candidate = `${clipped}-${n}`;
		if (!taken.includes(candidate)) return candidate;
	}
	return `${clipped}-new`;
}

/** Prefill the payment key: the wallet just created, else the saved default, else the only key. */
export function defaultPaymentSelector(
	keys: Array<{ selector: string }>,
	saved: string | null | undefined,
	preferred?: string,
): string | null {
	if (preferred) {
		const match = keys.find((key) => key.selector === `${preferred}:payment`);
		if (match) return match.selector;
	}
	if (typeof saved === "string" && keys.some((key) => key.selector === saved))
		return saved;
	const payments = keys.filter((key) => key.selector.endsWith(":payment"));
	if (payments.length === 1) return payments[0].selector;
	return null;
}

/** Turn fail-closed backend errors into an action the user can take. */
export function friendlySetupError(
	message: string,
	accountName?: string,
): string {
	if (message.includes("do not match the configured account address"))
		return accountName
			? `Those keys don’t match the saved wallet named ${accountName}. Choose a different wallet name to import them as a new wallet.`
			: "Those keys don’t match a wallet already saved under that name. Choose a different wallet name.";
	if (message.includes("vault binding does not match"))
		return "This saved wallet doesn’t match the current Vault. Go back and choose a different payment key, or import the keys under a new name.";
	return message;
}

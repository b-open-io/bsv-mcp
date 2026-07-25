/**
 * Broadcast policy.
 *
 * The startup banner advertises `Broadcasting: Enabled/Disabled` from
 * DISABLE_BROADCASTING, but the flag only ever reached the BAP tools. A user
 * who set it, read "Disabled", and then called wallet_sendBsv moved real money.
 * A safety switch that reports itself as on while being off is worse than no
 * switch, so every tool that writes to chain asserts through here.
 *
 * The banner reads the same process env this does, so the two cannot drift.
 */

export function broadcastingDisabled(): boolean {
	return process.env.DISABLE_BROADCASTING === "true";
}

/**
 * Throws when broadcasting is disabled. Call at the top of any handler that
 * submits a transaction, before any key material is touched or any fee is
 * quoted, so a refusal costs nothing and leaks nothing.
 */
export function assertBroadcastAllowed(toolName: string): void {
	if (!broadcastingDisabled()) return;

	throw new Error(
		`${toolName} submits a transaction to the network and DISABLE_BROADCASTING is set. ` +
			"Unset DISABLE_BROADCASTING to allow this tool to broadcast.",
	);
}

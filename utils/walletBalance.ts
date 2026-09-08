import type { OneSatContext } from "@1sat/actions";

/** Read every page, rejecting inconsistent snapshots instead of returning a partial balance. */
export async function readWalletBalance(ctx: OneSatContext) {
	const seen = new Set<string>();
	const sample: Awaited<
		ReturnType<OneSatContext["wallet"]["listOutputs"]>
	>["outputs"] = [];
	let totalSatoshis = 0;
	let expectedCount: number | undefined;
	do {
		const result = await ctx.wallet.listOutputs({
			basket: "default",
			limit: 1000,
			offset: seen.size,
		});
		if (
			!Number.isSafeInteger(result.totalOutputs) ||
			result.totalOutputs < 0 ||
			result.totalOutputs > 100_000
		)
			throw new Error(
				"Wallet output count is invalid or exceeds the balance read limit.",
			);
		expectedCount ??= result.totalOutputs;
		if (
			result.totalOutputs !== expectedCount ||
			(!result.outputs.length && seen.size < expectedCount)
		)
			throw new Error(
				"Wallet outputs changed or a page was incomplete. Retry the balance read.",
			);
		for (const output of result.outputs) {
			if (
				!output.outpoint ||
				seen.has(output.outpoint) ||
				!Number.isSafeInteger(output.satoshis) ||
				output.satoshis < 0
			)
				throw new Error(
					"Wallet returned inconsistent outputs. Retry the balance read.",
				);
			seen.add(output.outpoint);
			if (sample.length < 50) sample.push(output);
			totalSatoshis += output.satoshis;
		}
		if (seen.size > expectedCount || !Number.isSafeInteger(totalSatoshis))
			throw new Error("Wallet returned an inconsistent balance.");
	} while (seen.size < expectedCount);
	return { satoshis: totalSatoshis, utxoCount: seen.size, outputs: sample };
}

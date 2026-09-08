import { expect, test } from "bun:test";
import type { OneSatContext } from "@1sat/actions";
import type { WalletInterface } from "@bsv/sdk";
import type { McpServer } from "@modelcontextprotocol/server";
import { registerWalletGetBalanceTool } from "./getBalance";

type BalanceResult = {
	isError?: boolean;
	content: Array<{ type: "text"; text: string }>;
};

async function balance(listOutputs: WalletInterface["listOutputs"]) {
	let call: (() => Promise<BalanceResult>) | undefined;
	registerWalletGetBalanceTool(
		{
			registerTool: (
				_name: unknown,
				_schema: unknown,
				handler: () => Promise<BalanceResult>,
			) => {
				call = handler;
			},
		} as unknown as McpServer,
		{ wallet: { listOutputs } } as OneSatContext,
	);
	if (!call) throw new Error("balance tool missing");
	return call();
}
const outputs = Array.from({ length: 23 }, (_, index) => ({
	outpoint: `${index.toString(16).padStart(64, "0")}.0`,
	satoshis: index + 1,
	spendable: true,
}));
test("balance sums every output even when the provider caps each page at ten", async () => {
	const offsets: number[] = [];
	const result = await balance(async (args) => {
		offsets.push(args.offset ?? 0);
		expect(args.limit).toBe(1000);
		return {
			totalOutputs: 23,
			outputs: outputs.slice(args.offset ?? 0, (args.offset ?? 0) + 10),
		};
	});
	expect(result.isError).not.toBe(true);
	expect(JSON.parse(result.content[0].text)).toEqual({
		satoshis: 276,
		bsv: 0.00000276,
		utxoCount: 23,
	});
	expect(offsets).toEqual([0, 10, 20]);
});
test("balance returns zero for an empty wallet", async () => {
	const result = await balance(async () => ({ totalOutputs: 0, outputs: [] }));
	expect(JSON.parse(result.content[0].text)).toEqual({
		satoshis: 0,
		bsv: 0,
		utxoCount: 0,
	});
});
test("balance never reports a partial or double-counted total", async () => {
	for (const failure of ["empty", "duplicate", "changed"] as const) {
		let calls = 0;
		const result = await balance(async () => {
			calls++;
			return calls === 1
				? { totalOutputs: 23, outputs: outputs.slice(0, 10) }
				: {
						totalOutputs: failure === "changed" ? 22 : 23,
						outputs:
							failure === "empty"
								? []
								: failure === "duplicate"
									? outputs.slice(0, 10)
									: outputs.slice(10, 20),
					};
		});
		expect(result.isError).toBe(true);
		expect(calls).toBe(2);
	}
});

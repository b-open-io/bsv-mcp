import { deriveDepositAddresses, type OneSatContext } from "@1sat/actions";
import {
	EMBEDDED_OWNER_ORIGINATOR,
	withEmbeddedOwnerDerivation,
} from "./embeddedOwnerRead";

export const WALLET_DEPOSIT_PREFIX = Symbol.for(
	"bsv-mcp.wallet-deposit-prefix",
);

export async function walletDepositAddress(ctx: OneSatContext) {
	const context = ctx as OneSatContext & {
		[WALLET_DEPOSIT_PREFIX]?: "mcp" | "1sat";
		[EMBEDDED_OWNER_ORIGINATOR]?: string;
	};
	const owner = context[EMBEDDED_OWNER_ORIGINATOR];
	const selected = owner
		? { ...ctx, wallet: withEmbeddedOwnerDerivation(ctx.wallet, owner) }
		: ctx;
	const { derivations } = await deriveDepositAddresses.execute(selected, {
		prefix: context[WALLET_DEPOSIT_PREFIX] ?? "mcp",
	});
	if (!derivations[0]) throw new Error("No deposit address was derived");
	return derivations[0].address;
}

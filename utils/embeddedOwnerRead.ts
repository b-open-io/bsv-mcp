import type { WalletInterface } from "@bsv/sdk";

const DEFAULT_BASKET = "default";

/** Internal marker carried only by the embedded wallet context. */
export const EMBEDDED_OWNER_ORIGINATOR = Symbol(
	"bsv-mcp.embedded-owner-originator",
);

/**
 * Bind the embedded owner's fixed originator to the one owner read that the
 * embedded wallet must perform. Every other method and basket keeps the
 * caller-supplied arguments and originator.
 */
export function withEmbeddedOwnerDefaultBasketRead(
	wallet: WalletInterface,
	ownerOriginator: string,
): WalletInterface {
	return new Proxy(wallet, {
		get(target, property, receiver) {
			const value = Reflect.get(target, property, receiver);
			if (property !== "listOutputs" || typeof value !== "function") {
				return value;
			}

			return (...args: unknown[]) => {
				const request = args[0];
				if (
					typeof request === "object" &&
					request !== null &&
					"basket" in request &&
					request.basket === DEFAULT_BASKET
				) {
					return Reflect.apply(value, target, [request, ownerOriginator]);
				}
				return Reflect.apply(value, target, args);
			};
		},
	}) as WalletInterface;
}

/**
 * Bind the embedded owner's originator only for an internal derivation call.
 * The returned proxy must stay inside the address-derivation action: public
 * wallet_getPublicKey calls continue to use the unwrapped wallet and caller
 * originators.
 */
export function withEmbeddedOwnerDerivation(
	wallet: WalletInterface,
	ownerOriginator: string,
): WalletInterface {
	return new Proxy(wallet, {
		get(target, property, receiver) {
			const value = Reflect.get(target, property, receiver);
			if (property !== "getPublicKey" || typeof value !== "function") {
				return value;
			}

			return (...args: unknown[]) => {
				if (args.length < 2 || args[1] === undefined) {
					return Reflect.apply(value, target, [args[0], ownerOriginator]);
				}
				return Reflect.apply(value, target, args);
			};
		},
	}) as WalletInterface;
}

/** Stable local MCP caller. It must never equal the permission manager administrator. */
export const EMBEDDED_MCP_ORIGINATOR = "local.bsv-mcp.client";

/** Supply the missing SDK originator without bypassing spending authorization. */
export function withEmbeddedMcpOriginator(
	wallet: WalletInterface,
): WalletInterface {
	return new Proxy(wallet, {
		get(target, property) {
			const value = Reflect.get(target, property, target);
			if (typeof value !== "function") return value;
			return (...args: unknown[]) => {
				if (args[1] === undefined) args[1] = EMBEDDED_MCP_ORIGINATOR;
				return Reflect.apply(value, target, args);
			};
		},
	});
}

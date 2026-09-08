import { BAP_BASKET, BAP_PROTOCOL_ID, type OneSatContext } from "@1sat/actions";

/** Route only identity lookup and SIGMA cryptography; transaction ownership stays with assets. */
export function withSigmaIdentity(
	assets: OneSatContext,
	identity: OneSatContext,
): OneSatContext {
	if (assets.chain !== identity.chain)
		throw new Error("Identity and ordinals wallets must use the same network.");
	if (assets === identity) return assets;
	const wallet = new Proxy(assets.wallet, {
		get(target, property) {
			const value = Reflect.get(target, property, target);
			if (typeof value !== "function") return value;
			return (...args: unknown[]) => {
				const request = args[0] as
					| { basket?: unknown; protocolID?: unknown }
					| undefined;
				const protocol = request?.protocolID;
				const sigmaProtocol =
					Array.isArray(protocol) &&
					protocol.length === 2 &&
					protocol[0] === BAP_PROTOCOL_ID[0] &&
					protocol[1] === BAP_PROTOCOL_ID[1];
				const identityOperation =
					(property === "listOutputs" && request?.basket === BAP_BASKET) ||
					((property === "getPublicKey" ||
						property === "createSignature" ||
						property === "verifySignature") &&
						sigmaProtocol);
				const selected = identityOperation ? identity.wallet : target;
				return Reflect.apply(
					Reflect.get(selected, property, selected),
					selected,
					args,
				);
			};
		},
	});
	return Object.assign(Object.create(Object.getPrototypeOf(assets)), assets, {
		wallet,
	});
}

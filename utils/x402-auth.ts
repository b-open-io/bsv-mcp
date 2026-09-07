import {
	AuthFetch,
	type CreateActionArgs,
	type CreateActionResult,
	Peer,
	SimplifiedFetchTransport,
	type WalletInterface,
} from "@bsv/sdk";

/** Use SDK authentication/encoding, but route every spend through our quote/limit guard. */
export function authenticatedClient(
	wallet: WalletInterface,
	origin: string,
	fetcher: typeof fetch,
	payment: (args: CreateActionArgs) => Promise<CreateActionResult>,
) {
	const guarded = new Proxy(wallet, {
		get(target, property) {
			if (property === "createAction") return payment;
			if (property === "signAction")
				return async () => {
					throw new Error(
						"Unexpected wallet signing request during HTTP authentication",
					);
				};
			const value = Reflect.get(target, property, target);
			return typeof value === "function" ? value.bind(target) : value;
		},
	});
	const transport = new SimplifiedFetchTransport(origin, fetcher);
	const send = transport.send.bind(transport);
	// Do not let AuthFetch fall back to its unguarded global fetch on authentication failure.
	transport.send = async (message) => {
		try {
			await send(message);
		} catch {
			throw new Error(
				"BSV authenticated request failed; no automatic retry or unauthenticated fallback",
			);
		}
	};
	const peer = new Peer(guarded, transport);
	const client = new AuthFetch(guarded);
	client.peers[origin] = { peer, pendingCertificateRequests: [] };
	return client;
}

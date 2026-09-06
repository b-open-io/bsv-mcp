import {
	AuthFetch,
	Certificate,
	Peer,
	PublicKey,
	SessionManager,
	SimplifiedFetchTransport,
	type WalletInterface,
} from "@bsv/sdk";
import { z } from "zod";

const publicKey = z.string().regex(/^(02|03)[a-f0-9]{64}$/);
const base64 = z
	.string()
	.min(4)
	.max(16384)
	.regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/);
const fields = z
	.record(z.string().min(1).max(49), base64)
	.refine((v) => Object.keys(v).length > 0 && Object.keys(v).length <= 32);
const handoffSchema = z
	.object({
		certificate: z
			.object({
				type: z.literal("30kchAJIGfLxzCNloCJNLI3AtkgA8UbkxlXU2Cj4PpA="),
				serialNumber: base64.refine(
					(v) => Buffer.from(v, "base64").length === 32,
				),
				subject: publicKey,
				certifier: publicKey,
				revocationOutpoint: z.string().regex(/^[a-f0-9]{64}\.\d{1,10}$/),
				signature: z.string().regex(/^(?:[a-f0-9]{2}){8,72}$/),
				fields,
			})
			.strict(),
		subjectKeyring: fields,
		revealTo: publicKey,
		revelationPath: z.string().max(512),
	})
	.strict();

export class RevelationError extends Error {
	constructor(
		readonly code: string,
		message: string,
		readonly status?: number,
	) {
		super(message);
	}
}

function invalid(): never {
	throw new RevelationError(
		"invalid_handoff",
		"Provide a valid Sigma origin and the owner's BRC-169 handoff.",
	);
}

function parseHandoff(origin: string, handoffJSON: string) {
	if (handoffJSON.length > 131072 || !/^https?:\/\/[^/?#\\]+\/?$/.test(origin))
		invalid();
	const url = new URL(origin);
	const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
	if (
		url.username ||
		url.password ||
		(url.protocol !== "https:" && !(url.protocol === "http:" && loopback))
	)
		invalid();
	const h = handoffSchema.parse(JSON.parse(handoffJSON));
	for (const key of [
		h.certificate.subject,
		h.certificate.certifier,
		h.revealTo,
	]) {
		if (!PublicKey.fromString(key).validate()) invalid();
	}
	const match =
		/^\/api\/agents\/([A-Za-z0-9_-]{1,128})\/delegations\/(.+)\/revelation$/.exec(
			h.revelationPath,
		);
	if (!match || decodeURIComponent(match[2]) !== h.certificate.serialNumber)
		invalid();
	if (
		Object.keys(h.subjectKeyring).sort().join("\n") !==
		Object.keys(h.certificate.fields).sort().join("\n")
	)
		invalid();
	return {
		h,
		endpoint: `${url.origin}/api/agents/${encodeURIComponent(match[1])}/delegations/${encodeURIComponent(h.certificate.serialNumber)}/revelation`,
		origin: url.origin,
	};
}

/** Uses the existing subject wallet. Master keys are never sent to Sigma. */
export async function revealDelegation(
	wallet: WalletInterface,
	sigmaOrigin: string,
	handoffJSON: string,
) {
	let input: ReturnType<typeof parseHandoff>;
	try {
		input = parseHandoff(sigmaOrigin, handoffJSON);
	} catch {
		invalid();
	}
	const { h, endpoint, origin } = input;
	const c = h.certificate;
	try {
		const { publicKey: identity } = await wallet.getPublicKey({
			identityKey: true,
		});
		if (identity !== c.subject)
			throw new RevelationError(
				"subject_mismatch",
				"The connected wallet is not this delegation's subject.",
			);
		const certificate = new Certificate(
			c.type,
			c.serialNumber,
			c.subject,
			c.certifier,
			c.revocationOutpoint,
			c.fields,
			c.signature,
		);
		if (!(await certificate.verify())) invalid();
	} catch (error) {
		if (error instanceof RevelationError) throw error;
		throw new RevelationError(
			"invalid_certificate",
			"Could not verify the certificate and connected wallet identity.",
		);
	}
	let keyring: Record<string, string>;
	try {
		await wallet.acquireCertificate({
			...c,
			acquisitionProtocol: "direct",
			keyringRevealer: "certifier",
			keyringForSubject: h.subjectKeyring,
		});
		const proof = await wallet.proveCertificate({
			certificate: c,
			fieldsToReveal: Object.keys(c.fields),
			verifier: h.revealTo,
		});
		keyring = fields.parse(proof.keyringForVerifier);
	} catch {
		throw new RevelationError(
			"wallet_proof_failed",
			"The wallet could not acquire or prove this delegation. Check its certificate store before retrying.",
		);
	}
	return postRevelation(wallet, origin, endpoint, keyring);
}

/** SDK public transport injection enforces redirect policy on handshake AND request. */
export async function postRevelation(
	wallet: WalletInterface,
	origin: string,
	endpoint: string,
	keyring: Record<string, string>,
) {
	const guarded = new Proxy(wallet, {
		get(target, property) {
			if (property === "createAction" || property === "signAction")
				return async () => {
					throw new RevelationError(
						"payment_required",
						"Sigma revelation must not require a payment.",
						402,
					);
				};
			const value = Reflect.get(target, property, target);
			return typeof value === "function" ? value.bind(target) : value;
		},
	});
	let refusal: RevelationError | undefined;
	const guardedFetch = (async (
		url: Parameters<typeof fetch>[0],
		init?: Parameters<typeof fetch>[1],
	) => {
		if (
			String(url) !== `${origin}/.well-known/auth` &&
			String(url) !== endpoint
		) {
			refusal = new RevelationError(
				"unexpected_endpoint",
				"Sigma authentication requested an unexpected endpoint.",
			);
			throw refusal;
		}
		const response = await fetch(url, { ...init, redirect: "error" });
		if ([401, 402, 403, 409, 422, 429].includes(response.status)) {
			refusal = new RevelationError(
				response.status === 402 ? "payment_required" : "request_rejected",
				"Sigma rejected revelation. Check owner delegation status before retrying.",
				response.status,
			);
			throw refusal;
		}
		return response;
	}) as typeof fetch;
	const transport = new SimplifiedFetchTransport(origin, guardedFetch);
	const sessions = new SessionManager();
	const auth = new AuthFetch(guarded, undefined, sessions);
	const peer = new Peer(guarded, transport, undefined, sessions);
	try {
		await peer.ready;
		auth.peers[origin] = { peer, pendingCertificateRequests: [] };
		const response = await auth.fetch(endpoint, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ keyring }),
			retryCounter: 1,
			paymentRetryAttempts: 1,
		});
		if (!response.ok)
			throw new RevelationError(
				"request_rejected",
				"Sigma rejected revelation. Check owner delegation status before retrying.",
				response.status,
			);
		// Return only a bounded acknowledgement; never echo an untrusted HTTP body.
		return { status: "revealed", httpStatus: response.status };
	} catch (error) {
		if (refusal) throw refusal;
		if (error instanceof RevelationError) throw error;
		throw new RevelationError(
			"outcome_unknown",
			"Revelation was not confirmed. Ask the owner to refresh delegation status before retrying; no automatic replay was attempted.",
		);
	}
}

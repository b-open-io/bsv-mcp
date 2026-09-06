import { afterEach, expect, mock, spyOn, test } from "bun:test";
import {
	AuthFetch,
	KeyDeriver,
	MasterCertificate,
	Peer,
	PrivateKey,
	ProtoWallet,
	type SimplifiedFetchTransport,
	Utils,
	VerifiableCertificate,
	type WalletInterface,
} from "@bsv/sdk";
import { Wallet } from "@bsv/wallet-toolbox";
import {
	postRevelation,
	RevelationError,
	revealDelegation,
} from "./revealDelegation";

afterEach(() => mock.restore());
const type = "30kchAJIGfLxzCNloCJNLI3AtkgA8UbkxlXU2Cj4PpA=";
async function fixture() {
	const principal = new ProtoWallet(PrivateKey.fromRandom());
	const subjectKey = PrivateKey.fromRandom();
	const identityKey = subjectKey.toPublicKey().toString();
	const verifier = new ProtoWallet(PrivateKey.fromRandom());
	const verifierKey = (await verifier.getPublicKey({ identityKey: true }))
		.publicKey;
	const master = await MasterCertificate.issueCertificateForSubject(
		principal,
		identityKey,
		{
			delegator: "@alice@example.test",
			scope: "identity:read",
			expiry: "2030-01-01T00:00:00.000Z",
		},
		type,
		async () => `${"a".repeat(64)}.0`,
		Utils.toBase64(Array(32).fill(255)),
	);
	if (!master.signature) throw new Error("Missing fixture signature");
	const certificate = {
		type: master.type,
		serialNumber: master.serialNumber,
		subject: master.subject,
		certifier: master.certifier,
		revocationOutpoint: master.revocationOutpoint,
		fields: master.fields,
		signature: master.signature,
	};
	type Stored = {
		fields: Array<{ fieldName: string; fieldValue: string; masterKey: string }>;
		[key: string]: unknown;
	};
	let stored: Stored = { fields: [] };
	const insert = mock(async (value: Stored) => {
		stored = value;
	});
	// Actual toolbox Wallet acquire/prove and crypto; only persistence is in memory.
	const wallet = new Wallet({
		chain: "test",
		keyDeriver: new KeyDeriver(subjectKey),
		storage: {
			_authId: { identityKey },
			insertCertificate: insert,
			listCertificates: async () => ({
				certificates: [
					{
						...stored,
						fields: Object.fromEntries(
							stored.fields.map((f) => [f.fieldName, f.fieldValue]),
						),
						keyring: Object.fromEntries(
							stored.fields.map((f) => [f.fieldName, f.masterKey]),
						),
					},
				],
			}),
		} as never,
	});
	const handoff = {
		certificate,
		subjectKeyring: master.masterKeyring,
		revealTo: verifierKey,
		revelationPath: `/api/agents/agent-123/delegations/${certificate.serialNumber}/revelation`,
	};
	return { wallet, verifier, handoff, insert };
}

test("real toolbox acquisition/proof reveals to verifier and sends only verifier keys", async () => {
	const f = await fixture();
	let sent: NonNullable<Parameters<AuthFetch["fetch"]>[1]> = {};
	const request = spyOn(AuthFetch.prototype, "fetch").mockImplementation(
		async (_url, config) => {
			sent = config ?? {};
			return new Response("untrusted body", { status: 200 });
		},
	);
	expect(
		await revealDelegation(
			f.wallet,
			"https://sigma.example",
			JSON.stringify(f.handoff),
		),
	).toEqual({ status: "revealed", httpStatus: 200 });
	expect(f.insert).toHaveBeenCalledTimes(1);
	expect(request.mock.calls[0][0]).toBe(
		`https://sigma.example/api/agents/agent-123/delegations/${encodeURIComponent(f.handoff.certificate.serialNumber)}/revelation`,
	);
	expect(sent.retryCounter).toBe(1);
	const body = JSON.parse(sent.body);
	expect(Object.keys(body)).toEqual(["keyring"]);
	expect(JSON.stringify(body)).not.toContain(
		JSON.stringify(f.handoff.subjectKeyring),
	);
	const c = f.handoff.certificate;
	const proof = new VerifiableCertificate(
		c.type,
		c.serialNumber,
		c.subject,
		c.certifier,
		c.revocationOutpoint,
		c.fields,
		body.keyring,
		c.signature,
	);
	expect(await proof.decryptFields(f.verifier)).toEqual({
		delegator: "@alice@example.test",
		scope: "identity:read",
		expiry: "2030-01-01T00:00:00.000Z",
	});
});

test("subject mismatch and invalid origins fail before certificate import", async () => {
	const f = await fixture();
	const request = spyOn(AuthFetch.prototype, "fetch");
	for (const origin of [
		"http://sigma.example",
		"https://x:y@sigma.example",
		"https://sigma.example/path",
		"https://sigma.example?x=1",
		"https://sigma.example#x",
		"https://sigma.example\\evil",
	]) {
		await expect(
			revealDelegation(f.wallet, origin, JSON.stringify(f.handoff)),
		).rejects.toMatchObject({ code: "invalid_handoff" });
	}
	const wrong = {
		...f.handoff,
		certificate: {
			...f.handoff.certificate,
			subject: PrivateKey.fromRandom().toPublicKey().toString(),
		},
	};
	await expect(
		revealDelegation(f.wallet, "https://sigma.example", JSON.stringify(wrong)),
	).rejects.toMatchObject({ code: "subject_mismatch" });
	expect(f.insert).not.toHaveBeenCalled();
	expect(request).not.toHaveBeenCalled();
});

test("actual SDK stale-session recursion cannot replace guarded transport or resend", async () => {
	const f = await fixture();
	const send = spyOn(Peer.prototype, "toPeer").mockRejectedValue(
		new Error("Session not found for nonce: stale"),
	);
	await expect(
		postRevelation(
			f.wallet,
			"https://sigma.example",
			"https://sigma.example/api/agents/a/delegations/b/revelation",
			{},
		),
	).rejects.toMatchObject({ code: "outcome_unknown" });
	expect(send).toHaveBeenCalledTimes(1);
});

test("authentication wallet blocks both payment methods and redacts errors", async () => {
	const f = await fixture();
	const create = spyOn(f.wallet, "createAction");
	const sign = spyOn(f.wallet, "signAction");
	spyOn(AuthFetch.prototype, "fetch").mockImplementation(async function (
		this: AuthFetch,
	) {
		const wallet = Reflect.get(this, "wallet") as WalletInterface;
		await expect(
			wallet.signAction({ reference: "x", spends: {} }),
		).rejects.toMatchObject({ code: "payment_required" });
		await wallet.createAction({ description: "unexpected payment" });
		return new Response();
	});
	await expect(
		postRevelation(
			f.wallet,
			"https://sigma.example",
			"https://sigma.example/api/agents/a/delegations/b/revelation",
			{},
		),
	).rejects.toMatchObject({ code: "payment_required", status: 402 });
	expect(create).not.toHaveBeenCalled();
	expect(sign).not.toHaveBeenCalled();
});

for (const phase of ["handshake", "endpoint"])
	test(`real SDK ${phase} refuses redirect without reaching target`, async () => {
		const f = await fixture();
		let requests = 0;
		let followed = 0;
		const target = Bun.serve({
			hostname: "127.0.0.1",
			port: 0,
			fetch() {
				followed++;
				return new Response("unexpected");
			},
		});
		if (phase === "endpoint") {
			spyOn(Peer.prototype, "toPeer").mockImplementation(async function (
				this: Peer,
				payload: number[],
			) {
				// Use the real configured SDK transport for the mutation; only skip the
				// cryptographic handshake so this regression isolates endpoint redirects.
				const transport = Reflect.get(
					this,
					"transport",
				) as SimplifiedFetchTransport;
				await transport.send({
					messageType: "general",
					version: "0.1",
					identityKey: f.handoff.certificate.subject,
					nonce: "n",
					yourNonce: "y",
					signature: [1],
					payload,
				});
			});
		}
		const source = Bun.serve({
			hostname: "127.0.0.1",
			port: 0,
			fetch() {
				requests++;
				return new Response(null, {
					status: 307,
					headers: { Location: target.url.href },
				});
			},
		});
		try {
			const origin = source.url.origin;
			await expect(
				postRevelation(
					f.wallet,
					origin,
					`${origin}/api/agents/a/delegations/b/revelation`,
					{},
				),
			).rejects.toMatchObject({ code: "outcome_unknown" });
			expect(requests).toBe(1);
			expect(followed).toBe(0);
		} finally {
			source.stop(true);
			target.stop(true);
		}
	});

test("actual SDK 402 processor cannot create a payment", async () => {
	const f = await fixture();
	const create = spyOn(f.wallet, "createAction");
	const processor = Reflect.get(
		AuthFetch.prototype,
		"handlePaymentAndRetry",
	) as (url: string, config: object, response: Response) => Promise<Response>;
	spyOn(AuthFetch.prototype, "fetch").mockImplementation(async function (
		this: AuthFetch,
		url,
		config,
	) {
		return processor.call(
			this,
			url,
			config ?? {},
			new Response(null, {
				status: 402,
				headers: {
					"x-bsv-payment-version": "1.0",
					"x-bsv-payment-satoshis-required": "25",
					"x-bsv-auth-identity-key": f.handoff.revealTo,
					"x-bsv-payment-derivation-prefix": "test-prefix",
				},
			}),
		);
	});
	await expect(
		postRevelation(
			f.wallet,
			"https://sigma.example",
			"https://sigma.example/api/agents/a/delegations/b/revelation",
			{},
		),
	).rejects.toMatchObject({ code: "payment_required", status: 402 });
	expect(create).not.toHaveBeenCalled();
});

test("invalid certificate and path cannot import; transport errors do not echo secrets", async () => {
	const f = await fixture();
	for (const handoff of [
		{
			...f.handoff,
			certificate: { ...f.handoff.certificate, signature: "3006020101020101" },
		},
		{
			...f.handoff,
			revelationPath: "//elsewhere/api/agents/a/delegations/b/revelation",
		},
		{
			...f.handoff,
			revelationPath: "/api/agents/a/delegations/wrong/revelation",
		},
	]) {
		await expect(
			revealDelegation(
				f.wallet,
				"https://sigma.example",
				JSON.stringify(handoff),
			),
		).rejects.toBeInstanceOf(RevelationError);
	}
	expect(f.insert).not.toHaveBeenCalled();
	spyOn(AuthFetch.prototype, "fetch").mockRejectedValue(
		new Error("private body preview must not escape"),
	);
	try {
		await postRevelation(
			f.wallet,
			"https://sigma.example",
			"https://sigma.example/api/agents/a/delegations/b/revelation",
			{},
		);
		throw new Error("expected failure");
	} catch (error) {
		expect(error).toMatchObject({ code: "outcome_unknown" });
		expect(String(error)).not.toContain("private body");
	}
});

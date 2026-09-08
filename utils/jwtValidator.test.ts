import { expect, test } from "bun:test";
import {
	createLocalJWKSet,
	exportJWK,
	generateKeyPair,
	type JWTPayload,
	SignJWT,
} from "jose";
import { JWTValidator } from "./jwtValidator";

const issuer = "https://issuer.example";
const audience = "https://resource.example";

async function createOfflineValidator(): Promise<{
	validator: JWTValidator;
	privateKey: CryptoKey;
}> {
	const { privateKey, publicKey } = await generateKeyPair("RS256");
	const publicJwk = await exportJWK(publicKey);
	const jwks = createLocalJWKSet({
		keys: [{ ...publicJwk, alg: "RS256", kid: "test-key", use: "sig" }],
	});
	const validator = new JWTValidator({ issuer, audience });

	// Replace the remote resolver with an ephemeral local resolver so these
	// signed-token tests never access the network.
	Object.defineProperty(validator, "jwks", { value: jwks });

	return { validator, privateKey };
}

async function signToken(
	privateKey: CryptoKey,
	subject: unknown,
	includeSubject = true,
): Promise<string> {
	const payload: Record<string, unknown> = {};
	if (includeSubject) payload.sub = subject;

	return await new SignJWT(payload as JWTPayload)
		.setProtectedHeader({ alg: "RS256", kid: "test-key" })
		.setIssuer(issuer)
		.setAudience(audience)
		.setExpirationTime("2h")
		.sign(privateKey);
}

test("rejects signed tokens with missing or invalid subjects", async () => {
	const { validator, privateKey } = await createOfflineValidator();
	const invalidSubjects = [
		{ value: undefined, includeSubject: false },
		{ value: "", includeSubject: true },
		{ value: null, includeSubject: true },
		{ value: 0, includeSubject: true },
	];

	for (const { value, includeSubject } of invalidSubjects) {
		const token = await signToken(privateKey, value, includeSubject);
		await expect(validator.validate(token)).rejects.toThrow();
	}
});

test("accepts and preserves a nonempty whitespace-bearing subject", async () => {
	const { validator, privateKey } = await createOfflineValidator();

	for (const subject of [" user-a \t", " \t"]) {
		const token = await signToken(privateKey, subject);
		expect((await validator.validate(token)).sub).toBe(subject);
	}
});

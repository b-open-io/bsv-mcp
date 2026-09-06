import { afterEach, expect, mock, spyOn, test } from "bun:test";
import { createContext } from "@1sat/actions";
import { AuthFetch, PrivateKey, type WalletInterface } from "@bsv/sdk";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAllTools } from "../tools";
import { IntegratedWallet } from "../tools/wallet/integratedWallet";
import {
	DroplitClient,
	DroplitError,
	readDroplitSponsorConfig,
} from "./droplit";

const publicKey =
	"0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798";
const config = {
	apiUrl: "https://api.droplit.dev/droplit",
	faucetName: "sponsor",
};
const access = {
	slug: "sponsor",
	public_key: publicKey,
	authorized: false,
	is_owner: false,
	quotas: [],
	unrestricted_kinds: [],
	approval_path: "https://evil.example/approve",
};
function wallet() {
	return {
		getPublicKey: mock(async () => ({ publicKey })),
	} as unknown as WalletInterface;
}
afterEach(() => mock.restore());

test("sponsor configuration requires an explicit pair", () => {
	expect(readDroplitSponsorConfig({})).toBeUndefined();
	expect(() =>
		readDroplitSponsorConfig({ DROPLIT_API_URL: config.apiUrl }),
	).toThrow("both");
	expect(() =>
		readDroplitSponsorConfig({ DROPLIT_FAUCET_NAME: config.faucetName }),
	).toThrow("both");
	expect(
		readDroplitSponsorConfig({
			DROPLIT_API_URL: config.apiUrl,
			DROPLIT_FAUCET_NAME: config.faucetName,
		}),
	).toEqual(config);
});

test("AuthFetch uses the actual connected wallet and identity, without exposing config secrets", async () => {
	const signer = wallet();
	const seen: unknown[] = [];
	const fetch = spyOn(AuthFetch.prototype, "fetch").mockImplementation(
		async function (this: AuthFetch) {
			seen.push((this as unknown as { wallet: WalletInterface }).wallet);
			return Response.json(access);
		},
	);
	const client = new DroplitClient({ ...config, wallet: signer });
	expect(await client.getIdentityKey()).toBe(publicKey);
	await client.getAccess();
	await client.getAccess();
	expect(seen).toHaveLength(2);
	expect(seen[0]).toBe(seen[1]);
	expect(
		await (seen[0] as WalletInterface).getPublicKey({ identityKey: true }),
	).toEqual({ publicKey });
	expect(signer.getPublicKey).toHaveBeenCalledWith({ identityKey: true });
	expect(client.getConfig()).toEqual(config);
	expect(fetch).toHaveBeenCalledTimes(2);
	expect(
		() =>
			new DroplitClient({
				...config,
				wallet: signer,
				authKey: PrivateKey.fromRandom(),
			}),
	).toThrow("not both");
	const legacy = new DroplitClient({
		...config,
		authKey: PrivateKey.fromHex("01"),
	});
	expect(await legacy.getIdentityKey()).toBe(publicKey);
	expect(legacy.getConfig()).not.toHaveProperty("authKey");
});

async function tools() {
	const signer = wallet();
	const server = new McpServer({ name: "droplit-test", version: "1" });
	registerAllTools(server, {
		ctx: createContext(signer),
		droplitClient: new DroplitClient({ ...config, wallet: signer }),
		enableBsvTools: false,
		enableOrdinalsTools: false,
		enableUtilsTools: false,
		enableBapTools: false,
		enableBsocialTools: false,
		enableMneeTools: false,
	});
	const client = new Client({ name: "test", version: "1" });
	const [clientTransport, serverTransport] =
		InMemoryTransport.createLinkedPair();
	await Promise.all([
		server.connect(serverTransport),
		client.connect(clientTransport),
	]);
	return {
		client,
		close: async () => {
			await client.close();
			await server.close();
		},
	};
}

test("denied access returns a trusted manual link with no mutation and keeps normal wallet tools", async () => {
	const fetch = spyOn(AuthFetch.prototype, "fetch").mockResolvedValue(
		Response.json(access),
	);
	const { client, close } = await tools();
	try {
		const list = await client.listTools();
		expect(list.tools.some((tool) => tool.name.startsWith("wallet_"))).toBe(
			true,
		);
		const read = list.tools.find((tool) => tool.name === "droplit_getAccess");
		expect(read?.annotations?.readOnlyHint).toBe(true);
		expect(
			list.tools.find((tool) => tool.name === "droplit_push")?.annotations
				?.idempotentHint,
		).toBe(false);
		const result = await client.callTool({
			name: "droplit_getAccess",
			arguments: {},
		});
		expect(result.isError).toBe(true);
		expect(result.structuredContent).toMatchObject({
			error: "approval_required",
			authorized: false,
			approval_url: `https://droplit.dev/droplit/sponsor?tab=api&request_key=${publicKey}`,
		});
		expect(fetch).toHaveBeenCalledTimes(1);
		expect(fetch.mock.calls[0][0]).toBe(
			`${config.apiUrl}/faucet/sponsor/access`,
		);
		expect(fetch.mock.calls[0][1]?.method).toBe("GET");
	} finally {
		await close();
	}
});

for (const [name, args, body] of [
	[
		"droplit_push",
		{ data: ["hello"], encoding: "utf8" },
		{ data: ["hello"], encoding: "utf8" },
	],
	["droplit_fund", { rawtx: "01000000" }, { rawtx: "01000000" }],
] as const) {
	test(`${name} sends canonical body once without auto-payment`, async () => {
		const fetch = spyOn(AuthFetch.prototype, "fetch").mockResolvedValue(
			Response.json({ txid: "test-txid" }),
		);
		const { client, close } = await tools();
		try {
			const result = await client.callTool({ name, arguments: args });
			expect(result.isError).toBe(false);
			expect(fetch).toHaveBeenCalledTimes(1);
			expect(fetch.mock.calls[0][1]).toMatchObject({
				method: "POST",
				body: JSON.stringify(body),
				paymentRetryAttempts: 0,
				retryCounter: 1,
			});
		} finally {
			await close();
		}
	});
}

for (const [status, code] of [
	[401, "authentication_required"],
	[402, "approval_required"],
	[403, "approval_required"],
	[429, "quota_exceeded"],
] as const) {
	test(`HTTP ${status} returns a structured actionable error without replay`, async () => {
		const fetch = spyOn(AuthFetch.prototype, "fetch").mockResolvedValue(
			Response.json(
				{
					error: "secret request dump",
					remaining: 0,
					resets_at: "2026-09-06T00:00:00Z",
				},
				{ status },
			),
		);
		const { client, close } = await tools();
		try {
			const result = await client.callTool({
				name: "droplit_push",
				arguments: { data: ["hello"], encoding: "utf8" },
			});
			expect(result.isError).toBe(true);
			expect(result.structuredContent).toMatchObject({ status, error: code });
			if (status === 429)
				expect(result.structuredContent).toMatchObject({
					remaining: 0,
					resets_at: "2026-09-06T00:00:00Z",
				});
			expect(JSON.stringify(result)).not.toContain("secret request dump");
			expect(fetch).toHaveBeenCalledTimes(1);
		} finally {
			await close();
		}
	});
}

test("ambiguous writes submit once and require reconciliation", async () => {
	const fetch = spyOn(AuthFetch.prototype, "fetch").mockRejectedValue(
		new Error("transport failure containing private request"),
	);
	const { client, close } = await tools();
	try {
		const result = await client.callTool({
			name: "droplit_fund",
			arguments: { rawtx: "01000000" },
		});
		expect(result.isError).toBe(true);
		expect(result.structuredContent).toMatchObject({
			error: "unknown_outcome",
		});
		expect(JSON.stringify(result)).toContain("Reconcile");
		expect(JSON.stringify(result)).not.toContain("private request");
		expect(fetch).toHaveBeenCalledTimes(1);
	} finally {
		await close();
	}
});

test("legacy arbitrary tap amount reaches server satoshis field", async () => {
	const fetch = spyOn(AuthFetch.prototype, "fetch").mockResolvedValue(
		Response.json({ txid: "test" }),
	);
	const integrated = new IntegratedWallet({
		useDroplitApi: true,
		droplitConfig: { ...config },
		paymentKey: PrivateKey.fromRandom(),
	});
	await integrated.sendToAddress("test-address", 1234);
	expect(fetch).toHaveBeenCalledTimes(1);
	expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).toEqual({
		recipient_address: "test-address",
		satoshis: 1234,
	});
});

test("SDK status errors are sanitized and remain typed", async () => {
	spyOn(AuthFetch.prototype, "fetch").mockRejectedValue(
		Object.assign(new Error("private details"), {
			details: { status: 403, bodyPreview: "private" },
		}),
	);
	const client = new DroplitClient({ ...config, wallet: wallet() });
	try {
		await client.push(["00"]);
		throw new Error("expected rejection");
	} catch (error) {
		expect(error).toBeInstanceOf(DroplitError);
		expect(error).toMatchObject({ status: 403, code: "approval_required" });
		expect(String(error)).not.toContain("private");
	}
});

test("real SDK 402 payment processor cannot spend through the authentication facade", async () => {
	const signer = {
		getPublicKey: mock(async () => ({ publicKey })),
		createHmac: mock(async () => ({ hmac: Array(32).fill(7) })),
		createAction: mock(async () => ({ tx: [1] })),
		signAction: mock(async () => ({})),
	} as unknown as WalletInterface;
	const client = new DroplitClient({ ...config, wallet: signer });
	// Invoke the installed SDK payment processor unchanged, as its own payment
	// tests do. A fetch mock alone would miss SDK auto-payment behavior.
	const sdk = (client as unknown as { authFetch: AuthFetch }).authFetch;
	const processPayment = Reflect.get(sdk, "handlePaymentAndRetry") as (
		url: string,
		init: object,
		response: Response,
	) => Promise<Response>;
	const response = new Response(null, {
		status: 402,
		headers: {
			"x-bsv-payment-version": "1.0",
			"x-bsv-payment-satoshis-required": "5",
			"x-bsv-auth-identity-key": publicKey,
			"x-bsv-payment-derivation-prefix": "test-prefix",
		},
	});
	await expect(
		processPayment.call(
			sdk,
			config.apiUrl,
			{ method: "POST", paymentRetryAttempts: 0 },
			response,
		),
	).rejects.toMatchObject({ code: "approval_required", status: 402 });
	expect(signer.createAction).not.toHaveBeenCalled();
	expect(signer.signAction).not.toHaveBeenCalled();
	expect(signer.getPublicKey).toHaveBeenCalled();
});

import { expect, mock, test } from "bun:test";
import { deriveDepositAddresses, type OneSatContext } from "@1sat/actions";
import {
	Beef,
	LockingScript,
	PublicKey,
	Transaction,
	UnlockingScript,
	type WalletInterface,
} from "@bsv/sdk";
import { WalletPermissionsManager } from "@bsv/wallet-toolbox/out/src/index.client.js";
import type { PermissionRequest } from "@bsv/wallet-toolbox/out/src/WalletPermissionsManager.js";
import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport, McpServer } from "@modelcontextprotocol/server";
import { registerGetAddressTool } from "../tools/wallet/getAddress";
import { registerWalletGetBalanceTool } from "../tools/wallet/getBalance";
import {
	EMBEDDED_OWNER_ORIGINATOR,
	withEmbeddedOwnerDefaultBasketRead,
	withEmbeddedOwnerDerivation,
} from "./embeddedOwnerRead";
import { ADMIN_ORIGINATOR } from "./walletInit";

const OWNER_OUTPUTS = [
	{
		outpoint:
			"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.0",
		satoshis: 321,
		lockingScript: "51",
		spendable: true,
	},
];

const OWNER_PUBLIC_KEY =
	"0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798";

function makeManager() {
	const calls: unknown[][] = [];
	const listOutputs = async (...args: unknown[]) => {
		calls.push(args);
		const request = args[0] as { basket?: string } | undefined;
		const outputs = request?.basket === "default" ? OWNER_OUTPUTS : [];
		return {
			totalOutputs: outputs.length,
			outputs,
		};
	};
	const underlying = { listOutputs } as unknown as WalletInterface;
	const manager = new WalletPermissionsManager(underlying, ADMIN_ORIGINATOR, {
		seekBasketListingPermissions: true,
	});
	return { calls, manager };
}

function makeSpendFixture() {
	const source = new Transaction(1);
	source.addOutput({
		satoshis: 1_000,
		lockingScript: LockingScript.fromHex("51"),
	});
	const tx = new Transaction(1);
	tx.addInput({
		sourceTransaction: source,
		sourceOutputIndex: 0,
		unlockingScript: UnlockingScript.fromHex(""),
	});
	tx.addOutput({
		satoshis: 900,
		lockingScript: LockingScript.fromHex("51"),
	});
	const beef = new Beef();
	beef.mergeRawTx(source.toUint8Array());
	beef.mergeRawTx(tx.toUint8Array());
	return beef.toBinaryAtomic(tx.id("hex"));
}

function makeSpendingManager() {
	const calls: string[] = [];
	const atomicBeef = makeSpendFixture();
	const underlying = {
		listOutputs: async () => {
			calls.push("listOutputs");
			return { outputs: [], totalOutputs: 0 };
		},
		createAction: async () => {
			calls.push("createAction");
			return {
				signableTransaction: { reference: "cmVm", tx: atomicBeef },
			};
		},
		signAction: async () => {
			calls.push("signAction");
			return {};
		},
		abortAction: async () => {
			calls.push("abortAction");
			return {};
		},
	};
	const manager = new WalletPermissionsManager(
		underlying as unknown as WalletInterface,
		ADMIN_ORIGINATOR,
		{
			encryptWalletMetadata: false,
			seekGroupedPermission: false,
			seekSpendingPermissions: true,
			seekBasketListingPermissions: false,
		},
	);
	return { calls, manager };
}

function spendingActionArgs() {
	return {
		description: "Synthetic payment",
		outputs: [
			{
				lockingScript: "51",
				satoshis: 900,
				outputDescription: "Synthetic recipient",
			},
		],
		options: { signAndProcess: false },
	};
}

type SpendingRequest = PermissionRequest & { requestID: string };

test("real WPM denies default reads for callers and owner adapter scopes the bypass", async () => {
	const { calls, manager } = makeManager();

	await expect(
		manager.listOutputs({ basket: "default" }, "caller.example"),
	).rejects.toThrow("admin-only");

	const ownerWallet = withEmbeddedOwnerDefaultBasketRead(
		manager,
		ADMIN_ORIGINATOR,
	);
	const result = await ownerWallet.listOutputs(
		{ basket: "default" },
		"caller.example",
	);

	expect(result.outputs).toEqual(OWNER_OUTPUTS);
	expect(calls).toHaveLength(1);
	expect(calls[0]?.[1]).toBe(ADMIN_ORIGINATOR);
});

test("non-default and admin-prefixed baskets retain WPM permissions", async () => {
	const { manager } = makeManager();
	(
		manager as unknown as {
			requestPermissionFlow: () => Promise<never>;
		}
	).requestPermissionFlow = async () => {
		throw new Error("permission flow reached");
	};
	const ownerWallet = withEmbeddedOwnerDefaultBasketRead(
		manager,
		ADMIN_ORIGINATOR,
	);

	await expect(
		ownerWallet.listOutputs(
			{ basket: "admin-other", seekPermission: false },
			"caller.example",
		),
	).rejects.toThrow("admin-only");
	await expect(
		ownerWallet.listOutputs({ basket: "user-basket" }, "caller.example"),
	).rejects.toThrow("permission flow reached");
});

test("non-allowlisted methods preserve caller originators", async () => {
	const { manager } = makeManager();
	const createAction = mock(async (..._args: unknown[]) => ({ created: true }));
	const signAction = mock(async (..._args: unknown[]) => ({ signed: true }));
	manager.createAction = createAction as typeof manager.createAction;
	manager.signAction = signAction as typeof manager.signAction;
	const ownerWallet = withEmbeddedOwnerDefaultBasketRead(
		manager,
		ADMIN_ORIGINATOR,
	);
	const request = { description: "synthetic", outputs: [] };

	await ownerWallet.createAction(request as never, "caller.example");
	await ownerWallet.signAction(
		{ reference: "synthetic", spends: {} } as never,
		"caller.example",
	);
	expect(createAction.mock.calls[0]?.[1]).toBe("caller.example");
	expect(signAction.mock.calls[0]?.[1]).toBe("caller.example");
});

test("wallet_getBalance uses the adapted manager through MCP transport", async () => {
	const { calls, manager } = makeManager();
	const wallet = withEmbeddedOwnerDefaultBasketRead(manager, ADMIN_ORIGINATOR);
	const server = new McpServer({
		name: "embedded-owner-read-test",
		version: "1",
	});
	registerWalletGetBalanceTool(server, {
		wallet,
	} as OneSatContext);
	const client = new Client({
		name: "embedded-owner-read-client",
		version: "1",
	});
	const [clientTransport, serverTransport] =
		InMemoryTransport.createLinkedPair();

	try {
		await Promise.all([
			server.connect(serverTransport),
			client.connect(clientTransport),
		]);
		const result = await client.callTool({
			name: "wallet_getBalance",
			arguments: {},
		});

		expect(result.isError).not.toBe(true);
		const text = (result.content?.[0] as { text?: string })?.text ?? "";
		expect(text).toContain('"satoshis":321');
		expect(calls.at(-1)?.[0]).toMatchObject({ basket: "default" });
		expect(calls.at(-1)?.[1]).toBe(ADMIN_ORIGINATOR);
	} finally {
		await client.close();
		await server.close();
	}
});

test("internal address derivation gets owner origin without elevating public key calls", async () => {
	const calls: unknown[][] = [];
	const underlying = {
		getPublicKey: async (...args: unknown[]) => {
			calls.push(args);
			return { publicKey: OWNER_PUBLIC_KEY };
		},
	} as unknown as WalletInterface;
	const manager = new WalletPermissionsManager(underlying, ADMIN_ORIGINATOR, {
		seekProtocolPermissionsForSigning: false,
		seekPermissionsForPublicKeyRevelation: false,
		seekPermissionsForIdentityKeyRevelation: false,
	});
	const regularWallet = withEmbeddedOwnerDefaultBasketRead(
		manager,
		ADMIN_ORIGINATOR,
	);
	const ownerWallet = withEmbeddedOwnerDerivation(
		regularWallet,
		ADMIN_ORIGINATOR,
	);

	const { publicKey } = await ownerWallet.getPublicKey({ identityKey: true });
	expect(publicKey).toBe(OWNER_PUBLIC_KEY);
	expect(calls.at(-1)?.[1]).toBe(ADMIN_ORIGINATOR);
	await expect(
		regularWallet.getPublicKey({ identityKey: true }),
	).rejects.toThrow("Originator is required");

	const derived = await deriveDepositAddresses.execute(
		{
			wallet: ownerWallet,
			chain: "main",
			isBaseWallet: true,
		},
		{ prefix: "mcp" },
	);
	expect(derived.derivations[0]?.publicKey).toBe(OWNER_PUBLIC_KEY);
	expect(calls).toHaveLength(3);
	expect(calls[1]?.[1]).toBe(ADMIN_ORIGINATOR);
});

test("wallet_getAddress uses only the embedded derivation context", async () => {
	const calls: unknown[][] = [];
	const underlying = {
		getPublicKey: async (...args: unknown[]) => {
			calls.push(args);
			return { publicKey: OWNER_PUBLIC_KEY };
		},
	} as unknown as WalletInterface;
	const manager = new WalletPermissionsManager(underlying, ADMIN_ORIGINATOR, {
		seekPermissionsForPublicKeyRevelation: false,
		seekPermissionsForIdentityKeyRevelation: false,
	});
	const wallet = withEmbeddedOwnerDefaultBasketRead(manager, ADMIN_ORIGINATOR);
	const server = new McpServer({
		name: "embedded-owner-address-test",
		version: "1",
	});
	registerGetAddressTool(server, {
		wallet,
		chain: "main",
		isBaseWallet: true,
		[EMBEDDED_OWNER_ORIGINATOR]: ADMIN_ORIGINATOR,
	} as OneSatContext);
	const client = new Client({
		name: "embedded-owner-address-client",
		version: "1",
	});
	const [clientTransport, serverTransport] =
		InMemoryTransport.createLinkedPair();

	try {
		await Promise.all([
			server.connect(serverTransport),
			client.connect(clientTransport),
		]);
		const result = await client.callTool({
			name: "wallet_getAddress",
			arguments: {},
		});

		expect(result.isError).not.toBe(true);
		const text = (result.content?.[0] as { text?: string })?.text ?? "";
		expect(text).toContain('"status":"ok"');
		expect(text).toContain(
			`"address":"${PublicKey.fromString(OWNER_PUBLIC_KEY).toAddress()}"`,
		);
		expect(calls[0]?.[1]).toBe(ADMIN_ORIGINATOR);
		expect(calls[1]?.[1]).toBe(ADMIN_ORIGINATOR);
	} finally {
		await client.close();
		await server.close();
	}
});

test("real WPM spending denial aborts the action before signing", async () => {
	const { calls, manager } = makeSpendingManager();
	const ownerWallet = withEmbeddedOwnerDefaultBasketRead(
		manager,
		ADMIN_ORIGINATOR,
	);
	manager.bindCallback(
		"onSpendingAuthorizationRequested",
		async (request: SpendingRequest) =>
			manager.denyPermission(request.requestID),
	);

	await expect(
		ownerWallet.createAction(spendingActionArgs(), "caller.example"),
	).rejects.toMatchObject({ code: "ERR_PERMISSION_DENIED" });
	expect(calls).toEqual(["createAction", "listOutputs", "abortAction"]);
});

test("real WPM spending approval returns a signable action without broadcast", async () => {
	const { calls, manager } = makeSpendingManager();
	const ownerWallet = withEmbeddedOwnerDefaultBasketRead(
		manager,
		ADMIN_ORIGINATOR,
	);
	let requestedSatoshis = 0;
	manager.bindCallback(
		"onSpendingAuthorizationRequested",
		async (request: SpendingRequest) => {
			requestedSatoshis = request.spending?.satoshis ?? 0;
			await manager.grantPermission({
				requestID: request.requestID,
				amount: requestedSatoshis,
				ephemeral: true,
			});
		},
	);

	const result = await ownerWallet.createAction(
		spendingActionArgs(),
		"caller.example",
	);
	expect(requestedSatoshis).toBe(1_000);
	expect(result.signableTransaction?.reference).toBe("cmVm");
	expect(calls).toEqual(["createAction", "listOutputs"]);
});

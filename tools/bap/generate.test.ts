import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PrivateKey, Transaction } from "@bsv/sdk";
import HD from "@bsv/sdk/compat/HD";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type {
	CallToolResult,
	ServerNotification,
	ServerRequest,
} from "@modelcontextprotocol/sdk/types.js";
import * as utxoUtils from "../wallet/fetchPaymentUtxos";
import { type BapGenerateArgs, registerBapGenerateTool } from "./generate";

type GenericToolHandler = (
	params: { args: BapGenerateArgs },
	extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
) => CallToolResult | Promise<CallToolResult>;

const mockMcpServerInstance = {
	tool: (..._args: Parameters<McpServer["tool"]>): void => undefined,
};

const KEY_DIR = path.join(os.homedir(), ".bsv-mcp");
const KEY_FILE_PATH = path.join(KEY_DIR, "keys.json");

const MOCK_PAY_PK_WIF = "L3tg5yk23vBrSGZT8pfrDFQBK8n46eeot2Sf91ezNt7rhyReCA53";
const MOCK_PAY_ADDRESS = PrivateKey.fromWif(MOCK_PAY_PK_WIF).toAddress();
const MOCK_KEYS_WITH_PAYPK = { payPk: MOCK_PAY_PK_WIF };
const MOCK_UTXO_SCRIPT_HASH_PLACEHOLDER =
	"1a2b3c4d5e6f7081920a1b2c3d4e5f607081920a";
const MOCK_UTXO = {
	txid: "a1b2c3d4".repeat(8),
	vout: 0,
	satoshis: 100000,
	script: `76a914${MOCK_UTXO_SCRIPT_HASH_PLACEHOLDER}88ac`,
};

describe("BAP Generate Tool", () => {
	let readFileSyncSpy: ReturnType<typeof spyOn<typeof fs, "readFileSync">>;
	let writeFileSyncSpy: ReturnType<typeof spyOn<typeof fs, "writeFileSync">>;
	let existsSyncSpy: ReturnType<typeof spyOn<typeof fs, "existsSync">>;
	let mkdirSyncSpy: ReturnType<typeof spyOn<typeof fs, "mkdirSync">>;
	let mockServerToolSpy: ReturnType<
		typeof spyOn<typeof mockMcpServerInstance, "tool">
	>;
	let fetchPaymentUtxosSpy: ReturnType<
		typeof spyOn<typeof utxoUtils, "fetchPaymentUtxos">
	>;
	let transactionBroadcastSpy: ReturnType<
		typeof spyOn<Transaction.prototype, "broadcast">
	>;

	beforeEach(() => {
		mockServerToolSpy = spyOn(mockMcpServerInstance, "tool");
		mockServerToolSpy.mockClear();

		readFileSyncSpy = spyOn(fs, "readFileSync");
		writeFileSyncSpy = spyOn(fs, "writeFileSync");
		existsSyncSpy = spyOn(fs, "existsSync");
		mkdirSyncSpy = spyOn(fs, "mkdirSync");
		fetchPaymentUtxosSpy = spyOn(utxoUtils, "fetchPaymentUtxos");
		transactionBroadcastSpy = spyOn(Transaction.prototype, "broadcast");

		existsSyncSpy.mockReturnValue(true);
		readFileSyncSpy.mockReturnValue(JSON.stringify(MOCK_KEYS_WITH_PAYPK));
		mkdirSyncSpy.mockImplementation(() => undefined);
		writeFileSyncSpy.mockImplementation(() => undefined);
		fetchPaymentUtxosSpy.mockResolvedValue([MOCK_UTXO]);
		transactionBroadcastSpy.mockResolvedValue(
			`mock_txid_broadcasted_${"a".repeat(40)}`,
		);
	});

	afterEach(() => {
		mockServerToolSpy.mockRestore();
		readFileSyncSpy.mockRestore();
		writeFileSyncSpy.mockRestore();
		existsSyncSpy.mockRestore();
		mkdirSyncSpy.mockRestore();
		fetchPaymentUtxosSpy.mockRestore();
		transactionBroadcastSpy.mockRestore();
	});

	it("should register bap_generate tool with the MCP server", () => {
		registerBapGenerateTool(mockMcpServerInstance as unknown as McpServer);
		expect(mockServerToolSpy).toHaveBeenCalledTimes(1);
		expect(mockServerToolSpy).toHaveBeenCalledWith(
			"bap_generate",
			expect.any(String),
			{ args: expect.any(Object) },
			expect.any(Function),
		);
	});

	const getRegisteredHandler = (): GenericToolHandler => {
		if (mockServerToolSpy.mock.calls.length === 0) {
			throw new Error("Tool handler not registered or spy not called.");
		}
		return mockServerToolSpy.mock.calls[0][3] as GenericToolHandler;
	};

	it("should generate keys and TX if payPk exists and no BAP keys, and save all to keys.json", async () => {
		const initialKeys = { payPk: MOCK_PAY_PK_WIF };
		existsSyncSpy.mockReturnValue(true);
		readFileSyncSpy.mockReturnValue(JSON.stringify(initialKeys));
		fetchPaymentUtxosSpy.mockResolvedValue([MOCK_UTXO]);

		registerBapGenerateTool(mockMcpServerInstance as unknown as McpServer);
		const handler = getRegisteredHandler();
		const mockExtra = {} as RequestHandlerExtra<
			ServerRequest,
			ServerNotification
		>;
		const result = (await handler({ args: {} }, mockExtra)) as CallToolResult;

		expect(result.isError).toBe(false);
		expect(mkdirSyncSpy).toHaveBeenCalledWith(KEY_DIR, {
			recursive: true,
			mode: 0o700,
		});
		expect(writeFileSyncSpy).toHaveBeenCalledTimes(1);
		const writtenData = JSON.parse(
			writeFileSyncSpy.mock.calls[0][1] as string,
		) as Record<string, string>;

		expect(writtenData.payPk).toBe(MOCK_PAY_PK_WIF);
		expect(writtenData.xprv).toBeString();
		expect(writtenData.xprv?.startsWith("xprv")).toBe(true);
		expect(writtenData.identityPk).toBeString();

		expect(result.content?.[0]?.text).toContain(
			"BAP HD Key and Initial Identity Generated & Saved",
		);
		expect(result.content?.[0]?.text).toContain("Registration TXID:");
		expect(transactionBroadcastSpy).toHaveBeenCalled();
	});

	it("should return error if keys.json does not exist", async () => {
		existsSyncSpy.mockReturnValue(false);

		registerBapGenerateTool(mockMcpServerInstance as unknown as McpServer);
		const handler = getRegisteredHandler();
		const mockExtra = {} as RequestHandlerExtra<
			ServerRequest,
			ServerNotification
		>;
		const result = (await handler({ args: {} }, mockExtra)) as CallToolResult;

		expect(result.isError).toBe(true);
		expect(result.content?.[0]?.text).toContain(
			"keys.json not found. Payment Private Key (payPk) is required.",
		);
		expect(writeFileSyncSpy).not.toHaveBeenCalled();
	});

	it("should return error if payPk is missing from keys.json", async () => {
		existsSyncSpy.mockReturnValue(true);
		readFileSyncSpy.mockReturnValue(JSON.stringify({ someOtherKey: "value" }));

		registerBapGenerateTool(mockMcpServerInstance as unknown as McpServer);
		const handler = getRegisteredHandler();
		const mockExtra = {} as RequestHandlerExtra<
			ServerRequest,
			ServerNotification
		>;
		const result = (await handler({ args: {} }, mockExtra)) as CallToolResult;

		expect(result.isError).toBe(true);
		expect(result.content?.[0]?.text).toContain(
			"Payment Private Key (payPk) does not exist in keys.json.",
		);
		expect(writeFileSyncSpy).not.toHaveBeenCalled();
	});

	it("should return error if xprv already exists", async () => {
		const existingKeys = {
			payPk: MOCK_PAY_PK_WIF,
			xprv: "already_exists_xprv",
		};
		existsSyncSpy.mockReturnValue(true);
		readFileSyncSpy.mockReturnValue(JSON.stringify(existingKeys));

		registerBapGenerateTool(mockMcpServerInstance as unknown as McpServer);
		const handler = getRegisteredHandler();
		const mockExtra = {} as RequestHandlerExtra<
			ServerRequest,
			ServerNotification
		>;
		const result = (await handler({ args: {} }, mockExtra)) as CallToolResult;

		expect(result.isError).toBe(true);
		expect(result.content?.[0]?.text).toContain(
			"BAP Master Key (xprv) already exists in keys.json.",
		);
		expect(writeFileSyncSpy).not.toHaveBeenCalled();
	});

	it("should return error if identityPk already exists", async () => {
		const existingKeys = {
			payPk: MOCK_PAY_PK_WIF,
			identityPk: "L5BBNhvVgvpdV1AkMJMNGy89MHEUnyiKhrs11GNAUxWjXvhxgcAg",
		};
		existsSyncSpy.mockReturnValue(true);
		readFileSyncSpy.mockReturnValue(JSON.stringify(existingKeys));

		registerBapGenerateTool(mockMcpServerInstance as unknown as McpServer);
		const handler = getRegisteredHandler();
		const mockExtra = {} as RequestHandlerExtra<
			ServerRequest,
			ServerNotification
		>;
		const result = (await handler({ args: {} }, mockExtra)) as CallToolResult;

		expect(result.isError).toBe(true);
		expect(result.content?.[0]?.text).toContain(
			"BAP Identity Key (identityPk) already exists in keys.json.",
		);
		expect(writeFileSyncSpy).not.toHaveBeenCalled();
	});

	it("should handle HD key generation error gracefully", async () => {
		const originalHDFromRandom = HD.fromRandom;
		HD.fromRandom = () => {
			throw new Error("Test HD generation error");
		};
		existsSyncSpy.mockReturnValue(true);
		readFileSyncSpy.mockReturnValue(JSON.stringify(MOCK_KEYS_WITH_PAYPK));

		const mockExtra = {} as RequestHandlerExtra<
			ServerRequest,
			ServerNotification
		>;

		try {
			registerBapGenerateTool(mockMcpServerInstance as unknown as McpServer);
			const handler = getRegisteredHandler();
			const result = (await handler({ args: {} }, mockExtra)) as CallToolResult;

			expect(result.isError).toBe(true);
			expect(result.content?.[0]?.text).toContain(
				"Failed during BAP key generation/saving or transaction construction: Test HD generation error",
			);
			expect(writeFileSyncSpy).not.toHaveBeenCalled();
		} finally {
			HD.fromRandom = originalHDFromRandom;
		}
	});

	it("should handle error if keys.json is corrupt", async () => {
		existsSyncSpy.mockReturnValue(true);
		readFileSyncSpy.mockImplementation(() => {
			throw new Error("JSON Parse error: Unexpected identifier 'this'.");
		});

		registerBapGenerateTool(mockMcpServerInstance as unknown as McpServer);
		const handler = getRegisteredHandler();
		const mockExtra = {} as RequestHandlerExtra<
			ServerRequest,
			ServerNotification
		>;
		const result = (await handler({ args: {} }, mockExtra)) as CallToolResult;

		expect(result.isError).toBe(true);
		expect(result.content?.[0]?.text).toContain(
			"Could not read or parse keys.json: JSON Parse error",
		);
		expect(writeFileSyncSpy).not.toHaveBeenCalled();
	});

	it("should handle error if no UTXOs are found for payPk", async () => {
		existsSyncSpy.mockReturnValue(true);
		readFileSyncSpy.mockReturnValue(JSON.stringify(MOCK_KEYS_WITH_PAYPK));
		fetchPaymentUtxosSpy.mockResolvedValue([]);

		registerBapGenerateTool(mockMcpServerInstance as unknown as McpServer);
		const handler = getRegisteredHandler();
		const mockExtra = {} as RequestHandlerExtra<
			ServerRequest,
			ServerNotification
		>;
		const result = (await handler({ args: {} }, mockExtra)) as CallToolResult;

		expect(result.isError).toBe(false);
		expect(result.content?.[0]?.text).toContain(
			"No UTXOs found for payment address",
		);
		expect(result.content?.[0]?.text).toContain(
			"Cannot fund BAP registration.",
		);
		expect(writeFileSyncSpy).toHaveBeenCalledTimes(1);
		const writtenData = JSON.parse(
			writeFileSyncSpy.mock.calls[0][1] as string,
		) as Record<string, string>;
		expect(writtenData.xprv).toBeString();
		expect(writtenData.identityPk).toBeString();
		expect(transactionBroadcastSpy).not.toHaveBeenCalled();
	});

	it("should handle error if transaction broadcast fails", async () => {
		existsSyncSpy.mockReturnValue(true);
		readFileSyncSpy.mockReturnValue(JSON.stringify(MOCK_KEYS_WITH_PAYPK));
		fetchPaymentUtxosSpy.mockResolvedValue([MOCK_UTXO]);
		transactionBroadcastSpy.mockRejectedValue(
			new Error("Broadcast network error"),
		);

		registerBapGenerateTool(mockMcpServerInstance as unknown as McpServer);
		const handler = getRegisteredHandler();
		const mockExtra = {} as RequestHandlerExtra<
			ServerRequest,
			ServerNotification
		>;
		const result = (await handler({ args: {} }, mockExtra)) as CallToolResult;

		expect(result.isError).toBe(false);
		expect(result.content?.[0]?.text).toContain(
			"Keys generated and saved, but failed to broadcast BAP registration transaction",
		);
		expect(result.content?.[0]?.text).toContain("Broadcast network error");
		expect(writeFileSyncSpy).toHaveBeenCalledTimes(1);
		const writtenData = JSON.parse(
			writeFileSyncSpy.mock.calls[0][1] as string,
		) as Record<string, string>;
		expect(writtenData.xprv).toBeString();
		expect(transactionBroadcastSpy).toHaveBeenCalled();
	});
});

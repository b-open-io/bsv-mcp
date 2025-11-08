import os from "node:os";
import path from "node:path";
import {
	P2PKH,
	PrivateKey,
	Script,
	Transaction,
	fromUtxo,
	isBroadcastFailure,
} from "@bsv/sdk";
import { Utils as BSVUtils, HD } from "@bsv/sdk";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { BAP } from "bsv-bap";
import { z } from "zod";
import { V5Broadcaster } from "../../utils/broadcaster";
import { SecureKeyManager } from "../../utils/keyManager";
import { BAP_PREFIX } from "../constants";
import { fetchPaymentUtxos } from "../wallet/fetchPaymentUtxos";

// Get toArray from BSV SDK Utils
const { toArray } = BSVUtils;

const KEY_DIR = path.join(os.homedir(), ".bsv-mcp");
const KEY_FILE_PATH = path.join(KEY_DIR, "keys.json");

const bapGenerateArgsSchema = z
	.object({
		alternateName: z.string().optional(),
		description: z.string().optional(),
	})
	.optional();

export type BapGenerateArgs = z.infer<typeof bapGenerateArgsSchema>;

/**
 * Generates a new BAP HD master key and derives the first identity,
 * saving the keys to secure storage.
 * Attempts to register the ID on-chain, unless broadcasting is disabled.
 */
async function generateBapKeys(
	args?: BapGenerateArgs & { disableBroadcasting?: boolean },
): Promise<{
	success: boolean;
	xprv?: string;
	identityAddress?: string;
	identityKey?: string;
	error?: string;
	message?: string;
	txid?: string;
	rawTx?: string;
}> {
	const keyManager = new SecureKeyManager({ keyDir: KEY_DIR });
	let tempXprv = "";
	let identityPk: string;
	let payPkToPreserve: PrivateKey | undefined;

	// 1. Load existing keys and check preconditions
	try {
		let keys: { payPk?: PrivateKey; identityPk?: PrivateKey; xprv?: string };
		let source: string;

		try {
			const result = await keyManager.loadKeys();
			keys = result.keys;
			source = result.source;
		} catch (loadError) {
			const errorMsg =
				loadError instanceof Error ? loadError.message : String(loadError);
			console.error(
				`ERROR: Failed to read keys from secure storage: ${errorMsg}`,
			);

			// Check for specific error patterns
			if (
				errorMsg.includes("JSON Parse error") ||
				errorMsg.includes("JSON.parse")
			) {
				// Extract just the JSON parse error part
				const match = errorMsg.match(/JSON Parse error[^.]*\.?/);
				const jsonError = match ? match[0] : "JSON Parse error";
				return {
					success: false,
					error: `Could not read or parse keys.json: ${jsonError}`,
				};
			}

			return {
				success: false,
				error: `Failed to read keys: ${errorMsg}`,
			};
		}

		if (!keys.payPk) {
			console.error(
				"ERROR: Payment Private Key (payPk) does not exist in secure storage.",
			);
			const errorMessage =
				source === "none"
					? "keys.json not found. Payment Private Key (payPk) is required."
					: "Payment Private Key (payPk) does not exist in keys.json.";
			return {
				success: false,
				error: errorMessage,
			};
		}

		payPkToPreserve = keys.payPk;

		if (keys.xprv) {
			console.error(
				"ERROR: BAP Master Key (xprv) already exists in secure storage.",
			);
			return {
				success: false,
				error: "BAP Master Key (xprv) already exists in keys.json.",
			};
		}

		if (keys.identityPk) {
			console.error(
				"ERROR: BAP Identity Key (identityPk) already exists. Cannot generate HD key.",
			);
			return {
				success: false,
				error: "BAP Identity Key (identityPk) already exists in keys.json.",
			};
		}

		const status = keyManager.getStatus();
		if (source === "legacy" && !status.hasEncrypted) {
			console.warn(
				"WARN: Using unencrypted keys. Run the server again to encrypt them.",
			);
		}
	} catch (fileError) {
		console.error("ERROR: Failed to read keys from secure storage:", fileError);
		return {
			success: false,
			error: `Failed to read keys: ${fileError instanceof Error ? fileError.message : String(fileError)}`,
		};
	}

	try {
		const payPk = payPkToPreserve;
		const paymentAddress = payPk.toAddress();

		// 2. Generate HD Key
		const hdKey = HD.fromRandom();
		tempXprv = hdKey.toString();

		// 3. Create BAP instance and generate identity
		const bapInstance = new BAP(tempXprv);

		// Create identity attributes
		const identityAttributes = {
			name: {
				value: args?.alternateName || "Anonymous User",
				nonce: BSVUtils.toHex(BSVUtils.toArray(Math.random().toString())),
			},
			description: {
				value: args?.description || "A BAP identity managed by BSV-MCP.",
				nonce: BSVUtils.toHex(BSVUtils.toArray(Math.random().toString())),
			},
		};

		// Create new ID with the BAP instance
		const bapId = bapInstance.newId(undefined, identityAttributes);

		// Get the generated identity information
		const generatedIdentityKey = bapId.getIdentityKey();
		const generatedIdentityAddress = bapId.rootAddress;

		// Export member backup to get the private key
		const memberBackup = bapId.exportMemberBackup();
		identityPk = memberBackup.derivedPrivateKey;

		console.error(`INFO: Generated BAP identity key: ${generatedIdentityKey}`);
		console.error(
			`INFO: Generated BAP identity address: ${generatedIdentityAddress}`,
		);

		// 5. Save Keys to secure storage
		const updatedKeys = {
			payPk: payPkToPreserve,
			identityPk: PrivateKey.fromWif(identityPk),
			xprv: tempXprv,
		};

		await keyManager.saveKeys(updatedKeys);
		const status = keyManager.getStatus();

		if (status.hasEncrypted) {
			console.error(
				`INFO: BAP HD Master Key and initial Identity Key have been generated and saved (encrypted) to ${KEY_DIR}/keys.bep`,
			);
		} else {
			console.error(
				`INFO: BAP HD Master Key and initial Identity Key have been generated and saved to ${KEY_FILE_PATH}`,
			);
		}

		// Create the ID registration transaction output
		// BAP ID format: OP_0 OP_RETURN <BAP_PREFIX> "ID" <identity_key> <root_address> <current_address>
		const idPayload = [
			toArray(BAP_PREFIX, "utf8"),
			toArray("ID"),
			toArray(generatedIdentityKey),
			toArray(bapId.rootAddress),
			toArray(bapId.rootAddress), // For initial registration, current = root
		];

		// Sign the ID payload with AIP
		const signedIdPayload = bapId.signOpReturnWithAIP(idPayload);

		// Convert to hex strings for Script
		const idHexStrings = signedIdPayload.map((bytes) =>
			BSVUtils.toHex(bytes as number[]),
		);
		const idAsmString = `OP_0 OP_RETURN ${idHexStrings.join(" ")}`;
		const idScript = Script.fromASM(idAsmString);

		// Create the ALIAS transaction output
		// First create the structured data object for the alias
		const aliasData = {
			"@context": "https://schema.org",
			"@type": "Person",
			name: args?.alternateName || "Anonymous User",
			description: args?.description || "A BAP identity managed by BSV-MCP.",
			url: `bitcoin:${paymentAddress}`,
		};

		const aliasPayload = [
			toArray(BAP_PREFIX, "utf8"),
			toArray("ALIAS"),
			toArray(generatedIdentityKey),
			toArray(JSON.stringify(aliasData)),
		];

		// Sign the ALIAS payload with AIP
		const signedAliasPayload = bapId.signOpReturnWithAIP(aliasPayload);

		// Convert to hex strings for Script
		const aliasHexStrings = signedAliasPayload.map((bytes) =>
			BSVUtils.toHex(bytes as number[]),
		);
		const aliasAsmString = `OP_0 OP_RETURN ${aliasHexStrings.join(" ")}`;
		const aliasScript = Script.fromASM(aliasAsmString);

		// 6. Build Transaction
		const tx = new Transaction();
		// Add the ID registration output
		tx.addOutput({
			lockingScript: idScript,
			satoshis: 0,
		});
		// Add the ALIAS output
		tx.addOutput({
			lockingScript: aliasScript,
			satoshis: 0,
		});

		console.error(
			`INFO: Fetching UTXOs for payment address: ${paymentAddress}`,
		);
		const paymentUtxos = await fetchPaymentUtxos(paymentAddress);

		if (!paymentUtxos || paymentUtxos.length === 0) {
			console.error(
				`ERROR: No UTXOs found for payment address ${paymentAddress}. Cannot fund BAP registration.`,
			);
			// Keys were generated and saved, but no UTXOs to broadcast
			return {
				success: true,
				identityAddress: generatedIdentityAddress,
				identityKey: generatedIdentityKey,
				message:
					"BAP HD Key and Initial Identity Generated & Saved to secure storage. No UTXOs available to fund registration.",
				error:
					"No UTXOs found for payment address. Cannot fund BAP registration.",
			};
		}

		console.error(`INFO: Found ${paymentUtxos.length} payment UTXOs.`);

		// Estimate fee
		let estimatedSize = tx.toHex().length / 2;
		estimatedSize += paymentUtxos.length * 148;
		estimatedSize += 34;
		const estimatedFee = Math.ceil(estimatedSize * 0.05);

		for (const utxo of paymentUtxos) {
			const input = fromUtxo(utxo, new P2PKH().unlock(payPk));
			tx.addInput(input);
		}

		const totalInputValue = paymentUtxos.reduce(
			(sum: number, utxo: { satoshis: number }) => sum + utxo.satoshis,
			0,
		);
		const changeAmount = totalInputValue - estimatedFee;

		if (changeAmount > 0) {
			tx.addOutput({
				lockingScript: new P2PKH().lock(paymentAddress),
				satoshis: changeAmount,
			});
		}

		await tx.sign();
		const rawTxHex = tx.toHex();
		const txid = tx.id("hex");

		console.error(`INFO: BAP registration transaction created. TXID: ${txid}`);
		console.error(`DEBUG: Raw transaction hex: ${rawTxHex}`);

		// 7. Broadcast Transaction
		const disableBroadcasting =
			args?.disableBroadcasting || process.env.DISABLE_BROADCASTING === "true";

		if (disableBroadcasting) {
			console.error(
				"INFO: Broadcasting disabled. Transaction not sent to network.",
			);
			const message = `BAP HD Key and Initial Identity Generated & Saved to secure storage. Registration transaction created but not broadcast (TXID: ${txid}).`;
			return {
				success: true,
				identityAddress: bapId.rootAddress,
				identityKey: generatedIdentityKey,
				txid,
				rawTx: rawTxHex,
				message,
			};
		}

		try {
			const broadcaster = new V5Broadcaster();
			const broadcastResult = await tx.broadcast(broadcaster);

			let effectiveTxid = txid;
			if (!isBroadcastFailure(broadcastResult)) {
				effectiveTxid = broadcastResult.txid;
				console.error(
					`INFO: BAP registration transaction broadcast successfully. TXID: ${effectiveTxid}`,
				);
			} else if (isBroadcastFailure(broadcastResult)) {
				const failureTxid = broadcastResult.txid
					? ` (${broadcastResult.txid})`
					: "";
				console.warn(
					`WARN: Transaction broadcast failed${failureTxid}. Code: ${broadcastResult.code}, Description: ${broadcastResult.description}. Original TXID ${txid}.`,
				);
				if (broadcastResult.txid) {
					effectiveTxid = broadcastResult.txid;
				}
			}

			const message = `BAP HD Key and Initial Identity Generated & Saved to secure storage. Registration TXID: ${effectiveTxid}.`;
			let overallSuccess = true;
			let errorMessageFromBroadcast: string | undefined;
			if (isBroadcastFailure(broadcastResult)) {
				overallSuccess = false;
				errorMessageFromBroadcast = `Broadcast failed: ${broadcastResult.description} (Code: ${broadcastResult.code})`;
			}

			return {
				success: overallSuccess,
				identityAddress: generatedIdentityAddress,
				identityKey: generatedIdentityKey,
				txid: effectiveTxid,
				rawTx: rawTxHex,
				message: isBroadcastFailure(broadcastResult)
					? `${message} Note: ${errorMessageFromBroadcast}`
					: message,
				error: isBroadcastFailure(broadcastResult)
					? errorMessageFromBroadcast
					: undefined,
			};
		} catch (broadcastError) {
			const errorMsg =
				broadcastError instanceof Error
					? broadcastError.message
					: String(broadcastError);
			console.error(
				`ERROR: Failed to broadcast BAP registration transaction ${txid}: ${errorMsg}`,
			);
			// Keys were generated and saved, but broadcast failed
			return {
				success: true,
				identityAddress: generatedIdentityAddress,
				identityKey: generatedIdentityKey,
				txid,
				rawTx: rawTxHex,
				message: `Keys generated and saved, but failed to broadcast BAP registration transaction: ${errorMsg}`,
				error: `Broadcast failed: ${errorMsg}. You can manually broadcast the raw transaction.`,
			};
		}
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error);
		console.error(
			`ERROR: Failed to generate BAP HD key or register identity: ${errorMsg}`,
		);
		return {
			success: false,
			error: `Failed during BAP key generation/saving or transaction construction: ${errorMsg}`,
		};
	}
}

/**
 * Registers the bap_generate tool
 */
export function registerBapGenerateTool(server: McpServer) {
	server.tool(
		"bap_generate",
		"Generates a BAP HD master key AND derives the first identity key if no BAP keys (xprv or identityPk) exist. Saves keys to secure storage. Attempts on-chain registration using payPk (honors DISABLE_BROADCASTING). Optionally takes alternateName and description for the profile.",
		{ args: bapGenerateArgsSchema },
		async ({ args }: { args?: BapGenerateArgs }): Promise<CallToolResult> => {
			try {
				const result = await generateBapKeys(args);
				// Format result as JSON
				return {
					content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
					isError: !result.success,
				};
			} catch (e) {
				const msg = e instanceof Error ? e.message : String(e);
				return { content: [{ type: "text", text: msg }], isError: true };
			}
		},
	);
}

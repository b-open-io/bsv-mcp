import type { OneSatContext } from "@1sat/actions";
import type { CallToolResult, McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { createWalletRoleRouting } from "../../utils/walletRoleRouting";
import type { WalletRoleContexts } from "../../utils/walletRoles";

const noCtx: CallToolResult = {
	content: [{ type: "text", text: "Wallet not initialized." }],
	isError: true,
};

function result(data: unknown): CallToolResult {
	return { content: [{ type: "text", text: JSON.stringify(data) }] };
}

function error(err: unknown): CallToolResult {
	return {
		content: [
			{ type: "text", text: err instanceof Error ? err.message : String(err) },
		],
		isError: true,
	};
}

/**
 * Parse a JSON-encoded tool argument. Malformed JSON is reported rather than
 * passed through as a raw string, which would surface later as an opaque
 * wallet error about the wrong argument.
 */
function parseJSON<T>(name: string, s: string | undefined): T | undefined {
	if (!s) return undefined;
	try {
		return JSON.parse(s) as T;
	} catch (e) {
		throw new Error(
			`${name} is not valid JSON: ${e instanceof Error ? e.message : String(e)}`,
		);
	}
}

/**
 * Parse a JSON-encoded tool argument that the BRC-100 call requires. The MCP
 * schema already marks these mandatory, so a missing value means the caller
 * bypassed validation and is reported rather than forwarded as undefined.
 */
function parseRequiredJSON<T>(name: string, s: string | undefined): T {
	const parsed = parseJSON<T>(name, s);
	if (parsed === undefined) {
		throw new Error(`${name} is required`);
	}
	return parsed;
}

/**
 * BRC-100 models `identityKey` as the literal `true` — present or absent, never
 * `false`. MCP arguments are plain booleans, so `false` is dropped here.
 */
function identityKeyArg(v: boolean | undefined): true | undefined {
	return v === true ? true : undefined;
}

export function registerBrc100Tools(
	server: McpServer,
	ctx: OneSatContext | undefined,
	identityContext?: OneSatContext | null,
	roleContexts?: WalletRoleContexts,
) {
	const roles =
		roleContexts ??
		(ctx && identityContext !== undefined
			? { payments: ctx, identity: identityContext ?? undefined, ordinals: ctx }
			: undefined);
	if (roles) {
		const routing = createWalletRoleRouting(roles);
		ctx = routing.ctx;
		server = routing.server(server);
	}
	// ── Transaction lifecycle ──────────────────────────────────────────

	server.registerTool(
		"wallet_createAction",
		{
			description:
				"Creates a new Bitcoin transaction. Handles funding, signing, and broadcasting based on options.",
			inputSchema: z.object({
				description: z.string().describe("5-50 char description of the action"),
				inputBEEFJSON: z
					.string()
					.optional()
					.describe(
						"JSON array of BEEF bytes proving the inputs. Required whenever inputs are supplied — createAction rejects inputs without their proof chain.",
					),
				inputsJSON: z
					.string()
					.optional()
					.describe("JSON array of transaction inputs"),
				outputsJSON: z
					.string()
					.optional()
					.describe(
						"JSON array of transaction outputs [{lockingScript, satoshis, outputDescription, basket, tags, customInstructions}]",
					),
				labelsJSON: z
					.string()
					.optional()
					.describe("JSON array of label strings"),
				lockTime: z.number().optional(),
				version: z.number().optional(),
				optionsJSON: z
					.string()
					.optional()
					.describe(
						"JSON CreateActionOptions: {noSend, sendWith, acceptDelayedBroadcast, signAndProcess, randomizeOutputs, noSendChange, knownTxids, trustSelf}",
					),
			}),
		},
		async ({
			description,
			inputBEEFJSON,
			inputsJSON,
			outputsJSON,
			labelsJSON,
			lockTime,
			version,
			optionsJSON,
		}) => {
			if (!ctx) return noCtx;
			try {
				return result(
					await ctx.wallet.createAction({
						description,
						inputBEEF: parseJSON("inputBEEFJSON", inputBEEFJSON),
						inputs: parseJSON("inputsJSON", inputsJSON),
						outputs: parseJSON("outputsJSON", outputsJSON),
						labels: parseJSON("labelsJSON", labelsJSON),
						lockTime,
						version,
						options: parseJSON("optionsJSON", optionsJSON),
					}),
				);
			} catch (e) {
				return error(e);
			}
		},
	);

	server.registerTool(
		"wallet_signAction",
		{
			description:
				"Signs a transaction previously created with createAction (when signAndProcess was false).",
			inputSchema: z.object({
				spendsJSON: z
					.string()
					.describe(
						"JSON map of input index to {unlockingScript, sequenceNumber}",
					),
				reference: z
					.string()
					.describe("Base64 reference from createAction result"),
				optionsJSON: z
					.string()
					.optional()
					.describe(
						"JSON SignActionOptions: {acceptDelayedBroadcast, sendWith}",
					),
			}),
		},
		async ({ spendsJSON, reference, optionsJSON }) => {
			if (!ctx) return noCtx;
			try {
				return result(
					await ctx.wallet.signAction({
						spends: parseRequiredJSON("spendsJSON", spendsJSON),
						reference,
						options: parseJSON("optionsJSON", optionsJSON),
					}),
				);
			} catch (e) {
				return error(e);
			}
		},
	);

	server.registerTool(
		"wallet_abortAction",
		{
			description:
				"Aborts a pending (nosend or unsigned) transaction, releasing consumed inputs back to spendable state.",
			inputSchema: z.object({
				reference: z
					.string()
					.describe("Base64 reference of the transaction to abort"),
			}),
		},
		async ({ reference }) => {
			if (!ctx) return noCtx;
			try {
				return result(await ctx.wallet.abortAction({ reference }));
			} catch (e) {
				return error(e);
			}
		},
	);

	server.registerTool(
		"wallet_internalizeAction",
		{
			description:
				"Internalizes an external transaction, adding its outputs to wallet baskets.",
			inputSchema: z.object({
				txJSON: z.string().describe("JSON array of AtomicBEEF bytes"),
				outputsJSON: z
					.string()
					.describe("JSON array of outputs to internalize"),
				description: z.string().describe("5-50 char description"),
				labelsJSON: z
					.string()
					.optional()
					.describe("JSON array of label strings"),
				seekPermission: z.boolean().optional(),
			}),
		},
		async ({
			txJSON,
			outputsJSON,
			description,
			labelsJSON,
			seekPermission,
		}) => {
			if (!ctx) return noCtx;
			try {
				return result(
					await ctx.wallet.internalizeAction({
						tx: parseRequiredJSON("txJSON", txJSON),
						outputs: parseRequiredJSON("outputsJSON", outputsJSON),
						description,
						seekPermission,
						labels: parseJSON("labelsJSON", labelsJSON),
					}),
				);
			} catch (e) {
				return error(e);
			}
		},
	);

	// ── Queries ────────────────────────────────────────────────────────

	server.registerTool(
		"wallet_listActions",
		{
			description:
				"Lists wallet transactions filtered by labels, with optional input/output details.",
			inputSchema: z.object({
				labelsJSON: z
					.string()
					.default("[]")
					.describe("JSON array of label strings"),
				labelQueryMode: z.enum(["any", "all"]).default("any"),
				includeLabels: z.boolean().default(true),
				includeInputs: z.boolean().default(false),
				includeInputSourceLockingScripts: z.boolean().default(false),
				includeInputUnlockingScripts: z.boolean().default(false),
				includeOutputs: z.boolean().default(false),
				includeOutputLockingScripts: z.boolean().default(false),
				limit: z.number().default(25),
				offset: z.number().default(0),
				seekPermission: z.boolean().optional(),
			}),
		},
		async ({ labelsJSON, ...rest }) => {
			if (!ctx) return noCtx;
			try {
				return result(
					await ctx.wallet.listActions({
						labels: parseRequiredJSON("labelsJSON", labelsJSON),
						...rest,
					}),
				);
			} catch (e) {
				return error(e);
			}
		},
	);

	server.registerTool(
		"wallet_listOutputs",
		{
			description:
				"Lists spendable outputs in a basket, optionally filtered by tags.",
			inputSchema: z.object({
				basket: z.string().describe('Basket name (e.g. "default")'),
				tagsJSON: z.string().optional().describe("JSON array of tag strings"),
				tagQueryMode: z.enum(["all", "any"]).optional(),
				include: z.enum(["locking scripts", "entire transactions"]).optional(),
				includeCustomInstructions: z.boolean().default(false),
				includeTags: z.boolean().default(false),
				includeLabels: z.boolean().default(false),
				limit: z.number().default(25),
				offset: z.number().default(0),
				seekPermission: z.boolean().optional(),
			}),
		},
		async ({ tagsJSON, ...rest }) => {
			if (!ctx) return noCtx;
			try {
				return result(
					await ctx.wallet.listOutputs({
						tags: parseJSON("tagsJSON", tagsJSON),
						...rest,
					}),
				);
			} catch (e) {
				return error(e);
			}
		},
	);

	server.registerTool(
		"wallet_relinquishOutput",
		{
			description: "Removes an output from a basket without spending it.",
			inputSchema: z.object({
				basket: z.string().describe("Basket name"),
				output: z.string().describe("Outpoint string (txid.vout)"),
			}),
		},
		async (args) => {
			if (!ctx) return noCtx;
			try {
				return result(await ctx.wallet.relinquishOutput(args));
			} catch (e) {
				return error(e);
			}
		},
	);

	// ── Keys & Crypto ──────────────────────────────────────────────────

	server.registerTool(
		"wallet_getPublicKey",
		{
			description:
				'Retrieves a public key by protocol/key derivation. Use identityKey:true for the root identity key. protocolID is a JSON array like [2,"1sat"].',
			inputSchema: z.object({
				identityKey: z
					.boolean()
					.optional()
					.describe("If true, return the identity key (ignores other args)"),
				protocolIDJSON: z
					.string()
					.optional()
					.describe(
						'JSON array [securityLevel, protocolString] e.g. [2,"1sat"]',
					),
				keyID: z.string().optional(),
				counterparty: z.string().optional(),
				forSelf: z.boolean().optional(),
				privileged: z.boolean().optional(),
				privilegedReason: z.string().optional(),
				seekPermission: z.boolean().optional(),
			}),
		},
		async ({ protocolIDJSON, identityKey, ...rest }) => {
			if (!ctx) return noCtx;
			try {
				return result(
					await ctx.wallet.getPublicKey({
						protocolID: parseJSON("protocolIDJSON", protocolIDJSON),
						identityKey: identityKeyArg(identityKey),
						...rest,
					}),
				);
			} catch (e) {
				return error(e);
			}
		},
	);

	server.registerTool(
		"wallet_encrypt",
		{
			description:
				'Encrypts data using wallet keys. protocolID is a JSON array like [2,"protocolName"].',
			inputSchema: z.object({
				plaintext: z.array(z.number()).describe("Data bytes to encrypt"),
				protocolIDJSON: z
					.string()
					.describe("JSON array [securityLevel, protocolString]"),
				keyID: z.string(),
				counterparty: z.string().optional(),
				privileged: z.boolean().optional(),
				privilegedReason: z.string().optional(),
				seekPermission: z.boolean().optional(),
			}),
		},
		async ({ protocolIDJSON, ...rest }) => {
			if (!ctx) return noCtx;
			try {
				return result(
					await ctx.wallet.encrypt({
						protocolID: parseRequiredJSON("protocolIDJSON", protocolIDJSON),
						...rest,
					}),
				);
			} catch (e) {
				return error(e);
			}
		},
	);

	server.registerTool(
		"wallet_decrypt",
		{
			description: "Decrypts data using wallet keys.",
			inputSchema: z.object({
				ciphertext: z.array(z.number()).describe("Encrypted data bytes"),
				protocolIDJSON: z
					.string()
					.describe("JSON array [securityLevel, protocolString]"),
				keyID: z.string(),
				counterparty: z.string().optional(),
				privileged: z.boolean().optional(),
				privilegedReason: z.string().optional(),
				seekPermission: z.boolean().optional(),
			}),
		},
		async ({ protocolIDJSON, ...rest }) => {
			if (!ctx) return noCtx;
			try {
				return result(
					await ctx.wallet.decrypt({
						protocolID: parseRequiredJSON("protocolIDJSON", protocolIDJSON),
						...rest,
					}),
				);
			} catch (e) {
				return error(e);
			}
		},
	);

	server.registerTool(
		"wallet_createHmac",
		{
			description: "Creates an HMAC using wallet keys.",
			inputSchema: z.object({
				data: z.array(z.number()).describe("Data bytes"),
				protocolIDJSON: z
					.string()
					.describe("JSON array [securityLevel, protocolString]"),
				keyID: z.string(),
				counterparty: z.string().optional(),
				privileged: z.boolean().optional(),
				privilegedReason: z.string().optional(),
				seekPermission: z.boolean().optional(),
			}),
		},
		async ({ protocolIDJSON, ...rest }) => {
			if (!ctx) return noCtx;
			try {
				return result(
					await ctx.wallet.createHmac({
						protocolID: parseRequiredJSON("protocolIDJSON", protocolIDJSON),
						...rest,
					}),
				);
			} catch (e) {
				return error(e);
			}
		},
	);

	server.registerTool(
		"wallet_verifyHmac",
		{
			description: "Verifies an HMAC using wallet keys.",
			inputSchema: z.object({
				data: z.array(z.number()).describe("Data bytes"),
				hmac: z.array(z.number()).describe("HMAC bytes to verify"),
				protocolIDJSON: z
					.string()
					.describe("JSON array [securityLevel, protocolString]"),
				keyID: z.string(),
				counterparty: z.string().optional(),
				privileged: z.boolean().optional(),
				privilegedReason: z.string().optional(),
				seekPermission: z.boolean().optional(),
			}),
		},
		async ({ protocolIDJSON, ...rest }) => {
			if (!ctx) return noCtx;
			try {
				return result(
					await ctx.wallet.verifyHmac({
						protocolID: parseRequiredJSON("protocolIDJSON", protocolIDJSON),
						...rest,
					}),
				);
			} catch (e) {
				return error(e);
			}
		},
	);

	server.registerTool(
		"wallet_createSignature",
		{
			description:
				"Creates a digital signature using wallet keys. Supply exactly one of data or hashToDirectlySign.",
			inputSchema: z.object({
				data: z.array(z.number()).optional().describe("Data bytes to sign"),
				hashToDirectlySign: z
					.array(z.number())
					.optional()
					.describe("Pre-computed 32-byte hash to sign directly"),
				protocolIDJSON: z
					.string()
					.describe("JSON array [securityLevel, protocolString]"),
				keyID: z.string(),
				counterparty: z.string().optional(),
				privileged: z.boolean().optional(),
				privilegedReason: z.string().optional(),
				seekPermission: z.boolean().optional(),
			}),
		},
		async ({ protocolIDJSON, ...rest }) => {
			if (!ctx) return noCtx;
			try {
				return result(
					await ctx.wallet.createSignature({
						protocolID: parseRequiredJSON("protocolIDJSON", protocolIDJSON),
						...rest,
					}),
				);
			} catch (e) {
				return error(e);
			}
		},
	);

	server.registerTool(
		"wallet_verifySignature",
		{
			description:
				"Verifies a digital signature using wallet keys. Supply exactly one of data or hashToDirectlyVerify.",
			inputSchema: z.object({
				data: z
					.array(z.number())
					.optional()
					.describe("Data bytes that were signed"),
				hashToDirectlyVerify: z
					.array(z.number())
					.optional()
					.describe("Pre-computed 32-byte hash that was signed"),
				signature: z.array(z.number()).describe("Signature bytes"),
				protocolIDJSON: z
					.string()
					.describe("JSON array [securityLevel, protocolString]"),
				keyID: z.string(),
				counterparty: z.string().optional(),
				forSelf: z.boolean().optional(),
				privileged: z.boolean().optional(),
				privilegedReason: z.string().optional(),
				seekPermission: z.boolean().optional(),
			}),
		},
		async ({ protocolIDJSON, ...rest }) => {
			if (!ctx) return noCtx;
			try {
				return result(
					await ctx.wallet.verifySignature({
						protocolID: parseRequiredJSON("protocolIDJSON", protocolIDJSON),
						...rest,
					}),
				);
			} catch (e) {
				return error(e);
			}
		},
	);

	// ── Key Linkage ────────────────────────────────────────────────────

	server.registerTool(
		"wallet_revealCounterpartyKeyLinkage",
		{
			description:
				"Reveals the linkage between the wallet identity and a counterparty to a verifier.",
			inputSchema: z.object({
				counterparty: z.string().describe("Counterparty public key hex"),
				verifier: z.string().describe("Verifier public key hex"),
				privileged: z.boolean().optional(),
				privilegedReason: z.string().optional(),
			}),
		},
		async (args) => {
			if (!ctx) return noCtx;
			try {
				return result(await ctx.wallet.revealCounterpartyKeyLinkage(args));
			} catch (e) {
				return error(e);
			}
		},
	);

	server.registerTool(
		"wallet_revealSpecificKeyLinkage",
		{
			description:
				"Reveals linkage for a specific protocol/key combination to a verifier.",
			inputSchema: z.object({
				counterparty: z.string().describe("Counterparty public key hex"),
				verifier: z.string().describe("Verifier public key hex"),
				protocolIDJSON: z
					.string()
					.describe("JSON array [securityLevel, protocolString]"),
				keyID: z.string(),
				privileged: z.boolean().optional(),
				privilegedReason: z.string().optional(),
			}),
		},
		async ({ protocolIDJSON, ...rest }) => {
			if (!ctx) return noCtx;
			try {
				return result(
					await ctx.wallet.revealSpecificKeyLinkage({
						protocolID: parseRequiredJSON("protocolIDJSON", protocolIDJSON),
						...rest,
					}),
				);
			} catch (e) {
				return error(e);
			}
		},
	);

	// ── Certificates ───────────────────────────────────────────────────

	server.registerTool(
		"wallet_acquireCertificate",
		{
			description: "Acquires an identity certificate from a certifier.",
			inputSchema: z.object({
				type: z.string().describe("Certificate type (base64)"),
				certifier: z.string().describe("Certifier public key hex"),
				acquisitionProtocol: z.enum(["direct", "issuance"]),
				fieldsJSON: z.string().describe("JSON object of certificate fields"),
				serialNumber: z.string().optional(),
				revocationOutpoint: z.string().optional(),
				signature: z.string().optional(),
				certifierUrl: z.string().optional(),
				keyringRevealer: z.string().optional(),
				keyringForSubjectJSON: z
					.string()
					.optional()
					.describe("JSON object of keyring for subject"),
				privileged: z.boolean().optional(),
				privilegedReason: z.string().optional(),
			}),
		},
		async ({ fieldsJSON, keyringForSubjectJSON, ...rest }) => {
			if (!ctx) return noCtx;
			try {
				return result(
					await ctx.wallet.acquireCertificate({
						fields: parseRequiredJSON("fieldsJSON", fieldsJSON),
						keyringForSubject: parseJSON(
							"keyringForSubjectJSON",
							keyringForSubjectJSON,
						),
						...rest,
					}),
				);
			} catch (e) {
				return error(e);
			}
		},
	);

	server.registerTool(
		"wallet_listCertificates",
		{
			description:
				"Lists identity certificates filtered by certifiers and types.",
			inputSchema: z.object({
				certifiersJSON: z
					.string()
					.describe("JSON array of certifier public key hexes"),
				typesJSON: z
					.string()
					.describe("JSON array of certificate types (base64)"),
				limit: z.number().default(25),
				offset: z.number().default(0),
				privileged: z.boolean().optional(),
				privilegedReason: z.string().optional(),
			}),
		},
		async ({ certifiersJSON, typesJSON, ...rest }) => {
			if (!ctx) return noCtx;
			try {
				return result(
					await ctx.wallet.listCertificates({
						certifiers: parseRequiredJSON("certifiersJSON", certifiersJSON),
						types: parseRequiredJSON("typesJSON", typesJSON),
						...rest,
					}),
				);
			} catch (e) {
				return error(e);
			}
		},
	);

	server.registerTool(
		"wallet_proveCertificate",
		{
			description: "Proves select fields of a certificate to a verifier.",
			inputSchema: z.object({
				certificateJSON: z
					.string()
					.describe("JSON object of the certificate to prove"),
				fieldsToRevealJSON: z
					.string()
					.describe("JSON array of field names to reveal"),
				verifier: z.string().describe("Verifier public key hex"),
				privileged: z.boolean().optional(),
				privilegedReason: z.string().optional(),
			}),
		},
		async ({ certificateJSON, fieldsToRevealJSON, ...rest }) => {
			if (!ctx) return noCtx;
			try {
				return result(
					await ctx.wallet.proveCertificate({
						certificate: parseRequiredJSON("certificateJSON", certificateJSON),
						fieldsToReveal: parseRequiredJSON(
							"fieldsToRevealJSON",
							fieldsToRevealJSON,
						),
						...rest,
					}),
				);
			} catch (e) {
				return error(e);
			}
		},
	);

	server.registerTool(
		"wallet_relinquishCertificate",
		{
			description: "Removes a certificate from the wallet.",
			inputSchema: z.object({
				type: z.string().describe("Certificate type"),
				serialNumber: z.string().describe("Certificate serial number"),
				certifier: z.string().describe("Certifier public key hex"),
			}),
		},
		async (args) => {
			if (!ctx) return noCtx;
			try {
				return result(await ctx.wallet.relinquishCertificate(args));
			} catch (e) {
				return error(e);
			}
		},
	);

	// ── Discovery ──────────────────────────────────────────────────────

	server.registerTool(
		"wallet_discoverByIdentityKey",
		{
			description: "Discovers certificates issued to a given identity key.",
			inputSchema: z.object({
				identityKey: z.string().describe("Identity public key hex"),
				limit: z.number().default(25),
				offset: z.number().default(0),
				seekPermission: z.boolean().optional(),
			}),
		},
		async (args) => {
			if (!ctx) return noCtx;
			try {
				return result(await ctx.wallet.discoverByIdentityKey(args));
			} catch (e) {
				return error(e);
			}
		},
	);

	server.registerTool(
		"wallet_discoverByAttributes",
		{
			description: "Discovers certificates matching specific attributes.",
			inputSchema: z.object({
				attributesJSON: z
					.string()
					.describe("JSON object of attribute key/value pairs to match"),
				limit: z.number().default(25),
				offset: z.number().default(0),
				seekPermission: z.boolean().optional(),
			}),
		},
		async ({ attributesJSON, ...rest }) => {
			if (!ctx) return noCtx;
			try {
				return result(
					await ctx.wallet.discoverByAttributes({
						attributes: parseRequiredJSON("attributesJSON", attributesJSON),
						...rest,
					}),
				);
			} catch (e) {
				return error(e);
			}
		},
	);

	// ── Info ────────────────────────────────────────────────────────────

	server.registerTool(
		"wallet_isAuthenticated",
		{
			description: "Checks if the wallet user is authenticated.",
			inputSchema: z.object({}),
		},
		async () => {
			if (!ctx) return noCtx;
			try {
				return result(await ctx.wallet.isAuthenticated({}));
			} catch (e) {
				return error(e);
			}
		},
	);

	server.registerTool(
		"wallet_waitForAuthentication",
		{
			description: "Blocks until the wallet user is authenticated.",
			inputSchema: z.object({}),
		},
		async () => {
			if (!ctx) return noCtx;
			try {
				return result(await ctx.wallet.waitForAuthentication({}));
			} catch (e) {
				return error(e);
			}
		},
	);

	server.registerTool(
		"wallet_getHeight",
		{
			description: "Gets the current blockchain height.",
			inputSchema: z.object({}),
		},
		async () => {
			if (!ctx) return noCtx;
			try {
				return result(await ctx.wallet.getHeight({}));
			} catch (e) {
				return error(e);
			}
		},
	);

	server.registerTool(
		"wallet_getHeaderForHeight",
		{
			description: "Gets the 80-byte block header at a given height.",
			inputSchema: z.object({
				height: z.number().describe("Block height"),
			}),
		},
		async ({ height }) => {
			if (!ctx) return noCtx;
			try {
				return result(await ctx.wallet.getHeaderForHeight({ height }));
			} catch (e) {
				return error(e);
			}
		},
	);

	server.registerTool(
		"wallet_getNetwork",
		{
			description:
				"Gets the network the wallet is connected to (mainnet or testnet).",
			inputSchema: z.object({}),
		},
		async () => {
			if (!ctx) return noCtx;
			try {
				return result(await ctx.wallet.getNetwork({}));
			} catch (e) {
				return error(e);
			}
		},
	);

	server.registerTool(
		"wallet_getVersion",
		{
			description: "Gets the wallet implementation version.",
			inputSchema: z.object({}),
		},
		async () => {
			if (!ctx) return noCtx;
			try {
				return result(await ctx.wallet.getVersion({}));
			} catch (e) {
				return error(e);
			}
		},
	);
}

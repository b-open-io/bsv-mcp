import type { OneSatContext } from '@1sat/actions'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'

const noCtx: CallToolResult = {
	content: [{ type: 'text', text: 'Wallet not initialized.' }],
	isError: true,
}

function result(data: unknown): CallToolResult {
	return { content: [{ type: 'text', text: JSON.stringify(data) }] }
}

function error(err: unknown): CallToolResult {
	return {
		content: [{ type: 'text', text: err instanceof Error ? err.message : String(err) }],
		isError: true,
	}
}

function parseJSON(s: string | undefined): any {
	if (!s) return undefined
	try { return JSON.parse(s) } catch { return s }
}

export function registerBrc100Tools(
	server: McpServer,
	ctx: OneSatContext | undefined,
) {
	// ── Transaction lifecycle ──────────────────────────────────────────

	server.tool(
		'wallet_createAction',
		'Creates a new Bitcoin transaction. Handles funding, signing, and broadcasting based on options.',
		{
			description: z.string().describe('5-50 char description of the action'),
			inputsJSON: z.string().optional().describe('JSON array of transaction inputs'),
			outputsJSON: z.string().optional().describe('JSON array of transaction outputs [{lockingScript, satoshis, outputDescription, basket, tags, customInstructions}]'),
			labelsJSON: z.string().optional().describe('JSON array of label strings'),
			lockTime: z.number().optional(),
			version: z.number().optional(),
			optionsJSON: z.string().optional().describe('JSON CreateActionOptions: {noSend, sendWith, acceptDelayedBroadcast, signAndProcess, randomizeOutputs, noSendChange, knownTxids, trustSelf}'),
		},
		async ({ description, inputsJSON, outputsJSON, labelsJSON, lockTime, version, optionsJSON }) => {
			if (!ctx) return noCtx
			try {
				return result(await ctx.wallet.createAction({
					description,
					inputs: parseJSON(inputsJSON),
					outputs: parseJSON(outputsJSON),
					labels: parseJSON(labelsJSON),
					lockTime,
					version,
					options: parseJSON(optionsJSON),
				} as any))
			} catch (e) { return error(e) }
		},
	)

	server.tool(
		'wallet_signAction',
		'Signs a transaction previously created with createAction (when signAndProcess was false).',
		{
			spendsJSON: z.string().describe('JSON map of input index to {unlockingScript, sequenceNumber}'),
			reference: z.string().describe('Base64 reference from createAction result'),
			optionsJSON: z.string().optional().describe('JSON SignActionOptions: {acceptDelayedBroadcast, sendWith}'),
		},
		async ({ spendsJSON, reference, optionsJSON }) => {
			if (!ctx) return noCtx
			try {
				return result(await ctx.wallet.signAction({
					spends: parseJSON(spendsJSON),
					reference,
					options: parseJSON(optionsJSON),
				} as any))
			} catch (e) { return error(e) }
		},
	)

	server.tool(
		'wallet_abortAction',
		'Aborts a pending (nosend or unsigned) transaction, releasing consumed inputs back to spendable state.',
		{
			reference: z.string().describe('Base64 reference of the transaction to abort'),
		},
		async ({ reference }) => {
			if (!ctx) return noCtx
			try {
				return result(await ctx.wallet.abortAction({ reference }))
			} catch (e) { return error(e) }
		},
	)

	server.tool(
		'wallet_internalizeAction',
		'Internalizes an external transaction, adding its outputs to wallet baskets.',
		{
			txJSON: z.string().describe('JSON array of AtomicBEEF bytes'),
			outputsJSON: z.string().describe('JSON array of outputs to internalize'),
			description: z.string().describe('5-50 char description'),
			labelsJSON: z.string().optional().describe('JSON array of label strings'),
		},
		async ({ txJSON, outputsJSON, description, labelsJSON }) => {
			if (!ctx) return noCtx
			try {
				return result(await ctx.wallet.internalizeAction({
					tx: parseJSON(txJSON),
					outputs: parseJSON(outputsJSON),
					description,
					labels: parseJSON(labelsJSON),
				} as any))
			} catch (e) { return error(e) }
		},
	)

	// ── Queries ────────────────────────────────────────────────────────

	server.tool(
		'wallet_listActions',
		'Lists wallet transactions filtered by labels, with optional input/output details.',
		{
			labelsJSON: z.string().default('[]').describe('JSON array of label strings'),
			labelQueryMode: z.enum(['any', 'all']).default('any'),
			includeLabels: z.boolean().default(true),
			includeInputs: z.boolean().default(false),
			includeInputSourceLockingScripts: z.boolean().default(false),
			includeInputUnlockingScripts: z.boolean().default(false),
			includeOutputs: z.boolean().default(false),
			includeOutputLockingScripts: z.boolean().default(false),
			limit: z.number().default(25),
			offset: z.number().default(0),
		},
		async ({ labelsJSON, ...rest }) => {
			if (!ctx) return noCtx
			try {
				return result(await ctx.wallet.listActions({
					labels: parseJSON(labelsJSON),
					...rest,
				} as any))
			} catch (e) { return error(e) }
		},
	)

	server.tool(
		'wallet_listOutputs',
		'Lists spendable outputs in a basket, optionally filtered by tags.',
		{
			basket: z.string().describe('Basket name (e.g. "default")'),
			tagsJSON: z.string().optional().describe('JSON array of tag strings'),
			tagQueryMode: z.enum(['all', 'any']).optional(),
			include: z.enum(['locking scripts', 'entire transactions']).optional(),
			includeCustomInstructions: z.boolean().default(false),
			includeTags: z.boolean().default(false),
			includeLabels: z.boolean().default(false),
			limit: z.number().default(25),
			offset: z.number().default(0),
		},
		async ({ tagsJSON, ...rest }) => {
			if (!ctx) return noCtx
			try {
				return result(await ctx.wallet.listOutputs({
					tags: parseJSON(tagsJSON),
					...rest,
				} as any))
			} catch (e) { return error(e) }
		},
	)

	server.tool(
		'wallet_relinquishOutput',
		'Removes an output from a basket without spending it.',
		{
			basket: z.string().describe('Basket name'),
			output: z.string().describe('Outpoint string (txid.vout)'),
		},
		async (args) => {
			if (!ctx) return noCtx
			try {
				return result(await ctx.wallet.relinquishOutput(args as any))
			} catch (e) { return error(e) }
		},
	)

	// ── Keys & Crypto ──────────────────────────────────────────────────

	server.tool(
		'wallet_getPublicKey',
		'Retrieves a public key by protocol/key derivation. Use identityKey:true for the root identity key. protocolID is a JSON array like [2,"1sat"].',
		{
			identityKey: z.boolean().optional().describe('If true, return the identity key (ignores other args)'),
			protocolIDJSON: z.string().optional().describe('JSON array [securityLevel, protocolString] e.g. [2,"1sat"]'),
			keyID: z.string().optional(),
			counterparty: z.string().optional(),
			forSelf: z.boolean().optional(),
			privileged: z.boolean().optional(),
			privilegedReason: z.string().optional(),
		},
		async ({ protocolIDJSON, ...rest }) => {
			if (!ctx) return noCtx
			try {
				return result(await ctx.wallet.getPublicKey({
					protocolID: parseJSON(protocolIDJSON),
					...rest,
				} as any))
			} catch (e) { return error(e) }
		},
	)

	server.tool(
		'wallet_encrypt',
		'Encrypts data using wallet keys. protocolID is a JSON array like [2,"protocolName"].',
		{
			plaintext: z.array(z.number()).describe('Data bytes to encrypt'),
			protocolIDJSON: z.string().describe('JSON array [securityLevel, protocolString]'),
			keyID: z.string(),
			counterparty: z.string().optional(),
			privileged: z.boolean().optional(),
		},
		async ({ protocolIDJSON, ...rest }) => {
			if (!ctx) return noCtx
			try {
				return result(await ctx.wallet.encrypt({
					protocolID: parseJSON(protocolIDJSON),
					...rest,
				} as any))
			} catch (e) { return error(e) }
		},
	)

	server.tool(
		'wallet_decrypt',
		'Decrypts data using wallet keys.',
		{
			ciphertext: z.array(z.number()).describe('Encrypted data bytes'),
			protocolIDJSON: z.string().describe('JSON array [securityLevel, protocolString]'),
			keyID: z.string(),
			counterparty: z.string().optional(),
			privileged: z.boolean().optional(),
		},
		async ({ protocolIDJSON, ...rest }) => {
			if (!ctx) return noCtx
			try {
				return result(await ctx.wallet.decrypt({
					protocolID: parseJSON(protocolIDJSON),
					...rest,
				} as any))
			} catch (e) { return error(e) }
		},
	)

	server.tool(
		'wallet_createHmac',
		'Creates an HMAC using wallet keys.',
		{
			data: z.array(z.number()).describe('Data bytes'),
			protocolIDJSON: z.string().describe('JSON array [securityLevel, protocolString]'),
			keyID: z.string(),
			counterparty: z.string().optional(),
			privileged: z.boolean().optional(),
		},
		async ({ protocolIDJSON, ...rest }) => {
			if (!ctx) return noCtx
			try {
				return result(await ctx.wallet.createHmac({
					protocolID: parseJSON(protocolIDJSON),
					...rest,
				} as any))
			} catch (e) { return error(e) }
		},
	)

	server.tool(
		'wallet_verifyHmac',
		'Verifies an HMAC using wallet keys.',
		{
			data: z.array(z.number()).describe('Data bytes'),
			hmac: z.array(z.number()).describe('HMAC bytes to verify'),
			protocolIDJSON: z.string().describe('JSON array [securityLevel, protocolString]'),
			keyID: z.string(),
			counterparty: z.string().optional(),
			privileged: z.boolean().optional(),
		},
		async ({ protocolIDJSON, ...rest }) => {
			if (!ctx) return noCtx
			try {
				return result(await ctx.wallet.verifyHmac({
					protocolID: parseJSON(protocolIDJSON),
					...rest,
				} as any))
			} catch (e) { return error(e) }
		},
	)

	server.tool(
		'wallet_createSignature',
		'Creates a digital signature using wallet keys.',
		{
			data: z.array(z.number()).describe('Data bytes to sign'),
			protocolIDJSON: z.string().describe('JSON array [securityLevel, protocolString]'),
			keyID: z.string(),
			counterparty: z.string().optional(),
			privileged: z.boolean().optional(),
		},
		async ({ protocolIDJSON, ...rest }) => {
			if (!ctx) return noCtx
			try {
				return result(await ctx.wallet.createSignature({
					protocolID: parseJSON(protocolIDJSON),
					...rest,
				} as any))
			} catch (e) { return error(e) }
		},
	)

	server.tool(
		'wallet_verifySignature',
		'Verifies a digital signature using wallet keys.',
		{
			data: z.array(z.number()).describe('Data bytes that were signed'),
			signature: z.array(z.number()).describe('Signature bytes'),
			protocolIDJSON: z.string().describe('JSON array [securityLevel, protocolString]'),
			keyID: z.string(),
			counterparty: z.string().optional(),
			forSelf: z.boolean().optional(),
			privileged: z.boolean().optional(),
		},
		async ({ protocolIDJSON, ...rest }) => {
			if (!ctx) return noCtx
			try {
				return result(await ctx.wallet.verifySignature({
					protocolID: parseJSON(protocolIDJSON),
					...rest,
				} as any))
			} catch (e) { return error(e) }
		},
	)

	// ── Key Linkage ────────────────────────────────────────────────────

	server.tool(
		'wallet_revealCounterpartyKeyLinkage',
		'Reveals the linkage between the wallet identity and a counterparty to a verifier.',
		{
			counterparty: z.string().describe('Counterparty public key hex'),
			verifier: z.string().describe('Verifier public key hex'),
			privileged: z.boolean().optional(),
			privilegedReason: z.string().optional(),
		},
		async (args) => {
			if (!ctx) return noCtx
			try {
				return result(await ctx.wallet.revealCounterpartyKeyLinkage(args as any))
			} catch (e) { return error(e) }
		},
	)

	server.tool(
		'wallet_revealSpecificKeyLinkage',
		'Reveals linkage for a specific protocol/key combination to a verifier.',
		{
			counterparty: z.string().describe('Counterparty public key hex'),
			verifier: z.string().describe('Verifier public key hex'),
			protocolIDJSON: z.string().describe('JSON array [securityLevel, protocolString]'),
			keyID: z.string(),
			privileged: z.boolean().optional(),
			privilegedReason: z.string().optional(),
		},
		async ({ protocolIDJSON, ...rest }) => {
			if (!ctx) return noCtx
			try {
				return result(await ctx.wallet.revealSpecificKeyLinkage({
					protocolID: parseJSON(protocolIDJSON),
					...rest,
				} as any))
			} catch (e) { return error(e) }
		},
	)

	// ── Certificates ───────────────────────────────────────────────────

	server.tool(
		'wallet_acquireCertificate',
		'Acquires an identity certificate from a certifier.',
		{
			type: z.string().describe('Certificate type (base64)'),
			certifier: z.string().describe('Certifier public key hex'),
			acquisitionProtocol: z.enum(['direct', 'issuance']),
			fieldsJSON: z.string().describe('JSON object of certificate fields'),
			serialNumber: z.string().optional(),
			revocationOutpoint: z.string().optional(),
			signature: z.string().optional(),
			certifierUrl: z.string().optional(),
			keyringRevealer: z.string().optional(),
			keyringForSubjectJSON: z.string().optional().describe('JSON object of keyring for subject'),
			privileged: z.boolean().optional(),
			privilegedReason: z.string().optional(),
		},
		async ({ fieldsJSON, keyringForSubjectJSON, ...rest }) => {
			if (!ctx) return noCtx
			try {
				return result(await ctx.wallet.acquireCertificate({
					fields: parseJSON(fieldsJSON),
					keyringForSubject: parseJSON(keyringForSubjectJSON),
					...rest,
				} as any))
			} catch (e) { return error(e) }
		},
	)

	server.tool(
		'wallet_listCertificates',
		'Lists identity certificates filtered by certifiers and types.',
		{
			certifiersJSON: z.string().describe('JSON array of certifier public key hexes'),
			typesJSON: z.string().describe('JSON array of certificate types (base64)'),
			limit: z.number().default(25),
			offset: z.number().default(0),
			privileged: z.boolean().optional(),
			privilegedReason: z.string().optional(),
		},
		async ({ certifiersJSON, typesJSON, ...rest }) => {
			if (!ctx) return noCtx
			try {
				return result(await ctx.wallet.listCertificates({
					certifiers: parseJSON(certifiersJSON),
					types: parseJSON(typesJSON),
					...rest,
				} as any))
			} catch (e) { return error(e) }
		},
	)

	server.tool(
		'wallet_proveCertificate',
		'Proves select fields of a certificate to a verifier.',
		{
			certificateJSON: z.string().describe('JSON object of the certificate to prove'),
			fieldsToRevealJSON: z.string().describe('JSON array of field names to reveal'),
			verifier: z.string().describe('Verifier public key hex'),
			privileged: z.boolean().optional(),
			privilegedReason: z.string().optional(),
		},
		async ({ certificateJSON, fieldsToRevealJSON, ...rest }) => {
			if (!ctx) return noCtx
			try {
				return result(await ctx.wallet.proveCertificate({
					certificate: parseJSON(certificateJSON),
					fieldsToReveal: parseJSON(fieldsToRevealJSON),
					...rest,
				} as any))
			} catch (e) { return error(e) }
		},
	)

	server.tool(
		'wallet_relinquishCertificate',
		'Removes a certificate from the wallet.',
		{
			type: z.string().describe('Certificate type'),
			serialNumber: z.string().describe('Certificate serial number'),
			certifier: z.string().describe('Certifier public key hex'),
		},
		async (args) => {
			if (!ctx) return noCtx
			try {
				return result(await ctx.wallet.relinquishCertificate(args as any))
			} catch (e) { return error(e) }
		},
	)

	// ── Discovery ──────────────────────────────────────────────────────

	server.tool(
		'wallet_discoverByIdentityKey',
		'Discovers certificates issued to a given identity key.',
		{
			identityKey: z.string().describe('Identity public key hex'),
			limit: z.number().default(25),
			offset: z.number().default(0),
		},
		async (args) => {
			if (!ctx) return noCtx
			try {
				return result(await ctx.wallet.discoverByIdentityKey(args as any))
			} catch (e) { return error(e) }
		},
	)

	server.tool(
		'wallet_discoverByAttributes',
		'Discovers certificates matching specific attributes.',
		{
			attributesJSON: z.string().describe('JSON object of attribute key/value pairs to match'),
			limit: z.number().default(25),
			offset: z.number().default(0),
		},
		async ({ attributesJSON, ...rest }) => {
			if (!ctx) return noCtx
			try {
				return result(await ctx.wallet.discoverByAttributes({
					attributes: parseJSON(attributesJSON),
					...rest,
				} as any))
			} catch (e) { return error(e) }
		},
	)

	// ── Info ────────────────────────────────────────────────────────────

	server.tool(
		'wallet_isAuthenticated',
		'Checks if the wallet user is authenticated.',
		{},
		async () => {
			if (!ctx) return noCtx
			try {
				return result(await ctx.wallet.isAuthenticated({}))
			} catch (e) { return error(e) }
		},
	)

	server.tool(
		'wallet_getHeight',
		'Gets the current blockchain height.',
		{},
		async () => {
			if (!ctx) return noCtx
			try {
				return result(await ctx.wallet.getHeight({}))
			} catch (e) { return error(e) }
		},
	)

	server.tool(
		'wallet_getHeaderForHeight',
		'Gets the 80-byte block header at a given height.',
		{
			height: z.number().describe('Block height'),
		},
		async ({ height }) => {
			if (!ctx) return noCtx
			try {
				return result(await ctx.wallet.getHeaderForHeight({ height }))
			} catch (e) { return error(e) }
		},
	)

	server.tool(
		'wallet_getNetwork',
		'Gets the network the wallet is connected to (mainnet or testnet).',
		{},
		async () => {
			if (!ctx) return noCtx
			try {
				return result(await ctx.wallet.getNetwork({}))
			} catch (e) { return error(e) }
		},
	)

	server.tool(
		'wallet_getVersion',
		'Gets the wallet implementation version.',
		{},
		async () => {
			if (!ctx) return noCtx
			try {
				return result(await ctx.wallet.getVersion({}))
			} catch (e) { return error(e) }
		},
	)
}

/** Editorial details checked against the tool handlers; never inferred from readOnlyHint. */
export interface ReferenceNote {
	result: string;
	approval: string;
	details?: string;
}
export const toolReferenceNotes: Record<string, ReferenceNote> = {
	bsocial_read: {
		result:
			"Structured source, operation and indexer data, also returned as JSON text.",
		approval: "Public read; no wallet or signing permission required.",
		details:
			"Choose query.type. records reads raw action history, including follow/unfollow; it does not claim current relationship state or independently verified authorship. PUBLIC_BMAP_URL is the server root exposing /social and /q routes. Messages are not decrypted.",
	},
	bsocial_publish: {
		result:
			"Transaction ID, action type and output count; preview returns unsigned output scripts without spending.",
		approval:
			"The selected identity wallet signs and funds through its existing permissions. Legacy wallets require a separate identity key plus a payment key. Broadcasting must be enabled unless preview is true.",
		details:
			"Choose action.type. Replies are posts with replyTo. Tags and attachments have separately signed outputs. A message recipient is routing metadata, not encryption. Friend records advertise a supplied communication public key and do not establish a secure messaging protocol. unfriend and video are indexer extensions.",
	},
	wallet_sendBsv: {
		result:
			"JSON text with status, transaction ID and recipient amounts in satoshis, or an error.",
		approval:
			"Uses the payment wallet's transaction permissions. Guarded by the broadcasting setting.",
		details:
			"Provide an address or paymail for each recipient. USD amounts are converted using the current BSV price.",
	},
	wallet_createAction: {
		result:
			"The BRC-100 createAction result as JSON text. Depending on options, this includes a transaction or a pending signable transaction.",
		approval:
			"Forwarded to the selected BRC-100 wallet. Its spending permissions apply.",
		details:
			"Fields ending in JSON contain JSON-encoded strings, not nested objects. When inputs are supplied, include their BEEF proof data. In a role-routed wallet, walletRole can choose the signing wallet explicitly.",
	},
	wallet_signAction: {
		result: "The BRC-100 signAction result as JSON text, or an error.",
		approval:
			"The wallet checks spending permission. A pending action remains bound to its original wallet and caller.",
		details:
			"Inspect action status after an uncertain response before submitting again.",
	},
	wallet_abortAction: {
		result: "The wallet's abortAction result as JSON text.",
		approval:
			"Uses the pending action's wallet and caller binding; wallet permission policy applies.",
	},
	wallet_onboarding: {
		result:
			"Status and next steps after requesting the local browser setup page.",
		approval:
			"The user creates, imports or unlocks the Vault in the local browser. No password or private key belongs in the tool arguments.",
	},
	wallet_generate: {
		result:
			"Public account details after creation; no private key is returned.",
		approval:
			"Requires human approval through the account command flow and a password configured locally.",
	},
	wallet_import: {
		result: "Public account details after importing an encrypted backup.",
		approval: "Requires human approval. Plaintext WIF import is terminal-only.",
	},
	wallet_remove: {
		result: "Account removal status or an error.",
		approval:
			"Requires force, backup confirmation and human approval. The active account cannot be removed.",
	},
	wallet_use: {
		result: "The environment setting needed to select an account.",
		approval:
			"Does not unlock or switch the running wallet; restart with the returned setting.",
	},
	wallet_list: {
		result: "Public account metadata and addresses.",
		approval: "Lists accounts without unlocking them.",
	},
	x402_request: {
		result:
			"The service response or a payment quote, including its ID and expiry. Also returns structured content.",
		approval:
			"Never automatically pays. The requested HTTP method may still change the service's state if no payment is required.",
	},
	x402_payQuote: {
		result:
			"Payment outcome and service response, or an error. Also returns structured content.",
		approval:
			"Call only after authorization for the quoted service and total spending limit. Wallet permission checks apply; changed terms are not paid automatically.",
	},
	wallet_peerPayments: {
		result:
			"PeerPay inbox, receipt or processing status for the selected operation.",
		approval:
			"Embedded payment-wallet only. Receiving can internalize funds and acknowledge a message; it is a mutating operation, not a balance read.",
	},
	wallet_read: {
		result:
			"The selected full-tool operation's result, wrapped by the compact dispatcher.",
		approval:
			"Uses the selected wallet's read permissions. Whole-wallet balance is absent for external signers.",
	},
	wallet_payments: {
		result: "The selected PeerPay operation's result.",
		approval:
			"Embedded payment-wallet only. Receive operations can internalize funds and acknowledge messages.",
	},
};

const walletRPC = [
	"getPublicKey",
	"encrypt",
	"decrypt",
	"createHmac",
	"verifyHmac",
	"createSignature",
	"verifySignature",
	"listActions",
	"internalizeAction",
	"listOutputs",
	"relinquishOutput",
	"acquireCertificate",
	"listCertificates",
	"proveCertificate",
	"relinquishCertificate",
	"discoverByIdentityKey",
	"discoverByAttributes",
	"revealCounterpartyKeyLinkage",
	"revealSpecificKeyLinkage",
	"isAuthenticated",
	"waitForAuthentication",
	"getHeight",
	"getHeaderForHeight",
	"getNetwork",
	"getVersion",
];
for (const method of walletRPC)
	toolReferenceNotes[`wallet_${method}`] = {
		result: `The BRC-100 ${method} result, encoded as JSON text. Wallet failures return an error result.`,
		approval:
			"Forwarded to the connected wallet under the configured app origin. Its protocol, certificate or basket permission checks apply to the requested operation.",
		details:
			"In role-routed configurations, walletRole selects an assigned wallet. Identity methods default to the identity role; encryption and HMAC use the encryption role. Transaction and basket operations follow their assigned role. An unavailable role fails rather than borrowing another key.",
	};
const publicReads: Record<string, string> = {
	bsv_dashboard: "The MCP dashboard app resource and its initial view state.",
	app_explorer_data: "Explorer data for the dashboard query.",
	app_ordinals_data: "Ordinals data for the dashboard query.",
	bsv_getPrice: "A text message with the current BSV price in USD.",
	bsv_decodeTransaction: "Decoded transaction data as JSON text, or an error.",
	bsv_explore:
		"Explorer data for the selected address, block or transaction query.",
	bsv_status:
		"Server, wallet and backend status as JSON text. Service checks can be disabled with checkServices=false.",
	ordinals_getInscription: "Inscription metadata as JSON text.",
	ordinals_getTokenByIdOrTicker:
		"Token lookup data as JSON text. The current lookup accepts a token ID, not a ticker.",
	ordinals_searchInscriptions:
		"Indexed outputs and any available inscription metadata, as JSON text.",
	ordinals_marketListings:
		"Listings and nextFrom, as JSON text and structured content. Prices are satoshis; a null nextFrom ends pagination.",
	ordinals_marketSales:
		"Completed sales and nextFrom, as JSON text and structured content.",
	bap_getId:
		"A BAP identity record as JSON text, or a not-found message. Supply idKey when no identity is configured.",
	droplit_discover:
		"The sponsor catalog returned by the configured Droplit API.",
	utils_find_skills:
		"Up to five matching skill summaries and source links. Does not install plugins or download skill contents.",
	utils_convertData:
		"The converted value as text; array representations are JSON-encoded.",
	mnee_getBalance: "MNEE balance data for the requested address as JSON text.",
	mnee_parseTx: "Parsed MNEE transaction data as JSON text.",
};
for (const [name, result] of Object.entries(publicReads))
	toolReferenceNotes[name] = {
		result,
		approval:
			"No spending approval is requested by this handler. Public network lookups can still fail or require a compatible service.",
	};
const contextReads: Record<string, string> = {
	app_wallet_data: "Wallet data for the selected dashboard view.",
	app_sweep_scan:
		"Indexed outputs available for a prospective sweep; no transaction is submitted.",
	app_sweep_prepare:
		"A prepared sweep description; submission is a separate operation.",
	wallet_getAddress: "The deposit address and status as JSON text.",
	wallet_getBalance:
		"Local balance in satoshis and BSV with a UTXO count, or the sponsored balance in Droplit mode.",
	wallet_getOrdinals: "The ordinals listing result as JSON text.",
	wallet_listTokens: "The BSV21 token listing result as JSON text.",
	wallet_getBsv21Balances: "BSV21 balances as JSON text.",
	wallet_getLockData: "Locked-output data as JSON text.",
	bap_getIdentity:
		"The selected wallet's BAP ID, publication status, root public key and root address as JSON text.",
	bap_getProfile: "The selected BAP profile as JSON text.",
	bap_getCurrentAddress: "The legacy identity's current signing address.",
	wallet_gatherCollectionInfo:
		"Collection information from the legacy local wallet.",
};
for (const [name, result] of Object.entries(contextReads))
	toolReferenceNotes[name] = {
		result,
		approval:
			"Requires the configured wallet or identity context. Wallet read permissions apply; this handler does not request a payment.",
	};
toolReferenceNotes.wallet_createOrdinals = {
	result:
		"Inscription status, transaction ID and output information as JSON text, or an error.",
	approval:
		"The ordinals wallet funds and signs the transaction under its spending permissions. Broadcasting must be enabled.",
	details:
		"SIGMA signing also requires a published BAP identity in the identity role. Content is supplied as base64 with its MIME type.",
};
toolReferenceNotes.wallet_refreshUtxos = {
	result: "Address synchronization and imported-deposit status as JSON text.",
	approval:
		"Updates wallet storage by importing indexed deposits. Requires the payment wallet context; this is not a passive balance lookup.",
};
toolReferenceNotes.utils_installAgentMaster = {
	result:
		"Installation status or an error from the Agent Master CLI installer.",
	approval:
		"Runs an installer on the server's computer. It changes local software; call only when installation is requested.",
};

export function referenceNote(name: string): ReferenceNote {
	const specific = toolReferenceNotes[name];
	if (specific) return specific;
	if (["bsv_read", "ordinals_read", "utility", "wallet_setup"].includes(name))
		return {
			result:
				"The selected operation's result. Follow its linked full-tool reference for the exact result format.",
			approval:
				"The selected operation retains its underlying permissions and setup requirements.",
		};
	return {
		result:
			"An MCP result containing the operation outcome as text, with structured content where supplied. Check isError before using it; an output schema is shown when registered.",
		approval:
			"This operation can change wallet, account or service state. A connected wallet applies its own permissions. Guarded broadcasts also require broadcasting to be enabled; service authorization is separate from wallet approval.",
	};
}

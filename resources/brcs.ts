import {
	type McpServer,
	ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * BRC Categories for organizing the Bitcoin Request for Comments specifications
 */
export enum BRCCategory {
	Wallet = "wallet",
	Transactions = "transactions",
	Scripts = "scripts",
	Tokens = "tokens",
	Overlays = "overlays",
	Payments = "payments",
	PeerToPeer = "peer-to-peer",
	KeyDerivation = "key-derivation",
	Outpoints = "outpoints",
	Opinions = "opinions",
	StateMachines = "state-machines",
	Apps = "apps",
}

/**
 * Interface defining a BRC document
 */
interface BRCDocument {
	number: string;
	title: string;
	category: BRCCategory;
}

/**
 * Register all BRC-related resources with the MCP server
 * @param server The MCP server instance
 */
export function registerBRCsResources(server: McpServer): void {
	// Register BRCs repository main README
	server.resource(
		"brcs_readme",
		"https://raw.githubusercontent.com/bitcoin-sv/BRCs/master/README.md",
		{
			title: "Bitcoin SV BRCs Overview",
			description:
				"Overview of all Bitcoin SV protocol specifications in the BRCs repository",
		},
		async (uri) => {
			const resp = await fetch(uri.href);
			const text = await resp.text();
			return {
				contents: [
					{
						uri: uri.href,
						text,
					},
				],
			};
		},
	);

	// Register SUMMARY file which has the ToC
	server.resource(
		"brcs_summary",
		"https://raw.githubusercontent.com/bitcoin-sv/BRCs/master/SUMMARY.md",
		{
			title: "Bitcoin SV BRCs Summary",
			description: "Table of contents for all Bitcoin SV BRCs",
		},
		async (uri) => {
			const resp = await fetch(uri.href);
			const text = await resp.text();
			return {
				contents: [
					{
						uri: uri.href,
						text,
					},
				],
			};
		},
	);

	// Add a dynamic BRC specification resource for any BRC by path
	server.resource(
		"brc_spec",
		new ResourceTemplate("brc://{category}/{brcNumber}", { list: undefined }),
		{
			title: "Bitcoin SV BRC Specification",
			description: "Access specific BRC specifications by category and number",
		},
		async (uri, { category, brcNumber }) => {
			const path = `${category}/${brcNumber}.md`;
			const resp = await fetch(
				`https://raw.githubusercontent.com/bitcoin-sv/BRCs/master/${path}`,
			);

			if (!resp.ok) {
				throw new Error(`BRC specification not found: ${path}`);
			}

			const text = await resp.text();
			return {
				contents: [
					{
						uri: uri.href,
						text,
					},
				],
			};
		},
	);

	// Register individual BRCs
	registerAllBRCs(server);
}

/**
 * Register all BRC specifications from the master list
 */
function registerAllBRCs(server: McpServer): void {
	// Complete list of BRCs from the README.md
	const brcs: BRCDocument[] = [
		{
			number: "0",
			title: "Banana-Powered Bitcoin Wallet Control Protocol",
			category: BRCCategory.Wallet,
		},
		{
			number: "1",
			title: "Transaction Creation",
			category: BRCCategory.Wallet,
		},
		{
			number: "2",
			title: "Data Encryption and Decryption",
			category: BRCCategory.Wallet,
		},
		{
			number: "3",
			title: "Digital Signature Creation and Verification",
			category: BRCCategory.Wallet,
		},
		{ number: "4", title: "Input Redemption", category: BRCCategory.Wallet },
		{
			number: "5",
			title: "HTTP Wallet Communications Substrate",
			category: BRCCategory.Wallet,
		},
		{
			number: "6",
			title: "XDM Wallet Communications Substrate",
			category: BRCCategory.Wallet,
		},
		{
			number: "7",
			title: "Window Wallet Communication Substrate",
			category: BRCCategory.Wallet,
		},
		{
			number: "8",
			title: "Everett-style Transaction Envelopes",
			category: BRCCategory.Transactions,
		},
		{
			number: "9",
			title: "Simplified Payment Verification",
			category: BRCCategory.Transactions,
		},
		{
			number: "10",
			title: "Merkle proof standardised format",
			category: BRCCategory.Transactions,
		},
		{
			number: "11",
			title: "TSC Proof Format with Heights",
			category: BRCCategory.Transactions,
		},
		{
			number: "12",
			title: "Raw Transaction Format",
			category: BRCCategory.Transactions,
		},
		{
			number: "13",
			title: "TXO Transaction Object Format",
			category: BRCCategory.Transactions,
		},
		{
			number: "14",
			title: "Bitcoin Script Binary, Hex and ASM Formats",
			category: BRCCategory.Scripts,
		},
		{
			number: "15",
			title: "Bitcoin Script Assembly Language",
			category: BRCCategory.Scripts,
		},
		{
			number: "16",
			title: "Pay to Public Key Hash",
			category: BRCCategory.Scripts,
		},
		{
			number: "17",
			title: "Pay to R Puzzle Hash",
			category: BRCCategory.Scripts,
		},
		{
			number: "18",
			title: "Pay to False Return",
			category: BRCCategory.Scripts,
		},
		{
			number: "19",
			title: "Pay to True Return",
			category: BRCCategory.Scripts,
		},
		{ number: "20", title: "There is no BRC-20", category: BRCCategory.Tokens },
		{ number: "21", title: "Push TX", category: BRCCategory.Scripts },
		{
			number: "22",
			title: "Overlay Network Data Synchronization",
			category: BRCCategory.Overlays,
		},
		{
			number: "23",
			title: "Confederacy Host Interconnect Protocol (CHIP)",
			category: BRCCategory.Overlays,
		},
		{
			number: "24",
			title: "Overlay Network Lookup Services",
			category: BRCCategory.Overlays,
		},
		{
			number: "25",
			title: "Confederacy Lookup Availability Protocol (CLAP)",
			category: BRCCategory.Overlays,
		},
		{
			number: "26",
			title: "Universal Hash Resolution Protocol",
			category: BRCCategory.Overlays,
		},
		{
			number: "27",
			title: "Direct Payment Protocol (DPP)",
			category: BRCCategory.Payments,
		},
		{
			number: "28",
			title: "Paymail Payment Destinations",
			category: BRCCategory.Payments,
		},
		{
			number: "29",
			title: "Simple Authenticated BSV P2PKH Payment Protocol",
			category: BRCCategory.Payments,
		},
		{
			number: "30",
			title: "Transaction Extended Format (EF)",
			category: BRCCategory.Transactions,
		},
		{
			number: "31",
			title: "Authrite Mutual Authentication",
			category: BRCCategory.PeerToPeer,
		},
		{
			number: "32",
			title: "BIP32 Key Derivation Scheme",
			category: BRCCategory.KeyDerivation,
		},
		{
			number: "33",
			title: "PeerServ Message Relay Interface",
			category: BRCCategory.PeerToPeer,
		},
		{
			number: "34",
			title: "PeerServ Host Interconnect Protocol",
			category: BRCCategory.PeerToPeer,
		},
		// #35 is unused
		{
			number: "36",
			title: "Format for Bitcoin Outpoints",
			category: BRCCategory.Outpoints,
		},
		{
			number: "37",
			title: "Spending Instructions Extension for UTXO Storage Format",
			category: BRCCategory.Outpoints,
		},
		// 38, 39, 40 are placeholders in the README
		{
			number: "41",
			title: "PacketPay HTTP Payment Mechanism",
			category: BRCCategory.Payments,
		},
		{
			number: "42",
			title: "BSV Key Derivation Scheme (BKDS)",
			category: BRCCategory.KeyDerivation,
		},
		{
			number: "43",
			title: "Security Levels, Protocol IDs, Key IDs and Counterparties",
			category: BRCCategory.KeyDerivation,
		},
		{
			number: "44",
			title: "Admin-reserved and Prohibited Key Derivation Protocols",
			category: BRCCategory.KeyDerivation,
		},
		{
			number: "45",
			title: "Definition of UTXOs as Bitcoin Tokens",
			category: BRCCategory.Tokens,
		},
		{
			number: "46",
			title: "Wallet Transaction Output Tracking (Output Baskets)",
			category: BRCCategory.Wallet,
		},
		{
			number: "47",
			title: "Bare Multi-Signature",
			category: BRCCategory.Scripts,
		},
		{ number: "48", title: "Pay to Push Drop", category: BRCCategory.Scripts },
		{
			number: "49",
			title: "Users should never see an address",
			category: BRCCategory.Opinions,
		},
		{
			number: "50",
			title: "Submitting Received Payments to a Wallet",
			category: BRCCategory.Wallet,
		},
		{
			number: "51",
			title: "List of user experiences",
			category: BRCCategory.Opinions,
		},
		{
			number: "52",
			title: "Identity Certificates",
			category: BRCCategory.PeerToPeer,
		},
		{
			number: "53",
			title: "Certificate Creation and Revelation",
			category: BRCCategory.Wallet,
		},
		{
			number: "54",
			title: "Hybrid Payment Mode for DPP",
			category: BRCCategory.Payments,
		},
		{
			number: "55",
			title: "HTTPS Transport Mechanism for DPP",
			category: BRCCategory.Payments,
		},
		{
			number: "56",
			title: "Unified Abstract Wallet-to-Application Messaging Layer",
			category: BRCCategory.Wallet,
		},
		{
			number: "57",
			title: "Legitimate Uses for mAPI",
			category: BRCCategory.Opinions,
		},
		{
			number: "58",
			title: "Merkle Path JSON format",
			category: BRCCategory.Transactions,
		},
		{
			number: "59",
			title: "Security and Scalability Benefits of UTXO-based Overlay Networks",
			category: BRCCategory.Opinions,
		},
		{
			number: "60",
			title: "Simplifying State Machine Event Chains in Bitcoin",
			category: BRCCategory.StateMachines,
		},
		{
			number: "61",
			title: "Compound Merkle Path Format",
			category: BRCCategory.Transactions,
		},
		{
			number: "62",
			title: "Background Evaluation Extended Format (BEEF) Transactions",
			category: BRCCategory.Transactions,
		},
		{
			number: "63",
			title: "Genealogical Identity Protocol",
			category: BRCCategory.PeerToPeer,
		},
		{
			number: "64",
			title: "Overlay Network Transaction History Tracking",
			category: BRCCategory.Overlays,
		},
		{
			number: "65",
			title: "Transaction Labels and List Actions",
			category: BRCCategory.Wallet,
		},
		{
			number: "66",
			title: "Output Basket Removal and Certificate Deletion",
			category: BRCCategory.Wallet,
		},
		{
			number: "67",
			title: "Simplified Payment Verification",
			category: BRCCategory.Transactions,
		},
		{
			number: "68",
			title: "Publishing Trust Anchor Details at an Internet Domain",
			category: BRCCategory.PeerToPeer,
		},
		{
			number: "69",
			title: "Revealing Key Linkages",
			category: BRCCategory.KeyDerivation,
		},
		{
			number: "70",
			title: "Paymail BEEF Transaction",
			category: BRCCategory.Payments,
		},
		{
			number: "71",
			title: "Merkle Path Binary Format",
			category: BRCCategory.Transactions,
		},
		{
			number: "72",
			title: "Protecting BRC-69 Key Linkage Information in Transit",
			category: BRCCategory.KeyDerivation,
		},
		{
			number: "73",
			title: "Group Permissions for App Access",
			category: BRCCategory.Wallet,
		},
		{
			number: "74",
			title: "BSV Unified Merkle Path (BUMP) Format",
			category: BRCCategory.Transactions,
		},
		{
			number: "75",
			title: "Mnemonic For Master Private Key",
			category: BRCCategory.KeyDerivation,
		},
		{
			number: "76",
			title: "Graph Aware Sync Protocol",
			category: BRCCategory.Transactions,
		},
		{
			number: "77",
			title: "Message Signature Creation and Verification",
			category: BRCCategory.PeerToPeer,
		},
		{
			number: "78",
			title: "Serialization Format for Portable Encrypted Messages",
			category: BRCCategory.PeerToPeer,
		},
		{
			number: "79",
			title: "Token Exchange Protocol for UTXO-based Overlay Networks",
			category: BRCCategory.Tokens,
		},
		{
			number: "80",
			title: "Improving on MLD for BSV Multicast Services",
			category: BRCCategory.Opinions,
		},
		{
			number: "81",
			title: "Private Overlays with P2PKH Transactions",
			category: BRCCategory.Overlays,
		},
		{
			number: "82",
			title:
				"Defining a Scalable IPv6 Multicast Protocol for Blockchain Transaction Broadcast",
			category: BRCCategory.PeerToPeer,
		},
		{
			number: "83",
			title: "Scalable Transaction Processing in the BSV Network",
			category: BRCCategory.Transactions,
		},
		{
			number: "84",
			title: "Linked Key Derivation Scheme",
			category: BRCCategory.KeyDerivation,
		},
		{
			number: "85",
			title: "Proven Identity Key Exchange (PIKE)",
			category: BRCCategory.PeerToPeer,
		},
		{
			number: "86",
			title:
				"Bidirectionally Authenticated Derivation of Privacy Restricted Type 42 Keys",
			category: BRCCategory.KeyDerivation,
		},
		{
			number: "87",
			title:
				"Standardized Naming Conventions for BRC-22 Topic Managers and BRC-24 Lookup Services",
			category: BRCCategory.Overlays,
		},
		{
			number: "88",
			title: "Overlay Services Synchronization Architecture",
			category: BRCCategory.Overlays,
		},
		{
			number: "89",
			title: "Web 3.0 Standard (at a high level)",
			category: BRCCategory.Opinions,
		},
		{
			number: "90",
			title: "Thoughts on the Mandala Network",
			category: BRCCategory.Opinions,
		},
		{
			number: "91",
			title: "Outputs, Overlays, and Scripts in the Mandala Network",
			category: BRCCategory.Opinions,
		},
		{
			number: "92",
			title: "Mandala Token Protocol",
			category: BRCCategory.Tokens,
		},
		{
			number: "93",
			title: "Limitations of BRC-69 Key Linkage Revelation",
			category: BRCCategory.KeyDerivation,
		},
		{
			number: "94",
			title: "Verifiable Revelation of Shared Secrets Using Schnorr Protocol",
			category: BRCCategory.KeyDerivation,
		},
		{
			number: "95",
			title: "Atomic BEEF Transactions",
			category: BRCCategory.Transactions,
		},
		{
			number: "96",
			title: "BEEF V2 Txid Only Extension",
			category: BRCCategory.Transactions,
		},
		{
			number: "97",
			title: "Extensible Proof-Type Format for Specific Key Linkage Claims",
			category: BRCCategory.Wallet,
		},
		{
			number: "98",
			title: "P Protocols: Allowing future wallet protocol permission schemes",
			category: BRCCategory.Wallet,
		},
		{
			number: "99",
			title:
				"P Baskets: Allowing Future Wallet Basket and Digital Asset Permission Schemes",
			category: BRCCategory.Wallet,
		},
		{
			number: "100",
			title:
				"Unified, Vendor-Neutral, Unchanging, and Open BSV Blockchain Standard Wallet-to-Application Interface",
			category: BRCCategory.Wallet,
		},
		{
			number: "101",
			title:
				"Diverse Facilitators and URL Protocols for SHIP and SLAP Overlay Advertisements",
			category: BRCCategory.Overlays,
		},
		{
			number: "102",
			title: "The deployment-info.json Specification",
			category: BRCCategory.Apps,
		},
		{
			number: "103",
			title:
				"Peer-to-Peer Mutual Authentication and Certificate Exchange Protocol",
			category: BRCCategory.PeerToPeer,
		},
		{
			number: "104",
			title: "HTTP Transport for BRC-103 Mutual Authentication",
			category: BRCCategory.PeerToPeer,
		},
		{
			number: "105",
			title: "HTTP Service Monetization Framework",
			category: BRCCategory.Payments,
		},
	];

	// Register each BRC
	for (const brc of brcs) {
		// Format the BRC number with leading zeros for consistency in resource IDs
		const paddedNumber = brc.number.padStart(4, "0");

		// Use a shorter resource ID that includes a relevant key from the title
		const titleKeywords = brc.title.replace(/[^a-zA-Z0-9 ]/g, "").split(" ");
		const keyword =
			titleKeywords.find(
				(word) =>
					word.length > 3 &&
					![
						"with",
						"from",
						"that",
						"this",
						"your",
						"when",
						"then",
						"them",
						"they",
						"bitcoin",
					].includes(word.toLowerCase()),
			) ||
			titleKeywords[0] ||
			"brc";

		// Create a descriptive resource ID
		const resourceId = `brc_${paddedNumber}_${keyword.toLowerCase()}`;

		// Build the URL to the BRC file
		const url = `https://raw.githubusercontent.com/bitcoin-sv/BRCs/master/${brc.category}/${brc.number.padStart(4, "0")}.md`;

		server.resource(
			resourceId,
			url,
			{
				title: `BRC-${brc.number}: ${brc.title}`,
				description: `Bitcoin SV BRC-${brc.number}: ${brc.title}`,
			},
			async (uri) => {
				const resp = await fetch(uri.href);
				if (!resp.ok) {
					throw new Error(`BRC-${brc.number} not found at ${uri.href}`);
				}
				const text = await resp.text();
				return {
					contents: [
						{
							uri: uri.href,
							text,
						},
					],
				};
			},
		);
	}
}

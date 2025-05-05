import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";

// Store protocol documentation
// Source AIP: https://raw.githubusercontent.com/b-open-io/AIP/refs/heads/main/README.md
// Source MAP: https://raw.githubusercontent.com/rohenaz/MAP/refs/heads/master/README.md
// Source SIGMA: User provided text
const bitcomProtocols = {
	AIP: {
		name: "Author Identity Protocol (AIP)",
		prefix: "15PciHG22SNLQJXMoSUaWVi7WSqc7hCfva",
		description:
			"A simple and flexible method to sign arbitrary OP_RETURN data with Bitcoin ECDSA signatures, decoupling the signing address from the funding source.",
		structure: `
OP_RETURN
  [Data]
  [Media Type]
  [Encoding]
  [Filename]
  |
  15PciHG22SNLQJXMoSUaWVi7WSqc7hCfva (AIP Prefix)
  [Signing Algorithm] (e.g., BITCOIN_ECDSA)
  [Signing Address]
  [Signature] (Base64 Encoded)
  [Field Index 0] (Optional, 0 = OP_RETURN 0x6a)
  [Field Index 1] (Optional)
  ... (If indexes are omitted, all fields left of '|' are signed)
`,
		reference:
			"https://raw.githubusercontent.com/b-open-io/AIP/refs/heads/main/README.md",
	},
	MAP: {
		name: "Magic Attribute Protocol (MAP)",
		prefix: "1PuQa7K62MiKCtssSLKy1kh56WWU7MtUR5",
		description:
			"A simple protocol for associating data in a single transaction by defining key-value pairs, often used for mapping content (like B:// protocol data) to identifiers or actions.",
		structure: `
OP_RETURN
  ... (Optional Input Data Protocol, e.g., B://)
  |
  1PuQa7K62MiKCtssSLKy1kh56WWU7MtUR5 (MAP Prefix)
  'SET'
  [Key 1] (UTF8 String)
  [Value 1] (UTF8 String)
  [Key 2] (Optional UTF8 String)
  [Value 2] (Optional UTF8 String)
  ...
`,
		notes:
			"Can be used standalone or chained after other protocols (like B). Keys can represent attributes (url, type, coordinates.lat) or actions (like, follow.user).",
		reference:
			"https://raw.githubusercontent.com/rohenaz/MAP/refs/heads/master/README.md",
	},
	SIGMA: {
		name: "Sigma Protocol",
		prefix: "SIGMA", // As per user text, though often represented by a Bitcom address
		description:
			"Enhances transaction security by signing custom output scripts, incorporating input txid and output data hashes to mitigate replay attacks.",
		structure: `
<locking script>
OP_RETURN
  [Additional Data] (Optional)
  | (Optional Separator)
  SIGMA (Protocol Identifier)
  [Signing Algorithm] (e.g., ECDSA)
  [Signing Address]
  [Signature] (Base64 Encoded in lib, Hex in script)
  [VIN] (Index of input whose txid is included in signature, -1 for corresponding input)
`,
		reference: "User provided text (Abstract/Introduction)",
	},
	// BAP could be added here if spec is provided
} as const; // Use 'as const' for stricter type inference

type ProtocolName = keyof typeof bitcomProtocols;

// Define the MCP resource
const bitcomResourceTemplate = new ResourceTemplate(
	"bitcom://protocol/{protocolName}",
	{ list: undefined }, // Required options object with list: undefined
);

/**
 * Register the Bitcom protocol documentation resource
 * @param server McpServer instance
 */
export function registerBitcomResource(server: McpServer): void {
	server.resource(
		"bitcom_protocol",
		bitcomResourceTemplate,
		async (uri, params) => {
			const protocolName = params.protocolName as ProtocolName;

			if (!protocolName || !(protocolName in bitcomProtocols)) {
				const available = Object.keys(bitcomProtocols).join(", ");
				return {
					code: -32602, // Invalid params
					message: `Invalid or missing protocol name. Available: ${available}`,
					contents: [],
				};
			}

			const proto = bitcomProtocols[protocolName];
			const notesString =
				"notes" in proto && proto.notes ? `\\nNotes:\\n${proto.notes}\\n` : "";

			const textContent = `
Protocol: ${proto.name}
Prefix: ${proto.prefix || "N/A"}
Reference: ${proto.reference}

Description:
${proto.description}

Structure:
\`\`\`
${proto.structure.trim()}
\`\`\`
${notesString}      `.trim();

			return {
				contents: [
					{
						uri: uri.href,
						text: textContent,
						mimeType: "text/plain",
					},
				],
			};
		},
	);
}

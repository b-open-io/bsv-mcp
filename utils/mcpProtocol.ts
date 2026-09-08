import { SUPPORTED_PROTOCOL_VERSIONS } from "@modelcontextprotocol/client";
export const MCP_PRIMARY_PROTOCOL = "2026-07-28";

/** Prefer modern discovery while accepting existing clients by default. */
export function readMcpProtocolPolicy(env: Record<string, string | undefined> = process.env) {
 const value = env.MCP_LEGACY_COMPATIBILITY;
 if (value !== undefined && value !== "true" && value !== "false") throw new Error("MCP_LEGACY_COMPATIBILITY must be true or false");
 const legacyCompatibility = value !== "false";
 return { legacyCompatibility, supportedVersions: [...new Set([MCP_PRIMARY_PROTOCOL, ...(legacyCompatibility ? SUPPORTED_PROTOCOL_VERSIONS : [])])] };
}

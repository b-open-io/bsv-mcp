import { expect, test } from "bun:test";
import { readMcpProtocolPolicy } from "./mcpProtocol";
test("modern is preferred and older clients work by default", () => {
 const policy = readMcpProtocolPolicy({});
 expect(policy.legacyCompatibility).toBe(true);
 expect(policy.supportedVersions[0]).toBe("2026-07-28");
 expect(policy.supportedVersions).toContain("2025-06-18");
 expect(readMcpProtocolPolicy({MCP_LEGACY_COMPATIBILITY:"false"}).supportedVersions).toEqual(["2026-07-28"]);
 expect(() => readMcpProtocolPolicy({MCP_LEGACY_COMPATIBILITY:"yes"})).toThrow("must be true or false");
});

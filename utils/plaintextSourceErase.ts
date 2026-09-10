import { existsSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { erasePlaintext } from "./accountCommands";
import { eraseMcpClientEnvValue } from "./mcpClientKeySources";
import type { MigrationSource } from "./vaultMigration";

export interface EraseSourceResult {
	erased: boolean;
	kind: "mcp-client" | "file" | "none";
}

/**
 * After a verified Vault import, overwrite and remove the plaintext copy that
 * was imported. Cannot erase SSD remnants, APFS snapshots, or other copies.
 */
export function eraseImportedPlaintextSource(
	source: MigrationSource,
): EraseSourceResult {
	if (
		source.location === "mcp-client" &&
		source.configPath &&
		source.serverName &&
		source.envVar
	) {
		return {
			erased: eraseMcpClientEnvValue({
				configPath: source.configPath,
				serverName: source.serverName,
				envVar: source.envVar,
			}),
			kind: "mcp-client",
		};
	}
	if (
		source.plaintextKeys &&
		source.directory &&
		isAbsolute(source.directory) &&
		(source.location === "legacy-root" ||
			source.location === "custom" ||
			source.location === "account")
	) {
		const file = join(source.directory, source.keyFile ?? "keys.json");
		if (!existsSync(file)) return { erased: false, kind: "none" };
		erasePlaintext(file);
		return { erased: true, kind: "file" };
	}
	return { erased: false, kind: "none" };
}

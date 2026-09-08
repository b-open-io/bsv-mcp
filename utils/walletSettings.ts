import {
	closeSync,
	constants,
	fstatSync,
	openSync,
	readFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join } from "node:path";
import { z } from "zod";
import { accountNameSchema } from "./accounts";

export const walletSourceSchema = z
	.object({
		name: accountNameSchema,
		directory: z
			.string()
			.min(1)
			.refine(isAbsolute, "Wallet source directory must be absolute"),
		keyFile: z.enum(["keys.json", "root.wif"]).default("keys.json"),
		storageIdentityKey: z.string().min(1).max(200).optional(),
		depositPrefix: z.enum(["mcp", "1sat"]).optional(),
	})
	.strict();
export type WalletSource = z.infer<typeof walletSourceSchema>;
const settingsSchema = z
	.object({ sources: z.array(walletSourceSchema).default([]) })
	.passthrough();

/** User-owned public selectors only. Never infer custom sources from installation paths. */
export function readWalletSettings(
	home = homedir(),
): Record<string, unknown> & { sources: WalletSource[] } {
	let fd: number;
	try {
		fd = openSync(
			join(home, ".bsv-mcp", "settings.json"),
			constants.O_RDONLY | constants.O_NOFOLLOW,
		);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT")
			return { sources: [] };
		throw error;
	}
	try {
		const stat = fstatSync(fd);
		if (!stat.isFile() || stat.size > 1024 * 1024)
			throw new Error("Invalid wallet settings file");
		const settings = settingsSchema.parse(JSON.parse(readFileSync(fd, "utf8")));
		const { sources } = settings;
		if (new Set(sources.map((source) => source.name)).size !== sources.length)
			throw new Error("Wallet source names must be unique");
		return settings;
	} finally {
		closeSync(fd);
	}
}

export function readWalletSources(home = homedir()): WalletSource[] {
	return readWalletSettings(home).sources;
}

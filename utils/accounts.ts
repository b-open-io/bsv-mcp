import { randomBytes } from "node:crypto";
import {
	chmodSync,
	existsSync,
	lstatSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	renameSync,
	writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { z } from "zod";

export const accountNameSchema = z
	.string()
	.regex(
		/^[a-z0-9][a-z0-9_-]{0,63}$/,
		"Use 1–64 lowercase letters, digits, underscores or hyphens",
	);
/** Default active wallet-storage provider for newly-created embedded accounts. */
export const DEFAULT_STORAGE_REMOTE_URL = "https://wallet.1sat.app";
const remote = z
	.string()
	.url()
	.refine((s) => {
		const u = new URL(s);
		return (
			!u.username &&
			!u.password &&
			!u.search &&
			!u.hash &&
			(u.protocol === "https:" ||
				(u.protocol === "http:" &&
					["localhost", "127.0.0.1", "[::1]"].includes(u.hostname)))
		);
	});
export const accountConfigSchema = z
	.object({
		chain: z.enum(["main", "test"]),
		storageIdentityKey: z.string().min(1).max(200),
		activeRemote: remote.optional(),
		backups: z.array(remote).optional(),
		address: z
			.string()
			.regex(/^[123mn][1-9A-HJ-NP-Za-km-z]{24,40}$/)
			.optional(),
		depositPrefix: z.enum(["mcp", "1sat"]).default("mcp"),
	})
	.strict();
export type AccountConfig = z.infer<typeof accountConfigSchema>;

/**
 * Resolve the storage topology passed to the One Sat wallet factory.
 *
 * `REMOTE_STORAGE_URL` is a deployment override and is deliberately kept out
 * of the account file. A URL listed as both active and backup would otherwise
 * be connected twice by the SDK, so remove the active URL from the backup
 * list here. This function is pure so config behavior can be tested without
 * creating a wallet or making an authenticated request.
 */
export function resolveStorageConfig(
	config: Pick<AccountConfig, "activeRemote" | "backups"> | undefined,
	activeRemoteOverride?: string,
): Pick<AccountConfig, "activeRemote" | "backups"> {
	const validate = (url: string) => {
		if (!remote.safeParse(url).success)
			throw new Error("Wallet storage URL must be HTTPS or loopback HTTP");
		return url;
	};
	const activeRemote =
		activeRemoteOverride === undefined
			? config?.activeRemote
			: validate(activeRemoteOverride);
	const backups = config?.backups
		?.map(validate)
		.filter((url) => url !== activeRemote);
	return { activeRemote, backups };
}
export function accountsRoot() {
	const base = join(homedir(), ".bsv-mcp");
	regularPath(base, true);
	return join(base, "accounts");
}
export function accountName(value = process.env.BSV_MCP_ACCOUNT ?? "default") {
	return accountNameSchema.parse(value);
}
export function accountDir(name = accountName(), root = accountsRoot()) {
	return join(root, accountName(name));
}
/** Reject symlinks even on reads so an account cannot escape its canonical directory. */
export function regularPath(file: string, directory = false) {
	if (!existsSync(file)) return;
	const stat = lstatSync(file);
	if (
		stat.isSymbolicLink() ||
		(directory ? !stat.isDirectory() : !stat.isFile())
	)
		throw new Error(
			"Account path must be a regular file or directory, not a link",
		);
}
export function secureDirectory(dir: string) {
	regularPath(dir, true);
	mkdirSync(dir, { recursive: true, mode: 0o700 });
	chmodSync(dir, 0o700);
}
export function readAccount(
	name = accountName(),
	root = accountsRoot(),
): AccountConfig | undefined {
	regularPath(root, true);
	const dir = accountDir(name, root);
	regularPath(dir, true);
	const file = join(dir, "config.json");
	regularPath(file);
	if (!existsSync(file)) return undefined;
	try {
		return accountConfigSchema.parse(JSON.parse(readFileSync(file, "utf8")));
	} catch {
		throw new Error(`Invalid account configuration at ${file}`);
	}
}
export function writeAccount(
	name: string,
	config: AccountConfig,
	root = accountsRoot(),
) {
	const data = accountConfigSchema.parse(config);
	regularPath(root, true);
	secureDirectory(root);
	const dir = accountDir(name, root);
	secureDirectory(dir);
	const file = join(dir, "config.json");
	regularPath(file);
	const temp = join(dir, `.config-${randomBytes(8).toString("hex")}`);
	writeFileSync(temp, `${JSON.stringify(data, null, 2)}\n`, {
		mode: 0o600,
		flag: "wx",
	});
	renameSync(temp, file);
}
export function listAccounts(root = accountsRoot()) {
	regularPath(root, true);
	if (!existsSync(root)) return [];
	return readdirSync(root)
		.filter((name) => accountNameSchema.safeParse(name).success)
		.sort()
		.map((name) => {
			const config = readAccount(name, root);
			return {
				name,
				chain: config?.chain,
				address: config?.address ?? null,
				encrypted: existsSync(join(accountDir(name, root), "keys.bep")),
			};
		});
}
export function newAccountConfig(
	chain: "main" | "test",
	address: string,
): AccountConfig {
	return {
		chain,
		address,
		storageIdentityKey: `bsv-mcp-${randomBytes(16).toString("hex")}`,
		...(chain === "main" ? { activeRemote: DEFAULT_STORAGE_REMOTE_URL } : {}),
		depositPrefix: "mcp",
	};
}

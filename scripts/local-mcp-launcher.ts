#!/usr/bin/env bun
/**
 * Launch the canonical BSV MCP binary in one of the two local wallet modes.
 *
 * The launcher is intended for local MCP registrations. It keeps the server
 * process independent of the repository working directory and repository
 * dotenv files:
 *
 *   bun --no-env-file scripts/local-mcp-launcher.ts external
 *   BSV_MCP_PASSWORD=... bun --no-env-file scripts/local-mcp-launcher.ts embedded
 *
 * The password is accepted only from the launcher's runtime environment. It
 * never appears in argv, configuration text, or launcher diagnostics.
 */

import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
	accountDir,
	accountNameSchema,
	readAccount,
	regularPath,
} from "../utils/accounts.ts";
import { readExternalWalletConfig } from "../utils/externalWalletConfig.ts";

export type LocalMcpMode = "external" | "embedded";

export interface LocalMcpLaunchOptions {
	mode: LocalMcpMode;
	/** The account name is metadata only; its encrypted backup is never read here. */
	accountName?: string;
	/** Runtime-only password; callers should source it from process.env. */
	runtimePassword?: string;
	externalWalletUrl?: string;
	externalOriginator?: string;
	serverBinary?: string;
	bunExecutable?: string;
	/** Must be outside this checkout. Defaults to an OS temporary directory. */
	workingDirectory?: string;
	/** Embedded mode resolves ~/.bsv-mcp from this directory. */
	homeDirectory?: string;
	disableBroadcasting?: boolean;
}

export interface EmbeddedAccountReadiness {
	name: string;
	eligible: boolean;
	missing: string[];
}

/** The only inherited variables allowed into the child before mode setup. */
const SAFE_INHERITED_ENV = [
	"PATH",
	"USER",
	"LOGNAME",
	"SHELL",
	"TERM",
	"LANG",
	"LC_ALL",
	"TZ",
] as const;

/**
 * Wallet-selection and dotenv-sensitive variables are removed explicitly,
 * rather than being passed as empty strings. Empty values can still select a
 * branch or trigger a different validation path.
 */
export const CONFLICTING_WALLET_ENV = [
	"BRC100_WALLET_URL",
	"BRC100_WALLET_ORIGINATOR",
	"PRIVATE_KEY_WIF",
	"IDENTITY_KEY_WIF",
	"BSV_MCP_ACCOUNT",
	"BSV_MCP_PASSWORD",
	"BSV_MCP_PASSPHRASE",
	"USE_DROPLIT_API",
	"REMOTE_STORAGE_URL",
	"BSV_CHAIN",
	"VAULT_PATH",
] as const;

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_SERVER_BINARY = resolve(REPO_ROOT, "dist/index.js");

function isInside(parent: string, child: string): boolean {
	const path = relative(resolve(parent), resolve(child));
	return path === "" || (!path.startsWith("..") && !isAbsolute(path));
}

function assertCleanWorkingDirectory(directory: string): string {
	const resolved = resolve(directory);
	if (isInside(REPO_ROOT, resolved))
		throw new Error(
			"Launcher working directory must be outside the BSV MCP checkout",
		);
	return resolved;
}

function regularFileExists(file: string): boolean {
	try {
		regularPath(file);
		return existsSync(file);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
		throw error;
	}
}

/**
 * Check account metadata and filenames without opening keys.bep or any other
 * key/password/database payload.
 */
export function inspectEmbeddedAccount(
	name: string,
	homeDirectory = homedir(),
): EmbeddedAccountReadiness {
	const parsed = accountNameSchema.safeParse(name);
	if (!parsed.success)
		throw new Error(
			"Invalid BSV_MCP_ACCOUNT; use lowercase letters, digits, underscores or hyphens",
		);

	const accountsRoot = join(resolve(homeDirectory), ".bsv-mcp", "accounts");
	const directory = accountDir(name, accountsRoot);
	const missing: string[] = [];
	let config: ReturnType<typeof readAccount> | undefined;
	try {
		config = readAccount(name, accountsRoot);
	} catch {
		missing.push("a valid config.json");
	}
	if (!config && !missing.includes("a valid config.json"))
		missing.push("config.json");
	if (!regularFileExists(join(directory, "keys.bep")))
		missing.push("encrypted keys.bep");

	return { name, eligible: missing.length === 0, missing };
}

function safeInheritedEnvironment(
	baseEnv: Record<string, string | undefined>,
	homeDirectory: string,
): Record<string, string> {
	const env: Record<string, string> = {};
	for (const name of SAFE_INHERITED_ENV) {
		const value = baseEnv[name];
		if (value !== undefined) env[name] = value;
	}

	// Remove inherited wallet selectors explicitly; do not leave empty values.
	for (const name of CONFLICTING_WALLET_ENV) delete env[name];

	const pathValue = env.PATH ?? "/usr/bin:/bin";
	env.PATH = pathValue;
	env.HOME = resolve(homeDirectory);
	env.TMPDIR = tmpdir();
	env.TMP = env.TMPDIR;
	env.TEMP = env.TMPDIR;
	env.NO_COLOR = "1";
	env.TRANSPORT = "stdio";
	return env;
}

function requireNonEmpty(value: string | undefined, message: string): string {
	if (!value?.trim()) throw new Error(message);
	return value;
}

export function buildLaunchPlan(
	options: LocalMcpLaunchOptions,
	baseEnv: Record<string, string | undefined> = process.env,
): {
	mode: LocalMcpMode;
	command: string;
	args: string[];
	cwd: string;
	env: Record<string, string>;
	serverBinary: string;
} {
	if (options.mode !== "external" && options.mode !== "embedded")
		throw new Error("Launcher mode must be external or embedded");

	const serverBinary = resolve(options.serverBinary ?? DEFAULT_SERVER_BINARY);
	if (!existsSync(serverBinary))
		throw new Error(
			"Canonical BSV MCP binary was not found at the configured path",
		);

	const cwd = assertCleanWorkingDirectory(
		options.workingDirectory ?? join(tmpdir(), `bsv-mcp-local-${options.mode}`),
	);
	const bunExecutable = resolve(options.bunExecutable ?? process.execPath);
	const homeDirectory =
		options.mode === "embedded"
			? resolve(options.homeDirectory ?? homedir())
			: resolve(
					options.homeDirectory ??
						join(tmpdir(), "bsv-mcp-local-external-home"),
				);
	const env = safeInheritedEnvironment(baseEnv, homeDirectory);
	env.DISABLE_BROADCASTING =
		options.disableBroadcasting === false ? "false" : "true";

	if (options.mode === "external") {
		const url = requireNonEmpty(
			options.externalWalletUrl ?? baseEnv.BRC100_WALLET_URL,
			"External mode requires BRC100_WALLET_URL in the launcher's runtime environment",
		);
		const originator =
			options.externalOriginator ??
			baseEnv.BRC100_WALLET_ORIGINATOR ??
			"bsv-mcp.local";
		// Reuse the server's validation so the launcher cannot make a malformed
		// signer registration look ready.
		const config = readExternalWalletConfig({
			BRC100_WALLET_URL: url,
			BRC100_WALLET_ORIGINATOR: originator,
		});
		if (!config) throw new Error("External signer configuration is missing");
		env.BRC100_WALLET_URL = config.url;
		env.BRC100_WALLET_ORIGINATOR = config.originator;
	} else {
		const name = options.accountName ?? baseEnv.BSV_MCP_ACCOUNT ?? "default";
		const home = resolve(options.homeDirectory ?? homedir());
		const readiness = inspectEmbeddedAccount(name, home);
		if (!readiness.eligible)
			throw new Error(
				'Embedded account "' +
					name +
					'" is not ready; provide an existing encrypted account with ' +
					readiness.missing.join(" and ") +
					". The launcher never creates or migrates accounts.",
			);
		const password = requireNonEmpty(
			options.runtimePassword ?? baseEnv.BSV_MCP_PASSWORD,
			"Embedded mode requires BSV_MCP_PASSWORD at launcher runtime; do not pass it as an argument or store it in MCP config",
		);
		env.BSV_MCP_ACCOUNT = name;
		// This is the sole secret copied into the child, and it came from the
		// launcher's runtime environment or an in-memory caller option.
		env.BSV_MCP_PASSWORD = password;
	}

	return {
		mode: options.mode,
		command: bunExecutable,
		args: ["--no-env-file", serverBinary, "--stdio"],
		cwd,
		env,
		serverBinary,
	};
}

function ensureLaunchDirectories(
	plan: ReturnType<typeof buildLaunchPlan>,
): void {
	mkdirSync(plan.cwd, { recursive: true, mode: 0o700 });
	if (plan.mode === "external")
		mkdirSync(plan.env.HOME, { recursive: true, mode: 0o700 });
}

export function launch(
	plan: ReturnType<typeof buildLaunchPlan>,
): Promise<number> {
	ensureLaunchDirectories(plan);
	return new Promise((resolvePromise, reject) => {
		const child = spawn(plan.command, plan.args, {
			cwd: plan.cwd,
			env: plan.env,
			stdio: "inherit",
		});
		child.once("error", reject);
		child.once("exit", (code, signal) => {
			if (code !== null) {
				resolvePromise(code);
				return;
			}
			// Preserve signal termination as a conventional non-zero exit.
			resolvePromise(signal ? 128 : 1);
		});
	});
}

function usage(): string {
	return (
		"Usage:\n" +
		"  bun --no-env-file scripts/local-mcp-launcher.ts external\n" +
		"  BSV_MCP_PASSWORD=... bun --no-env-file scripts/local-mcp-launcher.ts embedded\n\n" +
		"External mode reads BRC100_WALLET_URL and optional BRC100_WALLET_ORIGINATOR\n" +
		"from the launcher's runtime environment. Embedded mode reads BSV_MCP_ACCOUNT\n" +
		"and BSV_MCP_PASSWORD at runtime and requires an existing encrypted account.\n" +
		"Neither mode loads repository dotenv files. The password is never an argv value\n" +
		"or printed by this launcher."
	);
}

async function main(): Promise<void> {
	const mode = process.argv[2];
	if (!mode || mode === "--help" || mode === "-h") {
		console.error(usage());
		return;
	}
	if (mode !== "external" && mode !== "embedded")
		throw new Error(`Unknown launcher mode: ${mode}`);

	const plan = buildLaunchPlan({ mode });
	const exitCode = await launch(plan);
	process.exitCode = exitCode;
}

if (import.meta.main) {
	try {
		await main();
	} catch (error) {
		console.error(
			error instanceof Error ? error.message : "Local MCP launch failed",
		);
		process.exitCode = 1;
	}
}

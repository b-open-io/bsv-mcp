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
import { existsSync, lstatSync, mkdirSync, realpathSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import {
	basename,
	dirname,
	isAbsolute,
	join,
	relative,
	resolve,
} from "node:path";
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
	/** Explicit project root for project-role bindings; never inferred from cwd. */
	projectRoot?: string;
	/** Explicit project identifier paired with projectRoot. */
	projectId?: string;
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

/** Project-role configuration is passed only as an explicit launcher pair. */
export const PROJECT_CONFIG_ENV = [
	"BSV_MCP_PROJECT_ROOT",
	"BSV_MCP_PROJECT_ID",
] as const;

const PROJECT_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/;

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_SERVER_BINARY = resolve(REPO_ROOT, "dist/index.js");
const FORWARDED_SIGNALS: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];

/** Resolve symlinked existing parents as well as a not-yet-created tail. */
function canonicalPath(path: string): string {
	let candidate = resolve(path);
	const tail: string[] = [];
	while (!existsSync(candidate)) {
		const parent = dirname(candidate);
		if (parent === candidate) return candidate;
		tail.unshift(basename(candidate));
		candidate = parent;
	}
	return resolve(realpathSync(candidate), ...tail);
}

function isInside(parent: string, child: string): boolean {
	const path = relative(canonicalPath(parent), canonicalPath(child));
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
	for (const name of PROJECT_CONFIG_ENV) delete env[name];

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

/**
 * Validate the nonsecret project selector before the child is spawned. The
 * role store applies the same root requirement; keeping the check here makes a
 * bad MCP registration fail at launch instead of silently selecting temp cwd.
 */
function resolveProjectConfig(
	options: LocalMcpLaunchOptions,
): { projectRoot: string; projectId: string } | undefined {
	const hasRoot = options.projectRoot !== undefined;
	const hasId = options.projectId !== undefined;
	if (hasRoot !== hasId)
		throw new Error(
			"BSV_MCP_PROJECT_ROOT and BSV_MCP_PROJECT_ID must be configured together",
		);
	if (!hasRoot || !hasId) return undefined;

	const projectRoot = options.projectRoot as string;
	const projectId = options.projectId as string;
	if (!isAbsolute(projectRoot))
		throw new Error("BSV_MCP_PROJECT_ROOT must be an absolute path");
	if (!projectId || !PROJECT_ID_PATTERN.test(projectId))
		throw new Error(
			"BSV_MCP_PROJECT_ID must match the project role identifier format",
		);
	let info: ReturnType<typeof lstatSync>;
	try {
		info = lstatSync(projectRoot);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT")
			throw new Error("BSV_MCP_PROJECT_ROOT must be an existing directory");
		throw error;
	}
	if (!info.isDirectory() || info.isSymbolicLink())
		throw new Error("BSV_MCP_PROJECT_ROOT must be an existing real directory");
	return { projectRoot: realpathSync(projectRoot), projectId };
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
	projectRoot?: string;
	projectId?: string;
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
	const project = resolveProjectConfig(options);
	if (project) {
		env.BSV_MCP_PROJECT_ROOT = project.projectRoot;
		env.BSV_MCP_PROJECT_ID = project.projectId;
	}

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
		...(project ?? {}),
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
			env: plan.env as NodeJS.ProcessEnv,
			stdio: "inherit",
		} as import("node:child_process").SpawnOptions);
		let settled = false;
		const forwardSignal = (signal: NodeJS.Signals) => {
			if (!child.killed) child.kill(signal);
		};
		const cleanup = () => {
			for (const signal of FORWARDED_SIGNALS)
				process.off(signal, forwardSignal);
		};
		const settle = (finish: () => void) => {
			if (settled) return;
			settled = true;
			cleanup();
			finish();
		};

		for (const signal of FORWARDED_SIGNALS) process.on(signal, forwardSignal);
		child.once("error", (error) => settle(() => reject(error)));
		child.once("exit", (code, signal) => {
			settle(() => {
				if (code !== null) {
					resolvePromise(code);
					return;
				}
				// Preserve signal termination as a conventional non-zero exit.
				resolvePromise(signal ? 128 : 1);
			});
		});
	});
}

function usage(): string {
	return (
		"Usage:\n" +
		"  bun --no-env-file scripts/local-mcp-launcher.ts external [--project-root /absolute/project --project-id id]\n" +
		"  BSV_MCP_PASSWORD=... bun --no-env-file scripts/local-mcp-launcher.ts embedded [--project-root /absolute/project --project-id id]\n\n" +
		"External mode reads BRC100_WALLET_URL and optional BRC100_WALLET_ORIGINATOR\n" +
		"from the launcher's runtime environment. Embedded mode reads BSV_MCP_ACCOUNT\n" +
		"and BSV_MCP_PASSWORD at runtime and requires an existing encrypted account.\n" +
		"Project-role mode requires the paired --project-root and --project-id flags;\n" +
		"the root is passed as BSV_MCP_PROJECT_ROOT and the ID as BSV_MCP_PROJECT_ID.\n" +
		"Neither mode loads repository dotenv files. The password is never an argv value\n" +
		"or printed by this launcher."
	);
}

/**
 * `import.meta.main` is rewritten to a CommonJS-only helper by Bun's Node
 * bundler. Compare the resolved entry paths instead so both the source script
 * and the npm-shipped ESM bundle can run directly under Bun or Node.
 */
function isLauncherEntryPoint(): boolean {
	const entry = process.argv[1];
	if (!entry) return false;
	try {
		return (
			realpathSync(fileURLToPath(import.meta.url)) ===
			realpathSync(resolve(entry))
		);
	} catch {
		return false;
	}
}

export function parseLauncherArguments(
	argv: readonly string[],
): LocalMcpLaunchOptions {
	const mode = argv[0];
	if (mode !== "external" && mode !== "embedded")
		throw new Error("Launcher mode must be external or embedded");
	let projectRoot: string | undefined;
	let projectId: string | undefined;
	for (let index = 1; index < argv.length; index += 1) {
		const flag = argv[index];
		if (flag === "--project-root" || flag === "--project-id") {
			const value = argv[++index];
			if (!value || value.startsWith("--"))
				throw new Error(`${flag} requires a value`);
			if (flag === "--project-root") projectRoot = value;
			else projectId = value;
			continue;
		}
		throw new Error(`Unknown launcher option: ${flag}`);
	}
	return { mode, projectRoot, projectId };
}

async function main(): Promise<void> {
	const args = process.argv.slice(2);
	if (!args[0] || args[0] === "--help" || args[0] === "-h") {
		console.error(usage());
		return;
	}
	const plan = buildLaunchPlan(parseLauncherArguments(args));
	const exitCode = await launch(plan);
	process.exitCode = exitCode;
}

if (isLauncherEntryPoint()) {
	try {
		await main();
	} catch (error) {
		console.error(
			error instanceof Error ? error.message : "Local MCP launch failed",
		);
		process.exitCode = 1;
	}
}

import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { PrivateKey } from "@bsv/sdk";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { createAccount } from "../../utils/accountStore.ts";
import { newAccountConfig } from "../../utils/accounts.ts";

const repoRoot = join(import.meta.dir, "../..");
const testPassword = "synthetic-test-passphrase";

const stdioGuardBanner = `var __stdio = process.argv.includes("--stdio") || (process.env.TRANSPORT || "").toLowerCase() === "stdio";
if (__stdio) {
  var __stderr = console.error.bind(console);
  console.log = function() { __stderr.apply(null, ["[log]"].concat([].slice.call(arguments))); };
  console.warn = function() { __stderr.apply(null, ["[warn]"].concat([].slice.call(arguments))); };
  console.info = function() { __stderr.apply(null, ["[info]"].concat([].slice.call(arguments))); };
  console.debug = function() { __stderr.apply(null, ["[debug]"].concat([].slice.call(arguments))); };
}`;

const externalDrivers = [
	"pg",
	"pg-query-stream",
	"mysql",
	"mysql2",
	"mariadb",
	"mariadb/callback",
	"oracledb",
	"tedious",
	"better-sqlite3",
	"sqlite3",
];

export type WalletMode = "external" | "embedded";

export type BuiltMcpExecutable = {
	path: string;
	cleanup: () => void;
};

export type StubSigner = {
	url: string;
	identityKey: string;
	requests: Array<{
		path: string;
		origin: string | null;
		originator: string | null;
		body: unknown;
	}>;
	close: () => Promise<void>;
};

export type WalletModeFixture = {
	mode: WalletMode;
	home: string;
	env: Record<string, string>;
	stubSigner?: StubSigner;
	cleanup: () => Promise<void>;
};

export type RunningMcpWalletMode = {
	mode: WalletMode;
	client: Client;
	transport: StdioClientTransport;
	stderr: () => string;
	close: () => Promise<void>;
};

function definedEnvironment(
	entries: Record<string, string | undefined>,
): Record<string, string> {
	return Object.fromEntries(
		Object.entries(entries).filter(
			(entry): entry is [string, string] => entry[1] !== undefined,
		),
	);
}

/** Build one executable that both wallet-mode subprocesses run. */
export function buildMcpExecutable(): BuiltMcpExecutable {
	const buildDir = mkdtempSync(join("/tmp", "bsv-mcp-wallet-modes-build-"));
	const output = join(buildDir, "bsv-mcp.js");
	const result = Bun.spawnSync(
		[
			process.execPath,
			"build",
			join(repoRoot, "index.ts"),
			"--target=node",
			`--outfile=${output}`,
			`--banner=${stdioGuardBanner}`,
			...externalDrivers.flatMap((driver) => ["--external", driver]),
		],
		{ cwd: repoRoot, stdout: "pipe", stderr: "pipe" },
	);
	if (result.exitCode !== 0) {
		const stderr = result.stderr
			? new TextDecoder().decode(result.stderr)
			: "no build output";
		throw new Error(`Synthetic MCP executable build failed: ${stderr}`);
	}
	return {
		path: output,
		cleanup: () => rmSync(buildDir, { recursive: true, force: true }),
	};
}

/** Start a signer that can answer only the read-only RPCs used by this test. */
export function startStubSigner(): StubSigner {
	const identityKey = PrivateKey.fromRandom().toPublicKey().toString();
	const requests: StubSigner["requests"] = [];
	const server = Bun.serve({
		hostname: "127.0.0.1",
		port: 0,
		async fetch(request) {
			const path = new URL(request.url).pathname;
			let body: unknown;
			try {
				body = await request.json();
			} catch {
				body = undefined;
			}
			requests.push({
				path,
				origin: request.headers.get("origin"),
				originator: request.headers.get("originator"),
				body,
			});

			if (path === "/getPublicKey")
				return Response.json({ publicKey: identityKey });
			if (path === "/listOutputs")
				return Response.json({ totalOutputs: 0, outputs: [] });
			return Response.json(
				{ message: `Unexpected synthetic signer method: ${path}` },
				{ status: 501 },
			);
		},
	});
	return {
		url: `http://127.0.0.1:${server.port}`,
		identityKey,
		requests,
		close: async () => {
			server.stop(true);
		},
	};
}

function baseEnvironment(home: string): Record<string, string> {
	return definedEnvironment({
		NODE_ENV: "test",
		PATH: process.env.PATH ?? "/usr/bin:/bin",
		HOME: home,
		TMPDIR: home,
		TRANSPORT: "stdio",
		ENABLE_OAUTH: "false",
		DISABLE_BROADCASTING: "true",
		DISABLE_BSV_TOOLS: "true",
		DISABLE_ORDINALS_TOOLS: "true",
		DISABLE_UTILS_TOOLS: "true",
		DISABLE_BAP_TOOLS: "true",
		DISABLE_BSOCIAL_TOOLS: "true",
		DISABLE_MNEE_TOOLS: "true",
		DISABLE_PROMPTS: "true",
		DISABLE_RESOURCES: "true",
		BUN_RUNTIME_TRANSPILER_CACHE_PATH: "0",
		MCP_TOOL_CATALOG: "full",
	});
}

/** Create a mode with isolated HOME and no inherited wallet credentials. */
export async function createWalletModeFixture(
	mode: WalletMode,
): Promise<WalletModeFixture> {
	const home = mkdtempSync(join("/tmp", `bsv-mcp-${mode}-home-`));
	const env = baseEnvironment(home);
	let stubSigner: StubSigner | undefined;

	if (mode === "external") {
		stubSigner = startStubSigner();
		Object.assign(env, {
			BRC100_WALLET_URL: stubSigner.url,
			BRC100_WALLET_ORIGINATOR: "https://synthetic-agent.example",
		});
	} else {
		const paymentKey = PrivateKey.fromRandom();
		await createAccount(
			"default",
			{ payPk: paymentKey },
			testPassword,
			newAccountConfig("test", paymentKey.toAddress("testnet")),
			join(home, ".bsv-mcp", "accounts"),
		);
		Object.assign(env, {
			BSV_MCP_ACCOUNT: "default",
			BSV_MCP_PASSWORD: testPassword,
			BSV_CHAIN: "test",
		});
	}

	return {
		mode,
		home,
		env,
		stubSigner,
		cleanup: async () => {
			await stubSigner?.close();
			rmSync(home, { recursive: true, force: true });
		},
	};
}

/** Connect an MCP client to the built executable using one isolated fixture. */
export async function runWalletMode(
	executable: string,
	fixture: WalletModeFixture,
): Promise<RunningMcpWalletMode> {
	let stderr = "";
	const transport = new StdioClientTransport({
		command: process.execPath,
		args: [executable, "--stdio"],
		cwd: fixture.home,
		env: fixture.env,
		stderr: "pipe",
	});
	transport.stderr?.on("data", (chunk: Buffer | string) => {
		stderr += chunk.toString();
	});
	const client = new Client(
		{
			name: `synthetic-${fixture.mode}-client`,
			version: "1.0.0",
		},
		{ versionNegotiation: { mode: "auto" } },
	);
	try {
		await client.connect(transport);
	} catch (error) {
		await transport.close().catch(() => {});
		throw new Error(
			`Could not connect ${fixture.mode} MCP mode: ${error instanceof Error ? error.message : String(error)}\n${stderr}`,
		);
	}
	return {
		mode: fixture.mode,
		client,
		transport,
		stderr: () => stderr,
		close: async () => {
			await client.close().catch(() => {});
			await transport.close().catch(() => {});
		},
	};
}

export function textFromResult(result: {
	content: Array<{ type: string; text?: string }>;
}): string {
	const text = result.content.find((item) => item.type === "text")?.text;
	if (text === undefined) throw new Error("MCP result did not contain text");
	return text;
}

export function jsonFromResult<T>(result: {
	content: Array<{ type: string; text?: string }>;
}): T {
	return JSON.parse(textFromResult(result)) as T;
}

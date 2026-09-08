#!/usr/bin/env bun
/**
 * Measure MCP stdio startup and tools/list overhead for an executable.
 *
 * The benchmark deliberately uses only the MCP initialize/discovery and
 * tools/list exchanges. It never calls a tool, passes wallet configuration to
 * the child, or loads dotenv files itself.
 *
 * Example:
 *   bun run scripts/benchmark-mcp.ts -- bun --no-env-file dist/index.js --stdio
 *   bun run scripts/benchmark-mcp.ts --client both -- bun --no-env-file dist/index.js --stdio
 */

import {
	type ChildProcess,
	execFile as execFileCallback,
} from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, delimiter, join, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_RUNS = 1;

type ClientMode = "legacy" | "modern" | "both";

export interface BenchmarkOptions {
	client: ClientMode;
	runs: number;
	timeoutMs: number;
	json: boolean;
	cwd: string;
	extraEnv: Record<string, string>;
	clientRoots: string[];
}

export interface BenchmarkTarget {
	command: string;
	args: string[];
	cwd: string;
}

export interface BenchmarkSample {
	client: "legacy" | "modern";
	protocolEra?: "legacy" | "modern";
	negotiatedProtocolVersion?: string;
	startupMs: number;
	listMs: number;
	totalMs: number;
	toolCount: number;
	toolNames: string[];
	toolNamesJsonBytes: number;
	toolJsonBytes: number;
	listResponseBytes: number | null;
	stdinBytes: number;
	stdoutBytes: number;
	stderrBytes: number;
	pid: number | null;
	rssBytes: number | null;
	peakRssBytes: number | null;
}

export interface BenchmarkFailure {
	client: "legacy" | "modern";
	error: string;
}

export interface BenchmarkReport {
	target: BenchmarkTarget;
	options: {
		client: ClientMode;
		runs: number;
		timeoutMs: number;
		cleanEnvironment: true;
	};
	samples: BenchmarkSample[];
	failures: BenchmarkFailure[];
	warnings: string[];
}

interface TransportMetrics {
	stdinBytes: number;
	stdoutBytes: number;
	stderrBytes: number;
	listRequestIds: Set<string>;
	listResponseBytes: number | null;
	pid: number | null;
	rssBytes: number | null;
	peakRssBytes: number | null;
}

interface TransportMetricsSnapshot {
	stdinBytes: number;
	stdoutBytes: number;
	stderrBytes: number;
	listResponseBytes: number | null;
	pid: number | null;
	rssBytes: number | null;
	peakRssBytes: number | null;
}

interface InstrumentedTransport {
	transport: {
		start(): Promise<void>;
		send(message: unknown): Promise<void>;
		close(): Promise<void>;
		[key: string]: unknown;
	};
	metrics: TransportMetrics;
	stop(): TransportMetricsSnapshot;
}

interface ClientPackage {
	Client: new (
		info: { name: string; version: string },
		options?: Record<string, unknown>,
	) => {
		connect(
			transport: unknown,
			options?: Record<string, unknown>,
		): Promise<void>;
		listTools(
			params?: unknown,
			options?: Record<string, unknown>,
		): Promise<{ tools?: unknown[] }>;
		close(): Promise<void>;
		[key: string]: unknown;
	};
	StdioClientTransport: new (
		params: Record<string, unknown>,
	) => InstrumentedTransport["transport"];
}

function usage(): string {
	return `Usage: bun run scripts/benchmark-mcp.ts [options] -- <executable> [args...]

Measure a child MCP server's stdio initialize/discovery and tools/list overhead.
The child receives a clean environment, a temporary HOME, and read-only safety
flags. No MCP tool is called.

Options:
  --client legacy|modern|both  Client implementation to run (default: legacy)
  --runs N                     Repeat each selected client (default: 1)
  --timeout-ms N               Per MCP request timeout (default: 10000)
  --cwd PATH                   Child working directory (default: current directory)
  --env NAME=VALUE             Add a non-sensitive variable to the clean env
  --client-root PATH            Additional node_modules root for client packages
  --human                      Print a compact table instead of JSON
  --help                       Show this help

The v2 client is opt-in. Use --client modern or --client both. Put all target
arguments after the required -- separator so they are passed unchanged.`;
}

const RESERVED_ENV_NAMES = new Set([
	"HOME",
	"LOGNAME",
	"PATH",
	"SHELL",
	"TERM",
	"USER",
	"TMPDIR",
	"TMP",
	"TEMP",
	"TRANSPORT",
	"DISABLE_WALLET_TOOLS",
	"DISABLE_BROADCASTING",
	"MCP_BENCHMARK",
	"NODE_OPTIONS",
	"BUN_ENV",
	"BUN_CONFIG_FILE",
	"BUN_CONFIG_NO_ENV_FILE",
	"NPM_CONFIG_USERCONFIG",
	"npm_config_userconfig",
	"XDG_CONFIG_HOME",
	"XDG_DATA_HOME",
	"XDG_CACHE_HOME",
	"XDG_STATE_HOME",
]);

const SENSITIVE_ENV_NAME =
	/(?:WIF|MNEMONIC|PRIVATE|PASSWORD|PASSKEY|TOKEN|SECRET|VAULT|WALLET|CREDENTIAL|COOKIE|AUTH|DATABASE|KEY)/i;

function parsePositiveInteger(value: string, flag: string): number {
	if (!/^\d+$/.test(value)) {
		throw new Error(`${flag} requires a positive integer`);
	}
	const parsed = Number(value);
	if (!Number.isSafeInteger(parsed) || parsed < 1) {
		throw new Error(`${flag} requires a positive integer`);
	}
	return parsed;
}

function parseEnvEntry(value: string): [string, string] {
	const equal = value.indexOf("=");
	if (equal <= 0) {
		throw new Error(`--env requires NAME=VALUE: ${value}`);
	}
	const name = value.slice(0, equal);
	const variableValue = value.slice(equal + 1);
	if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
		throw new Error(`Invalid environment variable name: ${name}`);
	}
	if (RESERVED_ENV_NAMES.has(name) || SENSITIVE_ENV_NAME.test(name)) {
		throw new Error(`Refusing sensitive or reserved --env name: ${name}`);
	}
	return [name, variableValue];
}

export function parseArguments(argv: string[]): {
	options: BenchmarkOptions;
	target: string[];
	help: boolean;
} {
	const separator = argv.indexOf("--");
	// `bun run script -- target` consumes the separator when no script option
	// precedes it. Accept the first non-option as the target in that case while
	// still preserving all target arguments.
	let implicitTargetIndex = -1;
	if (separator === -1) {
		for (let index = 0; index < argv.length; index += 1) {
			const argument = argv[index];
			if (
				argument === "--client" ||
				argument === "--runs" ||
				argument === "--timeout-ms" ||
				argument === "--cwd" ||
				argument === "--env" ||
				argument === "--client-root"
			) {
				index += 1;
				continue;
			}
			if (!argument.startsWith("-")) {
				implicitTargetIndex = index;
				break;
			}
		}
	}
	const ownArguments =
		separator >= 0
			? argv.slice(0, separator)
			: implicitTargetIndex >= 0
				? argv.slice(0, implicitTargetIndex)
				: argv;
	const target =
		separator >= 0
			? argv.slice(separator + 1)
			: implicitTargetIndex >= 0
				? argv.slice(implicitTargetIndex)
				: [];
	const options: BenchmarkOptions = {
		client: "legacy",
		runs: DEFAULT_RUNS,
		timeoutMs: DEFAULT_TIMEOUT_MS,
		json: true,
		cwd: process.cwd(),
		extraEnv: {},
		clientRoots: [],
	};
	let help = false;

	for (let index = 0; index < ownArguments.length; index += 1) {
		const argument = ownArguments[index];
		switch (argument) {
			case "--help":
			case "-h":
				help = true;
				break;
			case "--human":
				options.json = false;
				break;
			case "--client": {
				const value = ownArguments[++index];
				if (value !== "legacy" && value !== "modern" && value !== "both") {
					throw new Error("--client must be legacy, modern, or both");
				}
				options.client = value;
				break;
			}
			case "--runs":
				options.runs = parsePositiveInteger(
					ownArguments[++index] ?? "",
					"--runs",
				);
				break;
			case "--timeout-ms":
				options.timeoutMs = parsePositiveInteger(
					ownArguments[++index] ?? "",
					"--timeout-ms",
				);
				break;
			case "--cwd":
				options.cwd = resolve(ownArguments[++index] ?? "");
				break;
			case "--env": {
				const [name, value] = parseEnvEntry(ownArguments[++index] ?? "");
				options.extraEnv[name] = value;
				break;
			}
			case "--client-root":
				options.clientRoots.push(resolve(ownArguments[++index] ?? ""));
				break;
			default:
				throw new Error(`Unknown benchmark option: ${argument}`);
		}
	}

	if (
		!help &&
		(target.length === 0 || (separator === -1 && implicitTargetIndex < 0))
	) {
		throw new Error(`A target executable is required after --\n\n${usage()}`);
	}
	return { options, target, help };
}

function makeTarget(targetArguments: string[], cwd: string): BenchmarkTarget {
	const [command, ...args] = targetArguments;
	return { command, args, cwd };
}

function cleanEnvironment(
	sandbox: string,
	extraEnv: Record<string, string>,
): Record<string, string> {
	const pathValue = process.env.PATH ?? "/usr/bin:/bin";
	return {
		PATH: pathValue,
		HOME: sandbox,
		TMPDIR: sandbox,
		TMP: sandbox,
		TEMP: sandbox,
		XDG_CONFIG_HOME: sandbox,
		XDG_DATA_HOME: sandbox,
		XDG_CACHE_HOME: sandbox,
		XDG_STATE_HOME: sandbox,
		LANG: process.env.LANG ?? "C",
		LC_ALL: process.env.LC_ALL ?? "C",
		TERM: process.env.TERM ?? "dumb",
		NO_COLOR: "1",
		TRANSPORT: "stdio",
		DISABLE_WALLET_TOOLS: "true",
		DISABLE_BROADCASTING: "true",
		MCP_BENCHMARK: "1",
		...extraEnv,
	};
}

function targetArgsWithNoDotenv(command: string, args: string[]): string[] {
	const commandName = basename(command).toLowerCase();
	if (
		(commandName === "bun" || commandName === "bun.exe") &&
		!args.includes("--no-env-file")
	) {
		return ["--no-env-file", ...args];
	}
	return args;
}

function packageRoots(additionalRoots: string[]): string[] {
	const scriptRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
	const configured =
		process.env.MCP_BENCHMARK_NODE_MODULES?.split(delimiter).filter(Boolean) ??
		[];
	const inheritedNodePath =
		process.env.NODE_PATH?.split(delimiter).filter(Boolean) ?? [];
	return [
		...new Set([
			...additionalRoots,
			...configured,
			...inheritedNodePath,
			resolve(process.cwd(), "node_modules"),
			resolve(scriptRoot, "node_modules"),
			"/Users/satchmo/.codex/worktrees/bsv-mcp-v2-integration/node_modules",
		]),
	];
}

async function loadLegacyClient(roots: string[]): Promise<ClientPackage> {
	const client = (await import(
		moduleFile(roots, "@modelcontextprotocol/sdk", "dist/esm/client/index.js")
	)) as Record<string, unknown>;
	const stdio = (await import(
		moduleFile(roots, "@modelcontextprotocol/sdk", "dist/esm/client/stdio.js")
	)) as Record<string, unknown>;
	if (
		typeof client.Client !== "function" ||
		typeof stdio.StdioClientTransport !== "function"
	) {
		throw new Error(
			"Legacy MCP SDK does not expose Client and StdioClientTransport",
		);
	}
	return {
		Client: client.Client as ClientPackage["Client"],
		StdioClientTransport:
			stdio.StdioClientTransport as ClientPackage["StdioClientTransport"],
	};
}

async function loadModernClient(roots: string[]): Promise<ClientPackage> {
	const client = (await import(
		moduleFile(roots, "@modelcontextprotocol/client", "dist/index.mjs")
	)) as Record<string, unknown>;
	const stdio = (await import(
		moduleFile(roots, "@modelcontextprotocol/client", "dist/stdio.mjs")
	)) as Record<string, unknown>;
	if (
		typeof client.Client !== "function" ||
		typeof stdio.StdioClientTransport !== "function"
	) {
		throw new Error(
			"Modern MCP client does not expose Client and StdioClientTransport",
		);
	}
	return {
		Client: client.Client as ClientPackage["Client"],
		StdioClientTransport:
			stdio.StdioClientTransport as ClientPackage["StdioClientTransport"],
	};
}

function moduleFile(
	roots: string[],
	packageName: string,
	relativePath: string,
): string {
	for (const root of roots) {
		const candidate = join(root, packageName, relativePath);
		if (existsSync(candidate)) return pathToFileURL(candidate).href;
	}
	throw new Error(`Cannot find ${packageName}; searched ${roots.join(", ")}`);
}

function requestIdKey(id: unknown): string {
	return JSON.stringify(id);
}

function attachTransportMetrics(
	transport: InstrumentedTransport["transport"],
): InstrumentedTransport {
	const metrics: TransportMetrics = {
		stdinBytes: 0,
		stdoutBytes: 0,
		stderrBytes: 0,
		listRequestIds: new Set(),
		listResponseBytes: null,
		pid: null,
		rssBytes: null,
		peakRssBytes: null,
	};
	let frameBuffer: Buffer<ArrayBufferLike> = Buffer.alloc(0);
	let rssTimer: ReturnType<typeof setInterval> | undefined;
	let stdoutListener:
		| ((chunk: Buffer | Uint8Array | string) => void)
		| undefined;
	let stderrListener:
		| ((chunk: Buffer | Uint8Array | string) => void)
		| undefined;
	let childProcess: ChildProcess | undefined;
	let stdoutStream: NonNullable<ChildProcess["stdout"]> | undefined;
	let stderrStream: NonNullable<ChildProcess["stderr"]> | undefined;
	let metricsActive = true;
	let frozenMetrics: TransportMetricsSnapshot | undefined;

	const readRss = async (): Promise<number | null> => {
		if (metrics.pid === null) return null;
		try {
			const { stdout } = await execFile(
				"ps",
				["-o", "rss=", "-p", String(metrics.pid)],
				{ maxBuffer: 32 * 1024 },
			);
			const kib = Number(stdout.trim());
			return Number.isFinite(kib) && kib > 0 ? kib * 1024 : null;
		} catch {
			return null;
		}
	};

	const sampleRss = async (): Promise<void> => {
		if (!metricsActive) return;
		const rss = await readRss();
		if (!metricsActive || rss === null) return;
		metrics.rssBytes = rss;
		metrics.peakRssBytes = Math.max(metrics.peakRssBytes ?? 0, rss);
	};

	const processFrame = (frame: Buffer): void => {
		const withoutCarriageReturn =
			frame[frame.length - 1] === 13 ? frame.subarray(0, -1) : frame;
		let message: Record<string, unknown>;
		try {
			message = JSON.parse(withoutCarriageReturn.toString("utf8")) as Record<
				string,
				unknown
			>;
		} catch {
			return;
		}
		const id = message.id;
		if (
			id !== undefined &&
			metrics.listRequestIds.has(requestIdKey(id)) &&
			metrics.listResponseBytes === null
		) {
			// `frame` excludes the LF delimiter; include it in the wire count.
			metrics.listResponseBytes = frame.length + 1;
		}
	};

	const originalStart = transport.start.bind(transport);
	transport.start = async (): Promise<void> => {
		if (!metricsActive)
			throw new Error("MCP transport was closed before start");
		await originalStart();
		childProcess = (transport as unknown as { _process?: ChildProcess })
			._process;
		if (!metricsActive) {
			await transport.close().catch(() => {});
			throw new Error("MCP transport was closed before start completed");
		}
		metrics.pid = childProcess?.pid ?? null;
		const stdout = childProcess?.stdout;
		stdoutStream = stdout ?? undefined;
		if (stdout) {
			stdoutListener = (chunk) => {
				if (!metricsActive) return;
				const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
				metrics.stdoutBytes += bytes.length;
				frameBuffer =
					frameBuffer.length === 0
						? bytes
						: Buffer.concat([frameBuffer, bytes]);
				while (true) {
					const newline = frameBuffer.indexOf(10);
					if (newline === -1) break;
					processFrame(frameBuffer.subarray(0, newline));
					frameBuffer = frameBuffer.subarray(newline + 1);
				}
			};
			stdout.on("data", stdoutListener);
		}
		const stderr = childProcess?.stderr;
		stderrStream = stderr ?? undefined;
		if (stderr) {
			stderrListener = (chunk) => {
				if (!metricsActive) return;
				metrics.stderrBytes += Buffer.isBuffer(chunk)
					? chunk.length
					: Buffer.byteLength(String(chunk));
			};
			stderr.on("data", stderrListener);
		}
		void sampleRss();
		rssTimer = setInterval(() => void sampleRss(), 25);
		if (typeof (rssTimer as { unref?: () => void }).unref === "function") {
			(rssTimer as { unref: () => void }).unref();
		}
	};

	const originalSend = transport.send.bind(transport);
	transport.send = async (message: unknown): Promise<void> => {
		const wire = `${JSON.stringify(message)}\n`;
		if (metricsActive) {
			metrics.stdinBytes += Buffer.byteLength(wire, "utf8");
			if (typeof message === "object" && message !== null) {
				const record = message as { method?: unknown; id?: unknown };
				if (record.method === "tools/list" && record.id !== undefined) {
					metrics.listRequestIds.add(requestIdKey(record.id));
				}
			}
		}
		await originalSend(message);
	};

	const stop = (): TransportMetricsSnapshot => {
		if (frozenMetrics) return frozenMetrics;
		metricsActive = false;
		if (rssTimer !== undefined) clearInterval(rssTimer);
		if (stdoutListener && stdoutStream)
			stdoutStream.off("data", stdoutListener);
		if (stderrListener && stderrStream)
			stderrStream.off("data", stderrListener);
		frozenMetrics = {
			stdinBytes: metrics.stdinBytes,
			stdoutBytes: metrics.stdoutBytes,
			stderrBytes: metrics.stderrBytes,
			listResponseBytes: metrics.listResponseBytes,
			pid: metrics.pid,
			rssBytes: metrics.rssBytes,
			peakRssBytes: metrics.peakRssBytes,
		};
		return frozenMetrics;
	};

	const originalClose = transport.close.bind(transport);
	transport.close = async (): Promise<void> => {
		stop();
		await originalClose();
	};

	return { transport, metrics, stop };
}

async function withCleanParentDefaults<T>(
	sandbox: string,
	callback: () => Promise<T>,
): Promise<T> {
	const inheritedNames = ["HOME", "LOGNAME", "PATH", "SHELL", "TERM", "USER"];
	const previous = new Map<string, string | undefined>();
	const safeDefaults: Record<string, string> = {
		PATH: process.env.PATH ?? "/usr/bin:/bin",
		HOME: sandbox,
		TMPDIR: sandbox,
		TMP: sandbox,
		TEMP: sandbox,
		LANG: process.env.LANG ?? "C",
		LC_ALL: process.env.LC_ALL ?? "C",
		TERM: process.env.TERM ?? "dumb",
	};
	for (const name of inheritedNames) {
		previous.set(name, process.env[name]);
		if (safeDefaults[name] === undefined) delete process.env[name];
		else process.env[name] = safeDefaults[name];
	}
	try {
		return await callback();
	} finally {
		for (const name of inheritedNames) {
			const value = previous.get(name);
			if (value === undefined) delete process.env[name];
			else process.env[name] = value;
		}
	}
}

function withTimeout<T>(
	promise: Promise<T>,
	timeoutMs: number,
	operation: string,
): Promise<T> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	const timeout = new Promise<never>((_, reject) => {
		timer = setTimeout(
			() => reject(new Error(`${operation} timed out after ${timeoutMs}ms`)),
			timeoutMs,
		);
	});
	return Promise.race([promise, timeout]).finally(() => {
		if (timer !== undefined) clearTimeout(timer);
	});
}

function errorMessage(error: unknown): string {
	if (error instanceof Error) return error.message;
	return String(error);
}

async function runSample(
	clientMode: "legacy" | "modern",
	clientPackage: ClientPackage,
	target: BenchmarkTarget,
	options: BenchmarkOptions,
): Promise<BenchmarkSample> {
	const sandbox = await mkdtemp(join(tmpdir(), "mcp-benchmark-"));
	const env = cleanEnvironment(sandbox, options.extraEnv);
	const targetArgs = targetArgsWithNoDotenv(target.command, target.args);
	let instrumented: InstrumentedTransport | undefined;
	let client:
		| {
				connect(
					transport: unknown,
					options?: Record<string, unknown>,
				): Promise<void>;
				listTools(
					params?: unknown,
					options?: Record<string, unknown>,
				): Promise<{ tools?: unknown[] }>;
				close(): Promise<void>;
				[key: string]: unknown;
		  }
		| undefined;
	let connectPromise: Promise<void> | undefined;
	const startedAt = performance.now();
	let connectedAt = startedAt;
	let listedAt = startedAt;

	try {
		const clientOptions: Record<string, unknown> = {};
		if (clientMode === "modern") {
			clientOptions.versionNegotiation = {
				mode: "auto",
				probe: { timeoutMs: options.timeoutMs, maxRetries: 0 },
			};
		}
		client = new clientPackage.Client(
			{ name: "mcp-overhead-benchmark", version: "1.0.0" },
			clientOptions,
		);
		const transport = new clientPackage.StdioClientTransport({
			command: target.command,
			args: targetArgs,
			env,
			cwd: target.cwd,
			stderr: "pipe",
		});
		instrumented = attachTransportMetrics(transport);
		const connectedClient = client;
		const connectedTransport = instrumented;
		if (!connectedClient || !connectedTransport)
			throw new Error("MCP client transport was not initialized");
		connectPromise = withCleanParentDefaults(sandbox, () =>
			connectedClient.connect(connectedTransport.transport, {
				timeout: options.timeoutMs,
			}),
		);
		await withTimeout(connectPromise, options.timeoutMs, "MCP connect");
		connectedAt = performance.now();
		const listed = await withTimeout(
			client.listTools(undefined, { timeout: options.timeoutMs }),
			options.timeoutMs,
			"tools/list",
		);
		listedAt = performance.now();
		const measuredMetrics = instrumented.stop();
		const tools = Array.isArray(listed.tools) ? listed.tools : [];
		const toolNames = tools
			.map((tool) =>
				typeof tool === "object" &&
				tool !== null &&
				typeof (tool as { name?: unknown }).name === "string"
					? (tool as { name: string }).name
					: null,
			)
			.filter((name): name is string => name !== null);
		const toolJson = JSON.stringify(tools);
		const namesJson = JSON.stringify(toolNames);
		const getProtocolEra = client.getProtocolEra;
		const getNegotiatedProtocolVersion = client.getNegotiatedProtocolVersion;
		const protocolEra =
			typeof getProtocolEra === "function"
				? (getProtocolEra as () => "legacy" | "modern" | undefined).call(client)
				: undefined;
		const negotiatedProtocolVersion =
			typeof getNegotiatedProtocolVersion === "function"
				? (getNegotiatedProtocolVersion as () => string | undefined).call(
						client,
					)
				: undefined;

		const sample: BenchmarkSample = {
			client: clientMode,
			startupMs: roundMilliseconds(connectedAt - startedAt),
			listMs: roundMilliseconds(listedAt - connectedAt),
			totalMs: roundMilliseconds(listedAt - startedAt),
			toolCount: toolNames.length,
			toolNames,
			toolNamesJsonBytes: Buffer.byteLength(namesJson, "utf8"),
			toolJsonBytes: Buffer.byteLength(toolJson, "utf8"),
			listResponseBytes: measuredMetrics.listResponseBytes,
			stdinBytes: measuredMetrics.stdinBytes,
			stdoutBytes: measuredMetrics.stdoutBytes,
			stderrBytes: measuredMetrics.stderrBytes,
			pid: measuredMetrics.pid,
			rssBytes: measuredMetrics.rssBytes,
			peakRssBytes: measuredMetrics.peakRssBytes,
		};
		if (protocolEra !== undefined) sample.protocolEra = protocolEra;
		if (negotiatedProtocolVersion !== undefined)
			sample.negotiatedProtocolVersion = negotiatedProtocolVersion;
		return sample;
	} finally {
		instrumented?.stop();
		// Closing the transport directly also cancels modern version negotiation
		// before Client has attached it. Await the connect operation before
		// restoring parent defaults or removing its temporary sandbox.
		if (instrumented) {
			try {
				await instrumented.transport.close();
			} catch {
				// Cleanup remains best effort after a failed sample.
			}
		}
		if (connectPromise) {
			try {
				await connectPromise;
			} catch {
				// The sample's original error is reported below.
			}
		}
		if (client) {
			try {
				await client.close();
			} catch {
				// The first close attempt is allowed to time out; cleanup remains best effort.
			}
		}
		await rm(sandbox, { recursive: true, force: true });
	}
}

function roundMilliseconds(value: number): number {
	return Math.round(value * 100) / 100;
}

function selectedClients(client: ClientMode): Array<"legacy" | "modern"> {
	return client === "both" ? ["legacy", "modern"] : [client];
}

function summarizeSamples(
	samples: BenchmarkSample[],
): Record<string, Record<string, number | null>> {
	const summary: Record<string, Record<string, number | null>> = {};
	for (const mode of ["legacy", "modern"] as const) {
		const modeSamples = samples.filter((sample) => sample.client === mode);
		if (modeSamples.length === 0) continue;
		const median = (
			field:
				| "startupMs"
				| "listMs"
				| "totalMs"
				| "toolJsonBytes"
				| "peakRssBytes",
		): number | null => {
			const values = modeSamples
				.map((sample) => sample[field])
				.filter((value): value is number => typeof value === "number")
				.sort((a, b) => a - b);
			if (values.length === 0) return null;
			const middle = Math.floor(values.length / 2);
			const result =
				values.length % 2 === 0
					? (values[middle - 1] + values[middle]) / 2
					: values[middle];
			return field.endsWith("Ms") ? roundMilliseconds(result) : result;
		};
		summary[mode] = {
			startupMsMedian: median("startupMs"),
			listMsMedian: median("listMs"),
			totalMsMedian: median("totalMs"),
			toolJsonBytesMedian: median("toolJsonBytes"),
			peakRssBytesMedian: median("peakRssBytes"),
		};
	}
	return summary;
}

function printHuman(report: BenchmarkReport): void {
	console.log(
		`target: ${report.target.command} ${report.target.args.join(" ")}`,
	);
	console.log(`cwd: ${report.target.cwd}`);
	console.log(
		"client\tstartup ms\tlist ms\ttotal ms\ttools\ttool JSON B\tlist response B\tpeak RSS B",
	);
	for (const sample of report.samples) {
		console.log(
			[
				sample.client,
				sample.startupMs,
				sample.listMs,
				sample.totalMs,
				sample.toolCount,
				sample.toolJsonBytes,
				sample.listResponseBytes ?? "n/a",
				sample.peakRssBytes ?? "n/a",
			].join("\t"),
		);
	}
	for (const failure of report.failures)
		console.error(`${failure.client}: ${failure.error}`);
	for (const warning of report.warnings) console.error(`warning: ${warning}`);
}

export async function benchmark(
	target: BenchmarkTarget,
	options: BenchmarkOptions,
): Promise<BenchmarkReport> {
	const roots = packageRoots(options.clientRoots);
	const report: BenchmarkReport = {
		target,
		options: {
			client: options.client,
			runs: options.runs,
			timeoutMs: options.timeoutMs,
			cleanEnvironment: true,
		},
		samples: [],
		failures: [],
		warnings: [],
	};

	let legacy: ClientPackage | undefined;
	let modern: ClientPackage | undefined;
	for (const clientMode of selectedClients(options.client)) {
		let clientPackage: ClientPackage;
		try {
			if (clientMode === "legacy") legacy ??= await loadLegacyClient(roots);
			else modern ??= await loadModernClient(roots);
			const loaded = clientMode === "legacy" ? legacy : modern;
			if (!loaded) throw new Error(`${clientMode} client was not initialized`);
			clientPackage = loaded;
		} catch (error) {
			if (options.client === "both" && clientMode === "modern") {
				report.warnings.push(
					`Modern client unavailable; legacy samples were retained: ${errorMessage(error)}`,
				);
				continue;
			}
			throw new Error(
				`${clientMode} client could not be loaded: ${errorMessage(error)}`,
			);
		}
		for (let run = 0; run < options.runs; run += 1) {
			try {
				report.samples.push(
					await runSample(clientMode, clientPackage, target, options),
				);
			} catch (error) {
				report.failures.push({
					client: clientMode,
					error: errorMessage(error),
				});
				break;
			}
		}
	}
	return report;
}

async function main(): Promise<void> {
	try {
		const parsed = parseArguments(process.argv.slice(2));
		if (parsed.help) {
			console.log(usage());
			return;
		}
		const report = await benchmark(
			makeTarget(parsed.target, parsed.options.cwd),
			parsed.options,
		);
		if (parsed.options.json) {
			console.log(
				JSON.stringify(
					{ ...report, summary: summarizeSamples(report.samples) },
					null,
					2,
				),
			);
		} else {
			printHuman(report);
		}
		if (report.samples.length === 0 || report.failures.length > 0)
			process.exitCode = 1;
	} catch (error) {
		console.error(errorMessage(error));
		process.exitCode = 1;
	}
}

if (import.meta.main) await main();

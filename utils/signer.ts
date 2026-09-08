import { chmodSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createNodeWallet } from "@1sat/wallet-node";
import { HTTPWalletJSON } from "@bsv/sdk";
import {
	accountDir,
	readAccount,
	regularPath,
	secureDirectory,
} from "./accounts";
import { onesatUrl } from "./backends";
import { SecureKeyManager } from "./keyManager";
import { confirm, terminalInput } from "./terminal";

export function signerRequestAllowed(
	request: Request,
	token: string,
	allowed: Set<string>,
) {
	const parts = new URL(request.url).pathname.split("/");
	const method = parts.length === 3 ? parts[2] : undefined;
	return request.method === "POST" &&
		parts.length === 3 &&
		parts[1] === token &&
		request.headers.get("origin") === "http://bsv-mcp.local" &&
		method !== undefined &&
		allowed.has(method)
		? method
		: undefined;
}
export function signerChildEnvironment(
	url: string,
	env: Record<string, string | undefined> = process.env,
) {
	const child: Record<string, string | undefined> = {
		...env,
		TRANSPORT: "stdio",
		BRC100_WALLET_URL: url,
		BRC100_WALLET_ORIGINATOR: "bsv-mcp.local",
	};
	for (const name of Object.keys(child))
		if (
			name.startsWith("PRIVATE_KEY_WIF") ||
			name.startsWith("IDENTITY_KEY_WIF") ||
			[
				"BSV_MCP_PASSWORD",
				"BSV_MCP_PASSPHRASE",
				"ONESAT_PASSWORD",
				"USE_DROPLIT_API",
			].includes(name)
		)
			delete child[name];
	return child;
}
/** Own the signer and MCP child together; no reusable bearer URL is written or printed. */
export async function serveSigner(name: string) {
	const config = readAccount(name);
	if (!config)
		throw new Error("Account is not initialized; run bsv-mcp init first");
	if (
		process.env.PRIVATE_KEY_WIF ||
		process.env.IDENTITY_KEY_WIF ||
		process.env.BRC100_WALLET_URL
	)
		throw new Error(
			"signer-serve selects a named encrypted account; remove local key and external-signer overrides",
		);
	const password =
		process.env.BSV_MCP_PASSWORD ??
		(await terminalInput("Account password", true));
	const keys = await new SecureKeyManager({
		keyDir: accountDir(name),
	}).loadEncryptedKeys(password);
	if (!keys.payPk) throw new Error("Account has no payment key");
	const dir = accountDir(name);
	secureDirectory(dir);
	const filename = join(dir, `wallet-${config.chain}.db`);
	regularPath(filename);
	const previousMask = process.umask(0o077);
	const result = await createNodeWallet({
		privateKey: keys.payPk,
		chain: config.chain,
		storageIdentityKey: config.storageIdentityKey,
		storage: { provider: "bun-sqlite", filename },
		activeRemote: config.activeRemote,
		backups: config.backups,
		servicesBaseUrl: onesatUrl(config.chain),
		skipInitialMonitor: true,
	}).finally(() => process.umask(previousMask));
	if (existsSync(filename)) chmodSync(filename, 0o600);
	if (existsSync(join(dir, ".env"))) {
		await result.destroy();
		throw new Error("Signer account directory must not contain a .env file");
	}
	const token = crypto.randomUUID();
	const allowed = new Set(
		Object.getOwnPropertyNames(HTTPWalletJSON.prototype).filter(
			(method) => method !== "constructor",
		),
	);
	let approving = false;
	const server = Bun.serve({
		hostname: "127.0.0.1",
		port: 0,
		maxRequestBodySize: 8 * 1024 * 1024,
		async fetch(request) {
			const method = signerRequestAllowed(request, token, allowed);
			if (!method) return new Response(null, { status: 403 });
			try {
				const args = await request.json();
				if (!args || typeof args !== "object" || Array.isArray(args))
					throw new Error("Invalid arguments");
				if (["createAction", "signAction"].includes(method)) {
					if (approving) throw new Error("Another approval is pending");
					approving = true;
					try {
						await confirm(
							`Signer account ${name}: approve ${method}? Review the requesting MCP tool and spending limit first`,
						);
					} finally {
						approving = false;
					}
				}
				const wallet = result.wallet as unknown as Record<
					string,
					(args: unknown, origin: string) => Promise<unknown>
				>;
				if (typeof wallet[method] !== "function")
					return new Response(null, { status: 404 });
				return Response.json(await wallet[method](args, "bsv-mcp.local"));
			} catch {
				return Response.json(
					{
						isError: true,
						code: "SIGNER_ERROR",
						message: "Signer request failed or approval was declined",
					},
					{ status: 400 },
				);
			}
		},
	});
	const entrypoint = process.argv[1];
	if (!entrypoint) {
		server.stop(true);
		await result.destroy();
		throw new Error("Could not determine the MCP server entrypoint");
	}
	const child = Bun.spawn(
		[process.execPath, "--no-env-file", entrypoint, "--stdio"],
		{
			cwd: dir,
			env: signerChildEnvironment(`http://127.0.0.1:${server.port}/${token}`),
			stdin: "inherit",
			stdout: "inherit",
			stderr: "inherit",
		},
	);
	let stopping = false;
	const stop = async () => {
		if (stopping) return;
		stopping = true;
		child.kill();
		server.stop(true);
		await result.destroy();
	};
	const signal = () => {
		void stop();
	};
	process.on("SIGINT", signal);
	process.on("SIGTERM", signal);
	try {
		process.exitCode = await child.exited;
	} finally {
		await stop();
		process.off("SIGINT", signal);
		process.off("SIGTERM", signal);
	}
}

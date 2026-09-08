import { afterEach, describe, expect, test } from "bun:test";
import {
	existsSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
	buildLaunchPlan,
	CONFLICTING_WALLET_ENV,
	inspectEmbeddedAccount,
	launch,
} from "./local-mcp-launcher";

const fixtures: string[] = [];
const serverBinary = resolve("dist/index.js");
const runtimePassword = "runtime-only-password";
const repoRoot = resolve(".");

function fixtureHome(): string {
	const home = join(tmpdir(), `bsv-mcp-launcher-test-${crypto.randomUUID()}`);
	fixtures.push(home);
	mkdirSync(home, { recursive: true, mode: 0o700 });
	return home;
}

function createEncryptedAccount(home: string, name = "embedded-test"): string {
	const account = join(home, ".bsv-mcp", "accounts", name);
	mkdirSync(account, { recursive: true, mode: 0o700 });
	writeFileSync(
		join(account, "config.json"),
		JSON.stringify({
			chain: "main",
			storageIdentityKey: "launcher-test",
			address: "1BoatSLRHtKNngkdXEeobR76b53LETtpyT",
			depositPrefix: "mcp",
		}),
	);
	writeFileSync(
		join(account, "keys.bep"),
		"encrypted sentinel that must not be read",
	);
	return account;
}

afterEach(() => {
	for (const fixture of fixtures.splice(0))
		rmSync(fixture, { recursive: true, force: true });
});

describe("embedded account preflight", () => {
	test("accepts only an existing config and encrypted backup", () => {
		const home = fixtureHome();
		expect(inspectEmbeddedAccount("embedded-test", home)).toEqual({
			name: "embedded-test",
			eligible: false,
			missing: ["config.json", "encrypted keys.bep"],
		});
		const account = createEncryptedAccount(home);
		const keyFile = join(account, "keys.bep");
		const before = readFileSync(keyFile, "utf8");
		expect(inspectEmbeddedAccount("embedded-test", home)).toEqual({
			name: "embedded-test",
			eligible: true,
			missing: [],
		});
		expect(readFileSync(keyFile, "utf8")).toBe(before);
	});

	test("rejects an invalid account name without touching account paths", () => {
		const home = fixtureHome();
		expect(() => inspectEmbeddedAccount("../escape", home)).toThrow(
			"Invalid BSV_MCP_ACCOUNT",
		);
		expect(existsSync(join(home, ".bsv-mcp"))).toBe(false);
	});
});

describe("two-mode launch plans", () => {
	test("external mode uses the signer and removes every inherited local selector", () => {
		const desiredUrl = "http://127.0.0.1:3321";
		const inherited: Record<string, string> = {
			PATH: "/usr/bin",
			HOME: "/repo-from-dotenv",
			DOTENV_SENTINEL: "must-not-cross-process",
			BRC100_WALLET_URL: "http://127.0.0.1:9999",
			BRC100_WALLET_ORIGINATOR: "inherited.example",
			PRIVATE_KEY_WIF: "inherited-private-key",
			IDENTITY_KEY_WIF: "inherited-identity-key",
			BSV_MCP_ACCOUNT: "inherited-account",
			BSV_MCP_PASSWORD: "inherited-password",
			BSV_MCP_PASSPHRASE: "inherited-passphrase",
			USE_DROPLIT_API: "true",
			REMOTE_STORAGE_URL: "https://storage.example",
			BSV_CHAIN: "test",
			VAULT_PATH: "/tmp/vault",
		};
		const plan = buildLaunchPlan(
			{
				mode: "external",
				serverBinary,
				workingDirectory: join(tmpdir(), "bsv-mcp-launcher-external-cwd"),
				externalWalletUrl: desiredUrl,
				externalOriginator: "bsv-mcp.local",
			},
			inherited,
		);

		expect(plan.mode).toBe("external");
		expect(plan.serverBinary).toBe(serverBinary);
		expect(plan.args).toEqual(["--no-env-file", serverBinary, "--stdio"]);
		expect(plan.cwd).not.toBe(repoRoot);
		expect(plan.cwd.startsWith(`${repoRoot}/`)).toBe(false);
		expect(plan.env.BRC100_WALLET_URL).toBe(desiredUrl);
		expect(plan.env.BRC100_WALLET_ORIGINATOR).toBe("bsv-mcp.local");
		expect(plan.env.DOTENV_SENTINEL).toBeUndefined();
		for (const name of CONFLICTING_WALLET_ENV) {
			if (name === "BRC100_WALLET_URL" || name === "BRC100_WALLET_ORIGINATOR")
				continue;
			expect(plan.env[name]).toBeUndefined();
		}
		expect(plan.env.HOME).not.toBe(homedir());
	});

	test("embedded mode selects an existing account and injects only the runtime password", () => {
		const home = fixtureHome();
		createEncryptedAccount(home);
		const inherited: Record<string, string> = {
			PATH: "/usr/bin",
			DOTENV_SENTINEL: "must-not-cross-process",
			BRC100_WALLET_URL: "http://127.0.0.1:3321",
			BRC100_WALLET_ORIGINATOR: "inherited.example",
			PRIVATE_KEY_WIF: "inherited-private-key",
			IDENTITY_KEY_WIF: "inherited-identity-key",
			BSV_MCP_ACCOUNT: "wrong-account",
			BSV_MCP_PASSWORD: "wrong-password",
			BSV_MCP_PASSPHRASE: "inherited-passphrase",
			USE_DROPLIT_API: "true",
			REMOTE_STORAGE_URL: "https://storage.example",
			BSV_CHAIN: "test",
			VAULT_PATH: "/tmp/vault",
		};
		const plan = buildLaunchPlan(
			{
				mode: "embedded",
				accountName: "embedded-test",
				runtimePassword,
				homeDirectory: home,
				serverBinary,
				workingDirectory: join(tmpdir(), "bsv-mcp-launcher-embedded-cwd"),
			},
			inherited,
		);

		expect(plan.mode).toBe("embedded");
		expect(plan.serverBinary).toBe(serverBinary);
		expect(plan.args).toEqual(["--no-env-file", serverBinary, "--stdio"]);
		expect(plan.env.HOME).toBe(home);
		expect(plan.env.BSV_MCP_ACCOUNT).toBe("embedded-test");
		expect(plan.env.BSV_MCP_PASSWORD).toBe(runtimePassword);
		expect(plan.args.join(" ")).not.toContain(runtimePassword);
		expect(JSON.stringify(plan.args)).not.toContain(runtimePassword);
		expect(plan.env.DOTENV_SENTINEL).toBeUndefined();
		for (const name of CONFLICTING_WALLET_ENV) {
			if (name === "BSV_MCP_ACCOUNT" || name === "BSV_MCP_PASSWORD") continue;
			expect(plan.env[name]).toBeUndefined();
		}
		expect(plan.env.BSV_MCP_PASSPHRASE).toBeUndefined();
	});

	test("refuses missing accounts and missing runtime passwords without creating setup files", () => {
		const home = fixtureHome();
		expect(() =>
			buildLaunchPlan(
				{
					mode: "embedded",
					accountName: "missing",
					runtimePassword,
					homeDirectory: home,
					serverBinary,
				},
				{},
			),
		).toThrow("never creates or migrates accounts");
		expect(existsSync(join(home, ".bsv-mcp"))).toBe(false);

		createEncryptedAccount(home, "ready");
		expect(() =>
			buildLaunchPlan(
				{
					mode: "embedded",
					accountName: "ready",
					homeDirectory: home,
					serverBinary,
				},
				{},
			),
		).toThrow("BSV_MCP_PASSWORD at launcher runtime");
	});

	test("rejects repository working directories", () => {
		expect(() =>
			buildLaunchPlan({
				mode: "external",
				externalWalletUrl: "http://127.0.0.1:3321",
				serverBinary,
				workingDirectory: repoRoot,
			}),
		).toThrow("outside the BSV MCP checkout");
	});

	test("uses one canonical binary and forwards its exit code", async () => {
		const root = fixtureHome();
		const fakeServer = join(root, "server-exit.ts");
		writeFileSync(fakeServer, "process.exit(17);\n");
		const plan = buildLaunchPlan({
			mode: "external",
			externalWalletUrl: "http://127.0.0.1:3321",
			serverBinary: fakeServer,
			bunExecutable: process.execPath,
			workingDirectory: join(root, "cwd"),
			homeDirectory: join(root, "home"),
		});
		expect(await launch(plan)).toBe(17);
		expect(existsSync(join(root, "cwd"))).toBe(true);
		expect(existsSync(join(root, "home"))).toBe(true);
	});

	test("launches embedded mode with runtime-only password injection", async () => {
		const root = fixtureHome();
		createEncryptedAccount(root, "ready");
		const fakeServer = join(root, "server-checks-env.ts");
		writeFileSync(
			fakeServer,
			"const ok = process.env.BSV_MCP_ACCOUNT === 'ready' && process.env.BSV_MCP_PASSWORD?.length === 21 && !process.argv.includes(process.env.BSV_MCP_PASSWORD ?? ''); process.exit(ok ? 19 : 20);\n",
		);
		const plan = buildLaunchPlan({
			mode: "embedded",
			accountName: "ready",
			runtimePassword,
			homeDirectory: root,
			serverBinary: fakeServer,
			bunExecutable: process.execPath,
			workingDirectory: join(root, "embedded-cwd"),
		});
		expect(await launch(plan)).toBe(19);
		expect(existsSync(join(root, "embedded-cwd"))).toBe(true);
	});
});

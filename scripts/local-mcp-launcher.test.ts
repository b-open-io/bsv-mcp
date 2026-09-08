import { afterEach, describe, expect, test } from "bun:test";
import {
	existsSync,
	mkdirSync,
	readFileSync,
	realpathSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
	buildLaunchPlan,
	CONFLICTING_WALLET_ENV,
	inspectEmbeddedAccount,
	launch,
	PROJECT_CONFIG_ENV,
	parseLauncherArguments,
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

describe("local launch plans", () => {
	test("project mode forwards only the explicit project and runtime Vault inputs", () => {
		const projectRoot = fixtureHome();
		const plan = buildLaunchPlan(
			{
				mode: "project",
				projectRoot,
				projectId: "project.example",
				runtimePassword,
				vaultPath: "/tmp/project-vault",
				serverBinary,
				workingDirectory: join(tmpdir(), "bsv-mcp-launcher-project-mode-cwd"),
			},
			{
				PATH: "/usr/bin",
				BRC100_WALLET_URL: "https://signer.example/rpc",
				BSV_MCP_ACCOUNT: "wrong-account",
				PRIVATE_KEY_WIF: "wrong-key",
			},
		);
		expect(plan.mode).toBe("project");
		expect(plan.env.BSV_MCP_PROJECT_ROOT).toBe(realpathSync(projectRoot));
		expect(plan.env.BSV_MCP_PROJECT_ID).toBe("project.example");
		expect(plan.env.BSV_MCP_PASSWORD).toBe(runtimePassword);
		expect(plan.env.VAULT_PATH).toBe("/tmp/project-vault");
		expect(plan.env.BRC100_WALLET_URL).toBeUndefined();
		expect(plan.env.BSV_MCP_ACCOUNT).toBeUndefined();
		expect(plan.env.PRIVATE_KEY_WIF).toBeUndefined();
	});

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
			BSV_MCP_PROJECT_ROOT: "/inherited/project",
			BSV_MCP_PROJECT_ID: "inherited-project",
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
			if (
				name === "BRC100_WALLET_URL" ||
				name === "BRC100_WALLET_ORIGINATOR" ||
				name === "BSV_CHAIN"
			)
				continue;
			expect(plan.env[name]).toBeUndefined();
		}
		for (const name of PROJECT_CONFIG_ENV)
			expect(plan.env[name]).toBeUndefined();
		expect(plan.env.HOME).not.toBe(homedir());
	});

	test("supports explicit project selectors in external and Vault modes", () => {
		const projectRoot = fixtureHome();
		const external = buildLaunchPlan({
			mode: "external",
			externalWalletUrl: "http://127.0.0.1:3321",
			projectRoot,
			projectId: "project.example:local",
			serverBinary,
		});
		expect(external.env.BSV_MCP_PROJECT_ROOT).toBe(realpathSync(projectRoot));
		expect(external.env.BRC100_WALLET_ORIGINATOR).toMatch(/^project-/);
		expect(external.env.BSV_MCP_PASSWORD).toBeUndefined();
		const plan = buildLaunchPlan({
			mode: "project",
			projectRoot,
			projectId: "project.example:local",
			runtimePassword,
			serverBinary,
			workingDirectory: join(tmpdir(), "bsv-mcp-launcher-project-cwd"),
		});
		expect(plan.projectRoot).toBe(realpathSync(projectRoot));
		expect(plan.projectId).toBe("project.example:local");
		expect(plan.env.BSV_MCP_PROJECT_ROOT).toBe(realpathSync(projectRoot));
		expect(plan.env.BSV_MCP_PROJECT_ID).toBe("project.example:local");
		expect(plan.cwd).not.toBe(resolve(projectRoot));
	});

	test("requires a complete project configuration and validates its contract", () => {
		const projectRoot = fixtureHome();
		const base = {
			mode: "external" as const,
			externalWalletUrl: "http://127.0.0.1:3321",
			serverBinary,
		};
		expect(() => buildLaunchPlan({ ...base, projectRoot })).toThrow(
			"configured together",
		);
		expect(() => buildLaunchPlan({ ...base, projectId: "project" })).toThrow(
			"configured together",
		);
		expect(() =>
			buildLaunchPlan({
				...base,
				projectRoot: "relative/project",
				projectId: "project",
			}),
		).toThrow("absolute path");
		expect(() =>
			buildLaunchPlan({ ...base, projectRoot, projectId: "bad project" }),
		).toThrow("identifier format");
		expect(() =>
			buildLaunchPlan({
				...base,
				projectRoot: join(projectRoot, "missing"),
				projectId: "project",
			}),
		).toThrow("existing directory");
		const alias = join(projectRoot, "alias");
		symlinkSync(projectRoot, alias);
		expect(() =>
			buildLaunchPlan({ ...base, projectRoot: alias, projectId: "project" }),
		).toThrow("real directory");
	});

	test("parses explicit project flags without accepting unknown or partial flags", () => {
		expect(
			parseLauncherArguments([
				"embedded",
				"--project-root",
				"/tmp/project",
				"--project-id",
				"project",
			]),
		).toEqual({
			mode: "embedded",
			projectRoot: "/tmp/project",
			projectId: "project",
		});
		expect(() =>
			parseLauncherArguments(["external", "--project-root"]),
		).toThrow("requires a value");
		expect(() => parseLauncherArguments(["external", "--unknown"])).toThrow(
			"Unknown launcher option",
		);
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

	test("rejects symlinked working directories that resolve into the checkout", () => {
		const home = fixtureHome();
		const alias = join(home, "repo-alias");
		symlinkSync(repoRoot, alias);

		expect(() =>
			buildLaunchPlan({
				mode: "external",
				externalWalletUrl: "http://127.0.0.1:3321",
				serverBinary,
				workingDirectory: join(alias, "runtime"),
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

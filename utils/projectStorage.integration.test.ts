import { expect, test } from "bun:test";
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

test("encrypted Vault project roles initialize real SDK storage, share roots and isolate children", async () => {
	const directory = realpathSync(mkdtempSync(join(tmpdir(), "bsv-project-storage-")));
	const child = Bun.spawn(
		[
			process.execPath,
			"--no-env-file",
			resolve("tests/helpers/project-storage-proof.ts"),
			directory,
		],
		{
			cwd: directory,
			env: { HOME: directory, PATH: process.env.PATH, NODE_ENV: "test" },
			stdout: "pipe",
			stderr: "pipe",
		},
	);
	const timer = setTimeout(() => child.kill(), 30_000);
	try {
		const [stdout, stderr, exit] = await Promise.all([
			new Response(child.stdout).text(),
			new Response(child.stderr).text(),
			child.exited,
		]);
		if (exit !== 0)
			throw new Error(
				`Project storage proof failed (${exit}): ${stderr}\n${stdout}`,
			);
		expect(stdout).toContain('"success":true');
		expect(stdout).toContain('"databaseCount":2');
		expect(stdout).toContain('"sharedRootSurvivesRoleLock":true');
	expect(stdout).toContain('"headlessIdentitySelection":true');
	expect(stdout).toContain('"headlessVaultDefaults":true');
	} finally {
		clearTimeout(timer);
		child.kill();
		await child.exited;
		rmSync(directory, { recursive: true, force: true });
	}
}, 35_000);

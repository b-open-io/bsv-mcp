import { expect, test } from "bun:test";
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("one setup session imports multiple wallets then activates distinct role keys", async () => {
	const home = realpathSync(mkdtempSync(join(tmpdir(), "multi-import-")));
	try {
		const child = Bun.spawn(
			[
				process.execPath,
				"--no-env-file",
				"-e",
				`
   const { createEmbeddedSetupActions } = await import(${JSON.stringify(join(import.meta.dir, "embeddedSetupActions.ts"))});
   const { listAccounts } = await import(${JSON.stringify(join(import.meta.dir, "accounts.ts"))});
   const { saveWalletRoleDefaults } = await import(${JSON.stringify(join(import.meta.dir, "walletRoleDefaults.ts"))});
   let activated = 0; let distinctRoles = false;

   const actions = createEmbeddedSetupActions({vaultPath: process.env.HOME + '/vault.bep', onActivated: async result => { try { activated++; const roles=result.roleContexts; const a=await roles.payments.wallet.getPublicKey({identityKey:true}, "admin.bsv-mcp.internal"); const b=await roles.identity.wallet.getPublicKey({identityKey:true}, "admin.bsv-mcp.internal"); distinctRoles=a.publicKey!==b.publicKey && roles.payments===roles.ordinals; await result.destroy(); } catch(error) {console.error(error); throw error;} }});
   const results = [];
   for (const name of ['first', 'second']) results.push(await actions.import({
    accountName:name, backupText:JSON.stringify({payPk:name === 'first' ? 'KwDiBf89QgGbjEhKnhXJuH7LrciVrZi3qYjgd9M7rFU73sVHnoWn' : 'KwDiBf89QgGbjEhKnhXJuH7LrciVrZi3qYjgd9M7rFU74NMTptX4'}),
    destinationPassphrase:'synthetic-test-password', passwordConfirmation:'synthetic-test-password', confirmation:'IMPORT_WALLET_CONFIRMED', activate:false
   }));
   const beforeActivation=activated;
   saveWalletRoleDefaults({payments:"first:payment",identity:"second:payment",ordinals:"first:payment"},0);
   await actions.unlock({accountName:"first",password:"synthetic-test-password"});
   console.log("RESULT="+JSON.stringify({results, beforeActivation, activated, distinctRoles, accounts:listAccounts().map(a=>a.name)}));
  `,
			],
			{
				cwd: home,
				env: { HOME: home, PATH: process.env.PATH ?? "" },
				stdout: "pipe",
				stderr: "pipe",
			},
		);
		const stdout = await new Response(child.stdout).text();
		const stderr = await new Response(child.stderr).text();
		expect(await child.exited, stderr).toBe(0);
		expect(stderr).not.toContain("Error");
		const result = JSON.parse(
			stdout
				.split("\n")
				.find((line) => line.startsWith("RESULT="))
				?.slice(7) ?? "null",
		);
		expect(result.beforeActivation).toBe(0);
		expect(result.activated).toBe(1);
		expect(result.distinctRoles).toBe(true);
		expect(result.accounts).toEqual(["first", "second"]);
		expect(
			result.results.map((r: { ready: boolean; saved: boolean }) => ({
				ready: r.ready,
				saved: r.saved,
			})),
		).toEqual([
			{ ready: false, saved: true },
			{ ready: false, saved: true },
		]);
	} finally {
		rmSync(home, { recursive: true, force: true });
	}
}, 30000);

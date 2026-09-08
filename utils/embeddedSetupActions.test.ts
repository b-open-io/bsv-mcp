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
   let activated = 0; let distinctRoles = false; let identitySignatureValid = false;

   const actions = createEmbeddedSetupActions({vaultPath: process.env.HOME + '/vault.bep', onActivated: async result => { try { activated++; const roles=result.roleContexts; const a=await roles.payments.wallet.getPublicKey({identityKey:true}); const b=await roles.identity.wallet.getPublicKey({identityKey:true}); distinctRoles=a.publicKey!==b.publicKey && roles.payments===roles.ordinals; const signing={data:[1,2,3],protocolID:[2,"bsv mcp test"],keyID:"fixture",counterparty:"self"}; const signature=await roles.identity.wallet.createSignature(signing); identitySignatureValid=(await roles.identity.wallet.verifySignature({...signing,...signature})).valid; await result.destroy(); } catch(error) {console.error(error); throw error;} }});
   const results = [];
   for (const name of ['first', 'second']) results.push(await actions.import({
    accountName:name, backupText:JSON.stringify({payPk:name === 'first' ? 'KwDiBf89QgGbjEhKnhXJuH7LrciVrZi3qYjgd9M7rFU73sVHnoWn' : 'KwDiBf89QgGbjEhKnhXJuH7LrciVrZi3qYjgd9M7rFU74NMTptX4'}),
    destinationPassphrase:'synthetic-test-password', passwordConfirmation:'synthetic-test-password', confirmation:'IMPORT_WALLET_CONFIRMED', activate:false
   }));
   const beforeActivation=activated;
   const {readFileSync}=await import("node:fs");
   const beforeVault=readFileSync(process.env.HOME + '/vault.bep');
   let wrongPasswordRejected=false; try {await actions.vaultKeys({password:"incorrect-password"});} catch {wrongPasswordRejected=true;}
   const inventory=await actions.vaultKeys({password:"synthetic-test-password"});
   const secondKey=inventory.keys.find(k=>k.publicKey === "02c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5");
   const key=secondKey ?? inventory.keys[1];
   let wrongPinRejected=false; try {await actions.linkKey({accountName:"bad-pin",password:"synthetic-test-password",vaultId:inventory.vaultId,entryId:key.entryId,publicKey:inventory.keys.find(k=>k.entryId!==key.entryId).publicKey});} catch {wrongPinRejected=true;}
   await actions.linkKey({accountName:"linked",password:"synthetic-test-password",vaultId:inventory.vaultId,entryId:key.entryId,publicKey:key.publicKey});
   let overwriteRejected=false; try {await actions.linkKey({accountName:"first",password:"synthetic-test-password",vaultId:inventory.vaultId,entryId:key.entryId,publicKey:key.publicKey});} catch {overwriteRejected=true;}
   const vaultUnchanged=beforeVault.equals(readFileSync(process.env.HOME + '/vault.bep'));

   saveWalletRoleDefaults({payments:"first:payment",identity:"linked:payment",ordinals:"first:payment"},0);
   await actions.unlock({accountName:"first",password:"synthetic-test-password"});
   console.log("RESULT="+JSON.stringify({results, beforeActivation, activated, distinctRoles, identitySignatureValid, wrongPasswordRejected, wrongPinRejected, overwriteRejected, vaultUnchanged, keyCount:inventory.keys.length, accounts:listAccounts().map(a=>a.name)}));
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
		expect(result.identitySignatureValid).toBe(true);
		expect(result.accounts).toEqual(["first", "linked", "second"]);
		expect(result.keyCount).toBe(2);
		expect(result.wrongPasswordRejected).toBe(true);
		expect(result.wrongPinRejected).toBe(true);
		expect(result.overwriteRejected).toBe(true);
		expect(result.vaultUnchanged).toBe(true);
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

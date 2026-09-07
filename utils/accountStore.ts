import { existsSync, renameSync, rmSync } from "node:fs";
import { join } from "node:path";
import {
	type AccountConfig,
	accountDir,
	accountsRoot,
	regularPath,
	secureDirectory,
	writeAccount,
} from "./accounts";
import { SecureKeyManager } from "./keyManager";
export async function createAccount(
	name: string,
	keys: Parameters<SecureKeyManager["saveKeys"]>[0],
	password: string,
	config: AccountConfig,
	root = accountsRoot(),
) {
	const dir = accountDir(name, root);
	regularPath(root, true);
	if (existsSync(dir))
		throw new Error("Account already exists; choose a different name");
	secureDirectory(root);
	const stage = join(root, `.setup-${crypto.randomUUID()}`);
	try {
		await new SecureKeyManager({ keyDir: stage }).saveKeys(keys, {
			passphrase: password,
		});
		// The staging directory name is internal; account names still pass the public validator.
		const stagingName = `setup-${crypto.randomUUID()}`;
		const ready = join(root, stagingName);
		renameSync(stage, ready);
		try {
			writeAccount(stagingName, config, root);
			if (existsSync(dir)) throw new Error("Account appeared during setup");
			renameSync(ready, dir);
		} catch (error) {
			rmSync(ready, { recursive: true, force: true });
			throw error;
		}
	} catch (error) {
		rmSync(stage, { recursive: true, force: true });
		throw error;
	}
}

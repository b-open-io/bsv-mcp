import {
	chmodSync,
	closeSync,
	existsSync,
	fsyncSync,
	openSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { P1SAT_PROTOCOL } from "@1sat/actions";
import { PrivateKey, ProtoWallet, PublicKey } from "@bsv/sdk";
import { createAccount } from "./accountStore";
import {
	type AccountConfig,
	accountDir,
	accountName,
	accountsRoot,
	listAccounts,
	newAccountConfig,
	readAccount,
	regularPath,
} from "./accounts";

export { createAccount } from "./accountStore";

import { backendUrl, onesatUrl } from "./backends";
import { SecureKeyManager } from "./keyManager";
import { confirm, newPassword, terminalInput } from "./terminal";

/** Best-effort overwrite, not a guarantee on SSDs, snapshots, or copy-on-write filesystems. */
export function erasePlaintext(file: string) {
	regularPath(file);
	const fd = openSync(file, "r+");
	try {
		const size = readFileSync(fd).length;
		const zeros = new Uint8Array(Math.min(size, 65536));
		for (let offset = 0; offset < size; offset += zeros.length)
			writeSync(fd, zeros, 0, Math.min(zeros.length, size - offset), offset);
		fsyncSync(fd);
	} finally {
		closeSync(fd);
	}
	rmSync(file);
}
export async function migrateAccount(
	name: string,
	source: "legacy" | "sigma-lab",
	password: string,
	root = accountsRoot(),
	sourceDir = source === "legacy"
		? join(homedir(), ".bsv-mcp")
		: join(homedir(), ".local/share/sigma-brc169-lab"),
) {
	const sourceFile = join(
		sourceDir,
		source === "legacy" ? "keys.json" : "root.wif",
	);
	const target = accountDir(name, root);
	const expectedStorage = source === "legacy" ? "bsv-mcp" : "sigma-brc169-lab";
	const verifyDestination = () => {
		const config = readAccount(name, root);
		if (
			!config ||
			config.storageIdentityKey !== expectedStorage ||
			config.chain !== "main" ||
			(source === "sigma-lab" && !existsSync(join(target, "wallet-main.db")))
		)
			throw new Error(
				"Incomplete migration destination; source will not be erased. Preserve it and repair the account first.",
			);
	};
	if (!existsSync(sourceFile)) {
		if (existsSync(join(target, "keys.bep"))) {
			await new SecureKeyManager({ keyDir: target }).loadEncryptedKeys(
				password,
			);
			verifyDestination();
			return { name, alreadyMigrated: true };
		}
		throw new Error("Migration source does not exist");
	}
	regularPath(sourceDir, true);
	regularPath(sourceFile);
	let keys: Parameters<SecureKeyManager["saveKeys"]>[0];
	try {
		keys =
			source === "legacy"
				? new SecureKeyManager({ keyDir: sourceDir }).loadLegacyKeys()
				: {
						payPk: PrivateKey.fromWif(readFileSync(sourceFile, "utf8").trim()),
					};
	} catch {
		throw new Error("Cannot read migration source; no files changed");
	}
	if (!keys.payPk) throw new Error("Source has no payment key");
	if (existsSync(target)) {
		const old = await new SecureKeyManager({
			keyDir: target,
		}).loadEncryptedKeys(password);
		if (
			old.payPk?.toWif() !== keys.payPk.toWif() ||
			old.xprv !== keys.xprv ||
			old.identityPk?.toWif() !== keys.identityPk?.toWif()
		)
			throw new Error(
				"Destination contains a different identity; no files changed",
			);
		verifyDestination();
		return { name, alreadyMigrated: true };
	}
	const config: AccountConfig = {
		chain: "main",
		storageIdentityKey: expectedStorage,
		...(source === "legacy"
			? {
					activeRemote: backendUrl(
						"REMOTE_STORAGE_URL",
						`${onesatUrl("main")}/1sat/wallet`,
					),
				}
			: {}),
		address:
			source === "sigma-lab"
				? PublicKey.fromString(
						(
							await new ProtoWallet(keys.payPk).getPublicKey({
								protocolID: P1SAT_PROTOCOL,
								keyID: "1sat 0",
								forSelf: true,
							})
						).publicKey,
					).toAddress()
				: keys.payPk.toAddress(),
		depositPrefix: source === "legacy" ? "mcp" : "1sat",
	};
	// Legacy automatic storage used the working directory; require an explicit follow-up for it.
	const dbSource = join(sourceDir, "wallet.db");
	if (source === "sigma-lab" && !existsSync(dbSource))
		throw new Error(
			"Lab wallet database is missing; refusing an incomplete migration",
		);
	await createAccount(name, keys, password, config, root);
	try {
		if (existsSync(dbSource)) {
			regularPath(dbSource);
			const { Database } = await import("bun:sqlite");
			const db = new Database(dbSource, { readonly: true });
			try {
				db.exec(
					`VACUUM INTO '${join(target, "wallet-main.db").replaceAll("'", "''")}'`,
				);
			} finally {
				db.close();
			}
			chmodSync(join(target, "wallet-main.db"), 0o600);
		}
	} catch {
		rmSync(target, { recursive: true, force: true });
		throw new Error(
			"Database snapshot failed; migration source was not changed",
		);
	}
	return { name, alreadyMigrated: false };
}
export async function runAccountCommand(args: string[]): Promise<boolean> {
	const command = args[0];
	if (
		![
			"init",
			"wallet_generate",
			"wallet_import",
			"wallet_list",
			"wallet_remove",
			"wallet_use",
			"wallet_migrate",
			"signer-serve",
		].includes(command)
	)
		return false;
	const index = args.indexOf("--account");
	const name = accountName(index >= 0 ? (args[index + 1] ?? "") : undefined);
	if (command === "wallet_list") {
		console.log(JSON.stringify(listAccounts(), null, 2));
		return true;
	}
	if (command === "wallet_use") {
		if (!readAccount(name)) throw new Error("Account is not initialized");
		console.log(
			`Set BSV_MCP_ACCOUNT=${name} in your MCP environment and restart the server. The running wallet was not switched.`,
		);
		return true;
	}
	if (command === "signer-serve") {
		const { serveSigner } = await import("./signer");
		await serveSigner(name);
		return true;
	}
	if (!process.stdin.isTTY || !process.stderr.isTTY)
		throw new Error(
			"Account changes require a local interactive terminal; never put keys or passwords in MCP arguments",
		);
	if (command === "wallet_migrate") {
		const sourceIndex = args.indexOf("--source");
		const source = args[sourceIndex + 1];
		if (sourceIndex < 0 || !["legacy", "sigma-lab"].includes(source))
			throw new Error("Use --source legacy or --source sigma-lab");
		await confirm(
			"Stop all processes using the source wallet before migrating. Source wallet stopped?",
		);
		const password = existsSync(join(accountDir(name), "keys.bep"))
			? await terminalInput("Account password", true)
			: await newPassword();
		const result = await migrateAccount(
			name,
			source as "legacy" | "sigma-lab",
			password,
		);
		console.log(JSON.stringify(result));
		if (args.includes("--erase-source")) {
			await confirm(
				"Encrypted keys and the account database are backed up and verified? Source overwrite cannot erase SSD snapshots",
			);
			const sourceDir =
				source === "legacy"
					? join(homedir(), ".bsv-mcp")
					: join(homedir(), ".local/share/sigma-brc169-lab");
			const sourceFile = join(
				sourceDir,
				source === "legacy" ? "keys.json" : "root.wif",
			);
			if (existsSync(sourceFile)) erasePlaintext(sourceFile);
		}
		return true;
	}
	if (command === "wallet_remove") {
		if (!readAccount(name)) throw new Error("Account is not initialized");
		// Neither the root address nor one basket proves that every derived address is empty.
		if (!args.includes("--force"))
			throw new Error(
				"Cannot prove all derived addresses and remote storage are empty. Removal requires --force and a verified backup.",
			);
		await confirm(
			"Verified an encrypted backup of this account, including its database, and accept losing local access to any funds?",
		);
		const dir = accountDir(name);
		regularPath(dir, true);
		for (const file of readdirSync(dir)) regularPath(join(dir, file));
		rmSync(dir, { recursive: true });
		console.log(`Removed account ${name}`);
		return true;
	}
	if (existsSync(accountDir(name)))
		throw new Error("Account already exists; choose a different name");
	const chainInput = await terminalInput("Network: main or test");
	if (chainInput !== "main" && chainInput !== "test")
		throw new Error("Network must be main or test");
	const choice =
		command === "init"
			? await terminalInput(
					"Create a new key or import an existing one? generate/import",
				)
			: command === "wallet_generate"
				? "generate"
				: "import";
	if (!["generate", "import"].includes(choice))
		throw new Error("Choose generate or import");
	const password = await newPassword();
	await confirm(
		"Back up the encrypted keys.bep and config.json after setup, and the database before using funds. Continue?",
	);
	let key: PrivateKey;
	try {
		key =
			choice === "generate"
				? PrivateKey.fromRandom()
				: PrivateKey.fromWif(
						await terminalInput("Private key WIF (hidden)", true),
					);
	} catch {
		throw new Error("Key import failed; no account was created");
	}
	const address = key.toAddress(chainInput === "test" ? [0x6f] : [0]);
	await createAccount(
		name,
		{ payPk: key },
		password,
		newAccountConfig(chainInput, address),
	);
	console.log(
		`Account ${name} created. Address: ${address}\nBack up ${join(accountDir(name), "keys.bep")} and config.json. Keep the password separately.`,
	);
	return true;
}

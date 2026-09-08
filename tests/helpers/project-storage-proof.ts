import { mkdirSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { KeyDeriver, PrivateKey } from "@bsv/sdk";
import { createVault, PassphraseProvider, saveVault } from "@opl.dev/vault";
import {
	accountDir,
	accountsRoot,
	newAccountConfig,
	writeAccount,
} from "../../utils/accounts";
import type { ProjectRoleBindings } from "../../utils/projectRoleBindings";
import { saveProjectRoleBindings } from "../../utils/projectRoleBindingsStore";
import { createProjectWalletRuntime } from "../../utils/projectWalletRuntime";
import { createEmbeddedWalletRuntime } from "../../utils/embeddedWalletRuntime";
import { saveWalletRoleDefaults } from "../../utils/walletRoleDefaults";
import { walletDepositAddress } from "../../utils/walletDepositAddress";

const directory = process.argv[2];
if (!directory) throw new Error("Missing fixture directory");
const password = "synthetic-project-storage-password";
const path = join(directory, "vault.bep");
const provider = new PassphraseProvider(password);
const vault = await createVault(path, [provider]);
const root = PrivateKey.fromHex("41");
const [entry] = vault.importPlain(
	{ wif: root.toWif() },
	"Synthetic storage root",
);
if (!entry) throw new Error("No imported synthetic key");
await saveVault(path, vault, provider);
const publicKey = root.toPublicKey().toString();
const account = {
	...newAccountConfig("test", root.toAddress([0x6f])),
	depositPrefix: "1sat" as const,
	vaultBinding: {
		version: 1 as const,
		contract: "embedded-roots-v1" as const,
		vaultId: vault.toDocument().id,
		payment: { entryId: entry.id, publicKey },
	},
};
writeAccount("source", account);
const projectRoot = join(directory, "project");
mkdirSync(projectRoot);
const derivation = {
	scheme: "brc42" as const,
	protocolID: [2, "project storage"] as [2, string],
	keyID: "identity",
	counterparty: "self",
};
const child = new KeyDeriver(root).derivePrivateKey(
	derivation.protocolID,
	derivation.keyID,
	"self",
);
const config: ProjectRoleBindings = {
	schemaVersion: 1,
	projectId: "storage-proof",
	revision: 0,
	current: {
		payments: "payments",
		"identity-signing": "identity-signing",
		"one-sat": "one-sat",
		encryption: null,
	},
	bindings: [],
	retained: [],
};
for (const role of ["payments", "identity-signing", "one-sat"] as const)
	config.bindings.push({
		bindingId: role,
		role,
		accountId: "source",
		key: {
			vaultId: vault.toDocument().id,
			entryId: entry.id,
			expectedPublicKey:
				role === "identity-signing"
					? child.toPublicKey().toString()
					: publicKey,
			...(role === "identity-signing" ? { derivation } : {}),
		},
		keyUseContract: role === "identity-signing" ? "brc42-leaf-v1" : "direct-v1",
		createdAt: "2026-09-08T00:00:00Z",
	});
await saveProjectRoleBindings(projectRoot, config, {
	expectedProjectId: config.projectId,
	expectedRevision: null,
});
const originalAccount = readFileSync(
	join(accountDir("source"), "config.json"),
	"utf8",
);
const originalVault = readFileSync(path);
const runtime = await createProjectWalletRuntime({
	env: {
		BSV_MCP_PROJECT_ROOT: projectRoot,
		BSV_MCP_PROJECT_ID: config.projectId,
		BSV_MCP_PASSWORD: password,
		VAULT_PATH: path,
		TRANSPORT: "stdio",
	},
	argv: [],
});
try {
	const { identity, payments, ordinals } = runtime.roleContexts;
	if (!identity || !payments || !ordinals) throw new Error("Missing project roles");
	const identityKey = (
		await identity.wallet.getPublicKey({
			identityKey: true,
		})
	).publicKey;
	const paymentKey = (
		await payments.wallet.getPublicKey({
			identityKey: true,
		})
	).publicKey;
	const address = await walletDepositAddress(payments);
	if (
		identityKey !== child.toPublicKey().toString() ||
		paymentKey !== publicKey
	)
		throw new Error("Wrong initialized SDK key");
	if (address !== runtime.depositAddress)
		throw new Error("Deposit prefix changed after activation");
	await runtime.controller.lock("payments");
	const ordinalKey = (
		await ordinals.wallet.getPublicKey({
			identityKey: true,
		})
	).publicKey;
	if (ordinalKey !== publicKey)
		throw new Error(
			"Locking one role broke another role using the same key/database",
		);
	if (
		(
			await ordinals.wallet.listOutputs({
				basket: "default",
			})
		).totalOutputs !== 0
	)
		throw new Error("Synthetic fixture unexpectedly funded");
	const folders = readdirSync(accountsRoot());
	const databases = folders.filter((folder) => {
		try {
			return statSync(join(accountsRoot(), folder, "wallet-test.db")).isFile();
		} catch {
			return false;
		}
	});
	if (
		databases.length !== 2 ||
		!databases.includes("source") ||
		!databases.some((value) => value.startsWith("key-"))
	)
		throw new Error("Storage was not isolated by derived key");
	if (
		readFileSync(join(accountDir("source"), "config.json"), "utf8") !==
			originalAccount ||
		!readFileSync(path).equals(originalVault)
	)
		throw new Error(
			"Opening project roles modified source configuration or encrypted Vault",
		);
	console.log(
		JSON.stringify({
			success: true,
			databaseCount: databases.length,
			sharedRootSurvivesRoleLock: true,
			prefixPreserved: true,
		}),
	);
} finally {
	await runtime.cleanup();
}

// The ordinary headless entry path must preserve a separately selected identity.
process.env.BSV_MCP_ACCOUNT = "source";
const legacy = await createEmbeddedWalletRuntime(root, child, "test");
try {
  const identity = legacy.roleContexts?.identity;
  if (!identity || (await identity.wallet.getPublicKey({ identityKey: true })).publicKey !== child.toPublicKey().toString()) throw new Error("Headless identity selection was ignored");
} finally { await legacy.destroy(); }
// Saved Vault defaults must also apply without entering the browser again.
saveWalletRoleDefaults({ payments: "source:payment", identity: null, ordinals: "source:payment" }, 0);
process.env.BSV_MCP_PASSWORD = password;
process.env.VAULT_PATH = path;
const selected = await createEmbeddedWalletRuntime(root, child, "test");
try {
  if (selected.roleContexts?.identity !== undefined || !selected.roleContexts?.payments || !selected.roleContexts.ordinals) throw new Error("Headless Vault defaults were not applied");
} finally { await selected.destroy(); }
console.log(JSON.stringify({ headlessIdentitySelection: true, headlessVaultDefaults: true }));

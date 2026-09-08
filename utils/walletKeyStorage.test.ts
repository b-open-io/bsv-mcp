import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { KeyDeriver, PrivateKey } from "@bsv/sdk";
import { accountDir, newAccountConfig, writeAccount } from "./accounts";
import { walletStorageForKey } from "./walletKeyStorage";

test("derived keys get stable separate storage while the selected root retains its history", () => {
	const root = mkdtempSync(join(tmpdir(), "bsv-key-storage-"));
	try {
		const payment = PrivateKey.fromHex("1");
		const child = new KeyDeriver(payment).derivePrivateKey(
			[2, "project storage"],
			"project-a",
			"self",
		);
		const publicKey = payment.toPublicKey().toString();
		const childPublicKey = child.toPublicKey().toString();
		const config = {
			...newAccountConfig("main", payment.toAddress()),
			depositPrefix: "1sat" as const,
			backups: ["https://backup.example"],
			vaultBinding: {
				version: 1 as const,
				contract: "embedded-roots-v1" as const,
				vaultId: "vault",
				payment: { entryId: "root", publicKey },
			},
		};
		writeAccount("source", config, root);
		const original = readFileSync(
			join(accountDir("source", root), "config.json"),
			"utf8",
		);
		expect(walletStorageForKey("source", publicKey, root)).toEqual({
			accountName: "source",
			accountConfig: config,
		});
		const derived = walletStorageForKey("source", childPublicKey, root);
		expect(derived.accountName).not.toBe("source");
		expect(derived.accountConfig.address).toBe(child.toAddress());
		expect(derived.accountConfig.storageIdentityKey).not.toBe(
			config.storageIdentityKey,
		);
		expect(derived.accountConfig.depositPrefix).toBe("1sat");
		expect(derived.accountConfig.activeRemote).toBe(config.activeRemote);
		expect(derived.accountConfig.backups).toEqual(config.backups);
		expect(derived.accountConfig.vaultBinding).toBeUndefined();
		expect(
			walletStorageForKey("source", childPublicKey.toUpperCase(), root),
		).toEqual(derived);
		writeAccount("alias", config, root);
		expect(walletStorageForKey("alias", childPublicKey, root)).toEqual(derived);
		writeAccount(
			"testnet",
			{ ...config, chain: "test", address: payment.toAddress([0x6f]) },
			root,
		);
		expect(
			walletStorageForKey("testnet", childPublicKey, root).accountName,
		).not.toBe(derived.accountName);
		expect(
			readFileSync(join(accountDir("source", root), "config.json"), "utf8"),
		).toBe(original);
		// A stale address cannot override an explicit Vault payment pin.
		writeAccount("stale", { ...config, address: child.toAddress() }, root);
		expect(walletStorageForKey("stale", childPublicKey, root).accountName).toBe(
			derived.accountName,
		);
		expect(() => walletStorageForKey("missing", publicKey, root)).toThrow(
			"not initialized",
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

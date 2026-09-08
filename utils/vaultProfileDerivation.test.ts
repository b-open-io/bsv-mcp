import { expect, mock, test } from "bun:test";
import { HD, KeyDeriver, Mnemonic, PrivateKey } from "@bsv/sdk";
import {
	deriveVaultProfilePublicKey,
	resolveVaultProfilePrivateKey,
	type VaultProfileAccess,
	type VaultProfileDerivationApi,
	YOURS_LEGACY_PROFILE_PATHS,
} from "./vaultProfileDerivation";

const leaf = {
	scheme: "brc42",
	protocolID: [2, "project signing"],
	keyID: "chosen-leaf",
	counterparty: "self",
};
const reference = {
	vaultId: "vault-1",
	entryId: "source-1",
	derivation: { scheme: "brc157", index: 1, leaf },
};
const syntheticKey = PrivateKey.fromString("2", 10);
function fixture() {
	const access = {
		id: "vault-1",
		assertActive: mock(() => {}),
		get: mock(() => ({ kind: "entropy" })),
		reveal: mock(() => "synthetic-source"),
	};
	const api = {
		mnemonicToEntropy: mock(() => "synthetic-entropy"),
		brc157Profile: mock(() => PrivateKey.fromString("1", 10)),
		brc42Derive: mock(() => syntheticKey),
		bip32Derive: mock(() => "unused"),
	};
	return { access, api };
}

test("explicit BRC157 profile and leaf parameters use the supported exports", () => {
	const { access, api } = fixture();
	expect(
		deriveVaultProfilePublicKey(access, reference, "local preview", api),
	).toBe(syntheticKey.toPublicKey().toString());
	expect(api.brc157Profile).toHaveBeenCalledWith("synthetic-source", 1);
	expect(api.brc42Derive).toHaveBeenCalledWith(
		PrivateKey.fromString("1", 10).toWif(),
		[2, "project signing"],
		"chosen-leaf",
		"self",
	);
	expect(access.assertActive).toHaveBeenCalledTimes(3);
	expect(access.reveal).toHaveBeenCalledWith("source-1", "local preview");
});

test("unsupported descriptors fail before accessing the Vault", () => {
	const { access, api } = fixture();
	for (const derivation of [
		{ scheme: "brc157", index: 1 },
		{ scheme: "brc157", index: -1, leaf },
		{ scheme: "brc157", index: 0x80000000, leaf },
		{ scheme: "brc157", index: 1.5, leaf },
		{ scheme: "brc157", index: 1, leaf, path: "m/0'/1'" },
		{ scheme: "type42", index: 1 },
		{ scheme: "yours-legacy-bip32", path: "m/0'/0" },
		{ scheme: "brc157", index: 1, leaf: { ...leaf, wif: "sentinel" } },
	])
		expect(() =>
			deriveVaultProfilePublicKey(
				access,
				{ ...reference, derivation },
				"preview",
				api,
			),
		).toThrow("DESCRIPTOR_UNSUPPORTED");
	expect(access.get).not.toHaveBeenCalled();
	expect(access.reveal).not.toHaveBeenCalled();
});

test("source, Vault, API and session restrictions fail without fallback", () => {
	const { access, api } = fixture();
	expect(() =>
		deriveVaultProfilePublicKey(
			access,
			{ ...reference, vaultId: "other" },
			"preview",
			api,
		),
	).toThrow("VAULT_MISMATCH");
	access.get.mockReturnValue({ kind: "wif" });
	expect(() =>
		deriveVaultProfilePublicKey(access, reference, "preview", api),
	).toThrow("SOURCE_UNSUPPORTED");
	access.get.mockReturnValue({ kind: "entropy" });
	expect(() =>
		deriveVaultProfilePublicKey(access, reference, "preview", {
			...api,
			brc42Derive: undefined,
		} as unknown as VaultProfileDerivationApi),
	).toThrow("API_UNAVAILABLE");
	access.assertActive.mockImplementation(() => {
		throw new Error("secret-session-error");
	});
	expect(() =>
		deriveVaultProfilePublicKey(access, reference, "preview", api),
	).toThrow("SESSION_UNAVAILABLE");
	expect(access.reveal).not.toHaveBeenCalled();
});

test("private resolution requires an exact public-key pin and sanitized errors", () => {
	const { access, api } = fixture();
	const selection = {
		...reference,
		expectedPublicKey: syntheticKey.toPublicKey().toString(),
	};
	expect(
		resolveVaultProfilePrivateKey(
			access,
			selection,
			"wallet leaf",
			api,
		).toHex(),
	).toBe(syntheticKey.toHex());
	expect(() =>
		resolveVaultProfilePrivateKey(access, reference, "wallet leaf", api),
	).toThrow("DESCRIPTOR_UNSUPPORTED");
	expect(() =>
		resolveVaultProfilePrivateKey(
			access,
			{
				...selection,
				expectedPublicKey: PrivateKey.fromString("3", 10)
					.toPublicKey()
					.toString(),
			},
			"wallet leaf",
			api,
		),
	).toThrow("PUBLIC_KEY_MISMATCH");
	access.reveal.mockImplementation(() => {
		throw new Error("synthetic-secret-in-error");
	});
	expect(() =>
		resolveVaultProfilePrivateKey(access, selection, "wallet leaf", api),
	).toThrow("REVEAL_DENIED");
});

test("expiry during derivation prevents returning material", () => {
	const { access, api } = fixture();
	api.brc42Derive.mockImplementation(() => {
		access.assertActive.mockImplementation(() => {
			throw new Error("expired");
		});
		return syntheticKey;
	});
	expect(() =>
		deriveVaultProfilePublicKey(access, reference, "preview", api),
	).toThrow("SESSION_UNAVAILABLE");
});

// Real-package conformance runs against the installed, pinned Vault dependency.
// An explicit module override remains available for upstream compatibility work.
const modulePath = process.env.BSV_MCP_TEST_VAULT_MODULE ?? "@opl.dev/vault";
const real = await import(modulePath);

test("real Vault BRC157 mnemonic profiles match hardened path plus explicit BRC42 leaf", () => {
	if (!real) throw new Error("Missing real Vault fixture");
	const phrase = real.BRC157_PHRASE;
	const vault = new real.Vault(real.createVaultDocument());
	const [entry] = vault.importPlain(
		{
			format: "sigma-seed",
			version: 1,
			mnemonic: phrase,
			profiles: [{ index: 0, bapId: "synthetic-profile" }],
			nextProfileIndex: 1,
			createdAt: 1,
		},
		"synthetic",
	);
	const access: VaultProfileAccess = {
		id: vault.toDocument().id,
		assertActive: () => {},
		get: (id) => vault.get(id),
		reveal: (id, reason) => vault.reveal(id, reason),
	};
	const beforeEntries = vault.list();
	for (const index of [0, 1, 17]) {
		const profile = HD.fromSeed(Mnemonic.fromString(phrase).toSeed()).derive(
			`m/0'/${index}'`,
		).privKey;
		const expected = new KeyDeriver(profile).derivePrivateKey(
			[2, "project signing"],
			"chosen-leaf",
			"self",
		);
		const ref = {
			...reference,
			vaultId: access.id,
			entryId: entry.id,
			derivation: { ...reference.derivation, index },
		};
		expect(
			deriveVaultProfilePublicKey(access, ref, "synthetic preview", real),
		).toBe(expected.toPublicKey().toString());
		expect(
			resolveVaultProfilePrivateKey(
				access,
				{ ...ref, expectedPublicKey: expected.toPublicKey().toString() },
				"synthetic leaf",
				real,
			).toHex(),
		).toBe(expected.toHex());
	}
	expect(vault.list()).toEqual(beforeEntries);
	const denied = new real.Vault({
		...vault.toDocument(),
		settings: { revealEnabled: false, unlockTtlSeconds: 300 },
	});
	expect(() =>
		deriveVaultProfilePublicKey(
			{ ...access, reveal: (id, reason) => denied.reveal(id, reason) },
			{ ...reference, vaultId: access.id, entryId: entry.id },
			"synthetic denied",
			real,
		),
	).toThrow("REVEAL_DENIED");
});

test("real Vault preserves all three Yours legacy paths and rejects child HD sources", () => {
	if (!real) throw new Error("Missing real Vault fixture");
	const master = HD.fromSeed(Mnemonic.fromString(real.BRC157_PHRASE).toSeed());
	const vault = new real.Vault(real.createVaultDocument());
	const entries = vault.importPlain(
		{
			ids: "synthetic",
			mnemonic: real.BRC157_PHRASE,
			xprv: master.toString(),
		},
		"synthetic",
	);
	const entry = entries.find(
		(value: { kind: string }) => value.kind === "hd-private",
	);
	const access: VaultProfileAccess = {
		id: vault.toDocument().id,
		assertActive: () => {},
		get: (id) => vault.get(id),
		reveal: (id, reason) => vault.reveal(id, reason),
	};
	for (const path of YOURS_LEGACY_PROFILE_PATHS) {
		const ref = {
			vaultId: access.id,
			entryId: entry.id,
			derivation: { scheme: "yours-legacy-bip32", path },
		};
		const expected = master.derive(path).privKey;
		expect(
			resolveVaultProfilePrivateKey(
				access,
				{ ...ref, expectedPublicKey: expected.toPublicKey().toString() },
				"legacy fixture",
				real,
			).toHex(),
		).toBe(expected.toHex());
		expect(() =>
			deriveVaultProfilePublicKey(
				{ ...access, reveal: () => master.derive("m/1").toString() },
				ref,
				"reject child",
				real,
			),
		).toThrow("HD_MASTER_REQUIRED");
	}
});

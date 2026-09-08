import { expect, mock, test } from "bun:test";
import { HD, PrivateKey } from "@bsv/sdk";
import {
	PROJECT_KEY_ROLES,
	projectRoleBindingSchema,
} from "./projectRoleBindings";
import {
	parseVaultProfileBinding,
	previewVaultProfileBinding,
	resolveVaultProfileBindingKey,
} from "./vaultProfileBinding";
import { YOURS_LEGACY_PROFILE_PATHS } from "./vaultProfileDerivation";

const resultKey = PrivateKey.fromString("2", 10);
const leaf = {
	scheme: "brc42",
	protocolID: [2, "project signing"],
	keyID: "leaf",
	counterparty: "self",
};
const profile = {
	keyUseContract: "brc157-leaf-v1",
	key: {
		vaultId: "vault-1",
		entryId: "entry-1",
		expectedPublicKey: resultKey.toPublicKey().toString(),
		derivation: { scheme: "brc157", index: 7, leaf },
	},
};
function fixture() {
	return {
		access: {
			id: "vault-1",
			assertActive: mock(() => {}),
			get: mock(() => ({ kind: "entropy" })),
			reveal: mock(() => "synthetic"),
		},
		api: {
			mnemonicToEntropy: mock(() => "synthetic"),
			brc157Profile: mock(() => PrivateKey.fromString("1", 10)),
			brc42Derive: mock(() => resultKey),
			bip32Derive: mock(() => "unused"),
		},
	};
}

test("every project role accepts explicitly matched profiles and preserves direct contracts", () => {
	for (const role of PROJECT_KEY_ROLES) {
		const common = {
			bindingId: "binding-1",
			role,
			accountId: "account-1",
			createdAt: "2026-09-08T00:00:00Z",
		};
		for (const selection of [
			profile,
			...YOURS_LEGACY_PROFILE_PATHS.map((path) => ({
				keyUseContract: "yours-legacy-leaf-v1",
				key: {
					...profile.key,
					derivation: { scheme: "yours-legacy-bip32", path },
				},
			})),
		])
			expect(
				projectRoleBindingSchema.safeParse({ ...common, ...selection }).success,
			).toBe(true);
		const { derivation: _, ...key } = profile.key;
		expect(
			projectRoleBindingSchema.safeParse({
				...common,
				keyUseContract: "direct-v1",
				key,
			}).success,
		).toBe(true);
		expect(
			projectRoleBindingSchema.safeParse({
				...common,
				keyUseContract: "brc42-leaf-v1",
				key: { ...key, derivation: leaf },
			}).success,
		).toBe(true);
		for (const keyUseContract of [
			"direct-v1",
			"brc42-leaf-v1",
			"yours-legacy-leaf-v1",
		])
			expect(
				projectRoleBindingSchema.safeParse({
					...common,
					...profile,
					keyUseContract,
				}).success,
			).toBe(false);
	}
});

test("preview and SDK leaf resolution use the same descriptor and expected identity", () => {
	const { access, api } = fixture();
	expect(previewVaultProfileBinding(access, profile, "preview", api)).toBe(
		profile.key.expectedPublicKey,
	);
	expect(
		resolveVaultProfileBindingKey(access, profile, "initialize", api).toHex(),
	).toBe(resultKey.toHex());
	expect(api.brc157Profile).toHaveBeenNthCalledWith(1, "synthetic", 7);
	expect(api.brc157Profile).toHaveBeenNthCalledWith(2, "synthetic", 7);
	const bad = {
		...profile,
		key: {
			...profile.key,
			expectedPublicKey: PrivateKey.fromString("3", 10)
				.toPublicKey()
				.toString(),
		},
	};
	for (const resolve of [
		previewVaultProfileBinding,
		resolveVaultProfileBindingKey,
	])
		expect(() => resolve(access, bad, "check", api)).toThrow(
			"PUBLIC_KEY_MISMATCH",
		);
});

test("mismatched and unrecognized contracts reject before revealing any source", () => {
	const { access, api } = fixture();
	for (const input of [
		{ ...profile, keyUseContract: "direct-v1" },
		{ ...profile, keyUseContract: "yours-legacy-leaf-v1" },
		{ ...profile, key: { ...profile.key, derivation: undefined } },
		{
			...profile,
			key: {
				...profile.key,
				derivation: { ...profile.key.derivation, index: -1 },
			},
		},
		{ ...profile, wif: "sentinel" },
	])
		expect(() =>
			previewVaultProfileBinding(access, input, "preview", api),
		).toThrow("BINDING_UNSUPPORTED");
	expect(access.get).not.toHaveBeenCalled();
	expect(access.reveal).not.toHaveBeenCalled();
	const parsed = parseVaultProfileBinding(profile);
	parsed.derivation = {
		scheme: "yours-legacy-bip32",
		path: YOURS_LEGACY_PROFILE_PATHS[0],
	};
	expect(profile.key.derivation.scheme).toBe("brc157");
});

test("Yours profiles expose only the explicitly selected leaf and enforce session expiry", () => {
	const master = HD.fromSeed(new Array(32).fill(1));
	const { access, api } = fixture();
	access.get.mockReturnValue({ kind: "hd-private" });
	access.reveal.mockReturnValue(master.toString());
	api.bip32Derive.mockImplementation((...args: unknown[]) =>
		master.derive(args[1] as string).toString(),
	);
	for (const path of YOURS_LEGACY_PROFILE_PATHS) {
		const expected = master.derive(path).privKey;
		const selection = {
			keyUseContract: "yours-legacy-leaf-v1",
			key: {
				...profile.key,
				expectedPublicKey: expected.toPublicKey().toString(),
				derivation: { scheme: "yours-legacy-bip32", path },
			},
		};
		expect(previewVaultProfileBinding(access, selection, "preview", api)).toBe(
			expected.toPublicKey().toString(),
		);
		expect(
			resolveVaultProfileBindingKey(
				access,
				selection,
				"initialize",
				api,
			).toHex(),
		).toBe(expected.toHex());
	}
	access.assertActive.mockImplementation(() => {
		throw new Error("expired");
	});
	expect(() =>
		previewVaultProfileBinding(access, profile, "preview", api),
	).toThrow("SESSION_UNAVAILABLE");
});

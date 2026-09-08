import { z } from "zod";
import { projectVaultKeyReferenceSchema } from "./projectRoleBindings";
import {
	resolveVaultProfilePrivateKey,
	type VaultProfileAccess,
	type VaultProfileDerivationApi,
	VaultProfileDerivationError,
	type VaultProfileSelection,
} from "./vaultProfileDerivation";

/** The same public selector is used for preview and session initialization. */
export const vaultProfileBindingSchema = z
	.object({
		keyUseContract: z.enum(["brc157-leaf-v1", "yours-legacy-leaf-v1"]),
		key: projectVaultKeyReferenceSchema,
	})
	.strict()
	.superRefine((binding, ctx) => {
		const expected =
			binding.keyUseContract === "brc157-leaf-v1"
				? "brc157"
				: "yours-legacy-bip32";
		if (binding.key.derivation?.scheme !== expected)
			ctx.addIssue({
				code: "custom",
				path: ["key", "derivation"],
				message: "Profile contract and derivation must match",
			});
	});

export function parseVaultProfileBinding(
	input: unknown,
): VaultProfileSelection {
	const result = vaultProfileBindingSchema.safeParse(input);
	if (!result.success)
		throw new VaultProfileDerivationError("VAULT_PROFILE_BINDING_UNSUPPORTED");
	// The refinement above excludes both undefined and flat BRC-42 descriptors.
	return result.data.key as VaultProfileSelection;
}

/** Requires an active caller-owned session; returns only the pinned public leaf. */
export function previewVaultProfileBinding(
	access: VaultProfileAccess,
	input: unknown,
	reason: string,
	api: VaultProfileDerivationApi,
): string {
	return resolveVaultProfileBindingKey(access, input, reason, api)
		.toPublicKey()
		.toString();
}

/** Returns an in-memory leaf, never an HD master or a BRC-157 profile root. */
export function resolveVaultProfileBindingKey(
	access: VaultProfileAccess,
	input: unknown,
	reason: string,
	api: VaultProfileDerivationApi,
) {
	return resolveVaultProfilePrivateKey(
		access,
		parseVaultProfileBinding(input),
		reason,
		api,
	);
}

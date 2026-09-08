import { PublicKey } from "@bsv/sdk";
import { z } from "zod";
import { accountNameSchema } from "./accounts";

export const PROJECT_KEY_ROLES = [
	"identity-signing",
	"payments",
	"one-sat",
	"encryption",
] as const;
export const projectKeyRoleSchema = z.enum(PROJECT_KEY_ROLES);
export type ProjectKeyRole = z.infer<typeof projectKeyRoleSchema>;

const identifier = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/);
const publicKey = z
	.string()
	.regex(/^(02|03)[0-9a-f]{64}$/)
	.refine((value) => {
		try {
			const key = PublicKey.fromString(value);
			return key.validate() && key.toString() === value;
		} catch {
			return false;
		}
	}, "Expected a valid compressed public key");

/** Structured BRC-42 parameters; never reconstruct these from a display path. */
export const projectBrc42DerivationSchema = z
	.object({
		scheme: z.literal("brc42"),
		protocolID: z.tuple([
			z.union([z.literal(0), z.literal(1), z.literal(2)]),
			z
				.string()
				.min(5)
				.max(400)
				.regex(/^[a-z0-9]+(?: [a-z0-9]+)*$/)
				.refine((name) => !name.endsWith(" protocol")),
		]),
		keyID: z.string().min(1).max(800),
		counterparty: z.union([z.enum(["self", "anyone"]), publicKey]),
	})
	.strict();

export const projectVaultKeyReferenceSchema = z
	.object({
		vaultId: identifier,
		entryId: identifier,
		expectedPublicKey: publicKey,
		derivation: projectBrc42DerivationSchema.optional(),
	})
	.strict();

const bindingFields = z
	.object({
		bindingId: identifier,
		role: projectKeyRoleSchema,
		accountId: accountNameSchema,
		key: projectVaultKeyReferenceSchema,
		// Selection is not proof of wallet/asset capability. The runtime checks
		// the actual Vault entry, public key, account and supported contract.
		keyUseContract: z.enum(["direct-v1", "brc42-leaf-v1"]),
		createdAt: z.iso.datetime({ offset: true }),
		previousBindingId: identifier.optional(),
	})
	.strict();

export const projectRoleBindingSchema = bindingFields.superRefine(
	(binding, ctx) => {
		if (
			(binding.keyUseContract === "brc42-leaf-v1") !==
			(binding.key.derivation !== undefined)
		) {
			ctx.addIssue({
				code: "custom",
				path: ["key", "derivation"],
				message: "Only brc42-leaf-v1 requires an explicit BRC-42 derivation",
			});
		}
	},
);
export type ProjectRoleBinding = z.infer<typeof projectRoleBindingSchema>;

const retentionUseSchema = z.enum([
	"verify-history",
	"fund-recovery",
	"asset-recovery",
	"decrypt-history",
	"pending-actions",
]);
type RetentionUse = z.infer<typeof retentionUseSchema>;
const requiredRetention: Record<ProjectKeyRole, readonly RetentionUse[]> = {
	"identity-signing": ["verify-history", "pending-actions"],
	payments: ["fund-recovery", "pending-actions"],
	"one-sat": ["asset-recovery", "pending-actions"],
	encryption: ["decrypt-history"],
};

/**
 * Project-owned, nonsecret selectors. Each role is explicitly assigned or null.
 * Entry.roles flags and the process's global active account are not selectors.
 * Historical records are retained; this contract offers no deletion operation.
 */
export const projectRoleBindingsSchema = z
	.object({
		schemaVersion: z.literal(1),
		projectId: identifier,
		revision: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
		current: z
			.object({
				"identity-signing": identifier.nullable(),
				payments: identifier.nullable(),
				"one-sat": identifier.nullable(),
				encryption: identifier.nullable(),
			})
			.strict(),
		bindings: z.array(projectRoleBindingSchema),
		retained: z.array(
			z
				.object({
					bindingId: identifier,
					uses: z.array(retentionUseSchema).min(1),
				})
				.strict(),
		),
	})
	.strict()
	.superRefine((config, ctx) => {
		const fail = (message: string) => ctx.addIssue({ code: "custom", message });
		const bindings = new Map<string, ProjectRoleBinding>();
		for (const binding of config.bindings) {
			if (bindings.has(binding.bindingId)) fail("Duplicate binding ID");
			if (binding.previousBindingId !== undefined) {
				const previous = bindings.get(binding.previousBindingId);
				if (!previous || previous.role !== binding.role)
					fail("Predecessor must be an earlier binding for the same role");
			}
			bindings.set(binding.bindingId, binding);
		}
		const current = new Set<string>();
		for (const role of PROJECT_KEY_ROLES) {
			const id = config.current[role];
			if (id === null) continue;
			if (bindings.get(id)?.role !== role)
				fail("Current binding must exist and match its role");
			current.add(id);
		}
		const retained = new Map<string, Set<RetentionUse>>();
		for (const item of config.retained) {
			if (!bindings.has(item.bindingId)) fail("Retained binding is missing");
			if (retained.has(item.bindingId)) fail("Duplicate retention record");
			if (new Set(item.uses).size !== item.uses.length)
				fail("Duplicate retention use");
			retained.set(item.bindingId, new Set(item.uses));
		}
		for (const binding of bindings.values()) {
			if (current.has(binding.bindingId)) continue;
			if (
				!requiredRetention[binding.role].every((use) =>
					retained.get(binding.bindingId)?.has(use),
				)
			)
				fail("Historical binding must retain all role recovery uses");
		}
	});

export type ProjectRoleBindings = z.infer<typeof projectRoleBindingsSchema>;
type Immutable<T> = T extends object
	? { readonly [K in keyof T]: Immutable<T[K]> }
	: T;

function freeze<T>(value: T): Immutable<T> {
	if (value !== null && typeof value === "object") {
		for (const child of Object.values(value)) freeze(child);
		Object.freeze(value);
	}
	return value as Immutable<T>;
}

/** Parse a caller-supplied config; no file discovery, Vault unlock, or fallback. */
export function parseProjectRoleBindings(
	input: unknown,
): Immutable<ProjectRoleBindings> {
	return freeze(projectRoleBindingsSchema.parse(input));
}

export interface ProjectRoleSnapshot {
	readonly projectId: string;
	readonly revision: number;
	readonly binding: Immutable<ProjectRoleBinding>;
}

function forProject(input: unknown, expectedProjectId: string) {
	const config = projectRoleBindingsSchema.parse(input);
	if (config.projectId !== expectedProjectId)
		throw new Error("PROJECT_ROLE_PROJECT_MISMATCH");
	return config;
}

/** Snapshot one role for a complete operation; never replace it mid-operation. */
export function resolveProjectRoleBinding(
	input: unknown,
	expectedProjectId: string,
	role: ProjectKeyRole,
): ProjectRoleSnapshot {
	const config = forProject(input, expectedProjectId);
	const checkedRole = projectKeyRoleSchema.parse(role);
	const binding = config.bindings.find(
		(item) => item.bindingId === config.current[checkedRole],
	);
	if (!binding) throw new Error(`PROJECT_ROLE_UNASSIGNED: ${checkedRole}`);
	return freeze({
		projectId: config.projectId,
		revision: config.revision,
		binding,
	});
}

/** Resolve a pinned historical key for recovery/decryption, never by label. */
export function resolveHistoricalProjectRoleBinding(
	input: unknown,
	expectedProjectId: string,
	role: ProjectKeyRole,
	bindingId: string,
): ProjectRoleSnapshot {
	const config = forProject(input, expectedProjectId);
	const checkedRole = projectKeyRoleSchema.parse(role);
	const binding = config.bindings.find(
		(item) => item.bindingId === bindingId && item.role === checkedRole,
	);
	if (!binding) throw new Error("PROJECT_ROLE_HISTORY_MISSING");
	return freeze({
		projectId: config.projectId,
		revision: config.revision,
		binding,
	});
}

/** Check before a new side effect; this is not a persistence lock or Vault TTL. */
export function assertProjectRoleSnapshotCurrent(
	input: unknown,
	snapshot: ProjectRoleSnapshot,
): void {
	const current = resolveProjectRoleBinding(
		input,
		snapshot.projectId,
		snapshot.binding.role,
	);
	if (
		current.revision !== snapshot.revision ||
		JSON.stringify(current.binding) !== JSON.stringify(snapshot.binding)
	)
		throw new Error("PROJECT_ROLE_SNAPSHOT_STALE");
}

export interface ProjectRoleSelectionChange {
	role: ProjectKeyRole;
	binding: Omit<ProjectRoleBinding, "role" | "previousBindingId"> | null;
}

export interface ProjectRoleBatchChange {
	expectedProjectId: string;
	expectedRevision: number;
	changes: readonly ProjectRoleSelectionChange[];
}

export interface ProjectRoleChange extends ProjectRoleSelectionChange {
	expectedProjectId: string;
	expectedRevision: number;
}

const selectionChangeSchema = z
	.object({
		role: projectKeyRoleSchema,
		binding: bindingFields
			.omit({ role: true, previousBindingId: true })
			.nullable(),
	})
	.strict();

/**
 * Pure batch transition: change each role at most once and increment once.
 * An empty batch or clearing only already-unassigned roles leaves revision as is.
 * Persistence must separately compare-and-swap expectedRevision under a lock.
 * This does not move funds/assets, re-encrypt data, or alter any Vault entry.
 */
export function changeProjectRoleBindings(
	input: unknown,
	batch: ProjectRoleBatchChange,
): Immutable<ProjectRoleBindings> {
	const config = forProject(input, batch.expectedProjectId);
	if (config.revision !== batch.expectedRevision)
		throw new Error("PROJECT_ROLE_REVISION_CONFLICT");
	const changes = z.array(selectionChangeSchema).parse(batch.changes);
	if (new Set(changes.map((change) => change.role)).size !== changes.length)
		throw new Error("PROJECT_ROLE_DUPLICATE_ROLE");
	const effective = changes.filter(
		(change) => change.binding !== null || config.current[change.role] !== null,
	);
	if (effective.length === 0) return freeze(config);
	if (config.revision === Number.MAX_SAFE_INTEGER)
		throw new Error("PROJECT_ROLE_REVISION_EXHAUSTED");
	for (const change of effective) {
		const { role } = change;
		const previousId = config.current[role];
		if (change.binding !== null) {
			const fields = change.binding;
			if (config.bindings.some((item) => item.bindingId === fields.bindingId))
				throw new Error("PROJECT_ROLE_BINDING_ID_EXISTS");
			config.bindings.push(
				projectRoleBindingSchema.parse({
					...fields,
					role,
					...(previousId === null ? {} : { previousBindingId: previousId }),
				}),
			);
			config.current[role] = fields.bindingId;
		} else {
			config.current[role] = null;
		}
		if (previousId !== null) {
			let retained = config.retained.find(
				(item) => item.bindingId === previousId,
			);
			if (!retained) {
				retained = { bindingId: previousId, uses: [] };
				config.retained.push(retained);
			}
			retained.uses = [
				...new Set([...retained.uses, ...requiredRetention[role]]),
			];
		}
	}
	config.revision += 1;
	return parseProjectRoleBindings(config);
}

/** Single-role convenience form with the same batch validation and history rules. */
export function changeProjectRoleBinding(
	input: unknown,
	change: ProjectRoleChange,
): Immutable<ProjectRoleBindings> {
	return changeProjectRoleBindings(input, {
		expectedProjectId: change.expectedProjectId,
		expectedRevision: change.expectedRevision,
		changes: [{ role: change.role, binding: change.binding }],
	});
}

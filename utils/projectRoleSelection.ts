import { z } from "zod";
import {
	changeProjectRoleBindings,
	PROJECT_KEY_ROLES,
	type ProjectKeyRole,
	type ProjectRoleSelectionChange,
	parseProjectRoleBindings,
	projectRoleBindingSchema,
} from "./projectRoleBindings";

const choice = z
	.string()
	.regex(/^(unassigned|(?:keep|select):[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127})$/);
export const projectRoleAssignmentsSchema = z
	.object({
		"identity-signing": choice,
		payments: choice,
		"one-sat": choice,
		encryption: choice,
	})
	.strict();
export const projectRoleSelectionRequestSchema = z
	.object({
		expectedProjectId: z.string().min(1),
		expectedRevision: z
			.number()
			.int()
			.nonnegative()
			.max(Number.MAX_SAFE_INTEGER)
			.nullable(),
		roleAssignments: projectRoleAssignmentsSchema,
	})
	.strict();
export type ProjectRoleSelectionRequest = z.infer<
	typeof projectRoleSelectionRequestSchema
>;
export type ProjectRoleAssignments = z.infer<
	typeof projectRoleAssignmentsSchema
>;

/** Trusted public inventory, never accepted from the browser as authorization. */
export interface ProjectRoleCandidate {
	candidateId: string;
	label: string;
	accountId?: string;
	key?: z.infer<typeof projectRoleBindingSchema>["key"];
	keyUseContract?: z.infer<typeof projectRoleBindingSchema>["keyUseContract"];
	supportedRoles: readonly ProjectKeyRole[];
	unavailableReason?: string;
	publicDerivationLabel?: string;
}

const labels: Record<ProjectKeyRole, string> = {
	"identity-signing": "Identity signing",
	payments: "Payments",
	"one-sat": "OneSat assets",
	encryption: "Encryption",
};
function escapeHtml(value: string): string {
	return value.replace(
		/[&<>"']/g,
		(character) =>
			({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
				character
			] ?? character,
	);
}
function candidatesById(candidates: readonly ProjectRoleCandidate[]) {
	const map = new Map<string, ProjectRoleCandidate>();
	for (const candidate of candidates) {
		if (
			!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/.test(candidate.candidateId) ||
			map.has(candidate.candidateId)
		)
			throw new Error("PROJECT_ROLE_INVALID_CANDIDATE_ID");
		map.set(candidate.candidateId, candidate);
	}
	return map;
}
function unavailable(
	candidate: ProjectRoleCandidate,
	role: ProjectKeyRole,
): string | undefined {
	if (candidate.unavailableReason) return candidate.unavailableReason;
	if (!candidate.supportedRoles.includes(role))
		return "This key does not support this role";
	if (candidate.keyUseContract !== "direct-v1" || candidate.key?.derivation)
		return "Derived key profiles are not supported by this controller";
	if (!candidate.accountId || !candidate.key)
		return "Verified account and public key references are required";
	return undefined;
}

/** Only selects references; caller must persist under the store's revision lock. */
export function prepareProjectRoleSelection(
	current: unknown,
	candidates: readonly ProjectRoleCandidate[],
	requestInput: unknown,
	metadata: {
		createBindingId: (role: ProjectKeyRole) => string;
		now: string;
		expectedProjectId?: string;
	},
) {
	const request = projectRoleSelectionRequestSchema.parse(requestInput);
	const initial = current === null;
	if (
		initial &&
		(!metadata.expectedProjectId ||
			metadata.expectedProjectId !== request.expectedProjectId)
	)
		throw new Error("PROJECT_ROLE_PROJECT_MISMATCH");
	const config = parseProjectRoleBindings(
		initial
			? {
					schemaVersion: 1,
					projectId: metadata.expectedProjectId,
					revision: 0,
					current: {
						"identity-signing": null,
						payments: null,
						"one-sat": null,
						encryption: null,
					},
					bindings: [],
					retained: [],
				}
			: current,
	);
	if (config.projectId !== request.expectedProjectId)
		throw new Error("PROJECT_ROLE_PROJECT_MISMATCH");
	if ((initial ? null : config.revision) !== request.expectedRevision)
		throw new Error("PROJECT_ROLE_REVISION_CONFLICT");
	const inventory = candidatesById(candidates);
	const changes: ProjectRoleSelectionChange[] = [];
	for (const role of PROJECT_KEY_ROLES) {
		const selection = request.roleAssignments[role];
		if (selection === "unassigned") {
			changes.push({ role, binding: null });
			continue;
		}
		if (selection.startsWith("keep:")) {
			if (config.current[role] !== selection.slice(5))
				throw new Error("PROJECT_ROLE_SELECTION_STALE");
			continue;
		}
		const candidate = inventory.get(selection.slice(7));
		if (!candidate || unavailable(candidate, role))
			throw new Error("PROJECT_ROLE_CANDIDATE_UNAVAILABLE");
		const binding = projectRoleBindingSchema.parse({
			bindingId: metadata.createBindingId(role),
			role,
			accountId: candidate.accountId,
			key: candidate.key,
			keyUseContract: candidate.keyUseContract,
			createdAt: metadata.now,
		});
		const { role: _role, ...fields } = binding;
		changes.push({ role, binding: fields });
	}
	if (initial) {
		const bindings = changes.flatMap(({ role, binding }) =>
			binding ? [{ ...binding, role }] : [],
		);
		return parseProjectRoleBindings({
			...config,
			current: Object.fromEntries(
				PROJECT_KEY_ROLES.map((role) => [
					role,
					bindings.find((binding) => binding.role === role)?.bindingId ?? null,
				]),
			),
			bindings,
		});
	}
	return changeProjectRoleBindings(config, {
		expectedProjectId: request.expectedProjectId,
		expectedRevision: config.revision,
		changes,
	});
}

/** Public HTML fragment; host owns its form, CSRF checks and submission handler. */
export function renderProjectRoleSelection(
	current: unknown,
	candidates: readonly ProjectRoleCandidate[],
	options?: { expectedProjectId: string },
): string {
	const initial = current === null;
	const config = parseProjectRoleBindings(
		initial
			? {
					schemaVersion: 1,
					projectId: options?.expectedProjectId,
					revision: 0,
					current: {
						"identity-signing": null,
						payments: null,
						"one-sat": null,
						encryption: null,
					},
					bindings: [],
					retained: [],
				}
			: current,
	);
	candidatesById(candidates);
	const roles = PROJECT_KEY_ROLES.map((role) => {
		const selected = config.bindings.find(
			(binding) => binding.bindingId === config.current[role],
		);
		const references = (binding: typeof selected) =>
			binding
				? `Account: ${escapeHtml(binding.accountId)}; Vault: ${escapeHtml(binding.key.vaultId)}; Entry: ${escapeHtml(binding.key.entryId)}; Public key: <code>${escapeHtml(binding.key.expectedPublicKey)}</code>; Contract: ${escapeHtml(binding.keyUseContract)}${binding.key.derivation ? `; Derivation: ${escapeHtml(JSON.stringify(binding.key.derivation))}` : ""}`
				: "Unassigned";
		const keep = selected
			? `<option value="keep:${escapeHtml(selected.bindingId)}" selected>Keep current selection</option>`
			: "";
		const options = candidates
			.map((candidate) => {
				const reason = unavailable(candidate, role);
				return `<option value="select:${escapeHtml(candidate.candidateId)}"${reason ? " disabled" : ""}>${escapeHtml(candidate.label)}${candidate.publicDerivationLabel ? ` (${escapeHtml(candidate.publicDerivationLabel)})` : ""}${reason ? ` — ${escapeHtml(reason)}` : ""}</option>`;
			})
			.join("");
		const history = config.bindings
			.filter(
				(binding) =>
					binding.role === role && binding.bindingId !== config.current[role],
			)
			.map(
				(binding) =>
					`<li>${references(binding)}; Retained for: ${escapeHtml(config.retained.find((item) => item.bindingId === binding.bindingId)?.uses.join(", ") ?? "")}</li>`,
			)
			.join("");
		return `<fieldset data-project-role="${role}"><legend>${labels[role]}</legend><p>${references(selected)}</p><label for="project-role-${role}">Use key for ${labels[role]}</label><select id="project-role-${role}" name="roleAssignments[${role}]">${keep}<option value="unassigned"${selected ? "" : " selected"}>Unassigned</option>${options}</select><details><summary>Historical public references</summary>${history ? `<ul>${history}</ul>` : "<p>No historical keys</p>"}</details></fieldset>`;
	}).join("");
	return `<section aria-label="Project key roles"><input type="hidden" name="expectedProjectId" value="${escapeHtml(config.projectId)}"><input type="hidden" name="expectedRevision" value="${initial ? "null" : config.revision}">${roles}</section>`;
}

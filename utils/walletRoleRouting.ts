import { AsyncLocalStorage } from "node:async_hooks";
import type { OneSatContext } from "@1sat/actions";
import type { WalletInterface } from "@bsv/sdk";
import type { McpServer, ServerContext } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getMcpSessionPrincipal } from "./mcpSessionPrincipal";
import type { WalletRoleContexts } from "./walletRoles";

export const walletRoleSchema = z.enum([
	"payments",
	"identity",
	"ordinals",
	"encryption",
]);
type WalletRole = z.infer<typeof walletRoleSchema>;
type Invocation = { role?: WalletRole; principal: string };
type ActionBinding = {
	role: WalletRole;
	wallet: WalletInterface;
	principal: string;
	settling?: boolean;
};
const actionBindings = new WeakMap<
	WalletRoleContexts,
	Map<string, ActionBinding>
>();
const identityMethods = new Set([
	"getPublicKey",
	"createSignature",
	"verifySignature",
	"acquireCertificate",
	"listCertificates",
	"proveCertificate",
	"relinquishCertificate",
	"discoverByIdentityKey",
	"discoverByAttributes",
	"revealCounterpartyKeyLinkage",
	"revealSpecificKeyLinkage",
]);
const encryptionMethods = new Set([
	"encrypt",
	"decrypt",
	"createHmac",
	"verifyHmac",
]);
const commonMethods = new Set([
	"isAuthenticated",
	"waitForAuthentication",
	"getHeight",
	"getHeaderForHeight",
	"getNetwork",
	"getVersion",
]);
const assetBaskets = new Set([
	"1sat",
	"bsv21",
	"opns",
	"lock",
	"sigma",
	"bsocial",
]);

function basketRole(basket: unknown): WalletRole | undefined {
	if (basket === "bap") return "identity";
	return typeof basket === "string" && assetBaskets.has(basket)
		? "ordinals"
		: undefined;
}

/** Per-tool role selection never changes a shared wallet object or global key. */
export function createWalletRoleRouting(roles: WalletRoleContexts) {
	const scope = new AsyncLocalStorage<Invocation>();
	const bindings =
		actionBindings.get(roles) ?? new Map<string, ActionBinding>();
	actionBindings.set(roles, bindings);
	const roleContext = (role: WalletRole): OneSatContext | undefined =>
		role === "encryption"
			? roles.encryption === undefined
				? roles.identity
				: (roles.encryption ?? undefined)
			: roles[role];
	const primary =
		roles.payments ?? roles.identity ?? roles.ordinals ?? roles.encryption;
	if (!primary) throw new Error("No wallet key roles are assigned");
	const wallet = new Proxy(Object.create(null) as WalletInterface, {
		get(_target, property) {
			if (typeof property !== "string") return undefined;
			return async (...args: unknown[]) => {
				const invocation = scope.getStore();
				if (!invocation)
					throw new Error(
						"Wallet role selection requires an active tool request",
					);
				const input = (args[0] ?? {}) as Record<string, unknown>;
				const reference =
					typeof input.reference === "string" ? input.reference : undefined;
				const candidates = reference
					? [...bindings.entries()].filter(([key]) => key.endsWith(`\0${reference}`)).map(([, binding]) => binding)
					: [];
				if (!invocation.role && candidates.length > 1)
					throw new Error("This action reference exists in multiple wallets; specify walletRole");
				const binding = invocation.role && reference
					? bindings.get(`${invocation.role}\0${reference}`) ?? candidates[0]
					: candidates[0];
				let role = invocation.role;
				if (
					!role &&
					binding &&
					(property === "signAction" || property === "abortAction")
				)
					role = binding.role;
				if (!role) {
					if (identityMethods.has(property)) role = "identity";
					else if (encryptionMethods.has(property)) role = "encryption";
					else role = basketRole(input.basket) ?? "payments";
				}
				if (
					!invocation.role &&
					property === "createAction" &&
					Array.isArray(input.outputs)
				) {
					const outputRoles = new Set(
						input.outputs
							.map((output) => basketRole(output?.basket))
							.filter(Boolean),
					);
					if (outputRoles.size > 1)
						throw new Error(
							"Choose walletRole explicitly for an action with multiple key roles",
						);
					role = [...outputRoles][0] ?? role;
				}
				const selected =
					commonMethods.has(property) && !invocation.role
						? primary
						: roleContext(role);
				if (!selected)
					throw new Error(
						`No ${role} key is assigned. Configure the wallet role before using this operation.`,
					);
				if (
					binding &&
					(property === "signAction" || property === "abortAction")
				) {
					if (
						binding.role !== role ||
						binding.wallet !== selected.wallet ||
						binding.principal !== invocation.principal
					) {
						throw new Error(
							"Action reference belongs to another wallet role or authenticated user",
						);
					}
					if (binding.settling) throw new Error("This action has already been submitted for settlement; inspect wallet history before retrying");
				}
				if (property === "createAction" && bindings.size >= 4096)
					throw new Error(
						"Too many retained action references; restart only after settling pending actions",
					);
				const method = Reflect.get(selected.wallet, property, selected.wallet);
				if (typeof method !== "function")
					throw new Error(`Wallet method ${property} is unavailable`);
				if (binding && (property === "signAction" || property === "abortAction")) binding.settling = true;
				const result = await Reflect.apply(method, selected.wallet, args);
				if (property === "createAction") {
					const created = result as Awaited<
						ReturnType<WalletInterface["createAction"]>
					>;
					if (created?.signableTransaction?.reference)
						bindings.set(`${role}\0${created.signableTransaction.reference}`, {
							role,
							wallet: selected.wallet,
							principal: invocation.principal,
						});
				}
				return result;
			};
		},
	});
	const ctx = Object.create(Object.getPrototypeOf(primary)) as OneSatContext;
	const descriptors = Object.getOwnPropertyDescriptors(primary);
	Reflect.deleteProperty(descriptors, "wallet");
	Object.defineProperties(ctx, descriptors);
	Object.defineProperty(ctx, "wallet", { value: wallet, enumerable: true });
	return {
		ctx,
		/** Add a common optional root selector without forwarding it to BRC-100. */
		server(server: McpServer): McpServer {
			return new Proxy(server, {
				get(target, property, receiver) {
					if (property !== "registerTool")
						return Reflect.get(target, property, receiver);
					return (
						name: string,
						config: { inputSchema: z.ZodObject; [key: string]: unknown },
						callback: (
							args: Record<string, unknown>,
							ctx: ServerContext,
						) => unknown,
					) => {
						const inputSchema = config.inputSchema.extend({
							walletRole: walletRoleSchema
								.optional()
								.describe(
									"Select the configured root key for this BRC-100 call. Defaults to the role for the method; action continuations retain their original role.",
								),
						});
						return Reflect.apply(target.registerTool, target, [
							name,
							{ ...config, inputSchema },
							(args: Record<string, unknown>, ctx: ServerContext) => {
								const { walletRole, ...input } = args;
								return scope.run(
									{
										role: walletRoleSchema.optional().parse(walletRole),
										principal: getMcpSessionPrincipal(ctx?.http?.authInfo),
									},
									() => callback(input, ctx),
								);
							},
						]);
					};
				},
			});
		},
	};
}

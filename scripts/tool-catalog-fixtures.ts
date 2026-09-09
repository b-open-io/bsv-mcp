import type { OneSatContext } from "@1sat/actions";
import { PrivateKey } from "@bsv/sdk";
import type { ToolsConfig } from "../tools";
import type { IntegratedWallet } from "../tools/wallet/integratedWallet";
import { Wallet } from "../tools/wallet/wallet";
import type { DroplitClient } from "../utils/droplit";

/** Registration fixtures only. Calling a wallet or service is always an error. */
const unavailable = new Proxy(
	{},
	{
		get(_target, property) {
			if (property === "then") return undefined;
			return () => {
				throw new Error(`Catalog fixture attempted ${String(property)}`);
			};
		},
	},
);
const embedded = {
	wallet: unavailable,
	services: unavailable,
	chain: "main",
	isBaseWallet: true,
} as unknown as OneSatContext;
const external = { ...embedded, isBaseWallet: false } as OneSatContext;
const sponsor = {
	getConfig: () => ({
		apiUrl: "https://sponsor.example",
		faucetName: "example",
	}),
} as DroplitClient;

export const catalogModes = [
	{
		id: "walletless",
		label: "Before wallet setup",
		description: "Public tools and browser onboarding; no local keys loaded.",
	},
	{
		id: "legacy",
		label: "Legacy local wallet",
		description:
			"Existing local Wallet adapter with account management and local identity support.",
	},
	{
		id: "legacy-identity",
		label: "Legacy local identity",
		description:
			"Legacy wallet with an established identity and HD BAP configuration.",
	},
	{
		id: "broadcast-disabled",
		label: "Local Vault · broadcasting disabled",
		description:
			"All wallet roles assigned, with guarded transaction submission disabled.",
	},
	{
		id: "embedded",
		label: "Local Vault · all roles",
		description:
			"An unlocked embedded wallet with payment, identity and ordinals roles assigned.",
	},
	{
		id: "payments-role",
		label: "Local Vault · payment role only",
		description: "Identity, encryption and ordinals roles explicitly disabled.",
	},
	{
		id: "no-roles",
		label: "Local Vault · no roles",
		description:
			"Full catalog startup is rejected when no signing roles are assigned; compact public reads remain available.",
	},
	{
		id: "project-payments",
		label: "Project · payments scope",
		description: "A project context limited to its payment-safe wallet calls.",
	},
	{
		id: "external",
		label: "External BRC-100 wallet",
		description:
			"A connected signer that owns its keys and permissions; no local account tools.",
	},
	{
		id: "sponsored",
		label: "Local Vault + sponsor",
		description:
			"An embedded wallet with a separately configured Droplit sponsor.",
	},
	{
		id: "droplit",
		label: "Droplit wallet",
		description:
			"The integrated sponsored-wallet mode with faucet setup tools.",
	},
] as const;
export type CatalogMode = (typeof catalogModes)[number]["id"];

export function catalogFixture(id: CatalogMode): ToolsConfig {
	const base: ToolsConfig = {
		wallet: undefined,
		disableBroadcasting: false,
		enableAccountTools: false,
	};
	const roles = { payments: embedded, identity: embedded, ordinals: embedded };
	switch (id) {
		case "walletless":
			return {
				...base,
				bapPublicOnly: true,
				enableMneeTools: false,
				walletSetupNeeded: true,
				openWalletSetup: async () => {},
			};
		case "legacy":
			return {
				...base,
				wallet: Object.create(Wallet.prototype) as Wallet,
				enableAccountTools: true,
				localAccountAvailable: true,
			};
		case "legacy-identity":
			return {
				...base,
				wallet: Object.create(Wallet.prototype) as Wallet,
				identityPk: PrivateKey.fromString("1", "hex"),
				xprv: "registration-only-not-a-real-key",
				enableAccountTools: true,
			};
		case "broadcast-disabled":
			return {
				...base,
				ctx: embedded,
				roleContexts: roles,
				disableBroadcasting: true,
				enableAccountTools: true,
			};
		case "embedded":
			return {
				...base,
				ctx: embedded,
				roleContexts: roles,
				enableAccountTools: true,
			};
		case "payments-role":
			return {
				...base,
				ctx: embedded,
				roleContexts: { payments: embedded, encryption: null },
				enableAccountTools: true,
			};
		case "no-roles":
			return {
				...base,
				ctx: embedded,
				roleContexts: { encryption: null },
				enableAccountTools: true,
			};
		case "project-payments":
			return {
				...base,
				ctx: embedded,
				roleContexts: { payments: embedded },
				walletScope: "payments",
				bapPublicOnly: true,
				enableAccountTools: false,
				enableBsocialTools: false,
				enableMneeTools: false,
			};
		case "external":
			return {
				...base,
				ctx: external,
				externalWallet: true,
				bapPublicOnly: true,
				enableBsocialTools: false,
				enableMneeTools: false,
			};
		case "sponsored":
			return {
				...base,
				ctx: embedded,
				roleContexts: roles,
				enableAccountTools: true,
				droplitClient: sponsor,
				droplitApiUrl: "https://sponsor.example",
			};
		case "droplit":
			return {
				...base,
				droplitClient: sponsor,
				droplitApiUrl: "https://sponsor.example",
				bapPublicOnly: true,
				enableMneeTools: false,
				integratedWallet: {
					isDroplitMode: true,
					getDroplitClient: () => sponsor,
				} as unknown as IntegratedWallet,
			};
	}
}

import { PrivateKey } from "@bsv/sdk";
import {
	type EmbeddedVaultBinding as AccountVaultBinding,
	accountNameSchema,
	embeddedVaultBindingSchema,
	readAccount,
} from "./accounts";
import {
	createEmbeddedVaultIo,
	type EmbeddedVaultIo,
	type EmbeddedVaultReceipt,
} from "./embeddedVaultIo";
import { initWallet, type WalletInitResult } from "./walletInit";

/**
 * Errors from the activation boundary deliberately contain no account path,
 * passphrase, WIF, or Vault implementation detail. The browser can display
 * these messages directly while the server keeps the wallet context private.
 */
export class EmbeddedWalletActivationError extends Error {
	readonly code: "INVALID_REQUEST" | "BUSY" | "BINDING_MISMATCH" | "FAILED";

	constructor(
		code: "INVALID_REQUEST" | "BUSY" | "BINDING_MISMATCH" | "FAILED",
		message: string,
	) {
		super(message);
		this.name = "EmbeddedWalletActivationError";
		this.code = code;
	}
}

const failure = (
	code: EmbeddedWalletActivationError["code"],
): EmbeddedWalletActivationError => {
	const message = {
		INVALID_REQUEST: "The embedded wallet activation request is invalid.",
		BUSY: "Another embedded wallet activation is already in progress.",
		BINDING_MISMATCH:
			"The embedded wallet binding does not match the selected account.",
		FAILED: "Embedded wallet activation failed.",
	} as const;
	return new EmbeddedWalletActivationError(code, message[code]);
};

export interface EmbeddedWalletActivationRequest {
	accountName: string;
	password: string;
	binding: AccountVaultBinding;
}

/** The initializer is kept narrow so tests cannot accidentally return secrets. */
export type EmbeddedWalletInitializer = (
	privateKey: PrivateKey,
	chain: "main" | "test",
	options: { accountName: string },
) => Promise<WalletInitResult>;

export interface EmbeddedWalletActivationOptions {
	vaultPath: string;
	/** Defaults to the production Vault-backed embedded wallet initializer. */
	initializeWallet?: EmbeddedWalletInitializer;
	/** Defaults to the production Vault I/O facade for `vaultPath`. */
	io?: EmbeddedVaultIo;
}

export interface EmbeddedWalletActivation {
	activate(request: EmbeddedWalletActivationRequest): Promise<WalletInitResult>;
}

function sameBinding(a: AccountVaultBinding, b: AccountVaultBinding): boolean {
	if (
		a.version !== b.version ||
		a.contract !== b.contract ||
		a.vaultId !== b.vaultId ||
		a.payment.entryId !== b.payment.entryId ||
		a.payment.publicKey.toLowerCase() !== b.payment.publicKey.toLowerCase()
	)
		return false;
	if (!!a.identity !== !!b.identity || !!a.hd !== !!b.hd) return false;
	if (a.identity && b.identity) {
		if (
			a.identity.entryId !== b.identity.entryId ||
			a.identity.publicKey.toLowerCase() !== b.identity.publicKey.toLowerCase()
		)
			return false;
	}
	if (a.hd && b.hd) {
		if (
			a.hd.entryId !== b.hd.entryId ||
			a.hd.expectedXpub !== b.hd.expectedXpub
		)
			return false;
	}
	return true;
}

function asVaultReceipt(binding: AccountVaultBinding): EmbeddedVaultReceipt {
	return {
		vaultId: binding.vaultId,
		payment: { ...binding.payment },
		...(binding.identity ? { identity: { ...binding.identity } } : {}),
		...(binding.hd ? { hd: { ...binding.hd } } : {}),
	};
}

function addressForKey(key: PrivateKey, chain: "main" | "test"): string {
	return key.toAddress(chain === "test" ? [0x6f] : [0x00]);
}

function safeError(error: unknown): EmbeddedWalletActivationError {
	return error instanceof EmbeddedWalletActivationError
		? error
		: failure("FAILED");
}

/**
 * Build the in-process activation seam used after browser setup. The Vault
 * password is consumed only by `io.unlock`; the returned wallet context owns
 * all runtime resources and no key material crosses this boundary.
 */
export function createEmbeddedWalletActivation(
	options: EmbeddedWalletActivationOptions,
): EmbeddedWalletActivation {
	const io =
		options.io ?? createEmbeddedVaultIo({ vaultPath: options.vaultPath });
	const initialize = options.initializeWallet ?? initWallet;
	let inFlight = false;
	let active: WalletInitResult | undefined;

	const activate = async (
		request: EmbeddedWalletActivationRequest,
	): Promise<WalletInitResult> => {
		if (inFlight || active !== undefined) throw failure("BUSY");
		inFlight = true;
		let initialized: WalletInitResult | undefined;
		let initializedDestroyed = false;
		const destroyInitialized = async (): Promise<void> => {
			if (
				!initialized ||
				initializedDestroyed ||
				typeof initialized.destroy !== "function"
			)
				return;
			initializedDestroyed = true;
			try {
				await initialized.destroy();
			} catch {
				// Cleanup is best-effort; activation remains failed closed.
			}
		};
		let activationError: EmbeddedWalletActivationError | undefined;
		try {
			if (
				!request ||
				typeof request !== "object" ||
				!accountNameSchema.safeParse(request.accountName).success ||
				typeof request.password !== "string" ||
				request.password.length === 0
			)
				throw failure("INVALID_REQUEST");

			const parsedBinding = embeddedVaultBindingSchema.safeParse(
				request.binding,
			);
			if (!parsedBinding.success) throw failure("INVALID_REQUEST");

			let account: ReturnType<typeof readAccount>;
			try {
				account = readAccount(request.accountName);
			} catch {
				throw failure("FAILED");
			}
			if (!account?.vaultBinding || !account.address)
				throw failure("BINDING_MISMATCH");
			if (!sameBinding(account.vaultBinding, parsedBinding.data))
				throw failure("BINDING_MISMATCH");

			const keys = await io.unlock({
				password: request.password,
				binding: asVaultReceipt(parsedBinding.data),
			});
			const payPk = keys?.payPk;
			if (!(payPk instanceof PrivateKey)) throw failure("BINDING_MISMATCH");
			if (
				payPk.toPublicKey().toString().toLowerCase() !==
				parsedBinding.data.payment.publicKey.toLowerCase()
			)
				throw failure("BINDING_MISMATCH");
			const rootAddressMatches =
				addressForKey(payPk, account.chain) === account.address;

			initialized = await initialize(payPk, account.chain, {
				accountName: request.accountName,
			});
			if (
				!initialized ||
				typeof initialized !== "object" ||
				!initialized.wallet ||
				!initialized.services ||
				!initialized.ctx ||
				typeof initialized.depositAddress !== "string" ||
				typeof initialized.destroy !== "function"
			)
				throw failure("FAILED");
			if (!rootAddressMatches && initialized.depositAddress !== account.address)
				throw failure("BINDING_MISMATCH");
		} catch (error) {
			await destroyInitialized();
			activationError = safeError(error);
		}
		try {
			io.lock();
		} catch {
			await destroyInitialized();
			activationError = failure("FAILED");
		}
		inFlight = false;
		if (activationError) throw activationError;

		const result = initialized;
		if (!result) throw failure("FAILED");
		let destroyed = false;
		let trustedResult: WalletInitResult;
		const destroy = async (): Promise<void> => {
			if (destroyed) return;
			destroyed = true;
			try {
				await result.destroy();
			} finally {
				if (active === trustedResult) active = undefined;
			}
		};
		trustedResult = Object.freeze({
			wallet: result.wallet,
			services: result.services,
			ctx: result.ctx,
			depositAddress: result.depositAddress,
			destroy,
		});
		active = trustedResult;
		return trustedResult;
	};

	return { activate };
}

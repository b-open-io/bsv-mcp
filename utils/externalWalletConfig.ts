import type { OneSatContext } from "@1sat/actions";

/** Explicit signer selection must happen before any local key access. */
export interface ExternalWalletConfig {
	url: string;
	originator: string;
}

/**
 * An out-of-band marker for contexts returned by initExternalWallet.
 *
 * OneSat's context defaults `isBaseWallet` to true, and that field has action
 * routing semantics of its own. Keep the MCP custody distinction separate so
 * a caller can pass the returned context directly to a server factory without
 * re-advertising owner-only reads.
 */
export const EXTERNAL_WALLET_CONTEXT = Symbol.for(
	"bsv-mcp.external-wallet-context",
);

export type ExternalWalletContext = OneSatContext & {
	readonly [EXTERNAL_WALLET_CONTEXT]: true;
};

export function markExternalWalletContext(
	ctx: OneSatContext,
): ExternalWalletContext {
	Object.defineProperty(ctx, EXTERNAL_WALLET_CONTEXT, {
		value: true,
		enumerable: false,
		configurable: false,
		writable: false,
	});
	return ctx as ExternalWalletContext;
}

export function isExternalWalletContext(
	ctx: OneSatContext | undefined,
): ctx is ExternalWalletContext {
	return (
		ctx !== undefined &&
		(ctx as ExternalWalletContext)[EXTERNAL_WALLET_CONTEXT] === true
	);
}

export function readExternalWalletConfig(
	env: Record<string, string | undefined> = process.env,
): ExternalWalletConfig | undefined {
	const raw = env.BRC100_WALLET_URL;
	if (raw === undefined) {
		if (env.BRC100_WALLET_ORIGINATOR !== undefined) {
			throw new Error("BRC100_WALLET_ORIGINATOR requires BRC100_WALLET_URL");
		}
		return undefined;
	}
	for (const name of ["PRIVATE_KEY_WIF", "IDENTITY_KEY_WIF"]) {
		if (env[name] !== undefined) {
			throw new Error(
				`BRC100_WALLET_URL conflicts with ${name}; select one wallet identity`,
			);
		}
	}
	if (env.USE_DROPLIT_API === "true") {
		throw new Error("BRC100_WALLET_URL conflicts with USE_DROPLIT_API");
	}
	let url: URL;
	try {
		url = new URL(raw);
	} catch {
		throw new Error("BRC100_WALLET_URL must be a valid signer RPC URL");
	}
	const loopback =
		url.hostname === "localhost" ||
		url.hostname === "[::1]" ||
		/^127\.(?:\d{1,3}\.){2}\d{1,3}$/.test(url.hostname);
	if (
		!raw ||
		raw !== raw.trim() ||
		/[\\\s@?]/.test(raw) ||
		url.username ||
		url.password ||
		raw.includes("#") ||
		url.search ||
		!(url.protocol === "https:" || (url.protocol === "http:" && loopback))
	) {
		throw new Error(
			"BRC100_WALLET_URL requires HTTPS or HTTP loopback, without credentials, queries or fragments",
		);
	}
	const originator = env.BRC100_WALLET_ORIGINATOR ?? "bsv-mcp.local";
	let origin: URL;
	try {
		origin = new URL(
			originator.includes("://") ? originator : `http://${originator}`,
		);
	} catch {
		throw new Error(
			"BRC100_WALLET_ORIGINATOR must be a domain or HTTP(S) origin",
		);
	}
	if (
		!originator ||
		/[\s\\]/.test(originator) ||
		originator.length >= 250 ||
		!["http:", "https:"].includes(origin.protocol) ||
		origin.username ||
		origin.password ||
		origin.pathname !== "/" ||
		origin.search ||
		/[#?@]/.test(originator) ||
		!/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*|\[::1\])$/i.test(
			origin.hostname,
		) ||
		origin.hostname.toLowerCase() === "admin.bsv-mcp.internal"
	) {
		throw new Error(
			"BRC100_WALLET_ORIGINATOR must be a non-admin domain or HTTP(S) origin without credentials, path, query or fragment",
		);
	}
	return { url: url.toString().replace(/\/$/, ""), originator };
}

export async function initializeKeysForWalletMode<T>(
	external: ExternalWalletConfig | undefined,
	loadLocalKeys: () => Promise<T>,
): Promise<T | undefined> {
	return external ? undefined : loadLocalKeys();
}

import { OneSatServices } from "@1sat/client";

/** Deployment configuration, never populated from tool arguments. Paths are allowed for proxies. */
export function backendUrl(name: string, fallback: string): string {
	const value = process.env[name] ?? fallback;
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		throw new Error(`${name} must be an absolute HTTP(S) URL`);
	}
	if (
		!["http:", "https:"].includes(url.protocol) ||
		url.username ||
		url.password ||
		url.search ||
		url.hash
	) {
		throw new Error(
			`${name} must be an HTTP(S) URL without credentials, query or fragment`,
		);
	}
	return url.toString().replace(/\/+$/, "");
}

export function configuredChain(): "main" | "test" {
	const chain = process.env.BSV_CHAIN ?? "main";
	if (chain !== "main" && chain !== "test")
		throw new Error("BSV_CHAIN must be main or test");
	return chain;
}

export function onesatUrl(chain = configuredChain()): string {
	return backendUrl(
		"ONESAT_API_URL",
		chain === "main" ? "https://api.1sat.app" : "https://testnet.api.1sat.app",
	);
}

export function explorerUrl(chain = configuredChain()): string {
	// Preserve existing deployments; the neutral setting takes precedence.
	const setting =
		process.env.EXPLORER_API_URL !== undefined
			? "EXPLORER_API_URL"
			: process.env.WOC_API_URL !== undefined
				? "WOC_API_URL"
				: "EXPLORER_API_URL";
	const fallback =
		chain === "main"
			? "https://bananablocks.com/api/v1/bsv"
			: "https://api.whatsonchain.com/v1/bsv";
	return `${backendUrl(setting, fallback)}/${chain}`;
}

export function junglebusUrl(): string {
	return backendUrl("JUNGLEBUS_API_URL", "https://junglebus.gorillapool.io/v1");
}

export function legacyOrdinalsUrl(): string {
	return backendUrl("ORDINALS_API_URL", "https://ordinals.gorillapool.io/api");
}

export function contentUrl(base = onesatUrl()): string {
	return backendUrl("PUBLIC_ORDFS_URL", `${base}/content`);
}

/** Read clients require neither private keys nor a wallet connection. */
export function readServices(existing?: OneSatServices): OneSatServices {
	return existing ?? new OneSatServices(configuredChain(), onesatUrl());
}

/** Apply an explorer key only to the configured explorer; never follow redirects with it. */
export function explorerFetch(
	url: string,
	init: RequestInit = {},
): Promise<Response> {
	const headers = new Headers(init.headers);
	const key = process.env.EXPLORER_API_KEY;
	if (key) {
		const target = new URL(url);
		const base = new URL(explorerUrl());
		// Explicit network overrides share the same configured API base.
		const prefix = base.pathname.replace(/\/(main|test)$/, "/");
		if (target.origin !== base.origin || !target.pathname.startsWith(prefix))
			throw new Error(
				"Explorer API key cannot be sent outside the configured explorer",
			);
		if (
			target.protocol !== "https:" &&
			!["localhost", "127.0.0.1", "[::1]"].includes(target.hostname)
		)
			throw new Error("Explorer API keys require HTTPS or localhost");
		headers.set("X-API-Key", key);
	}
	return fetch(url, {
		...init,
		headers,
		redirect: "error",
		signal: init.signal ?? AbortSignal.timeout(10_000),
	});
}

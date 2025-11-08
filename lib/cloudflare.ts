// Helper to get CloudFlare env from the request context

interface CloudflareContext {
	env?: Record<string, unknown>;
}

interface CloudflareGlobal extends Record<symbol, unknown> {
	[key: symbol]: unknown;
}

export function getCloudflareEnv(): Record<string, unknown> | undefined {
	// Try different ways to access the CloudFlare env
	const context = (globalThis as CloudflareGlobal)[
		Symbol.for("__cloudflare-context__")
	] as CloudflareContext | undefined;
	if (context?.env) {
		return context.env;
	}

	// Fallback methods
	return undefined;
}

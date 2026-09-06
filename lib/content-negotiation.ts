/**
 * Minimal RFC 9110 Accept negotiation, used to serve markdown to agents and
 * HTML to browsers from the same URL.
 */

export interface AcceptEntry {
	type: string;
	subtype: string;
	q: number;
}

/** Parses an Accept header into media ranges with their quality values. */
export function parseAccept(header: string | null | undefined): AcceptEntry[] {
	if (!header) return [];

	const entries: AcceptEntry[] = [];
	for (const part of header.split(",")) {
		const [rawRange, ...params] = part.trim().split(";");
		const range = rawRange?.trim().toLowerCase();
		if (!range) continue;

		const [type, subtype] = range.split("/");
		if (!type || !subtype) continue;

		let q = 1;
		for (const param of params) {
			const [rawKey, rawValue] = param.split("=");
			if (rawKey?.trim().toLowerCase() !== "q") continue;
			const parsed = Number.parseFloat(rawValue ?? "");
			// An unparseable q is treated as 1, per "ignore invalid parameters".
			if (!Number.isNaN(parsed)) q = Math.min(Math.max(parsed, 0), 1);
		}

		entries.push({ type, subtype, q });
	}
	return entries;
}

/** Precedence: an exact match beats `type/*`, which beats `*​/*`. */
function specificity(entry: AcceptEntry): number {
	if (entry.type === "*") return 0;
	if (entry.subtype === "*") return 1;
	return 2;
}

/**
 * Returns the best media type to serve, or null when the client accepts none
 * of them (the caller should answer 406).
 *
 * `offered` is in server-preference order, which breaks ties — so a browser
 * sending `*​/*` keeps getting HTML.
 */
export function selectMediaType(
	header: string | null | undefined,
	offered: readonly string[],
): string | null {
	// No Accept header means the client will take anything.
	const entries = parseAccept(header);
	if (entries.length === 0) return offered[0] ?? null;

	let best: { media: string; q: number; specificity: number } | null = null;

	for (const media of offered) {
		const [type, subtype] = media.toLowerCase().split("/");

		let match: AcceptEntry | null = null;
		for (const entry of entries) {
			const matches =
				(entry.type === "*" && entry.subtype === "*") ||
				(entry.type === type && entry.subtype === "*") ||
				(entry.type === type && entry.subtype === subtype);
			if (!matches) continue;
			if (!match || specificity(entry) > specificity(match)) match = entry;
		}

		if (!match || match.q === 0) continue;

		const candidate = { media, q: match.q, specificity: specificity(match) };
		// Ties fall to server preference: `offered` is iterated in order and a
		// later entry must strictly beat the incumbent to replace it.
		if (!best || candidate.q > best.q) best = candidate;
	}

	return best?.media ?? null;
}

export const MEDIA_HTML = "text/html";
export const MEDIA_MARKDOWN = "text/markdown";

/** Media types the page routes can serve, in server-preference order. */
export const OFFERED_MEDIA = [MEDIA_HTML, MEDIA_MARKDOWN] as const;

/**
 * Vary must list Accept so a CDN cannot serve a cached HTML variant to an
 * agent asking for markdown. The Next router values are preserved because the
 * framework varies on them for prefetching.
 */
export const VARY_HEADER =
	"Accept, Accept-Encoding, RSC, Next-Router-State-Tree, Next-Router-Prefetch, Next-Router-Segment-Prefetch";

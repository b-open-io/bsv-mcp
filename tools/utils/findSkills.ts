import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { registerTool } from "./toolRegistration";

export const FIND_SKILLS_INDEX_URL =
	"https://bopen.ai/.well-known/agent-skills/index.json";
const EXPECTED_INDEX_SCHEMA =
	"https://schemas.agentskills.io/discovery/0.2.0/schema.json";
const CACHE_TTL_MS = 5 * 60 * 1000;
const FETCH_TIMEOUT_MS = 5000;
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const MAX_SKILLS = 5000;
const DESCRIPTION_CAP = 350;
const MAX_ID_LENGTH = 200;
const MAX_NAME_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_PLUGIN_LENGTH = 100;
const MAX_VERSION_LENGTH = 50;
const MAX_URL_LENGTH = 500;
const SKILL_URL_PATH = /^\/[^/]+\/[^/]+\/[0-9a-f]{40}\/.+\/SKILL\.md$/;

export const findSkillsInputSchema = z.object({
	query: z.string().trim().min(1).max(200),
	limit: z.number().int().min(1).max(5).default(3),
});

export type FindSkillsArgs = z.infer<typeof findSkillsInputSchema>;

export interface SkillSummary {
	id: string;
	name: string;
	description: string;
	plugin: string;
	version: string;
	url: string;
}

export type FindSkillsFetch = (
	url: string,
	init?: RequestInit,
) => Promise<Response>;

export interface FindSkillsDependencies {
	fetchFn?: FindSkillsFetch;
	now?: () => number;
}

function unavailable(reason: string): Error {
	return new Error(`skill-discovery-unavailable: ${reason}`);
}

function isAllowedSkillUrl(url: string): boolean {
	if (url.length < 1 || url.length > MAX_URL_LENGTH) return false;
	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		return false;
	}
	if (parsed.protocol !== "https:") return false;
	if (parsed.hostname !== "raw.githubusercontent.com") return false;
	if (parsed.username !== "" || parsed.password !== "") return false;
	// The URL parser drops default ports, so compare the raw authority to
	// reject explicit ports (including :443) and embedded credentials.
	const authority = url.slice(url.indexOf("://") + 3).split("/", 1)[0];
	if (authority !== "raw.githubusercontent.com") return false;
	if (parsed.search !== "" || parsed.hash !== "") return false;
	return SKILL_URL_PATH.test(parsed.pathname);
}

function isBoundedString(value: unknown, maxLength: number): value is string {
	return (
		typeof value === "string" && value.length >= 1 && value.length <= maxLength
	);
}

function normalizeEntry(entry: unknown): SkillSummary | null {
	if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
		return null;
	}
	const record = entry as Record<string, unknown>;
	if (record.type !== "skill-md") {
		return null;
	}
	if (
		!isBoundedString(record.id, MAX_ID_LENGTH) ||
		!isBoundedString(record.name, MAX_NAME_LENGTH) ||
		!isBoundedString(record.description, MAX_DESCRIPTION_LENGTH) ||
		!isBoundedString(record.plugin, MAX_PLUGIN_LENGTH) ||
		!isBoundedString(record.version, MAX_VERSION_LENGTH) ||
		!isBoundedString(record.url, MAX_URL_LENGTH) ||
		!isAllowedSkillUrl(record.url)
	) {
		return null;
	}
	return {
		id: record.id,
		name: record.name,
		description: record.description,
		plugin: record.plugin,
		version: record.version,
		url: record.url,
	};
}

function normalizeCatalog(value: unknown): SkillSummary[] {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		throw unavailable("malformed index");
	}
	const record = value as Record<string, unknown>;
	if (record.$schema !== EXPECTED_INDEX_SCHEMA) {
		throw unavailable("malformed index");
	}
	if (!Array.isArray(record.skills) || record.skills.length > MAX_SKILLS) {
		throw unavailable("malformed index");
	}
	const skills: SkillSummary[] = [];
	for (const entry of record.skills) {
		const skill = normalizeEntry(entry);
		if (skill) skills.push(skill);
	}
	return skills;
}

function tokenize(text: string): string[] {
	return text
		.toLowerCase()
		.split(/[^a-z0-9]+/)
		.filter((token) => token.length > 0);
}

function scoreSkill(
	skill: SkillSummary,
	lowerQuery: string,
	queryTokens: string[],
): number | null {
	const name = skill.name.toLowerCase();
	const id = skill.id.toLowerCase();
	const description = skill.description.toLowerCase();
	for (const token of queryTokens) {
		if (
			!name.includes(token) &&
			!id.includes(token) &&
			!description.includes(token)
		) {
			return null;
		}
	}
	let score = 0;
	if (name === lowerQuery || id === lowerQuery) score += 100;
	const nameTokens = new Set(tokenize(skill.name));
	const idTokens = new Set(tokenize(skill.id));
	for (const token of queryTokens) {
		if (nameTokens.has(token)) score += 10;
		else if (name.includes(token)) score += 5;
		if (idTokens.has(token)) score += 8;
		else if (id.includes(token)) score += 4;
		if (description.includes(token)) score += 1;
	}
	return score;
}

function matchSkills(
	skills: SkillSummary[],
	query: string,
	limit: number,
): SkillSummary[] {
	const queryTokens = tokenize(query);
	if (queryTokens.length === 0) return [];
	const lowerQuery = query.trim().toLowerCase();
	const scored: { skill: SkillSummary; score: number }[] = [];
	for (const skill of skills) {
		const score = scoreSkill(skill, lowerQuery, queryTokens);
		if (score !== null) scored.push({ skill, score });
	}
	scored.sort((a, b) => {
		if (b.score !== a.score) return b.score - a.score;
		if (a.skill.id < b.skill.id) return -1;
		if (a.skill.id > b.skill.id) return 1;
		return 0;
	});
	return scored.slice(0, limit).map(({ skill }) => ({
		id: skill.id,
		name: skill.name,
		description:
			skill.description.length > DESCRIPTION_CAP
				? skill.description.slice(0, DESCRIPTION_CAP)
				: skill.description,
		plugin: skill.plugin,
		version: skill.version,
		url: skill.url,
	}));
}

export function createFindSkillsHandler(deps: FindSkillsDependencies = {}) {
	const fetchFn: FindSkillsFetch =
		deps.fetchFn ?? ((url, init) => globalThis.fetch(url, init));
	const now: () => number = deps.now ?? (() => Date.now());
	let cached: { fetchedAt: number; skills: SkillSummary[] } | null = null;

	async function loadFromNetwork(signal: AbortSignal): Promise<SkillSummary[]> {
		let response: Response;
		try {
			response = await fetchFn(FIND_SKILLS_INDEX_URL, {
				redirect: "error",
				signal,
			});
		} catch {
			throw unavailable("index request failed");
		}
		if (!response.ok) {
			try {
				await response.body?.cancel();
			} catch {
				// Ignore cancel failures; the request error below is authoritative.
			}
			throw unavailable("index request failed");
		}
		const declared = response.headers.get("content-length");
		if (declared !== null) {
			const size = Number(declared.trim());
			if (!Number.isInteger(size) || size < 0 || size > MAX_BODY_BYTES) {
				try {
					await response.body?.cancel();
				} catch {
					// Ignore cancel failures; the size error below is authoritative.
				}
				throw unavailable("index response too large");
			}
		}
		const text = await readBoundedText(response, signal);
		let parsed: unknown;
		try {
			parsed = JSON.parse(text);
		} catch {
			throw unavailable("malformed index");
		}
		return normalizeCatalog(parsed);
	}

	async function readBoundedText(
		response: Response,
		signal: AbortSignal,
	): Promise<string> {
		const body = response.body;
		if (!body) {
			if (signal.aborted) throw unavailable("index request timed out");
			const text = await response.text();
			if (text.length > MAX_BODY_BYTES) {
				throw unavailable("index response too large");
			}
			if (signal.aborted) throw unavailable("index request timed out");
			return text;
		}
		const reader = body.getReader();
		let rejectOnAbort: (reason: Error) => void = () => {};
		const aborted = new Promise<never>((_, reject) => {
			rejectOnAbort = reject;
		});
		aborted.catch(() => {
			// Avoid unhandled rejections when the read completes without abort.
		});
		const onAbort = () => {
			try {
				void reader.cancel().catch(() => {
					// Ignore cancel failures; the timeout below is authoritative.
				});
			} catch {
				// Ignore sync cancel failures; the timeout below is authoritative.
			}
			rejectOnAbort(unavailable("index request timed out"));
		};
		if (signal.aborted) {
			onAbort();
		} else {
			signal.addEventListener("abort", onAbort, { once: true });
		}
		const chunks: Uint8Array[] = [];
		let total = 0;
		try {
			for (;;) {
				let next: Awaited<ReturnType<typeof reader.read>>;
				try {
					next = await Promise.race([reader.read(), aborted]);
				} catch {
					if (signal.aborted) throw unavailable("index request timed out");
					throw unavailable("index request failed");
				}
				if (signal.aborted) throw unavailable("index request timed out");
				if (next.done) break;
				total += next.value.byteLength;
				if (total > MAX_BODY_BYTES) {
					try {
						await reader.cancel();
					} catch {
						// Ignore cancel failures; the size error below is authoritative.
					}
					throw unavailable("index response too large");
				}
				chunks.push(next.value);
			}
		} finally {
			signal.removeEventListener("abort", onAbort);
			try {
				reader.releaseLock();
			} catch {
				// Ignore lock release failures after abort/cancel cleanup.
			}
		}
		if (signal.aborted) throw unavailable("index request timed out");
		const merged = new Uint8Array(total);
		let offset = 0;
		for (const chunk of chunks) {
			merged.set(chunk, offset);
			offset += chunk.byteLength;
		}
		return new TextDecoder().decode(merged);
	}

	async function loadCatalog(): Promise<SkillSummary[]> {
		const started = now();
		if (cached && started - cached.fetchedAt < CACHE_TTL_MS) {
			return cached.skills;
		}
		const controller = new AbortController();
		let timer: ReturnType<typeof setTimeout> | undefined;
		const timeout = new Promise<never>((_, reject) => {
			timer = setTimeout(() => {
				try {
					controller.abort();
				} catch {
					// Never throw from timeout cleanup.
				}
				reject(unavailable("index request timed out"));
			}, FETCH_TIMEOUT_MS);
		});
		const pending = loadFromNetwork(controller.signal);
		pending.catch(() => {
			// Avoid unhandled rejections after the timeout wins the race.
		});
		try {
			const skills = await Promise.race([pending, timeout]);
			cached = { fetchedAt: now(), skills };
			return skills;
		} finally {
			if (timer !== undefined) clearTimeout(timer);
		}
	}

	return async function findSkillsHandler(args: unknown) {
		const parsed = findSkillsInputSchema.safeParse(args);
		if (!parsed.success) {
			throw new Error(
				`invalid input: ${parsed.error.issues.map((issue) => issue.message).join("; ")}`,
			);
		}
		const skills = await loadCatalog();
		return {
			content: [
				{
					type: "text" as const,
					text: JSON.stringify({
						skills: matchSkills(skills, parsed.data.query, parsed.data.limit),
					}),
				},
			],
		};
	};
}

export function registerFindSkillsTool(
	server: McpServer,
	deps: FindSkillsDependencies = {},
): void {
	const handler = createFindSkillsHandler(deps);
	registerTool(server, {
		name: "utils_find_skills",
		description:
			"Search the agent-skills index for skill metadata by keyword. Returns only small on-demand SKILL.md links (id, name, description, plugin, version, url) without fetching skill content.",
		schema: findSkillsInputSchema,
		annotations: {
			readOnlyHint: true,
			destructiveHint: false,
			idempotentHint: true,
			openWorldHint: true,
		},
		handler: async (args) => handler(args),
	});
}

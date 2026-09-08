import { describe, expect, it } from "bun:test";
import type { McpServer } from "@modelcontextprotocol/server";
import {
	createFindSkillsHandler,
	FIND_SKILLS_INDEX_URL,
	type FindSkillsDependencies,
	type FindSkillsFetch,
	findSkillsInputSchema,
	registerFindSkillsTool,
} from "./findSkills";

const SCHEMA = "https://schemas.agentskills.io/discovery/0.2.0/schema.json";
const COMMIT = "83ab76cea10219a17376510e48017d562761b060";

function skillUrl(path = "skills/bitcoin-auth-diagnostics/SKILL.md"): string {
	return `https://raw.githubusercontent.com/b-open-io/better-auth-plugin/${COMMIT}/${path}`;
}

function makeSkill(overrides: Record<string, unknown> = {}) {
	return {
		id: "sigma-auth:bitcoin-auth-diagnostics",
		name: "bitcoin-auth-diagnostics",
		description:
			"Diagnose and troubleshoot bitcoin-auth token generation and verification issues.",
		plugin: "sigma-auth",
		version: "1.0.0",
		url: skillUrl(),
		type: "skill-md",
		digest:
			"sha256:d9cbc4ce9d6229abfa9129fcdbaec0a6174d145053aef07b53d614e33c6471e2",
		...overrides,
	};
}

function indexBody(skills: unknown[]) {
	return JSON.stringify({ $schema: SCHEMA, skills });
}

function jsonResponse(skills: unknown[], status = 200): Response {
	return new Response(indexBody(skills), { status });
}

interface Call {
	url: string;
	init?: RequestInit;
}

function mockFetch(
	respond: (url: string, init?: RequestInit) => Response | Promise<Response>,
) {
	const calls: Call[] = [];
	const fetchFn: FindSkillsFetch = async (url, init) => {
		calls.push({ url, init });
		return respond(url, init);
	};
	return { fetchFn, calls };
}

function fixedIndex(
	skills: unknown[],
	respond?: (url: string, init?: RequestInit) => Response | Promise<Response>,
) {
	return mockFetch(respond ?? (() => jsonResponse(skills)));
}

function controllableClock(start = 1_000_000) {
	let t = start;
	return {
		now: () => t,
		advance: (ms: number) => {
			t += ms;
		},
	};
}

async function readSkills(
	handler: (args: unknown) => Promise<unknown>,
	args: unknown,
) {
	const result = (await handler(args)) as {
		content: [{ type: string; text: string }];
	};
	return JSON.parse(result.content[0].text) as {
		skills: {
			id: string;
			name: string;
			description: string;
			plugin: string;
			version: string;
			url: string;
		}[];
	};
}

function rankingSkills() {
	return [
		makeSkill({
			id: "sigma-auth:device-authorization",
			name: "device-authorization",
			description: "Implement device authorization with Sigma Identity.",
			url: skillUrl("skills/device-authorization/SKILL.md"),
		}),
		makeSkill({
			id: "other:helper",
			name: "unrelated-helper",
			description: "Mentions device authorization only in passing text.",
			plugin: "other",
			version: "0.2.0",
			url: skillUrl("skills/helper/SKILL.md"),
		}),
		makeSkill({
			id: "sigma-auth:bitcoin-auth-diagnostics",
			name: "bitcoin-auth-diagnostics",
			description: "Unrelated wallet topic without the query tokens.",
			url: skillUrl("skills/bitcoin-auth-diagnostics/SKILL.md"),
		}),
	];
}

describe("utils_find_skills input", () => {
	it("applies the default limit and trims the query", async () => {
		const skills = Array.from({ length: 5 }, (_, i) =>
			makeSkill({
				id: `p:wombat-${i}`,
				name: `wombat-${i}`,
				description: "wombat handling",
				url: skillUrl(`skills/wombat-${i}/SKILL.md`),
			}),
		);
		const { fetchFn } = fixedIndex(skills);
		const handler = createFindSkillsHandler({ fetchFn });
		const parsed = await readSkills(handler, { query: "  wombat  " });
		expect(parsed.skills).toHaveLength(3);
	});

	it("rejects blank, overlong, and out-of-range inputs", async () => {
		const { fetchFn } = fixedIndex([makeSkill()]);
		const handler = createFindSkillsHandler({ fetchFn });
		await expect(handler({ query: "" })).rejects.toThrow("invalid input");
		await expect(handler({ query: "   " })).rejects.toThrow("invalid input");
		await expect(handler({ query: "x".repeat(201) })).rejects.toThrow(
			"invalid input",
		);
		await expect(handler({ query: "x", limit: 0 })).rejects.toThrow(
			"invalid input",
		);
		await expect(handler({ query: "x", limit: 6 })).rejects.toThrow(
			"invalid input",
		);
		await expect(handler({ query: "x", limit: 1.5 })).rejects.toThrow(
			"invalid input",
		);
		await expect(handler({ query: "x", limit: 1 })).resolves.toBeDefined();
		await expect(handler({ query: "x", limit: 5 })).resolves.toBeDefined();
	});
});

describe("utils_find_skills matching", () => {
	it("prefers name matches over description-only matches", async () => {
		const { fetchFn } = fixedIndex(rankingSkills());
		const handler = createFindSkillsHandler({ fetchFn });
		const parsed = await readSkills(handler, {
			query: "device-authorization",
			limit: 5,
		});
		expect(parsed.skills.map((skill) => skill.id)).toEqual([
			"sigma-auth:device-authorization",
			"other:helper",
		]);
	});

	it("breaks ties deterministically by id", async () => {
		const skills = [
			makeSkill({
				id: "b:wombat-helper",
				name: "wombat-helper",
				description: "wombat handling",
				url: skillUrl("skills/b/SKILL.md"),
			}),
			makeSkill({
				id: "a:wombat-tool",
				name: "wombat-tool",
				description: "wombat tooling",
				url: skillUrl("skills/a/SKILL.md"),
			}),
		];
		const { fetchFn } = fixedIndex(skills);
		const handler = createFindSkillsHandler({ fetchFn });
		const first = await readSkills(handler, { query: "wombat", limit: 5 });
		const second = await readSkills(handler, { query: "wombat", limit: 5 });
		expect(first.skills.map((skill) => skill.id)).toEqual([
			"a:wombat-tool",
			"b:wombat-helper",
		]);
		expect(second).toEqual(first);
	});

	it("respects the limit and returns empty skills when nothing matches", async () => {
		const skills = Array.from({ length: 4 }, (_, i) =>
			makeSkill({
				id: `p:wombat-${i}`,
				name: `wombat-${i}`,
				description: "wombat handling",
				url: skillUrl(`skills/wombat-${i}/SKILL.md`),
			}),
		);
		const { fetchFn } = fixedIndex(skills);
		const handler = createFindSkillsHandler({ fetchFn });
		const limited = await readSkills(handler, { query: "wombat", limit: 2 });
		expect(limited.skills).toHaveLength(2);
		const empty = await readSkills(handler, {
			query: "zzz-no-such-skill-qqq",
			limit: 5,
		});
		expect(empty).toEqual({ skills: [] });
	});
});

describe("utils_find_skills output", () => {
	it("emits only the allowlisted metadata fields with capped descriptions", async () => {
		const longDescription = "d".repeat(500);
		const { fetchFn } = fixedIndex([
			makeSkill({ description: longDescription }),
		]);
		const handler = createFindSkillsHandler({ fetchFn });
		const parsed = await readSkills(handler, {
			query: "bitcoin-auth-diagnostics",
			limit: 3,
		});
		expect(parsed.skills).toHaveLength(1);
		const [skill] = parsed.skills;
		expect(Object.keys(skill).sort()).toEqual(
			["description", "id", "name", "plugin", "url", "version"].sort(),
		);
		expect(skill.description).toHaveLength(350);
		expect(skill.description).toBe(longDescription.slice(0, 350));
		expect(skill.url).toBe(skillUrl());
	});
});

describe("utils_find_skills registration", () => {
	it("registers under the stable name with read-only annotations", () => {
		let captured:
			| { name: string; config: Record<string, unknown>; handler: unknown }
			| undefined;
		const server = {
			registerTool(name: string, config: unknown, handler: unknown) {
				captured = { name, config: config as Record<string, unknown>, handler };
			},
		} as unknown as McpServer;
		registerFindSkillsTool(server, {
			fetchFn: async () => jsonResponse([]),
		});
		expect(captured?.name).toBe("utils_find_skills");
		const config = captured?.config as {
			description: string;
			inputSchema: unknown;
			annotations: Record<string, boolean>;
		};
		expect(config.inputSchema).toBe(findSkillsInputSchema);
		expect(config.annotations).toEqual({
			readOnlyHint: true,
			destructiveHint: false,
			idempotentHint: true,
			openWorldHint: true,
		});
		expect(config.description).toContain("SKILL.md");
		expect(typeof captured?.handler).toBe("function");
	});
});

describe("utils_find_skills catalog validation", () => {
	const cases: [string, () => Response][] = [
		[
			"wrong schema",
			() =>
				new Response(
					JSON.stringify({
						$schema: "https://example.com/other.json",
						skills: [],
					}),
				),
		],
		["missing skills", () => new Response(JSON.stringify({ $schema: SCHEMA }))],
		[
			"non-array skills",
			() => new Response(JSON.stringify({ $schema: SCHEMA, skills: {} })),
		],
		["top-level array", () => new Response(JSON.stringify([]))],
		["invalid json", () => new Response("not json{{{")],
		[
			"too many entries",
			() =>
				new Response(
					indexBody(
						Array.from({ length: 5001 }, (_, i) =>
							makeSkill({
								id: `p:skill-${i}`,
								name: `skill-${i}`,
								url: skillUrl(`skills/skill-${i}/SKILL.md`),
							}),
						),
					),
				),
		],
	];

	for (const [name, respond] of cases) {
		it(`rejects a malformed catalog: ${name}`, async () => {
			const { fetchFn } = mockFetch(respond);
			const handler = createFindSkillsHandler({ fetchFn });
			await expect(handler({ query: "skill", limit: 3 })).rejects.toThrow(
				"skill-discovery-unavailable",
			);
		});
	}

	it("skips malformed entries but keeps valid ones", async () => {
		const valid = makeSkill();
		const { fetchFn } = fixedIndex([
			{ ...valid, url: undefined },
			{ ...valid, id: "bad:types", name: 42 },
			{ ...valid, id: "bad:empty", name: "" },
			{ ...valid, id: "bad:long", name: "x".repeat(101) },
			{ ...valid, id: "bad:desc", description: "d".repeat(3000) },
			"not-an-object",
			null,
			valid,
		]);
		const handler = createFindSkillsHandler({ fetchFn });
		const parsed = await readSkills(handler, {
			query: "bitcoin-auth-diagnostics",
			limit: 5,
		});
		expect(parsed.skills).toHaveLength(1);
		expect(parsed.skills[0].id).toBe(valid.id);
	});

	it("skips entries with missing or non-skill types", async () => {
		const valid = makeSkill();
		const { type: _dropped, ...missingType } = valid;
		void _dropped;
		const { fetchFn } = fixedIndex([
			{ ...missingType, id: "bad:missing-type", name: "wombat-missing" },
			{ ...valid, id: "bad:wrong-type", name: "wombat-other", type: "other" },
			{
				...valid,
				id: "bad:empty-type",
				name: "wombat-empty",
				type: "",
			},
			{
				...valid,
				id: "good:wombat-type",
				name: "wombat-typed",
				url: skillUrl("skills/wombat-typed/SKILL.md"),
			},
		]);
		const handler = createFindSkillsHandler({ fetchFn });
		const parsed = await readSkills(handler, { query: "wombat", limit: 5 });
		expect(parsed.skills.map((skill) => skill.id)).toEqual([
			"good:wombat-type",
		]);
	});

	it("skips unsafe source URLs and returns the upstream URL verbatim", async () => {
		const valid = makeSkill();
		const unsafeUrls = [
			`http://raw.githubusercontent.com/b-open-io/better-auth-plugin/${COMMIT}/skills/x/SKILL.md`,
			`https://example.com/b-open-io/better-auth-plugin/${COMMIT}/skills/x/SKILL.md`,
			"https://raw.githubusercontent.com/b-open-io/better-auth-plugin/main/skills/x/SKILL.md",
			`https://raw.githubusercontent.com/b-open-io/better-auth-plugin/${"a".repeat(39)}/skills/x/SKILL.md`,
			`https://raw.githubusercontent.com/b-open-io/better-auth-plugin/${COMMIT.toUpperCase()}/skills/x/SKILL.md`,
			`${skillUrl("skills/x/SKILL.md")}?x=1`,
			`${skillUrl("skills/x/SKILL.md")}#frag`,
			`https://user:pass@raw.githubusercontent.com/b-open-io/better-auth-plugin/${COMMIT}/skills/x/SKILL.md`,
			`https://raw.githubusercontent.com:443/b-open-io/better-auth-plugin/${COMMIT}/skills/x/SKILL.md`,
			`https://raw.githubusercontent.com/b-open-io/better-auth-plugin/${COMMIT}/skills/x/README.md`,
			`https://raw.githubusercontent.com/b-open-io/better-auth-plugin/${COMMIT}/SKILL.md`,
			"not-a-url",
		];
		const entries = [
			...unsafeUrls.map((url, i) =>
				makeSkill({ id: `bad:unsafe-${i}`, name: `unsafe-${i}`, url }),
			),
			valid,
		];
		const { fetchFn } = fixedIndex(entries);
		const handler = createFindSkillsHandler({ fetchFn });
		const parsed = await readSkills(handler, {
			query: "bitcoin-auth-diagnostics",
			limit: 5,
		});
		const withUnsafeToken = await readSkills(handler, {
			query: "unsafe",
			limit: 5,
		});
		expect(parsed.skills).toHaveLength(1);
		expect(parsed.skills[0].url).toBe(valid.url);
		expect(withUnsafeToken).toEqual({ skills: [] });
	});
});

describe("utils_find_skills transport", () => {
	it("requests only the fixed index URL with redirect errors and no credentials", async () => {
		const { fetchFn, calls } = fixedIndex([makeSkill()]);
		const handler = createFindSkillsHandler({ fetchFn });
		await readSkills(handler, { query: "bitcoin", limit: 3 });
		expect(calls).toHaveLength(1);
		expect(calls[0].url).toBe(FIND_SKILLS_INDEX_URL);
		expect(calls[0].url).not.toContain("?");
		expect(calls[0].init?.redirect).toBe("error");
		expect(calls[0].init?.headers).toBeUndefined();
	});

	it("reports HTTP failures without exposing the upstream payload", async () => {
		const marker = "SECRET-MARKER-12345";
		const { fetchFn } = mockFetch(() => new Response(marker, { status: 500 }));
		const handler = createFindSkillsHandler({ fetchFn });
		try {
			await handler({ query: "bitcoin", limit: 3 });
			throw new Error("expected handler to throw");
		} catch (error) {
			const message = (error as Error).message;
			expect(message).toContain("skill-discovery-unavailable");
			expect(message).not.toContain(marker);
		}
	});

	it("treats redirects as failures", async () => {
		const { fetchFn } = mockFetch(
			() =>
				new Response(null, {
					status: 302,
					headers: { location: "https://example.com/" },
				}),
		);
		const handler = createFindSkillsHandler({ fetchFn });
		await expect(handler({ query: "bitcoin", limit: 3 })).rejects.toThrow(
			"skill-discovery-unavailable",
		);
	});

	it("reports network failures generically", async () => {
		const deps: FindSkillsDependencies = {
			fetchFn: async () => {
				throw new TypeError("fetch failed");
			},
		};
		const handler = createFindSkillsHandler(deps);
		await expect(handler({ query: "bitcoin", limit: 3 })).rejects.toThrow(
			"skill-discovery-unavailable",
		);
	});

	it("rejects an oversize declared body without reading it", async () => {
		let cancelled = false;
		const stream = new ReadableStream<Uint8Array>({
			start(controller) {
				// A small valid body: the declared length must win without reads.
				controller.enqueue(new TextEncoder().encode(indexBody([makeSkill()])));
			},
			cancel() {
				cancelled = true;
			},
		});
		const fake = {
			ok: true,
			status: 200,
			headers: new Headers({
				"content-length": String(3 * 1024 * 1024),
			}),
			body: stream,
		} as unknown as Response;
		const { fetchFn } = mockFetch(() => fake);
		const handler = createFindSkillsHandler({ fetchFn });
		await expect(handler({ query: "bitcoin", limit: 3 })).rejects.toThrow(
			"index response too large",
		);
		expect(cancelled).toBe(true);
	});

	it("rejects a non-numeric declared length", async () => {
		const fake = {
			ok: true,
			status: 200,
			headers: new Headers({ "content-length": "banana" }),
			body: new ReadableStream<Uint8Array>({
				start(controller) {
					controller.enqueue(new TextEncoder().encode("[]"));
					controller.close();
				},
			}),
		} as unknown as Response;
		const { fetchFn } = mockFetch(() => fake);
		const handler = createFindSkillsHandler({ fetchFn });
		await expect(handler({ query: "bitcoin", limit: 3 })).rejects.toThrow(
			"skill-discovery-unavailable",
		);
	});

	it("aborts and cancels an oversize streamed body", async () => {
		let cancelled = false;
		const chunk = new Uint8Array(256 * 1024).fill(65);
		const stream = new ReadableStream<Uint8Array>({
			start(controller) {
				for (let i = 0; i < 12; i += 1) controller.enqueue(chunk);
			},
			cancel() {
				cancelled = true;
			},
		});
		const fake = {
			ok: true,
			status: 200,
			headers: new Headers(),
			body: stream,
		} as unknown as Response;
		const { fetchFn } = mockFetch(() => fake);
		const handler = createFindSkillsHandler({ fetchFn });
		await expect(handler({ query: "bitcoin", limit: 3 })).rejects.toThrow(
			"index response too large",
		);
		expect(cancelled).toBe(true);
	});

	it("times out a stalled response head and aborts the request", async () => {
		let observed: AbortSignal | undefined;
		const deps: FindSkillsDependencies = {
			fetchFn: (_url, init) => {
				observed = init?.signal as AbortSignal | undefined;
				return new Promise<never>((_, reject) => {
					observed?.addEventListener("abort", () => {
						reject(new DOMException("Aborted", "AbortError"));
					});
				});
			},
		};
		const handler = createFindSkillsHandler(deps);
		await expect(handler({ query: "bitcoin", limit: 3 })).rejects.toThrow(
			"index request timed out",
		);
		expect(observed?.aborted).toBe(true);
	}, 15000);

	it("times out a stalled body, cancels the stream, and never returns partial data", async () => {
		let observed: AbortSignal | undefined;
		let cancelled = false;
		const deps: FindSkillsDependencies = {
			fetchFn: (_url, init) => {
				observed = init?.signal as AbortSignal | undefined;
				// This stream ignores the fetch signal entirely: it never emits
				// and never closes, so only the handler's own abort listener
				// can cancel the pending reader.
				const body = new ReadableStream<Uint8Array>({
					cancel() {
						cancelled = true;
					},
				});
				return Promise.resolve({
					ok: true,
					status: 200,
					headers: new Headers(),
					body,
				} as unknown as Response);
			},
		};
		const handler = createFindSkillsHandler(deps);
		await expect(handler({ query: "bitcoin", limit: 3 })).rejects.toThrow(
			"skill-discovery-unavailable",
		);
		expect(observed?.aborted).toBe(true);
		expect(cancelled).toBe(true);
	}, 15000);

	it("cancels the body of failed HTTP responses instead of leaving it live", async () => {
		let cancelled = false;
		const stream = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(new TextEncoder().encode("SECRET-MARKER-12345"));
			},
			cancel() {
				cancelled = true;
			},
		});
		const fake = {
			ok: false,
			status: 500,
			headers: new Headers(),
			body: stream,
		} as unknown as Response;
		const { fetchFn } = mockFetch(() => fake);
		const handler = createFindSkillsHandler({ fetchFn });
		try {
			await handler({ query: "bitcoin", limit: 3 });
			throw new Error("expected handler to throw");
		} catch (error) {
			const message = (error as Error).message;
			expect(message).toContain("skill-discovery-unavailable");
			expect(message).not.toContain("SECRET-MARKER-12345");
		}
		expect(cancelled).toBe(true);
	});
});

describe("utils_find_skills cache", () => {
	it("hits the cache, expires after five minutes, and never serves stale failures", async () => {
		const clock = controllableClock();
		let failures = 0;
		const { fetchFn, calls } = mockFetch(() => {
			if (failures > 0) return new Response("boom", { status: 500 });
			return jsonResponse([makeSkill()]);
		});
		const handler = createFindSkillsHandler({ fetchFn, now: clock.now });

		await readSkills(handler, { query: "bitcoin", limit: 3 });
		await readSkills(handler, { query: "bitcoin", limit: 3 });
		expect(calls).toHaveLength(1);

		clock.advance(5 * 60 * 1000 - 1);
		await readSkills(handler, { query: "bitcoin", limit: 3 });
		expect(calls).toHaveLength(1);

		clock.advance(2);
		failures = 1;
		await expect(handler({ query: "bitcoin", limit: 3 })).rejects.toThrow(
			"skill-discovery-unavailable",
		);
		expect(calls).toHaveLength(2);

		failures = 0;
		const parsed = await readSkills(handler, { query: "bitcoin", limit: 3 });
		expect(calls).toHaveLength(3);
		expect(parsed.skills).toHaveLength(1);
	});

	it("isolates caches per handler factory", async () => {
		const first = mockFetch(() => jsonResponse([makeSkill()]));
		const second = mockFetch(() => jsonResponse([makeSkill()]));
		const handlerA = createFindSkillsHandler({ fetchFn: first.fetchFn });
		const handlerB = createFindSkillsHandler({ fetchFn: second.fetchFn });
		await readSkills(handlerA, { query: "bitcoin", limit: 3 });
		await readSkills(handlerA, { query: "bitcoin", limit: 3 });
		expect(first.calls).toHaveLength(1);
		expect(second.calls).toHaveLength(0);
		await readSkills(handlerB, { query: "bitcoin", limit: 3 });
		expect(second.calls).toHaveLength(1);
	});
});

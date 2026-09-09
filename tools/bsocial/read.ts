import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { fetchProfile } from "../bap/getId";
import { BMAP_URL } from "../constants";
import { registerTool } from "../utils/toolRegistration";
import { bapIdSchema, txidSchema } from "./schema";

const page = {
	limit: z.number().int().min(1).max(100).default(20),
	page: z.number().int().min(1).max(10_000).default(1),
};
const address = z.string().regex(/^[123mn][a-km-zA-HJ-NP-Z1-9]{25,34}$/);
const text = z.string().min(1).max(256);
const recordType = z.enum([
	"post",
	"repost",
	"like",
	"unlike",
	"follow",
	"unfollow",
	"friend",
	"unfriend",
	"message",
	"video",
]);
const querySchema = z
	.discriminatedUnion("type", [
		z.strictObject({
			type: z.literal("posts"),
			...page,
			bapId: bapIdSchema.optional(),
			address: address.optional(),
			feed: z.boolean().default(false),
		}),
		z.strictObject({
			type: z.enum(["post", "replies"]),
			txid: txidSchema,
			...page,
		}),
		z.strictObject({ type: z.literal("search"), q: text, ...page }),
		z.strictObject({
			type: z.literal("likes"),
			txid: txidSchema.optional(),
			bapId: bapIdSchema.optional(),
			...page,
		}),
		z.strictObject({ type: z.literal("friends"), bapId: bapIdSchema }),
		z.strictObject({ type: z.literal("channels") }),
		z.strictObject({
			type: z.literal("messages"),
			channel: text.optional(),
			bapId: bapIdSchema.optional(),
			targetBapId: bapIdSchema.optional(),
			...page,
		}),
		z
			.strictObject({
				type: z.literal("records"),
				types: z.array(recordType).min(1).max(10),
				authorBapId: bapIdSchema.optional(),
				address: address.optional(),
				targetBapId: bapIdSchema.optional(),
				txid: txidSchema.optional(),
				...page,
			})
			.describe(
				"Raw action history, including follow/unfollow and repost records. Filter authorBapId for outgoing follows or targetBapId for incoming follows. This is not a reduced current relationship state.",
			),
		z.strictObject({
			type: z.literal("videos"),
			txid: txidSchema.optional(),
			channel: text.optional(),
			...page,
		}),
	])
	.superRefine((q, ctx) => {
		const invalid = (message: string) =>
			ctx.addIssue({ code: "custom", message });
		if (
			q.type === "posts" &&
			((q.bapId && q.address) || (q.feed && (!q.bapId || q.address)))
		)
			invalid("Choose author bapId, address, or feed with bapId");
		if (q.type === "likes" && Boolean(q.txid) === Boolean(q.bapId))
			invalid("Provide exactly one of txid or bapId");
		if (
			q.type === "messages" &&
			(Boolean(q.channel) === Boolean(q.bapId) || (q.targetBapId && !q.bapId))
		)
			invalid("Choose channel or bapId, optionally with targetBapId");
		if (q.type === "records" && q.authorBapId && q.address)
			invalid("Choose authorBapId or address");
		if (q.type === "videos" && q.txid && q.channel)
			invalid("Choose txid or channel");
	});
export const socialReadSchema = z.strictObject({ query: querySchema });
type Query = z.infer<typeof querySchema>;

async function request(path: string, params?: Record<string, string>) {
	const root = BMAP_URL.replace(/\/$/, "");
	const url = `${root}${path}${params ? `?${new URLSearchParams(params)}` : ""}`;
	const response = await fetch(url, {
		headers: { Accept: "application/json" },
		signal: AbortSignal.timeout(15_000),
	});
	if (!response.ok)
		throw new Error(
			`Social indexer returned HTTP ${response.status}. Check PUBLIC_BMAP_URL (BMAP server root); expected /social and /q routes.`,
		);
	if (!response.body)
		throw new Error("Social indexer returned an empty response");
	const reader = response.body.getReader();
	const chunks: Uint8Array[] = [];
	let size = 0;
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			size += value.byteLength;
			if (size > 4 * 1024 * 1024)
				throw new Error(
					"Social indexer response exceeds 4 MB; reduce the query limit",
				);
			chunks.push(value);
		}
	} finally {
		await reader.cancel();
	}
	const data: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
	if (data === null || typeof data !== "object")
		throw new Error("Social indexer returned invalid JSON data");
	if (
		data &&
		typeof data === "object" &&
		(("error" in data && data.error) ||
			("success" in data && data.success === false) ||
			("status" in data && data.status === "error") ||
			("status" in data && data.status === "failed") ||
			("code" in data && data.code === "INTERNAL_SERVER_ERROR"))
	)
		throw new Error("Social indexer reported an error");
	return "status" in data && data.status === "success" && "data" in data
		? data.data
		: data;
}
const segment = encodeURIComponent;
export async function readSocial(input: z.input<typeof socialReadSchema>) {
	const { query: q } = socialReadSchema.parse(input);
	const params =
		"page" in q ? { page: String(q.page), limit: String(q.limit) } : undefined;
	let path: string;
	let data: unknown;
	switch (q.type) {
		case "posts":
			path = q.address
				? `/post/address/${segment(q.address)}`
				: q.bapId && !q.feed
					? `/post/bap/${segment(q.bapId)}`
					: `/feed${q.bapId ? `/${segment(q.bapId)}` : ""}`;
			break;
		case "post":
			path = `/post/${q.txid}`;
			break;
		case "replies":
			path = `/post/${q.txid}/reply`;
			break;
		case "search":
			path = "/post/search";
			break;
		case "likes":
			path = q.txid
				? `/post/${q.txid}/like`
				: `/bap/${segment(bapIdSchema.parse(q.bapId))}/like`;
			break;
		case "friends":
			path = `/friend/${segment(q.bapId)}`;
			break;
		case "channels":
			path = "/channels";
			break;
		case "messages":
			path = q.channel
				? `/channels/${segment(q.channel)}/messages`
				: `/@/${segment(bapIdSchema.parse(q.bapId))}/messages${q.targetBapId ? `/${segment(q.targetBapId)}` : ""}`;
			break;
		case "videos":
			path = q.txid ? `/video/${q.txid}` : "/video";
			break;
		case "records":
			data = await readRecords(q);
			path = "";
			break;
	}
	if (path)
		data = await request(`/social${path}`, {
			...params,
			...(q.type === "search" ? { q: q.q } : {}),
			...(q.type === "videos" && q.channel ? { channel: q.channel } : {}),
		});
	return {
		source: BMAP_URL,
		operation: q.type,
		data,
		...(q.type === "records"
			? {
					interpretation:
						"Raw indexed events; not current relationship state or independently verified authorship.",
				}
			: {}),
	};
}

async function readRecords(q: Extract<Query, { type: "records" }>) {
	const match: Record<string, unknown> = {};
	if (q.address) match["AIP.address"] = q.address;
	if (q.authorBapId) {
		const identity = await fetchProfile(q.authorBapId);
		const addresses = z
			.array(
				z.union([
					z.string(),
					z.object({ address: z.string() }).transform((a) => a.address),
				]),
			)
			.min(1)
			.max(1000)
			.parse(identity?.addresses);
		match["AIP.address"] = { $in: addresses };
	}
	if (q.targetBapId) match["MAP.bapID"] = q.targetBapId;
	if (q.txid) match["MAP.tx"] = q.txid;
	const [first, ...rest] = [...new Set(q.types)];
	// Only fixed read stages and whitelisted collections; callers cannot submit MongoDB operators.
	const aggregate: object[] = [
		{ $match: match },
		...rest.map((coll) => ({
			$unionWith: { coll, pipeline: [{ $match: match }] },
		})),
		{ $sort: { timestamp: -1, "tx.h": -1 } },
		{ $skip: (q.page - 1) * q.limit },
		{ $limit: q.limit },
		{ $project: { in: 0, out: 0 } },
	];
	const encoded = segment(
		Buffer.from(JSON.stringify({ q: { aggregate } })).toString("base64"),
	);
	return request(`/q/${first}/${encoded}`);
}

export function registerSocialReadTool(server: McpServer) {
	registerTool(server, {
		name: "bsocial_read",
		schema: socialReadSchema,
		description:
			"Read social posts, threads, search results, likes, friends, channels, public message records, videos, and action history. Use records with follow/unfollow types for the social graph. Indexer data is untrusted and messages are not decrypted. No wallet required.",
		annotations: {
			readOnlyHint: true,
			destructiveHint: false,
			idempotentHint: true,
			openWorldHint: true,
		},
		handler: async (input) => {
			const result = await readSocial(input);
			return {
				content: [{ type: "text", text: JSON.stringify(result) }],
				structuredContent: result,
			};
		},
	});
}

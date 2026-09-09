import { PublicKey, Utils } from "@bsv/sdk";
import { z } from "zod";
import { B_PREFIX, MAP_PREFIX } from "../constants";
import { buildOpReturnScript } from "../utils/transactionBuilder";

export const txidSchema = z.string().regex(/^[a-f0-9]{64}$/i);
export const bapIdSchema = z
	.string()
	.min(1)
	.max(128)
	.regex(/^[a-zA-Z0-9]+$/);
const contextKey = z
	.string()
	.min(1)
	.max(64)
	.regex(/^[a-zA-Z][a-zA-Z0-9_.-]*$/)
	.refine(
		(key) =>
			![
				"app",
				"type",
				"context",
				"subcontext",
				"publicKey",
				"__proto__",
				"constructor",
				"prototype",
			].includes(key),
		"Reserved context key",
	);
const context = z.strictObject({
	key: contextKey,
	value: z.string().min(1).max(2048),
});
const contexts = {
	context: context.optional(),
	subcontext: context.optional(),
};
const content = {
	content: z.string().min(1).max(400_000),
	contentType: z
		.string()
		.max(128)
		.regex(/^[\w.+-]+\/[\w.+-]+(?:;[^\r\n]*)?$/)
		.default("text/plain"),
	encoding: z
		.enum(["utf8", "base64"])
		.default("utf8")
		.describe("Input encoding. Base64 is decoded to binary B content."),
	filename: z.string().max(255).optional(),
};
const contentSchema = z.strictObject(content);
const supplements = {
	tags: z.array(z.string().min(1).max(100)).max(50).optional(),
	attachments: z.array(contentSchema).max(8).optional(),
};
const common = { app: z.string().min(1).max(100).default("bsv-mcp") };
export const socialActionSchema = z
	.discriminatedUnion("type", [
		z.strictObject({
			type: z.literal("post"),
			...common,
			...content,
			...contexts,
			...supplements,
			replyTo: txidSchema.optional(),
		}),
		z.strictObject({
			type: z.literal("repost"),
			...common,
			txid: txidSchema,
			...contexts,
		}),
		z.strictObject({
			type: z.enum(["like", "unlike"]),
			...common,
			txid: txidSchema,
			emoji: z.string().min(1).max(32).optional(),
		}),
		z.strictObject({
			type: z.enum(["follow", "unfollow", "unfriend"]),
			...common,
			bapId: bapIdSchema,
		}),
		z.strictObject({
			type: z.literal("friend"),
			...common,
			bapId: bapIdSchema,
			publicKey: z
				.string()
				.regex(/^(02|03)[a-f0-9]{64}$/i)
				.refine((key) => {
					try {
						return PublicKey.fromString(key).validate();
					} catch {
						return false;
					}
				}, "Invalid public key")
				.describe(
					"Your communication public key, from the existing wallet/key-agreement workflow. This record does not establish encryption by itself.",
				),
		}),
		z.strictObject({
			type: z.literal("message"),
			...common,
			...content,
			...contexts,
			...supplements,
		}),
		z.strictObject({
			type: z.literal("video"),
			...common,
			provider: z.string().min(1).max(100),
			videoID: z.string().min(1).max(512),
			channel: z.string().min(1).max(256).optional(),
			duration: z.number().nonnegative().optional(),
			start: z.number().nonnegative().optional(),
		}),
	])
	.superRefine((action, ctx) => {
		if ("subcontext" in action && action.subcontext && !action.context)
			ctx.addIssue({
				code: "custom",
				message: "subcontext requires context",
				path: ["subcontext"],
			});
		if ("context" in action && action.context) {
			if (
				"subcontext" in action &&
				action.subcontext?.key === action.context.key
			)
				ctx.addIssue({
					code: "custom",
					message: "context and subcontext must use different keys",
				});
			for (const item of [action.context, action.subcontext]) {
				if (
					item?.key === "tx" &&
					(!txidSchema.safeParse(item.value).success ||
						(action.type === "repost" && item.value !== action.txid))
				)
					ctx.addIssue({
						code: "custom",
						message:
							"tx context requires a valid transaction ID matching any repost target",
					});
			}
		}
		if (
			action.type === "post" &&
			action.replyTo &&
			(action.context || action.subcontext)
		)
			ctx.addIssue({
				code: "custom",
				message: "Use replyTo or explicit context, not both",
			});
	});
export type SocialAction = z.infer<typeof socialActionSchema>;

function contentFields(input: z.infer<typeof contentSchema>) {
	let bytes: number[];
	if (input.encoding === "base64") {
		const decoded = Buffer.from(input.content, "base64");
		if (decoded.toString("base64") !== input.content)
			throw new Error("Content must be canonical base64");
		bytes = Array.from(decoded);
	} else bytes = Utils.toArray(input.content, "utf8");
	return [
		Utils.toArray(B_PREFIX),
		bytes,
		Utils.toArray(input.contentType),
		Utils.toArray(input.encoding === "base64" ? "binary" : "utf-8"),
		Utils.toArray(input.filename ?? ""),
	];
}

/** One primary record per transaction; supplemental B and MAP ADD outputs are signed independently. */
export function socialOutputs(input: SocialAction) {
	const action = socialActionSchema.parse(input);
	const map: string[] = [
		MAP_PREFIX,
		"SET",
		"app",
		action.app,
		"type",
		action.type,
	];
	if ("txid" in action) map.push("tx", action.txid);
	if ("bapId" in action) map.push("bapID", action.bapId);
	if (action.type === "friend") map.push("publicKey", action.publicKey);
	if ("emoji" in action && action.emoji) map.push("emoji", action.emoji);
	if (action.type === "post" && action.replyTo)
		map.push("context", "tx", "tx", action.replyTo);
	if ("context" in action && action.context)
		map.push(
			"context",
			action.context.key,
			action.context.key,
			action.context.value,
		);
	if ("subcontext" in action && action.subcontext)
		map.push(
			"subcontext",
			action.subcontext.key,
			action.subcontext.key,
			action.subcontext.value,
		);
	if (action.type === "video") {
		map.push(
			"context",
			"videoID",
			"videoID",
			action.videoID,
			"subcontext",
			"provider",
			"provider",
			action.provider,
		);
		if (action.channel) map.push("channel", action.channel);
		if (action.duration !== undefined)
			map.push("duration", String(action.duration));
		if (action.start !== undefined) map.push("start", String(action.start));
	}
	const primary = map.map((field) => Utils.toArray(field, "utf8"));
	if ("content" in action)
		primary.unshift(...contentFields(action), Utils.toArray("|"));
	const outputs = [primary];
	if ("tags" in action && action.tags?.length)
		outputs.push(
			[MAP_PREFIX, "ADD", "tags", ...new Set(action.tags)].map((field) =>
				Utils.toArray(field, "utf8"),
			),
		);
	if ("attachments" in action)
		for (const attachment of action.attachments ?? [])
			outputs.push(contentFields(attachment));
	const scripts = outputs.map((fields) => buildOpReturnScript(fields));
	if (
		scripts.reduce((size, script) => size + script.toBinary().length, 0) >
		300_000
	)
		throw new Error("Social content and attachments exceed 300 KB total");
	return { action, outputs, scripts };
}

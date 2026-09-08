import { describe, expect, test } from "bun:test";
import {
	isHostedReadTool,
	registerHostedReadTools,
	withHostedReadPolicy,
} from "./hosted-read-policy";

const FORBIDDEN_PREFIXES = [
	"wallet_",
	"bap_",
	"mnee_",
	"x402_",
	"droplit_",
	"account",
];

const KNOWN_MUTATIONS = [
	"wallet_sendBsv",
	"wallet_list",
	"wallet_generate",
	"wallet_import",
	"wallet_use",
	"wallet_remove",
	"bsocial_createPost",
	"bap_generate",
	"bap_friend",
	"mnee_send",
	"x402_request",
	"x402_payQuote",
	"utils_installAgentMaster",
];

describe("hosted read-only policy", () => {
	test("the allowlist holds the reviewed public reads and nothing else", () => {
		for (const name of [
			"bsv_getPrice",
			"bsv_decodeTransaction",
			"bsv_explore",
			"bsv_status",
			"ordinals_getInscription",
			"ordinals_searchInscriptions",
			"ordinals_marketListings",
			"ordinals_marketSales",
			"ordinals_getTokenByIdOrTicker",
			"bsocial_readPosts",
			"bmap_readPosts",
			"bmap_readLikes",
			"bmap_readFollows",
			"utils_convertData",
			"utils_find_skills",
			"bsv_read",
			"ordinals_read",
			"utility",
		]) {
			expect(isHostedReadTool(name)).toBe(true);
		}
		for (const name of KNOWN_MUTATIONS) {
			expect(isHostedReadTool(name)).toBe(false);
		}
	});

	test("hosted registration advertises only allowlisted tools", () => {
		const names: string[] = [];
		const facade = {
			registerTool(name: string) {
				names.push(name);
			},
		} as never;
		registerHostedReadTools(facade);

		expect(names.length).toBeGreaterThan(0);
		for (const name of names) {
			expect(isHostedReadTool(name)).toBe(true);
			expect(FORBIDDEN_PREFIXES.some((prefix) => name.startsWith(prefix))).toBe(
				false,
			);
		}
		for (const name of [
			"bsv_getPrice",
			"bsv_status",
			"ordinals_searchInscriptions",
			"bsocial_readPosts",
			"bmap_readPosts",
			"utils_convertData",
			"utils_find_skills",
		]) {
			expect(names).toContain(name);
		}
		for (const name of KNOWN_MUTATIONS) {
			expect(names).not.toContain(name);
		}
	});

	test("the policy denies a future mutation before its callback in any era", async () => {
		let mutationCalls = 0;
		let readCalls = 0;
		const callbacks = new Map<string, (...args: never[]) => unknown>();
		const facade = {
			registerTool(
				name: string,
				_config: unknown,
				callback: (...args: never[]) => unknown,
			) {
				callbacks.set(name, callback);
			},
		} as never;
		withHostedReadPolicy(facade).registerTool("wallet_sendBsv", {}, (() => {
			mutationCalls += 1;
		}) as never);
		withHostedReadPolicy(facade).registerTool("bsv_getPrice", {}, (() => {
			readCalls += 1;
		}) as never);

		const denial = (await callbacks.get("wallet_sendBsv")?.()) as unknown as {
			isError?: boolean;
			content?: { text: string }[];
		};
		expect(denial?.isError).toBe(true);
		expect(denial?.content?.[0]?.text).toContain("wallet_sendBsv");
		expect(mutationCalls).toBe(0);

		await callbacks.get("bsv_getPrice")?.();
		expect(readCalls).toBe(1);
		expect(mutationCalls).toBe(0);
	});
});

import { expect, test } from "bun:test";
import { generateCatalog } from "../scripts/generate-tool-manifest";
import { COMPACT_OPERATION_LEGACY_NAMES } from "../tools/compactCatalog";
import { docs } from "./docs";
import {
	catalog,
	catalogTools,
	categoryForTool,
	compactOperations,
	getTool,
	inputAlternatives,
	inputFields,
} from "./tool-catalog";
import { renderToolMarkdown } from "./tool-reference-markdown";
import { toolReferenceNotes } from "./tool-reference-notes";

test("committed reference matches isolated real registration captures", () => {
	expect(JSON.stringify(generateCatalog())).toBe(JSON.stringify(catalog));
}, 60_000);

test("every registered entry has one category, valid links and distinct variants", () => {
	expect(new Set(catalogTools.map((t) => t.name)).size).toBe(
		catalogTools.length,
	);
	for (const tool of catalogTools) {
		expect(categoryForTool(tool.name)).toBeDefined();
		for (const operation of compactOperations(tool)) {
			expect(getTool(operation)).toBeDefined();
			expect(
				Object.entries(COMPACT_OPERATION_LEGACY_NAMES).find(
					([family]) => family === tool.name,
				)?.[1] as readonly string[] | undefined,
			).toContain(operation);
		}
		const modes = tool.variants.flatMap((v) =>
			v.modes.map((mode) => `${v.profile}/${mode}`),
		);
		expect(new Set(modes).size).toBe(modes.length);
		expect(renderToolMarkdown(tool.name)).toContain(tool.name);
	}
	for (const name of Object.keys(toolReferenceNotes))
		expect(getTool(name)).toBeDefined();
});

test("reference records conditional transaction tools and external restrictions", () => {
	const modes = (name: string) =>
		getTool(name)?.variants.flatMap((v) => v.modes) ?? [];
	expect(modes("wallet_peerPayments")).toContain("embedded");
	expect(modes("wallet_peerPayments")).not.toContain("external");
	expect(modes("wallet_getBalance")).not.toContain("external");
	expect(modes("x402_payQuote")).toContain("embedded");
	expect(modes("x402_payQuote")).not.toContain("broadcast-disabled");
	expect(modes("wallet_signBsm")).not.toContain("payments-role");
	expect(modes("bsocial_publish")).toContain("legacy-identity");
});

test("nested inputs, defaults and required fields remain visible", () => {
	const send = getTool("wallet_sendBsv");
	expect(send).toBeDefined();
	const fields = inputFields(send?.variants[0].definition.inputSchema ?? {});
	expect(fields.find((f) => f.name === "recipients")?.required).toBe(true);
	expect(fields.find((f) => f.name === "recipients[].amount")?.required).toBe(
		true,
	);
	expect(
		fields.find((f) => f.name === "recipients[].currency")?.constraints,
	).toContain('default: "BSV"');
	expect(renderToolMarkdown("missing_tool")).toBeUndefined();
});

test("guide topic anchors are unique and linkable", () => {
	const ids = docs.flatMap((section) => [
		section.id,
		...(section.topics ?? []).map((t) => t.id),
	]);
	expect(ids.every(Boolean)).toBe(true);
	expect(new Set(ids).size).toBe(ids.length);
	expect(ids).toContain("tasks");
});

test("social operations expose their conditional fields in the reference", () => {
	const schema =
		getTool("bsocial_publish")?.variants[0].definition.inputSchema ?? {};
	expect(
		inputAlternatives(schema).some((branch) =>
			branch.fields.some((field) => field.name === "action.replyTo"),
		),
	).toBe(true);
	expect(renderToolMarkdown("bsocial_publish")).toContain(
		"action.attachments[].contentType",
	);
});

test("reader reference deduplicates profiles without hiding distinct wallet inputs", async () => {
	const { displayVariants, toolNavigation } = await import("./tool-catalog");
	for (const name of ["bsocial_read", "bsocial_publish"]) {
		const tool = getTool(name);
		if (!tool) throw new Error(`Missing ${name}`);
		expect(displayVariants(tool)).toHaveLength(1);
		expect(renderToolMarkdown(name)?.match(/^## Definition/gm)).toHaveLength(1);
	}
	const publicKey = getTool("wallet_getPublicKey");
	if (!publicKey) throw new Error("Missing public key tool");
	expect(displayVariants(publicKey)).toHaveLength(2);
	const navigation = toolNavigation.flatMap((group) =>
		group.tools.map((tool) => tool.name),
	);
	expect(navigation).toContain("bsocial_publish");
	expect(navigation).not.toContain("app_wallet_data");
	expect(navigation).not.toContain("wallet_setup");
	expect(renderToolMarkdown("app_wallet_data")).toBeDefined();
});

import { SITE_URL } from "./site";
import {
	catalogTools,
	compactOperations,
	getTool,
	inputFields,
	modeLabel,
	toolNavigation,
	toolSummary,
} from "./tool-catalog";
import { referenceNote } from "./tool-reference-notes";

const cell = (value: string) => value.replace(/\|/g, "\\|").replace(/\n/g, " ");
export function renderToolIndexMarkdown(): string {
	return `# BSV MCP tool reference\n\nThis catalog combines supported wallet configurations. Your server lists only enabled tools.\n\n${toolNavigation.map((group) => `## ${group.name}\n\n${group.tools.map((tool) => `- [${tool.name}](${SITE_URL}/docs/tools/${tool.name}): ${tool.description}`).join("\n")}`).join("\n\n")}`;
}
export function renderToolMarkdown(name: string): string | undefined {
	const tool = getTool(name);
	if (!tool) return undefined;
	const note = referenceNote(name);
	const operations = compactOperations(tool);
	return [
		`# ${name}`,
		toolSummary(tool),
		`## Result\n\n${note.result}`,
		`## Permissions\n\n${note.approval}`,
		...(note.details ? [note.details] : []),
		...(operations.length
			? [
					`## Compact operations\n\nPass the full tool name as operation and its inputs as args.\n\n${operations.map((op) => `- [${op}](${SITE_URL}/docs/tools/${op})`).join("\n")}`,
				]
			: []),
		...tool.variants.map((variant, index) => {
			const fields = inputFields(variant.definition.inputSchema);
			return [
				`## Definition ${index + 1} (${variant.profile})`,
				`Registered in: ${variant.modes.map(modeLabel).join("; ")}.`,
				variant.definition.description ?? "",
				fields.length
					? `| Field | Type | Required | Description | Constraints |\n| --- | --- | --- | --- | --- |\n${fields.map((f) => `| ${cell(f.name)} | ${cell(f.type)} | ${f.required ? "Yes" : "No"} | ${cell(f.description)} | ${cell(f.constraints)} |`).join("\n")}`
					: "No input fields. Pass an empty object.",
				"Nested requirements apply when their parent is supplied.",
				`### Input schema\n\n\`\`\`json\n${JSON.stringify(variant.definition.inputSchema, null, 2)}\n\`\`\``,
				...(variant.definition.outputSchema
					? [
							`### Output schema\n\n\`\`\`json\n${JSON.stringify(variant.definition.outputSchema, null, 2)}\n\`\`\``,
						]
					: []),
			].join("\n\n");
		}),
		`[All tools](${SITE_URL}/docs/tools)`,
	].join("\n\n");
}
export const toolMarkdownPages: Record<string, () => string> =
	Object.fromEntries([
		["/docs/tools", renderToolIndexMarkdown],
		...catalogTools.map(
			(tool) =>
				[
					`/docs/tools/${tool.name}`,
					() => renderToolMarkdown(tool.name) ?? "",
				] as const,
		),
	]);

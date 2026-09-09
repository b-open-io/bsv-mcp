import { toolCategories } from "./site-content";
import data from "./tool-catalog.json";

export interface JsonSchema {
	[key: string]: unknown;
	type?: string | string[];
	description?: string;
	properties?: Record<string, JsonSchema>;
	required?: string[];
	items?: JsonSchema;
	enum?: unknown[];
	anyOf?: JsonSchema[];
	oneOf?: JsonSchema[];
}
export interface ToolDefinition {
	name: string;
	description?: string;
	inputSchema: JsonSchema;
	outputSchema?: JsonSchema;
	annotations?: Record<string, unknown>;
}
export interface ToolEntry {
	name: string;
	variants: {
		definition: ToolDefinition;
		modes: string[];
		profile: "full" | "compact";
	}[];
}
export const catalog = data as {
	modes: { id: string; label: string; description: string }[];
	tools: ToolEntry[];
};
export const catalogTools = catalog.tools;
export const fullToolNames = catalogTools
	.filter((t) => t.variants.some((v) => v.profile === "full"))
	.map((t) => t.name);
export function getTool(name: string) {
	return catalogTools.find((t) => t.name === name);
}
export function modeLabel(id: string) {
	return catalog.modes.find((m) => m.id === id)?.label ?? id;
}
export function categoryForTool(name: string) {
	return toolCategories.find(
		(c) =>
			c.tools?.includes(name) ||
			c.prefixes.some((prefix) => name.startsWith(`${prefix}_`)),
	);
}
export function toolSummary(tool: ToolEntry) {
	return tool.variants[0].definition.description ?? tool.name;
}
export function compactOperations(tool: ToolEntry): string[] {
	return [
		...new Set(
			tool.variants
				.filter((v) => v.profile === "compact")
				.flatMap((v) =>
					(v.definition.inputSchema.properties?.operation?.enum ?? []).filter(
						(value): value is string => typeof value === "string",
					),
				),
		),
	];
}
export interface InputField {
	name: string;
	type: string;
	required: boolean;
	description: string;
	constraints: string;
}
export function schemaType(schema: JsonSchema): string {
	if (schema.anyOf || schema.oneOf)
		return [
			...new Set((schema.anyOf ?? schema.oneOf ?? []).map(schemaType)),
		].join(" | ");
	if (schema.enum) return schema.enum.map((v) => JSON.stringify(v)).join(" | ");
	if (schema.type === "array")
		return `array of ${schema.items ? schemaType(schema.items) : "values"}`;
	return Array.isArray(schema.type)
		? schema.type.join(" | ")
		: (schema.type ?? "value");
}
function constraints(schema: JsonSchema): string {
	return [
		"default",
		"minimum",
		"maximum",
		"exclusiveMinimum",
		"exclusiveMaximum",
		"minLength",
		"maxLength",
		"minItems",
		"maxItems",
		"pattern",
		"format",
		"const",
	]
		.filter((key) => schema[key] !== undefined)
		.map((key) => `${key}: ${JSON.stringify(schema[key])}`)
		.join("; ");
}
/** Nested fields remain visible; conditional branch details stay in the full schema. */
export function inputFields(schema: JsonSchema, prefix = ""): InputField[] {
	return Object.entries(schema.properties ?? {}).flatMap(([name, property]) => {
		const path = prefix ? `${prefix}.${name}` : name;
		return [
			{
				name: path,
				type: schemaType(property),
				required: schema.required?.includes(name) ?? false,
				description: property.description ?? "",
				constraints: constraints(property),
			},
			...inputFields(property, path),
			...(property.items ? inputFields(property.items, `${path}[]`) : []),
		];
	});
}
export const toolNavigation = toolCategories.map((category) => ({
	id: category.key,
	name: category.name,
	tools: catalogTools
		.filter((t) => categoryForTool(t.name)?.key === category.key)
		.map((tool) => ({
			name: tool.name,
			description: toolSummary(tool),
			compact: tool.variants.every((v) => v.profile === "compact"),
		})),
}));

/** Describe the object alternatives of a discriminated input without hiding them in raw JSON. */
export function inputAlternatives(schema: JsonSchema) {
	return Object.entries(schema.properties ?? {}).flatMap(([field, property]) =>
		(property.oneOf ?? property.anyOf ?? [])
			.filter((branch) => branch.properties)
			.map((branch, index) => {
				const discriminator = Object.entries(branch.properties ?? {}).find(
					([, value]) => value.const !== undefined || value.enum,
				);
				const label = discriminator
					? `${field}.${discriminator[0]} = ${discriminator[1].const !== undefined ? JSON.stringify(discriminator[1].const) : discriminator[1].enum?.map((v) => JSON.stringify(v)).join(" | ")}`
					: `${field}: option ${index + 1}`;
				return { label, fields: inputFields(branch, field) };
			}),
	);
}

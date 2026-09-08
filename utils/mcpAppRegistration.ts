import {
	RESOURCE_MIME_TYPE,
	RESOURCE_URI_META_KEY,
} from "@modelcontextprotocol/ext-apps/server";
import type {
	McpServer,
	ReadResourceCallback,
	RegisteredResource,
	RegisteredTool,
	ResourceMetadata,
	StandardSchemaWithJSON,
	ToolAnnotations,
	ToolCallback,
} from "@modelcontextprotocol/server";

/** UI metadata accepted by MCP Apps hosts. */
export interface McpAppToolUiMeta extends Record<string, unknown> {
	resourceUri: string;
	visibility?: Array<"model" | "app">;
}

/** Tool configuration for a v2 MCP App registration. */
export interface McpAppToolConfig {
	title?: string;
	description?: string;
	inputSchema?: StandardSchemaWithJSON;
	outputSchema?: StandardSchemaWithJSON;
	annotations?: ToolAnnotations;
	_meta: Record<string, unknown> & {
		ui?: McpAppToolUiMeta;
		[RESOURCE_URI_META_KEY]?: string;
	};
}

/** Resource configuration for a v2 MCP App registration. */
export type McpAppResourceConfig = ResourceMetadata;

/**
 * Register an app tool against the SDK v2 server surface.
 *
 * ext-apps 1.7.5 exposes the same runtime helper with SDK v1 types. The
 * runtime behavior needed here is small: normalize the current and legacy UI
 * resource URI metadata keys, then delegate to the native v2 registration
 * method so its schema conversion and request validation remain active.
 */
export function registerAppTool<
	InputArgs extends StandardSchemaWithJSON | undefined = undefined,
>(
	server: Pick<McpServer, "registerTool">,
	name: string,
	config: McpAppToolConfig & { inputSchema?: InputArgs },
	cb: ToolCallback<InputArgs>,
): RegisteredTool {
	const normalizedMeta = normalizeToolMeta(config._meta);
	return server.registerTool(name, { ...config, _meta: normalizedMeta }, cb);
}

/**
 * Register the HTML resource referenced by an app tool.
 *
 * The MIME type and callback shape match ext-apps 1.7.5. The call is routed
 * through the native v2 resource registration method to avoid crossing SDK
 * major-version types.
 */
export function registerAppResource(
	server: Pick<McpServer, "registerResource">,
	name: string,
	uri: string,
	config: McpAppResourceConfig,
	readCallback: ReadResourceCallback,
): RegisteredResource {
	return server.registerResource(
		name,
		uri,
		{ mimeType: RESOURCE_MIME_TYPE, ...config },
		readCallback,
	);
}

function normalizeToolMeta(
	meta: McpAppToolConfig["_meta"],
): McpAppToolConfig["_meta"] {
	const uiMeta = meta.ui;
	const legacyResourceUri = meta[RESOURCE_URI_META_KEY];

	if (uiMeta?.resourceUri && !legacyResourceUri) {
		return { ...meta, [RESOURCE_URI_META_KEY]: uiMeta.resourceUri };
	}

	if (legacyResourceUri && !uiMeta?.resourceUri) {
		return {
			...meta,
			ui: { ...uiMeta, resourceUri: legacyResourceUri },
		};
	}

	return meta;
}

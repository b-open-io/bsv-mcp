import { expect, test } from "bun:test";
import {
	RESOURCE_MIME_TYPE,
	RESOURCE_URI_META_KEY,
} from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { registerAppResource, registerAppTool } from "./mcpAppRegistration.ts";

const RESOURCE_URI = "ui://test/app.html";

function makeServer() {
	return new McpServer({ name: "mcp-app-registration-test", version: "1.0.0" });
}

test("registerAppTool preserves v2 schemas and adds the legacy URI metadata", () => {
	const server = makeServer();
	const inputSchema = z.object({ value: z.string() });

	const registration = registerAppTool(
		server,
		"test_tool",
		{
			inputSchema,
			_meta: {
				ui: { resourceUri: RESOURCE_URI },
				custom: "preserved",
			},
		},
		async ({ value }) => ({
			content: [{ type: "text", text: value }],
		}),
	);

	expect(registration.inputSchema).toBe(inputSchema);
	expect(registration._meta).toEqual({
		ui: { resourceUri: RESOURCE_URI },
		[RESOURCE_URI_META_KEY]: RESOURCE_URI,
		custom: "preserved",
	});
});

test("registerAppTool adds current UI metadata for legacy-only callers", () => {
	const server = makeServer();

	const registration = registerAppTool(
		server,
		"legacy_test_tool",
		{
			_meta: { [RESOURCE_URI_META_KEY]: RESOURCE_URI },
		},
		async () => ({
			content: [{ type: "text", text: "ok" }],
		}),
	);

	expect(registration._meta).toEqual({
		[RESOURCE_URI_META_KEY]: RESOURCE_URI,
		ui: { resourceUri: RESOURCE_URI },
	});
});

test("registerAppResource keeps the MCP Apps MIME type on v2 resources", () => {
	const server = makeServer();

	const registration = registerAppResource(
		server,
		"Test App",
		RESOURCE_URI,
		{ description: "Test app resource" },
		async () => ({
			contents: [{ uri: RESOURCE_URI, text: "<html>Test App</html>" }],
		}),
	);

	expect(registration.metadata).toMatchObject({
		description: "Test app resource",
		mimeType: RESOURCE_MIME_TYPE,
	});
});

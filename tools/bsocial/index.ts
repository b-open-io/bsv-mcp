import type { McpServer } from "@modelcontextprotocol/server";
import { registerSocialPublishTool, type SocialWriter } from "./publish";
import { registerSocialReadTool } from "./read";

export function registerBsocialTools(
	server: McpServer,
	config: SocialWriter = {},
) {
	registerSocialReadTool(server);
	if (config.identityContext || config.wallet)
		registerSocialPublishTool(server, config);
}

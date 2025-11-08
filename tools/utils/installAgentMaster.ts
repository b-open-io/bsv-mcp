import { spawn } from "node:child_process";
import { platform } from "node:os";
import { z } from "zod";

const installAgentMasterSchema = z.object({
	method: z
		.enum(["go", "source", "auto"])
		.optional()
		.describe("Installation method"),
});

/**
 * Install the Agent Master CLI tool for managing MCP server configurations
 */
export async function installAgentMaster(
	args: z.infer<typeof installAgentMasterSchema>,
) {
	const method = args.method || "auto";

	return new Promise((resolve, reject) => {
		let command: string;
		let commandArgs: string[] = [];

		if (method === "auto" || method === "go") {
			// Try go install first
			command = "go";
			commandArgs = ["install", "github.com/b-open-io/agent-master-cli@latest"];
		} else if (method === "source") {
			// Install from source
			reject(
				new Error(
					"Source installation requires manual steps. Please run:\ngit clone https://github.com/b-open-io/agent-master-cli.git\ncd agent-master-cli\nmake deps && make build && make install",
				),
			);
			return;
		}

		console.log(`🔧 Installing Agent Master CLI using ${method} method...`);

		const install = spawn(command, commandArgs, {
			stdio: "inherit",
			shell: true,
		});

		install.on("error", (error) => {
			if (method === "auto" && command === "go") {
				// If go install fails in auto mode, provide instructions
				reject(
					new Error(
						"Go installation failed. Please ensure Go is installed or try manual installation:\n\n1. Install Go from https://golang.org/dl/\n2. Run: go install github.com/b-open-io/agent-master-cli@latest\n\nOr install from source:\ngit clone https://github.com/b-open-io/agent-master-cli.git\ncd agent-master-cli\nmake deps && make build && make install",
					),
				);
			} else {
				reject(error);
			}
		});

		install.on("close", (code) => {
			if (code !== 0) {
				reject(new Error(`Installation failed with code ${code}`));
			} else {
				resolve({
					success: true,
					message:
						"✅ Agent Master CLI installed successfully!\n\nGet started with:\n  agent-master init --with-demo\n  agent-master list\n  agent-master sync --preset claude",
					nextSteps: [
						"Initialize configuration: agent-master init --with-demo",
						"List servers: agent-master list",
						'Add BSV MCP: agent-master add bsv-mcp --transport stdio --command "bunx" --args "bsv-mcp@latest"',
						"Sync to Claude: agent-master sync --preset claude",
					],
				});
			}
		});
	});
}

export const installAgentMasterTool = {
	name: "utils_installAgentMaster",
	description:
		"Install the Agent Master CLI tool for managing MCP server configurations across multiple platforms (Claude, VS Code, Cursor, etc.)",
	inputSchema: installAgentMasterSchema,
	handler: installAgentMaster,
};

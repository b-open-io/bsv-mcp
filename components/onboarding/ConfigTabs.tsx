"use client";

import {
	Cloud,
	ExternalLink,
	Info,
	Package,
	Server,
	Terminal,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CodeBlock } from "./CodeBlock";

interface ConfigTabsProps {
	mcpUrl: string;
	sessionToken: string;
	copied: string;
	onCopy: (text: string, id: string) => Promise<void>;
}

function TransportBadge({
	icon,
	label,
	description,
}: {
	icon: React.ReactNode;
	label: string;
	description: string;
}) {
	return (
		<div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3">
			<div className="mt-0.5 text-muted-foreground">{icon}</div>
			<div className="space-y-0.5">
				<p className="text-sm font-medium">{label}</p>
				<p className="text-xs text-muted-foreground">{description}</p>
			</div>
		</div>
	);
}

export function ConfigTabs({
	mcpUrl,
	sessionToken,
	copied,
	onCopy,
}: ConfigTabsProps) {
	const claudeCodeCommand = `claude mcp add --transport sse bsv-mcp-hosted ${mcpUrl} --header X-Session-Token="${sessionToken}"`;

	const claudeDesktopConfig = `{
  "mcpServers": {
    "bsv-mcp-hosted": {
      "url": "${mcpUrl}",
      "headers": {
        "X-Session-Token": "${sessionToken}"
      }
    }
  }
}`;

	const cursorConfig = `{
  "mcpServers": {
    "bsv-mcp": {
      "transport": "stdio",
      "command": "bunx",
      "args": ["bsv-mcp@latest"]
    }
  }
}`;

	const dockerCommand = `docker run -it \\
  -e PRIVATE_KEY_WIF="YOUR_WIF_HERE" \\
  -e USE_DROPLET_API=false \\
  ghcr.io/rohenaz/bsv-mcp:latest`;

	return (
		<div className="space-y-4">
			<Tabs defaultValue="claude" className="w-full">
				<TabsList className="grid w-full grid-cols-4">
					<TabsTrigger value="claude">Claude</TabsTrigger>
					<TabsTrigger value="cursor">Cursor</TabsTrigger>
					<TabsTrigger value="local">Local</TabsTrigger>
					<TabsTrigger value="docker">Docker</TabsTrigger>
				</TabsList>

				{/* Claude tab */}
				<TabsContent value="claude" className="space-y-4 pt-2">
					<TransportBadge
						icon={<Cloud className="h-4 w-4" />}
						label="Hosted Mode — SSE Transport"
						description="Connects to our hosted MCP server over Server-Sent Events. Session token required."
					/>

					<div className="space-y-1.5">
						<p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
							Claude Code CLI
						</p>
						<CodeBlock
							code={claudeCodeCommand}
							id="claude-cli"
							copied={copied}
							onCopy={onCopy}
						/>
					</div>

					<div className="space-y-1.5">
						<p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
							Claude Desktop — claude_desktop_config.json
						</p>
						<CodeBlock
							code={claudeDesktopConfig}
							id="claude-json"
							copied={copied}
							onCopy={onCopy}
							multiline
						/>
					</div>
				</TabsContent>

				{/* Cursor tab */}
				<TabsContent value="cursor" className="space-y-4 pt-2">
					<TransportBadge
						icon={<Terminal className="h-4 w-4" />}
						label="Local Mode — STDIO Transport"
						description="Runs locally on your machine using your local BSV keys. No session token needed."
					/>

					<div className="space-y-1.5">
						<p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
							~/.cursor/mcp.json
						</p>
						<CodeBlock
							code={cursorConfig}
							id="cursor-json"
							copied={copied}
							onCopy={onCopy}
							multiline
						/>
					</div>

					<Alert>
						<Info className="h-4 w-4" />
						<AlertDescription className="text-xs">
							Restart Cursor after updating mcp.json for changes to take effect.
						</AlertDescription>
					</Alert>
				</TabsContent>

				{/* Local tab */}
				<TabsContent value="local" className="space-y-4 pt-2">
					<TransportBadge
						icon={<Package className="h-4 w-4" />}
						label="Bunx / NPX Mode"
						description="Run directly without installation. Useful for testing or one-time use."
					/>

					<div className="space-y-1.5">
						<p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
							Run with bunx (recommended)
						</p>
						<CodeBlock
							code="bunx bsv-mcp@latest"
							id="local-bunx"
							copied={copied}
							onCopy={onCopy}
						/>
					</div>

					<div className="space-y-1.5">
						<p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
							Run with npx
						</p>
						<CodeBlock
							code="npx bsv-mcp@latest"
							id="local-npx"
							copied={copied}
							onCopy={onCopy}
						/>
					</div>
				</TabsContent>

				{/* Docker tab */}
				<TabsContent value="docker" className="space-y-4 pt-2">
					<TransportBadge
						icon={<Server className="h-4 w-4" />}
						label="Container Mode"
						description="Runs in an isolated Docker container. Suitable for production deployments."
					/>

					<div className="space-y-1.5">
						<p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
							Docker run command
						</p>
						<CodeBlock
							code={dockerCommand}
							id="docker-cmd"
							copied={copied}
							onCopy={onCopy}
							multiline
						/>
					</div>

					<Alert variant="destructive">
						<AlertDescription className="text-xs">
							<strong>Security:</strong> Never bake your private key into a
							Docker image. Always pass it as an environment variable at
							runtime.
						</AlertDescription>
					</Alert>
				</TabsContent>
			</Tabs>

			{/* Config file locations reference */}
			<div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1">
				<p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
					Config File Locations
				</p>
				<p className="text-xs text-muted-foreground font-mono">
					Claude Desktop (macOS):{" "}
					<span className="text-foreground">
						~/Library/Application Support/Claude/claude_desktop_config.json
					</span>
				</p>
				<p className="text-xs text-muted-foreground font-mono">
					Cursor: <span className="text-foreground">~/.cursor/mcp.json</span>
				</p>
				<p className="text-xs text-muted-foreground font-mono">
					VS Code: <span className="text-foreground">~/.vscode/mcp.json</span>
				</p>
			</div>

			{/* Footer links */}
			<div className="flex gap-2 pt-2">
				<Button variant="outline" className="flex-1" asChild>
					<a
						href="https://github.com/rohenaz/bsv-mcp"
						target="_blank"
						rel="noopener noreferrer"
					>
						<ExternalLink className="h-4 w-4" />
						Documentation
					</a>
				</Button>
				<Button variant="outline" className="flex-1" asChild>
					<a
						href="https://docs.anthropic.com/en/docs/claude-code/tutorials#set-up-model-context-protocol-mcp"
						target="_blank"
						rel="noopener noreferrer"
					>
						<Terminal className="h-4 w-4" />
						MCP Guide
					</a>
				</Button>
			</div>
		</div>
	);
}

"use client";
import { ArrowUpRight } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { installTargets } from "@/lib/site-content";
import { CodeSnippet } from "./CodeSnippet";
import { CopyCommand } from "./CopyCommand";

const choices = [
	{ key: "claude-code", label: "Claude" },
	{ key: "grok", label: "Grok" },
	{ key: "codex", label: "Codex" },
	{ key: "other", label: "Other" },
];
export function QuickInstall() {
	return (
		<Tabs defaultValue="claude-code" className="quick-install">
			<TabsList
				aria-label="Install for your client"
				className="quick-install-tabs"
			>
				{choices.map((choice) => (
					<TabsTrigger key={choice.key} value={choice.key}>
						{choice.label}
					</TabsTrigger>
				))}
			</TabsList>
			{choices.map((choice) => {
				const target = installTargets.find((item) => item.key === choice.key);
				return (
					<TabsContent
						key={choice.key}
						value={choice.key}
						className="install-code-wells"
					>
						<CopyCommand
							command={target?.command ?? "bunx bsv-mcp@latest --stdio"}
							label={target?.label ?? "Terminal"}
						/>
						{target?.config && (
							<CodeSnippet
								code={target.config}
								language={
									target.configPath?.endsWith(".toml") ? "toml" : "json"
								}
								filename={target.configPath}
							/>
						)}
					</TabsContent>
				);
			})}
			<a className="landing-text-link" href="/docs#quickstart">
				Setup guide <ArrowUpRight size={15} />
			</a>
		</Tabs>
	);
}

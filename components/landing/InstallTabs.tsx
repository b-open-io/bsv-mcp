"use client";

import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { InstallTarget } from "@/lib/site-content";
import { CodeSnippet } from "./CodeSnippet";
import { CopyCommand } from "./CopyCommand";

interface InstallTabsProps {
	targets: InstallTarget[];
}

/**
 * Per-client install instructions.
 *
 * Every tab is generated from `installTargets`, so adding a client is a data
 * change and the docs link always matches the snippet shown.
 */
export function InstallTabs({ targets }: InstallTabsProps) {
	const first = targets[0];
	if (!first) return null;

	return (
		<Tabs defaultValue={first.key} className="w-full">
			<TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
				{targets.map((target) => (
					<TabsTrigger key={target.key} value={target.key}>
						{target.label}
					</TabsTrigger>
				))}
			</TabsList>

			{targets.map((target) => (
				<TabsContent
					key={target.key}
					value={target.key}
					className="space-y-3 pt-4"
				>
					{target.command ? (
						<CopyCommand command={target.command} label={target.label} />
					) : null}

					{target.altCommands?.map((alt) => (
						<div key={alt.command} className="space-y-1.5">
							<p className="font-mono text-xs text-muted-foreground">
								{alt.label}
							</p>
							<CopyCommand command={alt.command} label={target.label} />
						</div>
					))}

					{target.config ? (
						<div className="space-y-2">
							{target.configPath ? (
								<p className="font-mono text-xs text-muted-foreground">
									{target.configPath}
								</p>
							) : null}
							<CodeSnippet
								code={target.config}
								language={
									target.configPath?.endsWith(".toml") ? "toml" : "json"
								}
								filename={target.configPath ?? `${target.label} config`}
							/>
						</div>
					) : null}

					{target.note ? (
						<p className="text-sm text-muted-foreground">{target.note}</p>
					) : null}

					<Button variant="link" asChild className="h-auto px-0">
						<a href={target.docsUrl} target="_blank" rel="noreferrer">
							{target.label} MCP documentation
							<ExternalLink />
						</a>
					</Button>
				</TabsContent>
			))}
		</Tabs>
	);
}

import type { Metadata } from "next";
import Link from "next/link";
import { ReferenceLayout } from "@/components/docs/ReferenceLayout";
import {
	catalog,
	catalogTools,
	isDeveloperTool,
	toolNavigation,
} from "@/lib/tool-catalog";

export const metadata: Metadata = {
	title: "All tools",
	description:
		"Browse BSV MCP tools, inputs, wallet requirements and compact operations.",
	alternates: { canonical: "/docs/tools" },
};
export default function ToolsPage() {
	return (
		<ReferenceLayout>
			<p className="mb-3 font-mono text-sm text-primary">Tool reference</p>
			<h1 className="text-4xl font-bold tracking-tight">All tools</h1>
			<p className="mt-5 text-lg leading-8 text-muted-foreground">
				Find a tool by what you want to do. Open its reference for inputs,
				results and wallet requirements.
			</p>
			<p className="mt-4 leading-7">
				Your available tools depend on your wallet and settings.
			</p>
			<div className="mt-5 flex gap-5 text-sm">
				<Link href="/docs#tasks" className="text-primary underline">
					Common tasks
				</Link>
				<a href="/docs/tools.md" className="text-primary underline">
					Read as Markdown
				</a>
			</div>
			<details className="my-8 rounded-lg border p-4">
				<summary className="cursor-pointer font-medium">
					Wallet configurations in this reference
				</summary>
				<dl className="mt-4 space-y-4">
					{catalog.modes.map((mode) => (
						<div key={mode.id}>
							<dt className="font-medium">{mode.label}</dt>
							<dd className="text-sm leading-6 text-muted-foreground">
								{mode.description}
							</dd>
						</div>
					))}
				</dl>
			</details>
			{toolNavigation.map((group) => (
				<section id={group.id} key={group.id} className="mb-10 scroll-mt-8">
					<h2 className="border-b pb-3 text-2xl font-semibold">{group.name}</h2>
					<ul className="divide-y">
						{group.tools.map((tool) => (
							<li key={tool.name} className="py-5">
								<Link
									href={`/docs/tools/${tool.name}`}
									className="break-words font-mono text-sm font-semibold text-primary underline-offset-4 hover:underline"
								>
									{tool.name}
								</Link>
								{tool.compact && (
									<span className="ml-3 rounded bg-muted px-2 py-1 text-xs">
										Compact
									</span>
								)}
								<p className="mt-2 text-sm leading-6 text-muted-foreground">
									{tool.description}
								</p>
							</li>
						))}
					</ul>
				</section>
			))}
			<details className="my-8 rounded border p-4">
				<summary className="cursor-pointer font-medium">
					Developer reference: wallet API, compact aliases and dashboard tools
				</summary>
				<p className="my-3">
					Compact mode exposes a smaller set of operations and omits most write
					tools. Wallet API tools expose low-level signing and transaction
					methods. Dashboard tools are called by the app.
				</p>
				<ul className="space-y-2">
					{catalogTools.filter(isDeveloperTool).map((t) => (
						<li key={t.name}>
							<Link
								className="font-mono text-sm text-primary underline"
								href={`/docs/tools/${t.name}`}
							>
								{t.name}
							</Link>
						</li>
					))}
				</ul>
			</details>
		</ReferenceLayout>
	);
}

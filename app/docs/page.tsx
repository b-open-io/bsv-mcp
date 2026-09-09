import type { Metadata } from "next";
import Link from "next/link";
import { CodeSnippet } from "@/components/landing/CodeSnippet";
import { BrcReferences } from "@/lib/brc";
import { type DocTopic, docs } from "@/lib/docs";

export const metadata: Metadata = {
	title: "Documentation",
	description:
		"Install BSV MCP locally, set up your wallet and browse the tool reference.",
	alternates: { canonical: "/docs" },
};
function TopicContent({ topic }: { topic: DocTopic }) {
	return (
		<>
			{topic.paragraphs.map((paragraph) => (
				<p key={paragraph} className="text-base leading-7 text-foreground/85">
					<BrcReferences text={paragraph} />
				</p>
			))}
			{topic.settings && (
				<div className="overflow-x-auto">
					<table className="w-full text-left text-sm">
						<thead>
							<tr className="border-b">
								<th className="p-3 pl-0">Setting</th>
								<th className="p-3">Default</th>
								<th className="p-3">Effect</th>
							</tr>
						</thead>
						<tbody>
							{topic.settings.map((row) => (
								<tr key={row.name} className="border-b align-top">
									<th className="p-3 pl-0 font-mono text-xs font-medium">
										{row.name}
									</th>
									<td className="min-w-32 p-3">{row.default}</td>
									<td className="min-w-52 p-3 leading-6">{row.effect}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
			{topic.code && (
				<CodeSnippet
					code={topic.code}
					language={
						/^[{[]/.test(topic.code.trimStart())
							? "json"
							: topic.code.trimStart().startsWith("//")
								? "jsonc"
								: "bash"
					}
					filename="Example"
				/>
			)}
		</>
	);
}
export default function DocsPage() {
	return (
		<div className="mx-auto max-w-6xl px-6 pb-24">
			<header className="flex items-center justify-between border-b py-5">
				<Link href="/" className="font-mono font-semibold">
					← BSV MCP
				</Link>
				<Link href="/docs/tools" className="text-sm text-primary">
					All tools →
				</Link>
			</header>
			<div className="grid items-start gap-10 pt-10 md:grid-cols-[230px_minmax(0,1fr)]">
				<aside>
					<details
						open
						className="rounded-lg border p-4 md:sticky md:top-6 md:max-h-[calc(100dvh-3rem)] md:overflow-y-auto"
					>
						<summary className="cursor-pointer font-medium">
							Documentation
						</summary>
						<nav
							aria-label="Documentation"
							className="mt-4 max-h-64 space-y-4 overflow-y-auto md:max-h-none md:overflow-visible"
						>
							<Link
								href="/docs/tools"
								className="block text-sm font-semibold text-primary"
							>
								All tools →
							</Link>
							{docs.map((section) => (
								<details key={section.id}>
									<summary className="cursor-pointer text-sm">
										{section.title}
									</summary>
									<ul className="mt-2 space-y-2 border-l pl-3">
										<li>
											<a
												href={`#${section.id}`}
												className="text-xs text-muted-foreground hover:text-primary"
											>
												Overview
											</a>
										</li>
										{section.topics?.map((topic) => (
											<li key={topic.id}>
												<a
													href={`#${topic.id}`}
													className="text-xs text-muted-foreground hover:text-primary"
												>
													{topic.title}
												</a>
											</li>
										))}
									</ul>
								</details>
							))}
							<a href="/docs.md" className="block text-xs text-primary">
								Read as Markdown ↗
							</a>
						</nav>
					</details>
				</aside>
				<main className="min-w-0 max-w-3xl">
					<h1 className="text-4xl font-bold tracking-tight">Documentation</h1>
					<p className="mb-10 mt-4 text-lg text-muted-foreground">
						Set up the local server, connect a wallet, then ask your assistant
						to use Bitcoin SV.
					</p>
					<section
						id="tools"
						className="mb-10 scroll-mt-8 rounded-lg border p-5"
					>
						<h2 className="text-xl font-semibold">Tool reference</h2>
						<p className="mt-2 leading-7">
							Browse exact tool names, inputs, results and wallet requirements.
						</p>
						<Link
							href="/docs/tools"
							className="mt-3 inline-block text-primary underline"
						>
							Explore all tools →
						</Link>
					</section>
					{docs.map((section) => (
						<section
							key={section.id}
							id={section.id}
							className="mb-14 scroll-mt-8 space-y-4 border-t pt-8"
						>
							<h2 className="text-2xl font-semibold tracking-tight">
								{section.title}
							</h2>
							<TopicContent topic={section} />
							{section.topics?.map((topic) => (
								<section
									key={topic.id}
									id={topic.id}
									className="scroll-mt-8 space-y-4 pt-5"
								>
									<h3 className="text-lg font-semibold">{topic.title}</h3>
									<TopicContent topic={topic} />
								</section>
							))}
							{section.links && (
								<div className="flex flex-wrap gap-x-6 gap-y-2 pt-2">
									{section.links.map((link) => (
										<a
											key={link.href}
											href={link.href}
											className="text-sm text-primary underline underline-offset-4"
										>
											{link.label} ↗
										</a>
									))}
								</div>
							)}
						</section>
					))}
				</main>
			</div>
		</div>
	);
}

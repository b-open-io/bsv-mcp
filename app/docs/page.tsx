import type { Metadata } from "next";
import Link from "next/link";
import { GitHubStars } from "@/components/landing/GitHubStars";
import { BrcReferences } from "@/lib/brc";
import { docs } from "@/lib/docs";
import { GITHUB_URL } from "@/lib/site";

export const metadata: Metadata = {
	title: "Documentation",
	description:
		"Install BSV MCP, connect a wallet, configure 1Sat services, and use payments, ordinals and identity tools.",
	alternates: { canonical: "/docs" },
};

export default function DocsPage() {
	return (
		<div className="mx-auto max-w-6xl px-6 pb-24">
			<header className="flex items-center justify-between border-b py-5">
				<Link href="/" className="font-mono font-semibold">
					← BSV MCP
				</Link>
				<GitHubStars url={GITHUB_URL} />
			</header>
			<div className="grid gap-12 pt-12 md:grid-cols-[190px_minmax(0,1fr)]">
				<aside>
					<nav
						aria-label="Documentation"
						className="space-y-3 md:sticky md:top-8"
					>
						<p className="mb-4 font-mono text-xs uppercase tracking-widest text-muted-foreground">
							On this page
						</p>
						{docs.map((section) => (
							<a
								key={section.id}
								href={`#${section.id}`}
								className="block text-sm text-muted-foreground hover:text-primary"
							>
								{section.title}
							</a>
						))}
						<a
							href="/docs.md"
							className="block pt-4 font-mono text-xs text-primary"
						>
							Read as Markdown ↗
						</a>
					</nav>
				</aside>
				<main className="min-w-0 max-w-3xl">
					<h1 className="mb-4 text-4xl font-bold tracking-tight">
						Documentation
					</h1>
					<p className="mb-12 text-lg text-muted-foreground">
						Set up BSV MCP, then ask your assistant to check balances, find
						assets, or send payments.
					</p>
					{docs.map((section) => (
						<section
							key={section.id}
							id={section.id}
							className="mb-14 scroll-mt-8 space-y-4 border-t pt-8"
						>
							<h2 className="text-2xl font-semibold tracking-tight">
								{section.title}
							</h2>
							{section.paragraphs.map((paragraph) => (
								<p
									key={paragraph}
									className="text-base leading-7 text-foreground/85"
								>
									<BrcReferences text={paragraph} />
								</p>
							))}
							{section.code && (
								<pre className="overflow-x-auto rounded-lg border bg-card p-5 text-xs leading-6">
									<code>{section.code}</code>
								</pre>
							)}
							{section.topics?.map((topic) => (
								<div key={topic.title} className="space-y-4 pt-5">
									<h3 className="text-lg font-semibold">{topic.title}</h3>
									{topic.paragraphs.map((paragraph) => (
										<p
											key={paragraph}
											className="text-base leading-7 text-foreground/85"
										>
											<BrcReferences text={paragraph} />
										</p>
									))}
									{topic.code && (
										<pre className="overflow-x-auto rounded-lg border bg-card p-5 text-xs leading-6">
											<code>{topic.code}</code>
										</pre>
									)}
								</div>
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

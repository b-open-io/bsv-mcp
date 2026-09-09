"use client";

import Link from "next/link";
import { useId, useState } from "react";

export type NavigationGroup = {
	id: string;
	name: string;
	tools: { name: string; description: string; compact: boolean }[];
};
export function ToolNavigation({
	groups,
	current,
}: {
	groups: NavigationGroup[];
	current?: string;
}) {
	const [query, setQuery] = useState("");
	const id = useId();
	const term = query.trim().toLowerCase();
	const filtered = groups
		.map((group) => ({
			...group,
			tools: group.tools.filter((tool) =>
				`${tool.name} ${tool.description}`.toLowerCase().includes(term),
			),
		}))
		.filter((group) => group.tools.length);
	return (
		<details
			open
			className="rounded-lg border p-4 md:sticky md:top-6 md:max-h-[calc(100dvh-3rem)] md:overflow-y-auto"
		>
			<summary className="cursor-pointer font-semibold">Browse tools</summary>
			<nav
				aria-label="Tool reference"
				className="mt-4 max-h-64 space-y-4 overflow-y-auto md:max-h-none md:overflow-visible"
			>
				<Link
					href="/docs"
					className="block text-sm text-muted-foreground hover:text-primary"
				>
					← Setup and guides
				</Link>
				<Link
					href="/docs/tools"
					aria-current={current ? undefined : "page"}
					className="block text-sm font-semibold"
				>
					All tools
				</Link>
				<div>
					<label htmlFor={id} className="mb-2 block text-sm">
						Find a tool
					</label>
					<input
						id={id}
						type="search"
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						placeholder="Name or purpose"
						className="w-full rounded border bg-background px-3 py-2 text-sm"
					/>
				</div>
				{term && (
					<p role="status" className="text-sm text-muted-foreground">
						{filtered.reduce((n, group) => n + group.tools.length, 0)} matching
						tools
					</p>
				)}
				{!filtered.length && (
					<p className="text-sm">
						No tools match. Try “balance”, “ordinal” or “identity”.
					</p>
				)}
				{filtered.map((group) => (
					<details
						key={`${group.id}-${Boolean(term)}`}
						open={
							Boolean(term) || group.tools.some((tool) => tool.name === current)
						}
					>
						<summary className="cursor-pointer text-sm font-medium">
							{group.name}{" "}
							<span className="text-muted-foreground">
								({group.tools.length})
							</span>
						</summary>
						<ul className="mt-2 space-y-1 border-l pl-3">
							{group.tools.map((tool) => (
								<li key={tool.name}>
									<Link
										href={`/docs/tools/${tool.name}`}
										aria-current={tool.name === current ? "page" : undefined}
										className={`block break-words py-1 font-mono text-xs ${tool.name === current ? "font-bold text-primary" : "text-muted-foreground hover:text-primary"}`}
									>
										{tool.name}
										{tool.compact && (
											<span className="ml-1 font-sans">· compact</span>
										)}
									</Link>
								</li>
							))}
						</ul>
					</details>
				))}
			</nav>
		</details>
	);
}

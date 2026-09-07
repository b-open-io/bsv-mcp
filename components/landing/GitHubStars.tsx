"use client";

import { Github, Star } from "lucide-react";
import { useEffect, useState } from "react";

export function GitHubStars({ url }: { url: string }) {
	const [stars, setStars] = useState<number | null>(null);
	useEffect(() => {
		const controller = new AbortController();
		fetch(`https://api.github.com/repos${new URL(url).pathname}`, {
			signal: controller.signal,
		})
			.then((response) => (response.ok ? response.json() : null))
			.then((data) => {
				if (
					Number.isSafeInteger(data?.stargazers_count) &&
					data.stargazers_count >= 0
				) {
					setStars(data.stargazers_count);
				}
			})
			.catch(() => {}); // GitHub link remains usable when offline or rate limited.
		return () => controller.abort();
	}, [url]);

	return (
		<a
			href={url}
			target="_blank"
			rel="noopener noreferrer"
			className="inline-flex h-10 items-center gap-2 rounded-md px-3 text-sm transition-colors hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
			aria-label={
				stars === null
					? "BSV MCP on GitHub"
					: `BSV MCP on GitHub, ${stars} stars`
			}
		>
			<Github className="size-4" aria-hidden />
			<span className="hidden sm:inline">github</span>
			{stars !== null && (
				<span className="inline-flex items-center gap-1 text-xs tabular-nums">
					<Star className="size-3" aria-hidden />
					{stars.toLocaleString("en-US")}
				</span>
			)}
		</a>
	);
}

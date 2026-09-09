import Link from "next/link";
import type { ReactNode } from "react";
import { toolNavigation } from "@/lib/tool-catalog";
import { ToolNavigation } from "./ToolNavigation";

export function ReferenceLayout({
	children,
	current,
}: {
	children: ReactNode;
	current?: string;
}) {
	return (
		<div className="mx-auto max-w-7xl px-6 pb-24">
			<header className="flex items-center justify-between border-b py-5">
				<Link href="/" className="font-mono font-semibold">
					← BSV MCP
				</Link>
				<Link href="/docs#quickstart" className="text-sm text-primary">
					Install
				</Link>
			</header>
			<div className="grid items-start gap-10 pt-8 md:grid-cols-[260px_minmax(0,1fr)]">
				<aside>
					<ToolNavigation groups={toolNavigation} current={current} />
				</aside>
				<main className="min-w-0 max-w-3xl">{children}</main>
			</div>
		</div>
	);
}

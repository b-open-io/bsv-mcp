"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface CopyCommandProps {
	command: string;
	className?: string;
}

export function CopyCommand({ command, className }: CopyCommandProps) {
	const [copied, setCopied] = useState(false);

	async function copy() {
		try {
			await navigator.clipboard.writeText(command);
			setCopied(true);
			setTimeout(() => setCopied(false), 1500);
		} catch {
			// Clipboard unavailable (insecure context); nothing to do.
		}
	}

	return (
		<div
			className={cn(
				"group flex items-center gap-3 rounded-lg border border-border bg-black/40 pl-4 pr-2 py-2 font-mono text-sm",
				className,
			)}
		>
			<span className="select-none text-amber-400">$</span>
			<code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap text-foreground">
				{command}
			</code>
			<button
				type="button"
				onClick={copy}
				aria-label="Copy command"
				className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
			>
				{copied ? (
					<Check className="size-4 text-emerald-400" />
				) : (
					<Copy className="size-4" />
				)}
			</button>
		</div>
	);
}

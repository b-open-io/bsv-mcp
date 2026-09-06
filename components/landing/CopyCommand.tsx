"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
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
				"flex items-center gap-3 rounded-lg border bg-muted/40 py-2 pl-4 pr-2 font-mono text-sm",
				className,
			)}
		>
			<span aria-hidden className="select-none text-primary">
				$
			</span>
			<code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap text-foreground">
				{command}
			</code>
			<Button
				type="button"
				variant="ghost"
				size="icon"
				onClick={copy}
				aria-label={copied ? "Command copied" : "Copy command"}
			>
				{copied ? (
					<Check className="text-success" />
				) : (
					<Copy className="text-muted-foreground" />
				)}
			</Button>
		</div>
	);
}

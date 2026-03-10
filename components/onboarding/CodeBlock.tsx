"use client";

import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CodeBlockProps {
	code: string;
	id: string;
	copied: string;
	onCopy: (text: string, id: string) => Promise<void>;
	multiline?: boolean;
	className?: string;
}

export function CodeBlock({
	code,
	id,
	copied,
	onCopy,
	multiline = false,
	className,
}: CodeBlockProps) {
	const isCopied = copied === id;

	return (
		<div
			className={cn(
				"group relative rounded-lg bg-muted/50 border border-border p-4",
				className,
			)}
		>
			<div className="flex items-start gap-3">
				{multiline ? (
					<pre className="flex-1 text-xs text-foreground overflow-x-auto">
						<code>{code}</code>
					</pre>
				) : (
					<code className="flex-1 text-xs text-foreground break-all">
						{code}
					</code>
				)}
				<Button
					type="button"
					variant="ghost"
					size="icon"
					className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
					onClick={() => onCopy(code, id)}
					aria-label={isCopied ? "Copied" : "Copy to clipboard"}
				>
					{isCopied ? (
						<Check className="h-3.5 w-3.5" />
					) : (
						<Copy className="h-3.5 w-3.5" />
					)}
				</Button>
			</div>
		</div>
	);
}

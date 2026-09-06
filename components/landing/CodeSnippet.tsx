import { cn } from "@/lib/utils";

interface CodeSnippetProps {
	code: string;
	className?: string;
}

export function CodeSnippet({ code, className }: CodeSnippetProps) {
	return (
		<pre
			className={cn(
				"overflow-x-auto rounded-lg border bg-muted/40 p-4 font-mono text-xs leading-relaxed text-foreground",
				className,
			)}
		>
			<code>{code}</code>
		</pre>
	);
}

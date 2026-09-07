"use client";

import { Terminal } from "lucide-react";
import {
	CodeBlock,
	CodeBlockActions,
	CodeBlockCopyButton,
	CodeBlockFilename,
	CodeBlockHeader,
	CodeBlockTitle,
} from "@/components/ai-elements/code-block";
import { cn } from "@/lib/utils";

interface CopyCommandProps {
	command: string;
	label?: string;
	className?: string;
}

/**
 * One shell command per block: Shiki-highlighted bash with a copy button,
 * in the ai-elements CodeBlock API shape.
 */
export function CopyCommand({ command, label, className }: CopyCommandProps) {
	return (
		<CodeBlock
			code={command}
			language="bash"
			className={cn("bg-muted/40", className)}
		>
			<CodeBlockHeader>
				<CodeBlockTitle>
					<Terminal size={14} aria-hidden />
					<CodeBlockFilename>{label ?? "terminal"}</CodeBlockFilename>
				</CodeBlockTitle>
				<CodeBlockActions>
					<CodeBlockCopyButton />
				</CodeBlockActions>
			</CodeBlockHeader>
		</CodeBlock>
	);
}

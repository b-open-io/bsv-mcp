"use client";

import { FileCode2 } from "lucide-react";
import type { BundledLanguage } from "shiki";
import {
	CodeBlock,
	CodeBlockActions,
	CodeBlockCopyButton,
	CodeBlockFilename,
	CodeBlockHeader,
	CodeBlockTitle,
} from "@/components/ai-elements/code-block";
import { cn } from "@/lib/utils";

interface CodeSnippetProps {
	code: string;
	language?: BundledLanguage;
	filename?: string;
	className?: string;
}

/**
 * One config snippet per block: Shiki-highlighted code with a filename header
 * and a copy button, in the ai-elements CodeBlock API shape.
 */
export function CodeSnippet({
	code,
	language = "json",
	filename,
	className,
}: CodeSnippetProps) {
	return (
		<CodeBlock
			code={code}
			language={language}
			className={cn("bg-muted/40", className)}
		>
			<CodeBlockHeader>
				<CodeBlockTitle>
					<FileCode2 size={14} aria-hidden />
					<CodeBlockFilename>{filename ?? "config"}</CodeBlockFilename>
				</CodeBlockTitle>
				<CodeBlockActions>
					<CodeBlockCopyButton />
				</CodeBlockActions>
			</CodeBlockHeader>
		</CodeBlock>
	);
}

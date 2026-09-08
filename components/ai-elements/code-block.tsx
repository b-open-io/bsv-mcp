"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import type { CSSProperties, HTMLAttributes } from "react";
import {
	createContext,
	memo,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import type {
	BundledLanguage,
	BundledTheme,
	HighlighterGeneric,
	ThemedToken,
} from "shiki";
import { createHighlighter } from "shiki";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * CodeBlock — syntax highlighting (Shiki, https://shiki.style) with a copy
 * button, in the ai-elements composable API shape
 * (CodeBlock / CodeBlockHeader / CodeBlockTitle / CodeBlockFilename /
 * CodeBlockActions / CodeBlockCopyButton).
 *
 * Restrained port of vercel/ai-elements `code-block`: same public API and
 * highlighting behavior, without the language-selector (shadcn Select)
 * dependency, which the install docs never need.
 */

// Shiki uses bitflags for font styles: 1=italic, 2=bold, 4=underline
const isItalic = (fontStyle: number | undefined) =>
	fontStyle !== undefined && (fontStyle & 1) !== 0;
const isBold = (fontStyle: number | undefined) =>
	fontStyle !== undefined && (fontStyle & 2) !== 0;
const isUnderline = (fontStyle: number | undefined) =>
	fontStyle !== undefined && (fontStyle & 4) !== 0;

interface KeyedToken {
	token: ThemedToken;
	key: string;
}
interface KeyedLine {
	tokens: KeyedToken[];
	key: string;
}

function addKeysToTokens(lines: ThemedToken[][]): KeyedLine[] {
	return lines.map((line, lineIdx) => ({
		key: `line-${lineIdx}`,
		tokens: line.map((token, tokenIdx) => ({
			key: `line-${lineIdx}-${tokenIdx}`,
			token,
		})),
	}));
}

function TokenSpan({ token }: { token: ThemedToken }) {
	return (
		<span
			className="dark:!bg-[var(--shiki-dark-bg)] dark:!text-[var(--shiki-dark)]"
			style={
				{
					backgroundColor: token.bgColor,
					color: token.color,
					fontStyle: isItalic(token.fontStyle) ? "italic" : undefined,
					fontWeight: isBold(token.fontStyle) ? "bold" : undefined,
					textDecoration: isUnderline(token.fontStyle)
						? "underline"
						: undefined,
					...token.htmlStyle,
				} as CSSProperties
			}
		>
			{token.content}
		</span>
	);
}

const LINE_NUMBER_CLASSES = cn(
	"block",
	"before:content-[counter(line)]",
	"before:inline-block",
	"before:[counter-increment:line]",
	"before:w-8",
	"before:mr-4",
	"before:text-right",
	"before:text-muted-foreground/50",
	"before:font-mono",
	"before:select-none",
);

function LineSpan({
	keyedLine,
	showLineNumbers,
}: {
	keyedLine: KeyedLine;
	showLineNumbers: boolean;
}) {
	return (
		<span className={showLineNumbers ? LINE_NUMBER_CLASSES : "block"}>
			{keyedLine.tokens.length === 0
				? "\n"
				: keyedLine.tokens.map(({ token, key }) => (
						<TokenSpan key={key} token={token} />
					))}
		</span>
	);
}

type CodeBlockProps = HTMLAttributes<HTMLDivElement> & {
	code: string;
	language: BundledLanguage;
	showLineNumbers?: boolean;
};

interface TokenizedCode {
	tokens: ThemedToken[][];
	fg: string;
	bg: string;
}

interface CodeBlockContextType {
	code: string;
}

const CodeBlockContext = createContext<CodeBlockContextType>({ code: "" });

// Highlighter cache (singleton per language)
const highlighterCache = new Map<
	string,
	Promise<HighlighterGeneric<BundledLanguage, BundledTheme>>
>();

// Token cache
const tokensCache = new Map<string, TokenizedCode>();

// Subscribers for async token updates
const subscribers = new Map<string, Set<(result: TokenizedCode) => void>>();

function getTokensCacheKey(code: string, language: BundledLanguage) {
	const start = code.slice(0, 100);
	const end = code.length > 100 ? code.slice(-100) : "";
	return `${language}:${code.length}:${start}:${end}`;
}

function getHighlighter(
	language: BundledLanguage,
): Promise<HighlighterGeneric<BundledLanguage, BundledTheme>> {
	const cached = highlighterCache.get(language);
	if (cached) return cached;
	const highlighterPromise = createHighlighter({
		langs: [language],
		themes: ["github-light", "github-dark"],
	});
	highlighterCache.set(language, highlighterPromise);
	return highlighterPromise;
}

// Raw tokens for immediate display while highlighting loads
function createRawTokens(code: string): TokenizedCode {
	return {
		bg: "transparent",
		fg: "inherit",
		tokens: code
			.split("\n")
			.map((line) =>
				line === "" ? [] : [{ color: "inherit", content: line } as ThemedToken],
			),
	};
}

// Synchronous highlight with callback for async results
export function highlightCode(
	code: string,
	language: BundledLanguage,
	callback?: (result: TokenizedCode) => void,
): TokenizedCode | null {
	const tokensCacheKey = getTokensCacheKey(code, language);
	const cached = tokensCache.get(tokensCacheKey);
	if (cached) return cached;

	if (callback) {
		if (!subscribers.has(tokensCacheKey)) {
			subscribers.set(tokensCacheKey, new Set());
		}
		subscribers.get(tokensCacheKey)?.add(callback);
	}

	getHighlighter(language)
		.then((highlighter) => {
			const availableLangs = highlighter.getLoadedLanguages();
			const langToUse = availableLangs.includes(language) ? language : "text";
			const result = highlighter.codeToTokens(code, {
				lang: langToUse,
				themes: { dark: "github-dark", light: "github-light" },
			});
			const tokenized: TokenizedCode = {
				bg: result.bg ?? "transparent",
				fg: result.fg ?? "inherit",
				tokens: result.tokens,
			};
			tokensCache.set(tokensCacheKey, tokenized);
			const subs = subscribers.get(tokensCacheKey);
			if (subs) {
				for (const sub of subs) sub(tokenized);
				subscribers.delete(tokensCacheKey);
			}
		})
		.catch((error) => {
			console.error("Failed to highlight code:", error);
			subscribers.delete(tokensCacheKey);
		});

	return null;
}

const CodeBlockBody = memo(
	({
		tokenized,
		showLineNumbers,
		className,
	}: {
		tokenized: TokenizedCode;
		showLineNumbers: boolean;
		className?: string;
	}) => {
		const preStyle = useMemo(
			() => ({ backgroundColor: tokenized.bg, color: tokenized.fg }),
			[tokenized.bg, tokenized.fg],
		);
		const keyedLines = useMemo(
			() => addKeysToTokens(tokenized.tokens),
			[tokenized.tokens],
		);
		return (
			<pre
				className={cn(
					"dark:!bg-[var(--shiki-dark-bg)] dark:!text-[var(--shiki-dark)] m-0 overflow-x-auto p-4 text-sm",
					className,
				)}
				style={preStyle}
			>
				<code
					className={cn(
						"font-mono text-sm",
						showLineNumbers &&
							"[counter-increment:line_0] [counter-reset:line]",
					)}
				>
					{keyedLines.map((keyedLine) => (
						<LineSpan
							key={keyedLine.key}
							keyedLine={keyedLine}
							showLineNumbers={showLineNumbers}
						/>
					))}
				</code>
			</pre>
		);
	},
	(prevProps, nextProps) =>
		prevProps.tokenized === nextProps.tokenized &&
		prevProps.showLineNumbers === nextProps.showLineNumbers &&
		prevProps.className === nextProps.className,
);
CodeBlockBody.displayName = "CodeBlockBody";

export function CodeBlockContainer({
	className,
	language,
	style,
	...props
}: HTMLAttributes<HTMLDivElement> & { language: string }) {
	return (
		<div
			className={cn(
				"group relative w-full overflow-hidden rounded-md border bg-background text-foreground",
				className,
			)}
			data-language={language}
			style={{
				containIntrinsicSize: "auto 200px",
				contentVisibility: "auto",
				...style,
			}}
			{...props}
		/>
	);
}

export function CodeBlockHeader({
	children,
	className,
	...props
}: HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			className={cn(
				"flex items-center justify-between border-b bg-muted/80 px-3 py-2 font-mono text-xs text-muted-foreground",
				className,
			)}
			{...props}
		>
			{children}
		</div>
	);
}

export function CodeBlockTitle({
	children,
	className,
	...props
}: HTMLAttributes<HTMLDivElement>) {
	return (
		<div className={cn("flex items-center gap-2", className)} {...props}>
			{children}
		</div>
	);
}

export function CodeBlockFilename({
	children,
	className,
	...props
}: HTMLAttributes<HTMLSpanElement>) {
	return (
		<span className={cn("font-mono", className)} {...props}>
			{children}
		</span>
	);
}

export function CodeBlockActions({
	children,
	className,
	...props
}: HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			className={cn("-my-1 -mr-1 flex items-center gap-2", className)}
			{...props}
		>
			{children}
		</div>
	);
}

export function CodeBlockContent({
	code,
	language,
	showLineNumbers = false,
}: {
	code: string;
	language: BundledLanguage;
	showLineNumbers?: boolean;
}) {
	const rawTokens = useMemo(() => createRawTokens(code), [code]);
	// Server and first client render must use identical tokens, regardless of
	// whether the process-local Shiki cache has been warmed by another request.
	const [highlighted, setHighlighted] = useState<{
		code: string;
		language: BundledLanguage;
		tokens: TokenizedCode;
	} | null>(null);

	useEffect(() => {
		let cancelled = false;
		const apply = (tokens: TokenizedCode) => {
			if (!cancelled) setHighlighted({ code, language, tokens });
		};
		const cached = highlightCode(code, language, apply);
		if (cached) apply(cached);
		return () => {
			cancelled = true;
		};
	}, [code, language]);

	const tokenized =
		highlighted?.code === code && highlighted.language === language
			? highlighted.tokens
			: rawTokens;
	return (
		<div className="relative overflow-auto">
			<CodeBlockBody showLineNumbers={showLineNumbers} tokenized={tokenized} />
		</div>
	);
}

export function CodeBlock({
	code,
	language,
	showLineNumbers = false,
	className,
	children,
	...props
}: CodeBlockProps) {
	const contextValue = useMemo(() => ({ code }), [code]);
	return (
		<CodeBlockContext.Provider value={contextValue}>
			<CodeBlockContainer className={className} language={language} {...props}>
				{children}
				<CodeBlockContent
					code={code}
					language={language}
					showLineNumbers={showLineNumbers}
				/>
			</CodeBlockContainer>
		</CodeBlockContext.Provider>
	);
}

export type CodeBlockCopyButtonProps = React.ComponentProps<typeof Button> & {
	onCopy?: () => void;
	onError?: (error: Error) => void;
	timeout?: number;
};

export function CodeBlockCopyButton({
	onCopy,
	onError,
	timeout = 2000,
	children,
	className,
	...props
}: CodeBlockCopyButtonProps) {
	const [isCopied, setIsCopied] = useState(false);
	const timeoutRef = useRef<number>(0);
	const { code } = useContext(CodeBlockContext);

	const copyToClipboard = useCallback(async () => {
		if (typeof window === "undefined" || !navigator?.clipboard?.writeText) {
			onError?.(new Error("Clipboard API not available"));
			return;
		}
		try {
			if (!isCopied) {
				await navigator.clipboard.writeText(code);
				setIsCopied(true);
				onCopy?.();
				timeoutRef.current = window.setTimeout(
					() => setIsCopied(false),
					timeout,
				);
			}
		} catch (error) {
			onError?.(error as Error);
		}
	}, [code, onCopy, onError, timeout, isCopied]);

	useEffect(
		() => () => {
			window.clearTimeout(timeoutRef.current);
		},
		[],
	);

	const Icon = isCopied ? CheckIcon : CopyIcon;
	return (
		<Button
			type="button"
			className={cn("shrink-0", className)}
			onClick={copyToClipboard}
			size="icon"
			variant="ghost"
			aria-label={isCopied ? "Copied" : "Copy code"}
			{...props}
		>
			{children ?? <Icon size={14} />}
		</Button>
	);
}

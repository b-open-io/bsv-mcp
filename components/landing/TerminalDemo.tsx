import { ClaudeHeader } from "@/components/brainless/claude/claude-header";
import { ClaudeMessage } from "@/components/brainless/claude/claude-message";
import { ClaudePrompt } from "@/components/brainless/claude/claude-prompt";
import { ClaudeToolCall } from "@/components/brainless/claude/claude-tool-call";
import { Card } from "@/components/ui/card";

interface TerminalDemoProps {
	/** Figure label shown above the session, in the style of a numbered figure. */
	figure?: string;
}

/**
 * One Claude Code session from install to txid, composed from brainless
 * (https://brainless.swerdlow.dev) Claude Code components — the real
 * ❯ / ⏺ / ⎿ interface grammar as accessible React, not a hand-rolled
 * terminal mockup.
 *
 * The steps mirror `replay` in site-content, so the demo on the page and the
 * walkthrough in the markdown docs describe the same session.
 */
export function TerminalDemo({
	figure = "fig. 1 — prompt to txid",
}: TerminalDemoProps) {
	return (
		<Card className="min-w-0 overflow-hidden bg-card py-0">
			<div className="border-b px-4 py-2.5">
				<span className="font-mono text-xs text-muted-foreground">
					<span className="text-primary">&gt;_</span> {figure}
				</span>
			</div>
			<div className="space-y-3 p-5">
				<ClaudeHeader
					user="you"
					model="bsv-mcp · local wallet"
					org="1 MCP server connected"
					cwd="~/bsv-mcp"
					tips={["Ask in plain language, get a txid"]}
					whatsNew={["Send BSV, inscribe ordinals, read the chain"]}
				/>

				<div className="space-y-3 pt-1">
					{/* biome-ignore lint/a11y/useValidAriaRole: `role` is ClaudeMessage's user/assistant prop, not a DOM ARIA role. */}
					<ClaudeMessage role="user">
						inscribe hello.svg as a 1sat ordinal and tell me the txid
					</ClaudeMessage>

					<ClaudeMessage>
						I&apos;ll inscribe it, then report the outpoint.
					</ClaudeMessage>

					<ClaudeToolCall
						tool="wallet_createOrdinals"
						arg='dataB64: "…", contentType: "image/svg+xml"'
						result="broadcast ✓"
						defaultOpen
					>
						{`content prepared as base64
selecting UTXOs · estimating fee
broadcast ✓`}
					</ClaudeToolCall>

					<ClaudeMessage>
						Inscribed. Outpoint f3a1…9c2e_0 — view it on 1satordinals.com
					</ClaudeMessage>
				</div>

				<div className="pt-2">
					<ClaudePrompt effort={false} />
				</div>
			</div>
		</Card>
	);
}

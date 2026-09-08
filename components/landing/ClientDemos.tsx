import { CodexExec } from "@/components/brainless/codex/codex-exec";
import { CodexHeader } from "@/components/brainless/codex/codex-header";
import { CodexMessage } from "@/components/brainless/codex/codex-message";
import { CodexPrompt } from "@/components/brainless/codex/codex-prompt";
import { GrokEvent } from "@/components/brainless/grok/grok-event";
import { GrokHeader } from "@/components/brainless/grok/grok-header";
import { GrokMessage } from "@/components/brainless/grok/grok-message";
import { GrokPrompt } from "@/components/brainless/grok/grok-prompt";
import { GrokStatus } from "@/components/brainless/grok/grok-status";
import { GrokTool } from "@/components/brainless/grok/grok-tool";
import { GrokTurnEnd } from "@/components/brainless/grok/grok-turn-end";

export function CodexDemo() {
	return (
		<div className="client-demo-body space-y-5">
			<CodexHeader directory="~/bsv-mcp" model="bsv-mcp · local wallet" />
			{/* biome-ignore lint/a11y/useValidAriaRole: Brainless role selects the message speaker. */}
			<CodexMessage role="user">
				inscribe hello.svg as a 1sat ordinal and tell me the txid
			</CodexMessage>
			<CodexMessage>
				I&apos;ll inscribe it, then report the outpoint.
			</CodexMessage>
			<CodexExec
				command='wallet_createOrdinals({ contentType: "image/svg+xml", … })'
				result="broadcast ✓"
				defaultOpen
			>
				{
					"content prepared as base64\nselecting UTXOs · estimating fee\nbroadcast ✓"
				}
			</CodexExec>
			<CodexMessage>
				Inscribed. Outpoint f3a1…9c2e_0 — view it on 1satordinals.com
			</CodexMessage>
			<div className="demo-composer">
				<CodexPrompt
					directory="~/bsv-mcp"
					model="bsv-mcp · local wallet"
					placeholder="Ask about your wallet"
				/>
			</div>
		</div>
	);
}
export function GrokDemo() {
	return (
		<div className="client-demo-body space-y-4">
			<GrokStatus branch="main" directory="~/bsv-mcp" />
			<GrokHeader
				headline="BSV MCP is connected"
				subhead="Your wallet is ready."
			/>
			{/* biome-ignore lint/a11y/useValidAriaRole: Brainless role selects the message speaker. */}
			<GrokMessage role="user">
				inscribe hello.svg as a 1sat ordinal and tell me the txid
			</GrokMessage>
			<GrokEvent label="Thought for 0.4s" />
			<GrokTool
				verb="call"
				path="wallet_createOrdinals"
				meta="contentType: image/svg+xml"
			/>
			<GrokMessage>
				Inscribed. Outpoint f3a1…9c2e_0 — view it on 1satordinals.com
			</GrokMessage>
			<GrokTurnEnd elapsed="8.2s" />
			<div className="demo-composer">
				<GrokPrompt
					model="bsv-mcp · local wallet"
					mode="normal"
					showShortcuts={false}
				/>
			</div>
		</div>
	);
}

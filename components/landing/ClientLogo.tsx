import { Terminal } from "lucide-react";
import { GrokLogo } from "@/components/brainless/grok/grok-header";
export type DemoClient = "claude" | "grok" | "codex";
export function ClientLogo({ client }: { client: DemoClient | "other" }) {
	if (client === "grok")
		return (
			<span className="client-logo grok-logo">
				<GrokLogo scale={1.4} />
			</span>
		);
	if (client === "other")
		return (
			<Terminal
				className="client-logo terminal-logo"
				strokeWidth={1.5}
				aria-hidden="true"
			/>
		);
	return (
		<span aria-hidden="true" className={`client-logo client-logo-${client}`} />
	);
}

import { Card } from "@/components/ui/card";
import { replay } from "@/lib/site-content";

const trafficLights = ["bg-chart-3", "bg-warning", "bg-chart-2"];

/** Colour a replay line by what it is: a shell prompt, a chat prompt, a tool call, or output. */
function lineClass(line: string): string {
	if (line.startsWith("$ ")) return "text-foreground";
	if (line.startsWith("> ")) return "text-foreground";
	if (line.startsWith("● ")) return "text-muted-foreground";
	if (line.startsWith("  ")) return "text-muted-foreground/70";
	if (line.startsWith("✓")) return "text-success";
	return "text-foreground";
}

/** The leading glyph gets the accent so the eye finds each step's start. */
function splitLead(line: string): [string, string] {
	const match = line.match(/^(\$ |> |● |✓ )/);
	if (!match) return ["", line];
	return [match[1], line.slice(match[1].length)];
}

interface TerminalDemoProps {
	/** Figure label shown in the title bar, in the style of a numbered figure. */
	figure?: string;
}

/**
 * One terminal session from install to txid, as a numbered replay.
 *
 * The steps come from `replay` in site-content, so the walkthrough on the
 * page and the one in the markdown docs describe the same session.
 */
export function TerminalDemo({
	figure = "fig. 1 — prompt to txid",
}: TerminalDemoProps) {
	return (
		<Card className="min-w-0 overflow-hidden bg-card py-0">
			<div className="flex items-center gap-2 border-b px-4 py-2.5">
				{trafficLights.map((color) => (
					<span
						key={color}
						aria-hidden
						className={`size-2.5 rounded-full opacity-70 ${color}`}
					/>
				))}
				<span className="ml-2 font-mono text-xs text-muted-foreground">
					<span className="text-primary">&gt;_</span> {figure}
				</span>
			</div>
			<ol className="space-y-5 break-words p-5 font-mono text-[13px] leading-relaxed">
				{replay.map((step, index) => (
					<li key={step.label} className="space-y-1">
						<p className="text-[11px] uppercase tracking-wider text-muted-foreground/60">
							<span className="text-primary">0{index + 1}</span> {step.label}
						</p>
						{step.lines.map((line) => {
							const [lead, rest] = splitLead(line);
							return (
								<p key={line} className={lineClass(line)}>
									{lead ? (
										<span
											className={
												lead.startsWith("✓") ? "text-success" : "text-primary"
											}
										>
											{lead}
										</span>
									) : null}
									{rest}
								</p>
							);
						})}
					</li>
				))}
				<li aria-hidden className="text-foreground">
					<span className="text-primary">&gt; </span>
					<span className="cursor-blink inline-block h-[1.1em] w-[0.6em] translate-y-[0.2em] bg-primary" />
				</li>
			</ol>
		</Card>
	);
}

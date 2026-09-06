import { Card } from "@/components/ui/card";

const trafficLights = ["bg-chart-3", "bg-chart-1", "bg-chart-2"];

export function TerminalDemo() {
	return (
		<Card className="min-w-0 overflow-hidden bg-card/80 py-0 shadow-2xl">
			<div className="flex items-center gap-2 border-b px-4 py-2.5">
				{trafficLights.map((color) => (
					<span
						key={color}
						aria-hidden
						className={`size-2.5 rounded-full opacity-70 ${color}`}
					/>
				))}
				<span className="ml-2 font-mono text-xs text-muted-foreground">
					claude
				</span>
			</div>
			<div className="space-y-4 break-words p-5 font-mono text-[13px] leading-relaxed">
				<p>
					<span className="text-primary">&gt; </span>
					<span className="text-foreground">
						inscribe hello.svg as a 1sat ordinal and tell me the txid
					</span>
				</p>
				<div className="space-y-1 text-muted-foreground">
					<p>
						<span className="text-success">●</span> wallet_createOrdinals(file:
						&quot;hello.svg&quot;, contentType: &quot;image/svg+xml&quot;)
					</p>
					<p className="pl-4 text-muted-foreground/70">
						├ reading file (412 bytes)
					</p>
					<p className="pl-4 text-muted-foreground/70">
						├ selecting UTXOs · fee 1 sat/kb
					</p>
					<p className="pl-4 text-muted-foreground/70">└ broadcast ✓</p>
				</div>
				<p className="text-foreground">
					Inscribed. Outpoint <span className="text-primary">f3a1…9c2e_0</span>{" "}
					— view it on{" "}
					<span className="underline decoration-muted-foreground/40">
						1satordinals.com
					</span>
					.
				</p>
			</div>
		</Card>
	);
}

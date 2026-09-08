"use client";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useRef, useState } from "react";
import { CodexDemo, GrokDemo } from "./ClientDemos";
import { ClientLogo } from "./ClientLogo";
import { TerminalDemo } from "./TerminalDemo";

const clients = [
	{ id: "grok", name: "Grok", demo: <GrokDemo /> },
	{
		id: "claude",
		name: "Claude Code",
		demo: <TerminalDemo figure="Example session · prompt to txid" />,
	},
	{ id: "codex", name: "Codex", demo: <CodexDemo /> },
] as const;
export function DemoCarousel() {
	const [active, setActive] = useState(1);
	const start = useRef<number | null>(null);
	const move = (step: number) =>
		setActive((value) => (value + step + clients.length) % clients.length);
	return (
		<section
			className="demo-carousel"
			aria-roledescription="carousel"
			aria-label="MCP client demos"
		>
			<div
				className="demo-stage"
				onTouchStart={(event) => {
					start.current = event.touches[0]?.clientX ?? null;
				}}
				onTouchEnd={(event) => {
					const end = event.changedTouches[0]?.clientX;
					if (
						start.current !== null &&
						end !== undefined &&
						Math.abs(end - start.current) > 60
					)
						move(end < start.current ? 1 : -1);
					start.current = null;
				}}
			>
				{clients.map((client, index) => {
					const offset =
						index === active
							? 0
							: (index - active + clients.length) % clients.length === 1
								? 1
								: -1;
					return (
						<section
							key={client.id}
							className={`demo-slide ${offset === 0 ? "is-active" : offset < 0 ? "is-previous" : "is-next"}`}
							aria-roledescription="slide"
							aria-label={`${client.name}, ${index + 1} of ${clients.length}`}
						>
							<div
								className="demo-slide-content"
								inert={offset !== 0}
								aria-hidden={offset !== 0}
							>
								{client.id !== "claude" && (
									<div className="demo-caption">
										<span>&gt;_</span> Example session · prompt to txid
									</div>
								)}
								{client.demo}
							</div>
							{offset !== 0 && (
								<button
									type="button"
									className="demo-select-side"
									onClick={() => setActive(index)}
									aria-label={`Show ${client.name} demo`}
								/>
							)}
						</section>
					);
				})}
			</div>
			<div className="demo-controls">
				<button
					type="button"
					className="demo-arrow"
					onClick={() => move(-1)}
					aria-label="Previous client demo"
				>
					<ArrowLeft size={18} />
				</button>
				<div className="demo-client-picker">
					{clients.map((client, index) => (
						<button
							type="button"
							key={client.id}
							onClick={() => setActive(index)}
							aria-pressed={index === active}
						>
							<ClientLogo client={client.id} />
							<span>{client.name}</span>
						</button>
					))}
				</div>
				<button
					type="button"
					className="demo-arrow"
					onClick={() => move(1)}
					aria-label="Next client demo"
				>
					<ArrowRight size={18} />
				</button>
			</div>
			<span className="sr-only" aria-live="polite">
				{clients[active].name} example
			</span>
		</section>
	);
}

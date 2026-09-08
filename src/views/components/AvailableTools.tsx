import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { AvailableSetupTool } from "../../../utils/vaultSetup";
import {
	type CloudBox,
	findCloudSpace,
	rotatedBounds,
} from "../lib/cloudPacking";

function label(tool: AvailableSetupTool) {
	if (tool.title) return tool.title;
	const words = tool.name
		.replace(/^[^_]+_/, "")
		.replace(/_/g, " ")
		.replace(/([a-z])([A-Z])/g, "$1 $2")
		.toLowerCase();
	return (words.charAt(0).toUpperCase() + words.slice(1)).replace(
		/\b(bsv|bap|mnee|utxo|utxos)\b/gi,
		(word) => word.toUpperCase(),
	);
}
type Entry = CloudBox & {
	tool: AvailableSetupTool;
	lines: string[];
	size: number;
	angle: number;
	exiting?: boolean;
};
function makeEntry(
	tool: AvailableSetupTool,
	width: number,
	height: number,
	occupied: Entry[],
	rank: number,
): Entry | undefined {
	const canvas = document.createElement("canvas");
	const context = canvas.getContext("2d");
	if (!context) return;
	const words = label(tool).split(" ");
	const lines =
		words.length > 1 && label(tool).length > 10
			? [
					words.slice(0, Math.ceil(words.length / 2)).join(" "),
					words.slice(Math.ceil(words.length / 2)).join(" "),
				]
			: [label(tool)];
	const scale = Math.min(width / 760, height / 600, 1.25);
	const angle = [0, -7, 5, -3, 8, 0, -5, 4][rank % 8];
	for (const factor of [1, 0.85, 0.7]) {
		const size = Math.max(
			15,
			[100, 66, 52, 58, 43, 48, 36, 42, 32, 38, 30, 34][rank % 12] *
				scale *
				factor,
		);
		context.font = `${size}px "Geist Pixel Line"`;
		const textWidth = Math.max(
			...lines.map((line) => context.measureText(line).width),
		);
		const bounds = rotatedBounds(textWidth, lines.length * size * 1.03, angle);
		const space = findCloudSpace(width, height, bounds, occupied, rank * 1.37);
		if (space) return { ...space, tool, lines, size, angle };
	}
}
export function AvailableTools({ tools }: { tools?: AvailableSetupTool[] }) {
	const cloud = useRef<HTMLUListElement>(null);
	const [entries, setEntries] = useState<Entry[]>([]);
	const [selected, setSelected] = useState<{
		tool: AvailableSetupTool;
		rect: DOMRect;
	}>();
	const [interacting, setInteracting] = useState(false);
	const size = useRef({ width: 0, height: 0 });
	const sequence = useRef(0);
	useLayoutEffect(() => {
		const element = cloud.current;
		if (!element) return;
		const arrange = () => {
			const width = element.clientWidth,
				height = element.clientHeight;
			if (width === size.current.width && height === size.current.height)
				return;
			size.current = { width, height };
			const next: Entry[] = [];
			const ordered = [...(tools ?? [])].sort(
				(a, b) =>
					Number(/^send bsv$/i.test(label(b))) -
					Number(/^send bsv$/i.test(label(a))),
			);
			for (const tool of ordered) {
				const entry = makeEntry(tool, width, height, next, next.length);
				if (entry) next.push(entry);
				if (next.length === 12) break;
			}
			setEntries(next);
			setSelected(undefined);
		};
		size.current = { width: 0, height: 0 };
		let disposed = false;
		const observer = new ResizeObserver(arrange);
		// Pack with the final font metrics, including after a cold first load.
		document.fonts
			.load('30px "Geist Pixel Line"')
			.catch(() => [])
			.then(() => {
				if (disposed) return;
				arrange();
				observer.observe(element);
			});
		return () => {
			disposed = true;
			observer.disconnect();
		};
	}, [tools]);
	useEffect(() => {
		if (interacting || !tools?.length) return;
		let timeout: ReturnType<typeof setTimeout>;
		const timer = setInterval(() => {
			if (
				document.hidden ||
				window.matchMedia("(prefers-reduced-motion: reduce)").matches
			)
				return;
			setEntries((current) => {
				if (current.length < 2) return current;
				const index = 1 + Math.floor(Math.random() * (current.length - 1));
				return current.map((entry, i) => ({
					...entry,
					exiting:
						i === index || (sequence.current % 3 === 2 && i === index + 1),
				}));
			});
			timeout = setTimeout(() => {
				setEntries((current) => {
					const departed = current
						.filter((entry) => entry.exiting)
						.map((entry) => entry.tool.name);
					const next = current.filter((entry) => !entry.exiting);
					const candidates = tools
						.filter(
							(tool) =>
								!next.some((entry) => entry.tool.name === tool.name) &&
								!departed.includes(tool.name),
						)
						.sort(() => Math.random() - 0.5);
					for (const tool of candidates) {
						const entry = makeEntry(
							tool,
							size.current.width,
							size.current.height,
							next,
							1 + (sequence.current++ % 11),
						);
						if (entry) next.push(entry);
						if (next.length >= 12) break;
					}
					return next;
				});
			}, 650);
		}, 3200);
		return () => {
			clearInterval(timer);
			clearTimeout(timeout);
			setEntries((current) =>
				current.map((entry) => ({ ...entry, exiting: false })),
			);
		};
	}, [tools, interacting]);
	return (
		<section
			className="tool-cloud-section"
			aria-label="Explore your wallet tools"
		>
			<svg
				className="cloud-orbits"
				viewBox="0 0 760 650"
				fill="none"
				aria-hidden="true"
			>
				<ellipse
					cx="380"
					cy="325"
					rx="365"
					ry="220"
					transform="rotate(-16 380 325)"
				/>
				<ellipse
					cx="380"
					cy="325"
					rx="365"
					ry="170"
					transform="rotate(22 380 325)"
				/>
				<circle cx="110" cy="160" r="4" />
				<circle cx="660" cy="450" r="6" />
				<circle cx="230" cy="570" r="3" />
			</svg>
			<ul
				ref={cloud}
				className="tool-cloud"
				aria-label="Available MCP tools"
				onMouseEnter={() => setInteracting(true)}
				onMouseLeave={(event) => {
					if (!event.currentTarget.contains(document.activeElement)) {
						setInteracting(false);
						setSelected(undefined);
					}
				}}
				onFocus={() => setInteracting(true)}
				onBlur={(event) => {
					if (!event.currentTarget.contains(event.relatedTarget)) {
						setInteracting(false);
						setSelected(undefined);
					}
				}}
				onKeyDown={(event) => {
					if (event.key === "Escape") setSelected(undefined);
				}}
			>
				{entries.map((entry) => (
					<li
						key={entry.tool.name}
						className={entry.exiting ? "is-fading" : ""}
						style={{ left: entry.x, top: entry.y }}
					>
						<button
							type="button"
							className={`tool-cloud-word tool-cloud-weight-${Math.round(entry.size) % 5}`}
							style={{
								fontSize: entry.size,
								transform: `rotate(${entry.angle}deg)`,
							}}
							aria-describedby={
								selected?.tool.name === entry.tool.name
									? "tool-cloud-popover"
									: undefined
							}
							onMouseEnter={(event) =>
								setSelected({
									tool: entry.tool,
									rect: event.currentTarget.getBoundingClientRect(),
								})
							}
							onMouseLeave={() => setSelected(undefined)}
							onFocus={(event) =>
								setSelected({
									tool: entry.tool,
									rect: event.currentTarget.getBoundingClientRect(),
								})
							}
							onClick={(event) =>
								setSelected({
									tool: entry.tool,
									rect: event.currentTarget.getBoundingClientRect(),
								})
							}
						>
							{entry.lines.map((line) => (
								<span key={line}>{line}</span>
							))}
						</button>
					</li>
				))}
			</ul>
			{selected &&
				createPortal(
					<div
						id="tool-cloud-popover"
						role="tooltip"
						className="tool-cloud-popover"
						style={{
							left: Math.max(
								12,
								Math.min(
									window.innerWidth - 292,
									selected.rect.left + selected.rect.width / 2 - 140,
								),
							),
							...(selected.rect.top > window.innerHeight / 2
								? { bottom: window.innerHeight - selected.rect.top + 12 }
								: { top: selected.rect.bottom + 12 }),
						}}
					>
						<strong>{label(selected.tool)}</strong>
						<code>{selected.tool.name}</code>
						<p>
							{selected.tool.description || "Available in your MCP client."}
						</p>
					</div>,
					document.body,
				)}
		</section>
	);
}

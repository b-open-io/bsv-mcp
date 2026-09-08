import { useState } from "react";
import type { AvailableSetupTool } from "../../../utils/vaultSetup";

function label(tool: AvailableSetupTool) {
	if (tool.title) return tool.title;
	const words = tool.name
		.replace(/^[^_]+_/, "")
		.replace(/_/g, " ")
		.replace(/([a-z])([A-Z])/g, "$1 $2")
		.toLowerCase();
	return words.charAt(0).toUpperCase() + words.slice(1);
}

export function AvailableTools({ tools }: { tools?: AvailableSetupTool[] }) {
	const [selected, setSelected] = useState<AvailableSetupTool>();
	return (
		<section className="tool-cloud-section" aria-labelledby="tool-cloud-title">
			<h2 id="tool-cloud-title">A wallet of possibilities</h2>
			<p className="tool-cloud-caption">
				{tools
					? `${tools.length} tools connected. Explore what you can do.`
					: "Check your MCP client for available tools."}
			</p>
			{tools?.length === 0 && <p>No tools are enabled in this MCP session.</p>}
			<ul className="tool-cloud" aria-label="Available MCP tools">
				{tools?.map((tool, index) => (
					<li key={tool.name}>
						<button
							type="button"
							className={`tool-cloud-word tool-cloud-weight-${index % 5}`}
							aria-pressed={selected?.name === tool.name}
							aria-controls="tool-cloud-detail"
							onMouseEnter={() => setSelected(tool)}
							onFocus={() => setSelected(tool)}
							onClick={() => setSelected(tool)}
						>
							{label(tool)}
						</button>
					</li>
				))}
			</ul>
			<div
				id="tool-cloud-detail"
				className="tool-cloud-detail"
				aria-live="polite"
				aria-atomic="true"
			>
				{selected ? (
					<>
						<code>{selected.name}</code>
						<p>{selected.description || "Available in your MCP client."}</p>
					</>
				) : (
					<p>Choose a tool to learn more.</p>
				)}
			</div>
		</section>
	);
}

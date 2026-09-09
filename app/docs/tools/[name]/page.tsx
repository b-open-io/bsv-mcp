import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReferenceLayout } from "@/components/docs/ReferenceLayout";
import {
	catalogTools,
	categoryForTool,
	compactOperations,
	getTool,
	inputFields,
	modeLabel,
	toolSummary,
} from "@/lib/tool-catalog";
import { referenceNote } from "@/lib/tool-reference-notes";

type Props = { params: Promise<{ name: string }> };
export const dynamicParams = false;
export function generateStaticParams() {
	return catalogTools.map((tool) => ({ name: tool.name }));
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const { name } = await params;
	const tool = getTool(name);
	return {
		title: tool?.name ?? "Tool not found",
		description: tool ? toolSummary(tool) : undefined,
		alternates: { canonical: `/docs/tools/${name}` },
	};
}
export default async function ToolPage({ params }: Props) {
	const { name } = await params;
	const tool = getTool(name);
	if (!tool) notFound();
	const category = categoryForTool(name);
	const note = referenceNote(name);
	const operations = compactOperations(tool);
	const families = catalogTools.filter((t) =>
		compactOperations(t).includes(name),
	);
	return (
		<ReferenceLayout current={name}>
			<Link
				href={`/docs/tools#${category?.key ?? ""}`}
				className="text-sm text-primary"
			>
				{category?.name ?? "All tools"}
			</Link>
			<h1 className="mt-4 break-words font-mono text-3xl font-bold tracking-tight sm:text-4xl">
				{name}
			</h1>
			<p className="mt-5 text-lg leading-8 text-muted-foreground">
				{toolSummary(tool)}
			</p>
			<a
				className="mt-4 inline-block text-sm text-primary underline"
				href={`/docs/tools/${name}.md`}
			>
				Read as Markdown
			</a>
			<section className="mt-8 space-y-3">
				<h2 className="text-xl font-semibold">Result</h2>
				<p className="leading-7">{note.result}</p>
				<h2 className="pt-4 text-xl font-semibold">Permissions</h2>
				<p className="leading-7">{note.approval}</p>
				{note.details && (
					<p className="leading-7 text-muted-foreground">{note.details}</p>
				)}
			</section>
			{!!operations.length && (
				<section className="mt-8">
					<h2 className="text-xl font-semibold">Operations</h2>
					<p className="mt-3 leading-7">
						Pass the full tool name as <code>operation</code> and its input
						object as <code>args</code>. Available operations vary by wallet
						configuration.
					</p>
					<ul className="mt-4 space-y-2">
						{operations.map((operation) => (
							<li key={operation}>
								<Link
									className="font-mono text-sm text-primary underline"
									href={`/docs/tools/${operation}`}
								>
									{operation}
								</Link>
							</li>
						))}
					</ul>
				</section>
			)}
			{!!families.length && (
				<p className="mt-6 text-sm">
					Also available through{" "}
					{families.map((family) => (
						<Link
							key={family.name}
							className="mr-2 font-mono text-primary underline"
							href={`/docs/tools/${family.name}`}
						>
							{family.name}
						</Link>
					))}{" "}
					in compact mode.
				</p>
			)}
			{tool.variants.map((variant, index) => {
				const fields = inputFields(variant.definition.inputSchema);
				return (
					<section
						key={`${variant.profile}-${variant.modes.join("-")}`}
						className="mt-10 border-t pt-6"
					>
						<h2 className="text-xl font-semibold">
							{tool.variants.length > 1
								? `Definition ${index + 1}`
								: "Inputs and availability"}
						</h2>
						<p className="mt-3 text-sm leading-7">
							<strong>
								{variant.profile === "full"
									? "Full catalog"
									: "Compact catalog"}
							</strong>{" "}
							· {variant.modes.map(modeLabel).join("; ")}
						</p>
						{variant.definition.description !== toolSummary(tool) && (
							<p className="mt-3 leading-7">{variant.definition.description}</p>
						)}
						{!fields.length ? (
							<p className="mt-5">No input fields. Pass an empty object.</p>
						) : (
							<div className="mt-5 overflow-x-auto">
								<table className="w-full text-left text-sm">
									<thead>
										<tr className="border-b">
											<th className="p-3 pl-0">Field</th>
											<th className="p-3">Type / required</th>
											<th className="p-3">Description</th>
										</tr>
									</thead>
									<tbody>
										{fields.map((field) => (
											<tr className="border-b align-top" key={field.name}>
												<th className="p-3 pl-0 font-mono font-medium break-words">
													{field.name}
												</th>
												<td className="min-w-32 p-3 break-words">
													{field.type}
													<br />
													<span className="text-muted-foreground">
														{field.required ? "Required" : "Optional"}
													</span>
												</td>
												<td className="min-w-48 p-3 leading-6">
													{field.description || "See schema for details."}
													{field.constraints && (
														<p className="mt-1 font-mono text-xs text-muted-foreground">
															{field.constraints}
														</p>
													)}
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						)}
						<p className="mt-3 text-xs text-muted-foreground">
							Nested fields are required only when their parent object or array
							item is supplied.
						</p>
						<details className="mt-5 rounded border p-4">
							<summary className="cursor-pointer text-sm font-medium">
								Full input schema
							</summary>
							<pre className="mt-4 overflow-x-auto text-xs">
								{JSON.stringify(variant.definition.inputSchema, null, 2)}
							</pre>
						</details>
						{variant.definition.outputSchema && (
							<details className="mt-4 rounded border p-4">
								<summary className="cursor-pointer text-sm font-medium">
									Registered output schema
								</summary>
								<pre className="mt-4 overflow-x-auto text-xs">
									{JSON.stringify(variant.definition.outputSchema, null, 2)}
								</pre>
							</details>
						)}
					</section>
				);
			})}
		</ReferenceLayout>
	);
}

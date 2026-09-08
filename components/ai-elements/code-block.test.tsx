import { expect, test } from "bun:test";
import { renderToString } from "react-dom/server";
import { CodeBlockContent, highlightCode } from "./code-block";

test("initial code markup is identical with cold and warm highlighting caches", async () => {
	const code =
		"claude plugin marketplace add b-open-io/claude-plugins\nclaude plugin install bsv-mcp@b-open-io";
	const render = () =>
		renderToString(<CodeBlockContent code={code} language="bash" />);
	const cold = render();
	await new Promise<void>((resolve) => {
		if (highlightCode(code, "bash", () => resolve())) resolve();
	});
	const warm = render();
	expect(warm).toBe(cold);
	expect(warm).toContain("claude plugin marketplace add");
	expect(warm).toContain("background-color:transparent;color:inherit");
});

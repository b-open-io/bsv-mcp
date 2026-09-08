import { expect, test } from "bun:test";
import { startVaultSetup } from "./vaultSetup";
import { runVaultSetupCommand } from "./vaultSetupCommand";

test("setup command opens the preview and waits for closure", async () => {
	let opened = "";
	let finished = false;
	const setup = await startVaultSetup();
	const signalCount = process.listenerCount("SIGINT");
	const command = runVaultSetupCommand({
		start: async () => setup,
		open: async (url) => {
			opened = url;
		},
		log: () => {},
	}).then(() => {
		finished = true;
	});
	await Bun.sleep(10);
	expect(opened).toBe(setup.url);
	expect(finished).toBe(false);
	await setup.close();
	await command;
	expect(finished).toBe(true);
	expect(process.listenerCount("SIGINT")).toBe(signalCount);
});

test("browser failure gives retry guidance without logging the capability URL", async () => {
	const messages: string[] = [];
	const setup = await startVaultSetup({ timeoutMs: 40 });
	const signalCount = process.listenerCount("SIGINT");
	const secret = `synthetic-secret-${crypto.randomUUID()}`;
	await runVaultSetupCommand({
		start: async () => setup,
		open: async () => {
			throw new Error(`unavailable ${secret}`);
		},
		log: (message) => messages.push(message),
	});
	const fragment = new URL(setup.url).hash.slice(1);
	const combined = messages.join("\n");
	expect(combined.toLowerCase()).toContain("browser");
	expect(combined).toContain("bsv-mcp vault-setup");
	for (const message of messages) {
		expect(message).not.toContain(setup.url);
		expect(message).not.toContain(fragment);
		expect(message).not.toContain(secret);
		expect(message).not.toContain("unavailable");
		expect(message).not.toContain("#");
	}
	expect(process.listenerCount("SIGINT")).toBe(signalCount);
	await expect(fetch(setup.url)).rejects.toThrow();
});

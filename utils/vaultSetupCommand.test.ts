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

test("browser failure leaves a usable local link and timeout finishes the command", async () => {
	const messages: string[] = [];
	const setup = await startVaultSetup({ timeoutMs: 40 });
	await runVaultSetupCommand({
		start: async () => setup,
		open: async () => {
			throw new Error("unavailable");
		},
		log: (message) => messages.push(message),
	});
	expect(messages).toContain(setup.url);
	await expect(fetch(setup.url)).rejects.toThrow();
});

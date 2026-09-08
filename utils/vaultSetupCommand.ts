import { spawn } from "node:child_process";
import { startVaultSetup } from "./vaultSetup";

function openLocalBrowser(url: string): Promise<void> {
	const command =
		process.platform === "darwin"
			? "open"
			: process.platform === "win32"
				? "rundll32"
				: "xdg-open";
	const args =
		process.platform === "win32" ? ["url.dll,FileProtocolHandler", url] : [url];
	return new Promise((resolve, reject) => {
		const child = spawn(command, args, { stdio: "ignore", shell: false });
		child.once("error", reject);
		child.once("exit", (code) =>
			code === 0 ? resolve() : reject(new Error("Browser did not open")),
		);
	});
}

/** Explicit local preview command; never opens a browser during MCP startup. */
export async function runVaultSetupCommand(
	options: {
		open?: (url: string) => Promise<void>;
		log?: (message: string) => void;
		start?: typeof startVaultSetup;
	} = {},
): Promise<void> {
	const setup = await (options.start ?? startVaultSetup)();
	const log =
		options.log ?? ((message: string) => process.stderr.write(`${message}\n`));
	const stop = () => {
		void setup.close();
	};
	process.once("SIGINT", stop);
	process.once("SIGTERM", stop);
	try {
		log(
			"Vault setup preview is read-only. Close with Ctrl+C; it expires after five minutes.",
		);
		try {
			await (options.open ?? openLocalBrowser)(setup.url);
		} catch {
			log(
				"The browser could not open automatically. Open this local setup link yourself:",
			);
			log(setup.url);
		}
		await setup.closed;
	} finally {
		process.off("SIGINT", stop);
		process.off("SIGTERM", stop);
		await setup.close();
	}
}

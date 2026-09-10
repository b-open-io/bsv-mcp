/** Secrets stay on the local TTY and are never echoed or returned to MCP. */
export async function terminalInput(
	label: string,
	hidden = false,
): Promise<string> {
	if (!process.stdin.isTTY || !process.stderr.isTTY)
		throw new Error(
			"This command requires a local interactive terminal. Do not send passwords or private keys through chat or MCP.",
		);
	process.stderr.write(`${label}: `);
	const wasRaw = process.stdin.isRaw;
	process.stdin.setRawMode(true);
	process.stdin.resume();
	process.stdin.setEncoding("utf8");
	return new Promise((resolve, reject) => {
		let value = "";
		const finish = (error?: Error) => {
			process.stdin.off("data", input);
			process.stdin.setRawMode(wasRaw);
			process.stdin.pause();
			process.stderr.write("\n");
			if (error) reject(error);
			else resolve(value);
		};
		const input = (chunk: string) => {
			for (const char of chunk) {
				if (char === "\u0003" || char === "\u0004") {
					finish(new Error("Cancelled"));
					return;
				}
				if (char === "\r" || char === "\n") {
					finish();
					return;
				}
				if (char === "\u007f" || char === "\b") {
					if (value.length) {
						value = value.slice(0, -1);
						if (!hidden) process.stderr.write("\b \b");
					}
				} else if (char >= " ") {
					value += char;
					if (!hidden) process.stderr.write(char);
				}
			}
		};
		process.stdin.on("data", input);
	});
}
export async function confirm(label: string) {
	if ((await terminalInput(`${label} Type yes`)) !== "yes")
		throw new Error("Cancelled");
}
export async function newPassword() {
	const value = await terminalInput(
		"Encryption password (at least 12 characters; 16+ as a passphrase)",
		true,
	);
	if (value.length < 12)
		throw new Error("Password must contain at least 12 characters");
	if (value !== (await terminalInput("Repeat password", true)))
		throw new Error("Passwords do not match");
	return value;
}

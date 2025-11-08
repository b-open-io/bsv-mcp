/**
 * Dynamic passphrase prompting for secure key operations
 * Launches a temporary web server to collect passphrase without storing it
 */

import { spawn } from "node:child_process";
import * as fs from "node:fs";
import { createServer } from "node:http";
import { platform } from "node:os";
import * as path from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// Global lock to prevent multiple simultaneous prompts
const LOCK_DIR = path.join(process.env.HOME || "", ".bsv-mcp");
const LOCK_FILE = path.join(LOCK_DIR, "prompt.lock");

// Server instance to check transport type
let serverInstance: McpServer | null = null;

/**
 * Set the server instance so we can detect transport type
 */
export function setServerInstance(server: McpServer): void {
	serverInstance = server;
}

/**
 * Detect if we're running in MCP stdio mode by checking the actual transport
 * This uses the official MCP SDK approach with fallback to environment detection
 */
function isStdioMode(): boolean {
	// Primary: Check environment variable (set by MCP inspector and other clients)
	if (process.env.TRANSPORT === "stdio") {
		return true;
	}

	// Secondary: If we have access to the server instance, check its transport
	if (serverInstance?.server?.transport) {
		return serverInstance.server.transport instanceof StdioServerTransport;
	}

	// Fallback: check if stdout is being used for JSON-RPC (not a TTY)
	return process.stdout.isTTY === false;
}

/**
 * Check if another prompt is already active
 */
function isPromptLocked(): boolean {
	try {
		if (fs.existsSync(LOCK_FILE)) {
			const lockContent = fs.readFileSync(LOCK_FILE, "utf8");
			const { pid, timestamp } = JSON.parse(lockContent);

			// Check if the process is still running
			try {
				process.kill(pid, 0); // Signal 0 checks if process exists

				// If process exists, check if lock is too old (5 minutes)
				const lockAge = Date.now() - timestamp;
				if (lockAge > 300000) {
					// Lock is stale, remove it
					fs.unlinkSync(LOCK_FILE);
					return false;
				}
				return true;
			} catch {
				// Process doesn't exist, remove stale lock
				fs.unlinkSync(LOCK_FILE);
				return false;
			}
		}
		return false;
	} catch {
		return false;
	}
}

/**
 * Create a lock file for the current prompt
 */
function createPromptLock(): void {
	try {
		fs.mkdirSync(LOCK_DIR, { recursive: true, mode: 0o700 });
		const lockData = {
			pid: process.pid,
			timestamp: Date.now(),
		};
		fs.writeFileSync(LOCK_FILE, JSON.stringify(lockData), { mode: 0o600 });
	} catch (error) {
		console.error("Warning: Could not create prompt lock:", error);
	}
}

/**
 * Remove the lock file
 */
function removePromptLock(): void {
	try {
		if (fs.existsSync(LOCK_FILE)) {
			fs.unlinkSync(LOCK_FILE);
		}
	} catch (error) {
		console.error("Warning: Could not remove prompt lock:", error);
	}
}

/**
 * Find an available port
 */
async function findAvailablePort(): Promise<number> {
	return new Promise((resolve, reject) => {
		const server = createServer();
		server.listen(0, () => {
			const address = server.address();
			if (!address || typeof address === "string") {
				reject(new Error("Failed to get server address"));
				return;
			}
			const port = address.port;
			server.close(() => resolve(port));
		});
	});
}

/**
 * Open URL in default browser
 */
async function openBrowser(url: string): Promise<void> {
	const cmd =
		platform() === "darwin"
			? "open"
			: platform() === "win32"
				? "start"
				: "xdg-open";
	spawn(cmd, [url], { detached: true, stdio: "ignore" }).unref();
}

/**
 * HTML template for passphrase prompt
 */
function getPromptHTML(reason: string, isNewPassphrase = false): string {
	return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>BSV MCP - Passphrase Required</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #1a1a1a;
      color: #e0e0e0;
      margin: 0;
      padding: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
    .container {
      background: #2a2a2a;
      border-radius: 12px;
      padding: 40px;
      max-width: 500px;
      width: 100%;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    }
    h2 {
      margin: 0 0 10px 0;
      color: #fff;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .reason {
      color: #b0b0b0;
      margin-bottom: 30px;
      line-height: 1.5;
    }
    .form-group {
      margin-bottom: 20px;
    }
    label {
      display: block;
      margin-bottom: 8px;
      color: #d0d0d0;
      font-size: 14px;
    }
    input[type="password"] {
      width: 100%;
      padding: 12px 16px;
      font-size: 16px;
      background: #1a1a1a;
      border: 2px solid #404040;
      border-radius: 8px;
      color: #fff;
      transition: border-color 0.2s;
      box-sizing: border-box;
    }
    input[type="password"]:focus {
      outline: none;
      border-color: #007AFF;
    }
    button {
      width: 100%;
      padding: 14px;
      font-size: 16px;
      font-weight: 600;
      background: #007AFF;
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      transition: background 0.2s;
    }
    button:hover {
      background: #0056b3;
    }
    button:disabled {
      background: #404040;
      cursor: not-allowed;
    }
    .success {
      background: #1a4d2e;
      border: 1px solid #2d6a4f;
      border-radius: 8px;
      padding: 20px;
      text-align: center;
      color: #4ade80;
    }
    .error {
      background: #4d1a1a;
      border: 1px solid #6a2d2d;
      border-radius: 8px;
      padding: 20px;
      margin-top: 20px;
      color: #ef4444;
    }
    .note {
      font-size: 13px;
      color: #808080;
      margin-top: 20px;
      padding: 15px;
      background: #1a1a1a;
      border-radius: 8px;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <div class="container">
    <h2>🔐 ${isNewPassphrase ? "Create" : "Enter"} Passphrase</h2>
    <p class="reason">${reason}</p>
    
    <form id="passphraseForm" action="/submit" method="post">
      <div class="form-group">
        <label for="passphrase">${isNewPassphrase ? "New Passphrase" : "Passphrase"}</label>
        <input 
          type="password" 
          id="passphrase" 
          name="passphrase" 
          placeholder="${isNewPassphrase ? "Choose a strong passphrase" : "Enter your passphrase"}"
          minlength="8"
          required
          autofocus
        >
      </div>
      
      ${
				isNewPassphrase
					? `
      <div class="form-group">
        <label for="confirm">Confirm Passphrase</label>
        <input 
          type="password" 
          id="confirm" 
          name="confirm" 
          placeholder="Confirm your passphrase"
          minlength="8"
          required
        >
      </div>
      `
					: ""
			}
      
      <button type="submit">${isNewPassphrase ? "Create Encrypted Backup" : "Unlock"}</button>
    </form>
    
    <div class="note">
      ${
				isNewPassphrase
					? "⚠️ <strong>Important:</strong> Remember this passphrase! It cannot be recovered if lost. Your keys will be encrypted with this passphrase."
					: "🔒 Your passphrase is only used to decrypt your keys locally. It is never stored or transmitted."
			}
    </div>
  </div>
  
  <script>
    const form = document.getElementById('passphraseForm');
    
    form.onsubmit = async (e) => {
      e.preventDefault();
      
      const passphrase = document.getElementById('passphrase').value;
      ${
				isNewPassphrase
					? `
      const confirm = document.getElementById('confirm').value;
      
      if (passphrase !== confirm) {
        showError('Passphrases do not match');
        return;
      }
      `
					: ""
			}
      
      const button = form.querySelector('button');
      button.disabled = true;
      button.textContent = 'Processing...';
      
      try {
        const response = await fetch('/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ passphrase })
        });
        
        if (response.ok) {
          document.querySelector('.container').innerHTML = 
            '<div class="success">✅ Passphrase received. You can close this window.</div>';
          setTimeout(() => window.close(), 2000);
        } else {
          throw new Error('Failed to submit passphrase');
        }
      } catch (error) {
        showError('Failed to submit passphrase. Please try again.');
        button.disabled = false;
        button.textContent = '${isNewPassphrase ? "Create Encrypted Backup" : "Unlock"}';
      }
    };
    
    function showError(message) {
      const existing = document.querySelector('.error');
      if (existing) existing.remove();
      
      const error = document.createElement('div');
      error.className = 'error';
      error.textContent = message;
      form.appendChild(error);
    }
  </script>
</body>
</html>`;
}

/**
 * Prompt for passphrase via temporary web server
 * @param reason - Reason for requesting passphrase
 * @param options - Additional options
 * @returns Promise resolving to the entered passphrase
 */
export async function promptForPassphrase(
	reason: string,
	options: {
		isNewPassphrase?: boolean;
		timeout?: number;
	} = {},
): Promise<string> {
	// Check if another prompt is already active
	if (isPromptLocked()) {
		throw new Error(
			"Another passphrase prompt is already active. Please complete the existing prompt or wait for it to timeout.",
		);
	}

	const { isNewPassphrase = false, timeout = 300000 } = options; // 5 minute timeout
	const port = await findAvailablePort();

	// Create lock file
	createPromptLock();

	return new Promise((resolve, reject) => {
		let resolved = false;

		const server = createServer((req, res) => {
			res.setHeader("Access-Control-Allow-Origin", "*");

			if (req.method === "GET" && req.url === "/") {
				res.writeHead(200, { "Content-Type": "text/html" });
				res.end(getPromptHTML(reason, isNewPassphrase));
			} else if (req.method === "POST" && req.url === "/submit") {
				let body = "";
				req.on("data", (chunk) => {
					body += chunk;
				});
				req.on("end", () => {
					try {
						const { passphrase } = JSON.parse(body);

						if (!passphrase || passphrase.length < 8) {
							res.writeHead(400, { "Content-Type": "application/json" });
							res.end(JSON.stringify({ error: "Invalid passphrase" }));
							return;
						}

						res.writeHead(200, { "Content-Type": "application/json" });
						res.end(JSON.stringify({ success: true }));

						resolved = true;
						server.close();
						removePromptLock();
						resolve(passphrase);
					} catch (error) {
						res.writeHead(400, { "Content-Type": "application/json" });
						res.end(JSON.stringify({ error: "Invalid request" }));
					}
				});
			} else {
				res.writeHead(404);
				res.end("Not found");
			}
		});

		// Set timeout
		const timeoutId = setTimeout(() => {
			if (!resolved) {
				server.close();
				removePromptLock();
				reject(new Error("Passphrase prompt timeout"));
			}
		}, timeout);

		server.listen(port, () => {
			// Use stderr in stdio mode to avoid interfering with JSON-RPC messages
			const logOutput = isStdioMode() ? console.error : console.log;
			logOutput(`\n[Lock] Passphrase required: ${reason}`);
			logOutput(`[Browser] Opening browser at: http://localhost:${port}`);
			logOutput(`[Timer] Timeout: ${timeout / 1000} seconds\n`);

			openBrowser(`http://localhost:${port}`);
		});

		server.on("close", () => {
			clearTimeout(timeoutId);
			if (!resolved) {
				removePromptLock();
				reject(new Error("Passphrase prompt cancelled"));
			}
		});

		// Handle server errors
		server.on("error", (error) => {
			clearTimeout(timeoutId);
			removePromptLock();
			reject(error);
		});
	});
}

/**
 * Check if running in a headless environment
 */
export function isHeadless(): boolean {
	return (
		!process.env.DISPLAY &&
		process.platform !== "darwin" &&
		process.platform !== "win32"
	);
}

/**
 * Prompt for passphrase with fallback for headless environments
 */
export async function promptForPassphraseWithFallback(
	reason: string,
	options?: { isNewPassphrase?: boolean; timeout?: number },
): Promise<string> {
	if (isHeadless()) {
		throw new Error(
			"Cannot prompt for passphrase in headless environment. " +
				"Please use PRIVATE_KEY_WIF environment variable or run in an environment with a display.",
		);
	}

	return promptForPassphrase(reason, options);
}

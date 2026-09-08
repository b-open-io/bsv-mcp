import { randomBytes, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { inspectMigration, type MigrationInventory } from "./vaultMigration";

/** Read-only first step of setup. No key or passphrase is sent to the browser. */
export async function startVaultSetup(
	options: { inspect?: () => MigrationInventory; timeoutMs?: number } = {},
) {
	const token = randomBytes(32).toString("hex");
	let origin = "";
	const server = createServer((req, res) => {
		res.setHeader("Cache-Control", "no-store");
		res.setHeader("X-Content-Type-Options", "nosniff");
		res.setHeader("Referrer-Policy", "no-referrer");
		res.setHeader(
			"Content-Security-Policy",
			"default-src 'none'; script-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
		);
		if (
			req.headers.host !== new URL(origin).host ||
			(req.headers.origin && req.headers.origin !== origin)
		) {
			res.writeHead(403).end();
			return;
		}
		if (req.method !== "GET") {
			res.writeHead(405, { Allow: "GET" }).end();
			return;
		}
		if (req.url === "/") {
			res
				.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
				.end(page);
			return;
		}
		if (req.url === "/setup.js") {
			res
				.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8" })
				.end(script);
			return;
		}
		if (req.url !== "/api/inventory") {
			res.writeHead(404).end();
			return;
		}
		const supplied = Buffer.from(req.headers.authorization ?? "");
		const expected = Buffer.from(`Bearer ${token}`);
		if (
			supplied.length !== expected.length ||
			!timingSafeEqual(supplied, expected)
		) {
			res.writeHead(403).end();
			return;
		}
		try {
			const inventory = (options.inspect ?? inspectMigration)();
			res
				.writeHead(200, { "Content-Type": "application/json" })
				.end(JSON.stringify(inventory));
		} catch {
			res.writeHead(500, { "Content-Type": "application/json" }).end(
				JSON.stringify({
					error:
						"Could not inspect local setup. Check account paths before continuing.",
				}),
			);
		}
	});
	const closed = new Promise<void>((resolve) => server.once("close", resolve));
	await new Promise<void>((resolve, reject) => {
		server.once("error", reject);
		server.listen(0, "127.0.0.1", resolve);
	});
	const address = server.address();
	if (!address || typeof address === "string")
		throw new Error("Setup server did not bind");
	origin = `http://127.0.0.1:${address.port}`;
	let closing: Promise<void> | undefined;
	const close = () => {
		clearTimeout(timer);
		closing ??= new Promise<void>((resolve, reject) => {
			server.close((error) => (error ? reject(error) : resolve()));
			server.closeAllConnections();
		});
		return closing;
	};
	const timer = setTimeout(() => {
		void close();
	}, options.timeoutMs ?? 300_000);
	timer.unref();
	return { url: `${origin}/#${token}`, close, closed };
}

const page = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>BSV MCP local setup</title><body><main><h1>Move your existing identity into Vault</h1><p>This page inspects your local setup. Your keys and wallet databases are not changed.</p><div id="status" role="status">Inspecting local setup…</div><ul id="sources"></ul><p>Migration is not yet enabled in this preview. The next step will unlock your existing backup locally, preserve each key as a standalone Vault entry, and verify the original addresses before switching the wallet to Vault.</p></main><script src="/setup.js"></script></body></html>`;
const script = `const token = location.hash.slice(1); history.replaceState(null, '', '/');
fetch('/api/inventory', {headers: {Authorization: 'Bearer ' + token}}).then(async response => {
 if (!response.ok) throw new Error('Unable to inspect setup. Reopen the setup link from BSV MCP.');
 const data = await response.json();
 document.getElementById('status').textContent = data.migrationRequired ? 'Existing keys found. Review the accounts below.' : 'No existing keys found.';
 const list = document.getElementById('sources');
 for (const source of data.sources) {
  const item = document.createElement('li');
  item.textContent = source.account + (source.location === 'legacy-root' ? ' (older setup)' : '') + ': ' + [source.encryptedBackup && 'encrypted backup', source.plaintextKeys && 'plaintext keys', source.walletDatabases.length && source.walletDatabases.length + ' wallet database(s)'].filter(Boolean).join(', ');
  list.append(item);
 }
 if (data.environmentKeys.payment || data.environmentKeys.identity) {
  const item = document.createElement('li'); item.textContent = data.environmentKeys.empty ? 'An environment key is empty and needs correction.' : 'Keys are configured in the process environment.'; list.append(item);
 }
 const item = document.createElement('li'); item.textContent = data.vaultExists ? 'An existing Vault was found; migration must preserve its entries.' : 'No Vault file was found.'; list.append(item);
}).catch(error => {document.getElementById('status').textContent = error.message;});`;

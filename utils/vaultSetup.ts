import { randomBytes, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { localUiAssetsDirectory, readLocalUiAsset } from "./localUiAssets";
import { inspectMigration, type MigrationInventory } from "./vaultMigration";
import {
	isConflictResolution,
	type VaultMigrationBackend,
	type VaultMigrationDestination,
	VaultMigrationWizard,
} from "./vaultMigrationWizard";

function unavailableMigrationBackend(): VaultMigrationBackend {
	const reason =
		"The local Vault migration backend could not be initialized. Check the Vault package and project configuration, then reopen setup.";
	const unavailable = async (): Promise<never> => {
		throw new Error(reason);
	};
	return {
		available: false,
		unavailableReason: reason,
		beginUnlock: unavailable,
		preview: unavailable,
		cutover: unavailable,
		lock: async () => {},
	};
}

export type AvailableSetupTool = {
	name: string;
	title?: string;
	description?: string;
};
export interface EmbeddedSetupActions {
	unlock?(body: Record<string, unknown>): Promise<{
		accountName: string;
		address: string;
		ready: boolean;
		tools?: AvailableSetupTool[];
	}>;
	create(body: Record<string, unknown>): Promise<{
		accountName: string;
		address: string;
		ready: boolean;
		tools?: AvailableSetupTool[];
	}>;
	import(body: Record<string, unknown>): Promise<{
		accountName: string;
		address: string;
		ready: boolean;
		tools?: AvailableSetupTool[];
	}>;
}

/** Local setup flow. Inventory is read-only; cutover requires an explicit backend. */
export async function startVaultSetup(
	options: {
		inspect?: () => MigrationInventory;
		flow?: "embedded" | "standalone" | "project";
		embeddedActions?: EmbeddedSetupActions;
		timeoutMs?: number;
		/** Trusted local asset directory override for packaging tests and embedders. */
		assetsDirectory?: string;
		/** Trusted bootstrap defaults, visible only to the authenticated setup browser. */
		destinationDefaults?: { vaultPath: string };
		/** Explicit adapter used by tests and embedders. */
		migrationBackend?: VaultMigrationBackend;
		/** Trusted local bootstrap; evaluated before the server starts listening. */
		migrationBackendFactory?: () => Promise<VaultMigrationBackend>;
	} = {},
) {
	if (options.migrationBackend && options.migrationBackendFactory)
		throw new Error(
			"Provide either migrationBackend or migrationBackendFactory, not both.",
		);
	let migrationBackend = options.migrationBackend;
	if (!migrationBackend && options.migrationBackendFactory) {
		try {
			const candidate = await options.migrationBackendFactory();
			if (!candidate || typeof candidate.available !== "boolean")
				throw new Error("invalid backend");
			migrationBackend = candidate;
		} catch {
			migrationBackend = unavailableMigrationBackend();
		}
	}
	const token = randomBytes(32).toString("hex");
	const assetsDirectory = options.assetsDirectory ?? localUiAssetsDirectory();
	let origin = "";
	let wizard: VaultMigrationWizard | undefined;
	const server = createServer(async (req, res) => {
		res.setHeader("Cache-Control", "no-store");
		res.setHeader("X-Content-Type-Options", "nosniff");
		res.setHeader("Referrer-Policy", "no-referrer");
		res.setHeader(
			"Content-Security-Policy",
			"default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
		);
		if (
			req.headers.host !== new URL(origin).host ||
			(req.headers.origin && req.headers.origin !== origin)
		) {
			res.writeHead(403).end();
			return;
		}
		const requestPath = req.url?.split("?", 1)[0];
		const setupRoute = /^\/setup\/(source|destination|unlock|review)$/.test(
			requestPath ?? "",
		);
		if (
			requestPath === "/" ||
			setupRoute ||
			requestPath?.startsWith("/assets/")
		) {
			if (req.method !== "GET" && req.method !== "HEAD") {
				res.writeHead(405, { Allow: "GET, HEAD" }).end();
				return;
			}
			const asset = readLocalUiAsset(
				setupRoute ? "/" : (req.url ?? "/"),
				assetsDirectory,
			);
			if (!asset) {
				res
					.writeHead(requestPath === "/" ? 503 : 404, {
						"Content-Type": "text/plain; charset=utf-8",
					})
					.end(
						requestPath === "/"
							? "The local setup UI is unavailable. Rebuild or reinstall bsv-mcp, then reopen setup."
							: "Not found",
					);
				return;
			}
			res
				.writeHead(200, {
					"Content-Type": asset.contentType,
					"Content-Length": asset.body.byteLength,
				})
				.end(req.method === "HEAD" ? undefined : asset.body);
			return;
		}
		const apiPath = req.url?.split("?", 1)[0];
		if (
			apiPath !== "/api/inventory" &&
			!apiPath?.startsWith("/api/migration/") &&
			!apiPath?.startsWith("/api/embedded/")
		) {
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
		if (apiPath === "/api/migration/capabilities") {
			if (req.method !== "GET") {
				res.writeHead(405, { Allow: "GET" }).end();
				return;
			}
			res.writeHead(200, { "Content-Type": "application/json" }).end(
				JSON.stringify({
					available: migrationBackend?.available === true,
					destinationDefaults: options.destinationDefaults,
					reason:
						migrationBackend?.available === true
							? undefined
							: (migrationBackend?.unavailableReason ??
								"Vault migration is unavailable until the local Vault backend is enabled."),
				}),
			);
			return;
		}
		try {
			if (apiPath?.startsWith("/api/embedded/")) {
				if (req.method !== "POST") {
					res.writeHead(405, { Allow: "POST" }).end();
					return;
				}
				const action =
					apiPath === "/api/embedded/create"
						? "create"
						: apiPath === "/api/embedded/import"
							? "import"
							: apiPath === "/api/embedded/unlock"
								? "unlock"
								: undefined;
				if (!action) {
					res.writeHead(404).end();
					return;
				}
				const embeddedAction = options.embeddedActions?.[action];
				if (!embeddedAction) {
					res.writeHead(503, { "Content-Type": "application/json" }).end(
						JSON.stringify({
							error:
								"Wallet setup is not connected. Reopen setup from the MCP client.",
						}),
					);
					return;
				}
				try {
					const body = await readJson(req, 8 * 1024 * 1024);
					const result = await embeddedAction(body);
					return writeJson(res, result);
				} catch (error) {
					const safeNames = [
						"EmbeddedFirstRunError",
						"EmbeddedVaultError",
						"EmbeddedWalletActivationError",
						"EmbeddedImportError",
					];
					const message =
						error instanceof Error && safeNames.includes(error.name)
							? error.message
							: "Wallet setup could not complete. Check your selection and passwords, then try again.";
					res
						.writeHead(400, { "Content-Type": "application/json" })
						.end(JSON.stringify({ error: message }));
					return;
				}
			}
			if (apiPath === "/api/inventory") {
				if (req.method !== "GET") {
					res.writeHead(405, { Allow: "GET" }).end();
					return;
				}
				const inventory = (options.inspect ?? inspectMigration)();
				res
					.writeHead(200, { "Content-Type": "application/json" })
					.end(JSON.stringify(inventory));
				return;
			}
			const current = () =>
				(wizard ??= new VaultMigrationWizard({
					inventory: (options.inspect ?? inspectMigration)(),
					backend: migrationBackend,
				}));
			if (!migrationBackend?.available) {
				res.writeHead(503, { "Content-Type": "application/json" }).end(
					JSON.stringify({
						error: "Vault migration backend is unavailable.",
					}),
				);
				return;
			}
			if (req.method !== "POST") {
				res.writeHead(405, { Allow: "POST" }).end();
				return;
			}
			const body = await readJson(req);
			if (apiPath === "/api/migration/unlock") {
				const source = body.source as
					| {
							account?: unknown;
							location?: unknown;
					  }
					| undefined;
				const destination = body.destination as
					| VaultMigrationDestination
					| undefined;
				const sourcePassphrase = body.sourcePassphrase;
				const destinationPassphrase = body.destinationPassphrase;
				if (
					!source ||
					typeof source.account !== "string" ||
					typeof source.location !== "string" ||
					typeof sourcePassphrase !== "string" ||
					(destinationPassphrase !== undefined &&
						typeof destinationPassphrase !== "string") ||
					!destination
				) {
					res.writeHead(400, { "Content-Type": "application/json" }).end(
						JSON.stringify({
							error:
								"Source, destination, and local unlock fields are required.",
						}),
					);
					return;
				}
				const selected = current().selectSource(
					`${source.location}:${source.account}`,
				);
				if (selected.error) return writeWizardError(res, selected);
				const selectedDestination = current().selectDestination(destination);
				if (selectedDestination.error)
					return writeWizardError(res, selectedDestination);
				const result = await current().unlock({
					sourcePassphrase,
					destinationPassphrase,
				});
				return result.error
					? writeWizardError(res, result)
					: writeJson(res, {
							session: result.session,
							preview: result.preview,
						});
			}
			if (apiPath === "/api/migration/preview") {
				if (body.sessionId !== current().snapshot().session?.sessionId) {
					res.writeHead(409, { "Content-Type": "application/json" }).end(
						JSON.stringify({
							error: "The local unlock session is no longer active.",
						}),
					);
					return;
				}
				const result = await current().loadPreview();
				return result.error
					? writeWizardError(res, result)
					: writeJson(res, {
							session: result.session,
							preview: result.preview,
						});
			}
			if (apiPath === "/api/migration/cutover") {
				if (body.sessionId !== current().snapshot().session?.sessionId) {
					res.writeHead(409, { "Content-Type": "application/json" }).end(
						JSON.stringify({
							error: "The local unlock session is no longer active.",
						}),
					);
					return;
				}
				const confirmation = body.confirmation;
				const confirmed = current().confirmCutover(
					typeof confirmation === "string" ? confirmation : "",
					body.roleSelection,
				);
				if (confirmed.error) return writeWizardError(res, confirmed);
				const result = await current().cutover();
				if (!result.result && !result.error) {
					res
						.writeHead(409, { "Content-Type": "application/json" })
						.end(
							JSON.stringify({ error: "Migration is already in progress." }),
						);
					return;
				}
				return result.error
					? writeWizardError(res, result)
					: writeJson(res, result.result);
			}
			if (apiPath === "/api/migration/resolve") {
				if (body.sessionId !== current().snapshot().session?.sessionId) {
					res.writeHead(409, { "Content-Type": "application/json" }).end(
						JSON.stringify({
							error: "The local unlock session is no longer active.",
						}),
					);
					return;
				}
				const conflictId = body.conflictId;
				const resolution = body.resolution;
				if (
					typeof conflictId !== "string" ||
					!isConflictResolution(resolution)
				) {
					res.writeHead(400, { "Content-Type": "application/json" }).end(
						JSON.stringify({
							error: "A conflict and supported resolution are required.",
						}),
					);
					return;
				}
				const result = current().resolveConflict(conflictId, resolution);
				return result.error
					? writeWizardError(res, result)
					: writeJson(res, { preview: result.preview });
			}
			if (apiPath === "/api/migration/reconcile") {
				if (body.sessionId !== current().snapshot().session?.sessionId) {
					res.writeHead(409, { "Content-Type": "application/json" }).end(
						JSON.stringify({
							error: "The local unlock session is no longer active.",
						}),
					);
					return;
				}
				const result = await current().reconcile();
				return result.error
					? writeWizardError(res, result)
					: writeJson(res, {
							phase: result.phase,
							session: result.session,
							preview: result.preview,
							result: result.result,
						});
			}
			if (apiPath === "/api/migration/lock") {
				if (body.sessionId !== current().snapshot().session?.sessionId) {
					res.writeHead(409, { "Content-Type": "application/json" }).end(
						JSON.stringify({
							error: "The local unlock session is no longer active.",
						}),
					);
					return;
				}
				const result = await current().lock();
				return result.error
					? writeWizardError(res, result)
					: writeJson(res, { locked: true });
			}
			res.writeHead(404).end();
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
		closing ??= (async () => {
			if (wizard) await wizard.lock().catch(() => undefined);
			await new Promise<void>((resolve, reject) => {
				server.close((error) => (error ? reject(error) : resolve()));
				server.closeAllConnections();
			});
		})();
		return closing;
	};
	const timer = setTimeout(() => {
		void close();
	}, options.timeoutMs ?? 300_000);
	timer.unref();
	return {
		url: `${origin}/${options.flow && options.flow !== "embedded" ? `?flow=${options.flow}` : ""}#${token}`,
		close,
		closed,
	};
}

function writeJson(
	response: import("node:http").ServerResponse,
	value: unknown,
) {
	response
		.writeHead(200, { "Content-Type": "application/json" })
		.end(JSON.stringify(value));
}

function writeWizardError(
	response: import("node:http").ServerResponse,
	state: { error?: { code: string; message: string; noEffect?: true } },
) {
	const code = state.error?.code ?? "backend-error";
	const status =
		code === "backend-unavailable"
			? 503
			: code === "invalid-selection"
				? 400
				: 409;
	response.writeHead(status, { "Content-Type": "application/json" }).end(
		JSON.stringify({
			error: state.error?.message ?? "Vault migration failed.",
			...(state.error?.noEffect === true ? { noEffect: true } : {}),
		}),
	);
}

async function readJson(
	request: import("node:http").IncomingMessage,
	maximumBytes = 64 * 1024,
): Promise<Record<string, unknown>> {
	let size = 0;
	const chunks: Buffer[] = [];
	for await (const chunk of request) {
		const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
		size += buffer.length;
		if (size > maximumBytes) throw new Error("Migration request is too large");
		chunks.push(buffer);
	}
	if (chunks.length === 0) return {};
	const value: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
	if (!value || typeof value !== "object" || Array.isArray(value))
		throw new Error("Migration request must be a JSON object");
	return value as Record<string, unknown>;
}

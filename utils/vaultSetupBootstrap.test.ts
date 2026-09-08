import { expect, it } from "bun:test";
import {
	createConfiguredVaultSetupBackend,
	runConfiguredVaultSetup,
} from "./vaultSetupBootstrap";
it("requires an explicit absolute project root and project ID", async () => {
	for (const env of [
		{},
		{ BSV_MCP_PROJECT_ROOT: "relative", BSV_MCP_PROJECT_ID: "test" },
		{ BSV_MCP_PROJECT_ROOT: "/tmp/test" },
	])
		expect((await createConfiguredVaultSetupBackend(env)).available).toBe(
			false,
		);
});
it("passes only trusted runtime project and Vault configuration to the backend", async () => {
	let received: unknown;
	const backend = { available: true } as never;
	expect(
		await createConfiguredVaultSetupBackend(
			{
				BSV_MCP_PROJECT_ROOT: "/tmp/project",
				BSV_MCP_PROJECT_ID: "test",
				VAULT_PATH: "/tmp/selected.bep",
			},
			{
				createBackend: async (options) => {
					received = options;
					return backend;
				},
			},
		),
	).toBe(backend);
	expect(received).toMatchObject({
		projectRoot: "/tmp/project",
		expectedProjectId: "test",
		vaultPath: "/tmp/selected.bep",
		roleAssignments: {},
	});
});
it("awaits backend readiness before opening the local setup server", async () => {
	const order: string[] = [];
	await runConfiguredVaultSetup({
		createBackend: async () => {
			order.push("backend");
			return { available: true } as never;
		},
		run: async (options) => {
			order.push("run");
			await options?.start?.();
		},
		start: async (options) => {
			expect(options?.migrationBackend?.available).toBe(true);
			order.push("start");
			return {} as never;
		},
	});
	expect(order).toEqual(["backend", "run", "start"]);
});

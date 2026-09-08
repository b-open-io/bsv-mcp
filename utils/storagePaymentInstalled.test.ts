import { expect, test } from "bun:test";
import { createWalletCore } from "@1sat/wallet";
import { PrivateKey } from "@bsv/sdk";

class StorageClientFixture {
	static instances: StorageClientFixture[] = [];
	readonly endpointUrl: string;
	readonly originalProcessSyncChunk: () => Promise<{ done: boolean }>;
	processSyncChunk: () => Promise<{ done: boolean }>;

	constructor(_wallet: unknown, endpointUrl: string) {
		this.endpointUrl = endpointUrl;
		this.processSyncChunk = async () => ({ done: true });
		this.originalProcessSyncChunk = this.processSyncChunk;
		StorageClientFixture.instances.push(this);
	}

	getSettings() {
		return { storageIdentityKey: this.endpointUrl };
	}

	async makeAvailable() {
		return this.getSettings();
	}

	isStorageProvider() {
		return false;
	}
}

const localStorageFixture = {
	makeAvailable: async () => ({ storageIdentityKey: "local" }),
	getSettings: () => ({ storageIdentityKey: "local" }),
	isStorageProvider: () => true,
};

class StorageManagerFixture {
	readonly providers: Array<StorageClientFixture | typeof localStorageFixture> =
		[];
	active = "local";
	isActiveEnabled = true;

	async addWalletStorageProvider(
		provider: StorageClientFixture | typeof localStorageFixture,
	) {
		this.providers.push(provider);
	}

	getActiveStore() {
		return this.active;
	}

	getActive() {
		return this.providers.find(
			(provider) => provider.getSettings().storageIdentityKey === this.active,
		);
	}

	async setActive(key: string) {
		this.active = key;
	}

	async getAuth() {
		return { identityKey: "synthetic" };
	}

	getBackupStores() {
		return this.providers.filter((provider) => provider !== this.getActive());
	}

	async syncToWriter(_auth: unknown, writer: StorageClientFixture) {
		return writer.processSyncChunk();
	}
}

class WalletFixture {
	static instance: WalletFixture | undefined;

	constructor() {
		WalletFixture.instance = this;
	}

	createAction = async () => {
		throw new Error("network error 507 Insufficient Storage");
	};
	signAction = async () => {
		throw new Error("network error 507 Insufficient Storage");
	};
	internalizeAction = async () => {
		throw new Error("network error 507 Insufficient Storage");
	};

	async destroy() {}
}

class MonitorFixture {
	_tasks: Array<{ name: string }> = [];

	addDefaultTasks() {}

	addTask(task: { name: string }) {
		this._tasks.push(task);
	}

	stopTasks() {}

	async destroy() {}
}

test("installed patched wallet disables active and backup payment installers", async () => {
	StorageClientFixture.instances = [];
	WalletFixture.instance = undefined;
	const result = await createWalletCore(
		{
			privateKey: PrivateKey.fromString("1", 16),
			chain: "test",
			activeRemote: "https://active.invalid",
			backups: ["https://backup.invalid"],
			autoStoragePayments: false,
		},
		localStorageFixture,
		{
			Services: class {},
			StorageClient: StorageClientFixture,
			StorageProvider: class {},
			Wallet: WalletFixture,
			WalletStorageManager: StorageManagerFixture,
			Monitor: MonitorFixture,
		},
	);

	try {
		const wallet = WalletFixture.instance as unknown as WalletFixture;
		const originalWalletMethods = {
			createAction: wallet.createAction,
			signAction: wallet.signAction,
			internalizeAction: wallet.internalizeAction,
		};
		expect(result.remoteClients.map((client) => client.endpointUrl)).toEqual([
			"https://active.invalid",
			"https://backup.invalid",
		]);
		expect(
			result.monitor?._tasks.map((task: { name: string }) => task.name),
		).toContain("BackupSync");
		expect(wallet.createAction).toBe(originalWalletMethods.createAction);
		expect(wallet.signAction).toBe(originalWalletMethods.signAction);
		expect(wallet.internalizeAction).toBe(
			originalWalletMethods.internalizeAction,
		);
		expect(
			StorageClientFixture.instances.map(
				(client) => client.processSyncChunk === client.originalProcessSyncChunk,
			),
		).toEqual([true, true]);
		await result.addRemote("https://added.invalid");
		await result.setActiveStorage("https://switched.invalid");
		expect(result.remoteClients.map((client) => client.endpointUrl)).toEqual([
			"https://active.invalid",
			"https://backup.invalid",
			"https://added.invalid",
			"https://switched.invalid",
		]);
		expect(
			StorageClientFixture.instances.map(
				(client) => client.processSyncChunk === client.originalProcessSyncChunk,
			),
		).toEqual([true, true, true, true]);
		await expect(wallet.createAction()).rejects.toThrow(
			"network error 507 Insufficient Storage",
		);
		await expect(result.remoteClients[1].processSyncChunk()).resolves.toEqual({
			done: true,
		});
	} finally {
		await result.destroy();
	}
});

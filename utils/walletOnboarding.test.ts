import { expect, test } from "bun:test";
import { createWalletSetupLauncher } from "./walletOnboarding";

type FakeSetup = {
	url: string;
	close: () => Promise<void>;
	closed: Promise<void>;
};

function deferred<T = void>() {
	let resolve!: (value: T | PromiseLike<T>) => void;
	let reject!: (reason?: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

test("constructing launcher has no startup side effect", () => {
	let runCalls = 0;
	let startCalls = 0;
	createWalletSetupLauncher({
		runSetup: (async () => {
			runCalls++;
		}) as never,
		start: (async () => {
			startCalls++;
			return {} as never;
		}) as never,
		open: async () => {},
		log: () => {},
	});
	expect(runCalls).toBe(0);
	expect(startCalls).toBe(0);
});

test("explicit call is nonblocking before closure and never returns bearer material", async () => {
	let startCalls = 0;
	const closedGate = deferred<void>();
	const setup: FakeSetup = {
		url: "http://127.0.0.1:1/#synthetic-bearer-token",
		close: async () => {
			closedGate.resolve();
		},
		closed: closedGate.promise,
	};
	const runSetup = async (options: {
		start?: () => Promise<FakeSetup>;
		open?: (url: string) => Promise<void>;
	}) => {
		const created = await options.start?.();
		if (created) await options.open?.(created.url);
		expect(created?.url).toContain("127.0.0.1");
		await created?.closed;
	};
	const launcher = createWalletSetupLauncher({
		runSetup: runSetup as never,
		start: (async () => {
			startCalls++;
			return setup as never;
		}) as never,
		open: async () => {},
		log: () => {},
	});
	const startedAt = Date.now();
	const result = await launcher();
	expect(Date.now() - startedAt).toBeLessThan(1000);
	expect(result).toBeUndefined();
	expect(startCalls).toBe(1);
	closedGate.resolve();
	await Bun.sleep(10);
});

test("concurrent calls reuse one lifecycle", async () => {
	let startCalls = 0;
	const closedGate = deferred<void>();
	const setup: FakeSetup = {
		url: "http://127.0.0.1:1/#synthetic-token",
		close: async () => {},
		closed: closedGate.promise,
	};
	const runSetup = async (options: {
		start?: () => Promise<FakeSetup>;
		open?: (url: string) => Promise<void>;
	}) => {
		const created = await options.start?.();
		if (created) await options.open?.(created.url);
		await closedGate.promise;
	};
	const launcher = createWalletSetupLauncher({
		runSetup: runSetup as never,
		start: (async () => {
			startCalls++;
			return setup as never;
		}) as never,
		open: async () => {},
		log: () => {},
	});
	const first = launcher();
	const second = launcher();
	expect(first).toBe(second);
	await first;
	await second;
	expect(startCalls).toBe(1);
	closedGate.resolve();
	await Bun.sleep(10);
	await first;
	expect(startCalls).toBe(1);
});

test("next call after closure starts a fresh lifecycle", async () => {
	let startCalls = 0;
	let releaseCurrent!: () => void;
	const makeGate = () => {
		let release!: () => void;
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		releaseCurrent = release;
		return gate;
	};
	let currentClosed = makeGate();
	const runSetup = async (options: {
		start?: () => Promise<FakeSetup>;
		open?: (url: string) => Promise<void>;
	}) => {
		const created = (await options.start?.()) as FakeSetup;
		await options.open?.(created.url);
		await created.closed;
	};
	const launcher = createWalletSetupLauncher({
		runSetup: runSetup as never,
		start: (async () => {
			startCalls++;
			const closed = currentClosed;
			return {
				url: "http://127.0.0.1:1/",
				close: async () => {},
				closed,
			} as never;
		}) as never,
		open: async () => {},
		log: () => {},
	});
	await launcher();
	expect(startCalls).toBe(1);
	releaseCurrent();
	currentClosed = makeGate();
	await Bun.sleep(10);
	await launcher();
	expect(startCalls).toBe(2);
	releaseCurrent();
	await Bun.sleep(10);
});

test("startup failure uses fixed generic error and retries", async () => {
	const plainSecret = "sunny orchard picnic basket zebra umbrella onboarding";
	const messages: string[] = [];
	let runCalls = 0;
	let startCalls = 0;
	const closedGate = deferred<void>();
	const launcher = createWalletSetupLauncher({
		runSetup: (async (options: {
			start?: () => Promise<FakeSetup>;
			open?: (url: string) => Promise<void>;
		}) => {
			runCalls++;
			const created = await options.start?.();
			if (created) await options.open?.(created.url);
		}) as never,
		start: (async () => {
			startCalls++;
			if (startCalls === 1) {
				throw new Error(`boom ${plainSecret}`);
			}
			return {
				url: "http://127.0.0.1:1/",
				close: async () => {},
				closed: closedGate.promise,
			} as never;
		}) as never,
		open: async () => {},
		log: (message: string) => {
			messages.push(message);
		},
	});
	let error: unknown;
	try {
		await launcher();
	} catch (err) {
		error = err;
	}
	expect(error).toBeInstanceOf(Error);
	const text = (error as Error).message;
	expect(text).toBe(
		"Wallet setup could not be started. Retry wallet onboarding.",
	);
	expect(text).not.toContain(plainSecret);
	expect(text).not.toContain("boom");
	for (const message of messages) {
		expect(message).not.toContain(plainSecret);
		expect(message).not.toContain("boom");
	}
	expect(runCalls).toBe(1);
	expect(startCalls).toBe(1);
	await Bun.sleep(10);
	// Callback must retry after failure with a fresh lifecycle.
	await launcher();
	expect(startCalls).toBe(2);
	expect(runCalls).toBe(2);
	closedGate.resolve();
	await Bun.sleep(10);
});

test("lifecycle failure uses fixed generic error without secret leakage", async () => {
	const plainSecret = "quiet river meadow picnic basket zebra umbrella";
	const messages: string[] = [];
	const launcher = createWalletSetupLauncher({
		runSetup: (async () => {
			throw new Error(`lifecycle boom ${plainSecret}`);
		}) as never,
		start: (async () => {
			throw new Error("unreached");
		}) as never,
		open: async () => {},
		log: (message: string) => {
			messages.push(message);
		},
	});
	let error: unknown;
	try {
		await launcher();
	} catch (err) {
		error = err;
	}
	expect(error).toBeInstanceOf(Error);
	expect((error as Error).message).toBe(
		"Wallet setup could not be started. Retry wallet onboarding.",
	);
	expect((error as Error).message).not.toContain(plainSecret);
	await Bun.sleep(10);
	expect(messages.length).toBeGreaterThan(0);
	for (const message of messages) {
		expect(message).not.toContain(plainSecret);
		expect(message).not.toContain("lifecycle boom");
	}
});

test("actual setup command waits for browser success and closes after browser failure", async () => {
	const opened = deferred<void>();
	const closed = deferred<void>();
	let closeCalls = 0;
	const launcher = createWalletSetupLauncher({
		start: async () => ({
			url: "http://127.0.0.1:1/#synthetic-only",
			closed: closed.promise,
			close: async () => {
				closeCalls++;
				closed.resolve();
			},
		}),
		createBackend: async () => ({
			available: false,
			beginUnlock: async () => {
				throw new Error("unused");
			},
			preview: async () => {
				throw new Error("unused");
			},
			cutover: async () => {
				throw new Error("unused");
			},
			lock: async () => {},
		}),
		open: () => opened.promise,
		log: () => {},
	});
	let settled = false;
	const result = launcher().then(() => { settled = true; return undefined; }, (error: unknown) => { settled = true; return error; });
	await Bun.sleep(10);
	expect(settled).toBe(false);
	opened.reject(new Error("private arbitrary browser failure"));
	const failure = await result;
	expect(failure).toBeInstanceOf(Error);
	expect((failure as Error).message).toBe("Wallet setup could not be started. Retry wallet onboarding.");
	await Bun.sleep(10);
	expect(closeCalls).toBeGreaterThan(0);
});

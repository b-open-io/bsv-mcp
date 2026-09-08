import { redactKeyMaterial } from "./redact";
import { type EmbeddedSetupActions, startVaultSetup } from "./vaultSetup";
import {
	type createConfiguredVaultSetupBackend,
	runConfiguredVaultSetup,
} from "./vaultSetupBootstrap";
import {
	openLocalBrowser,
	type runVaultSetupCommand,
} from "./vaultSetupCommand";

export interface WalletSetupLauncherOptions {
	runSetup?: typeof runConfiguredVaultSetup;
	embeddedActions?: EmbeddedSetupActions;
	start?: typeof startVaultSetup;
	run?: typeof runVaultSetupCommand;
	open?: (url: string) => Promise<void>;
	log?: (message: string) => void;
	env?: Record<string, string | undefined>;
	createBackend?: typeof createConfiguredVaultSetupBackend;
}

/**
 * Create an explicitly invoked wallet-setup callback for the setup-needed state.
 * Constructing the launcher has no side effect. The returned callback resolves
 * after the local browser has opened, while the configured setup lifecycle
 * continues in the background until it closes.
 */
export function createWalletSetupLauncher(
	options: WalletSetupLauncherOptions = {},
): () => Promise<void> {
	const runSetup = options.runSetup ?? runConfiguredVaultSetup;
	const innerStart = options.start ?? startVaultSetup;
	const baseLog =
		options.log ?? ((message: string) => process.stderr.write(`${message}\n`));
	const sanitizeText = (value: string): string => {
		const redacted = redactKeyMaterial(value);
		return redacted
			.replace(/https?:\/\/[^\s"'`]+/g, "[REDACTED-URL]")
			.replace(/#[^\s"'`]+/g, "[REDACTED-FRAGMENT]");
	};
	const safeLog = (message: string) => {
		try {
			baseLog(sanitizeText(message));
		} catch {
			// Logging must never break setup lifecycle tracking.
		}
	};
	const WALLET_SETUP_START_FAILURE =
		"Wallet setup could not be started. Retry wallet onboarding.";

	let activeCallback: Promise<void> | undefined;
	let activeLifecycle: Promise<void> | undefined;

	return function openWalletSetup(): Promise<void> {
		if (activeCallback) return activeCallback;
		let resolveStarted!: () => void;
		let rejectStarted!: (error: Error) => void;
		const started = new Promise<void>((resolve, reject) => {
			resolveStarted = resolve;
			rejectStarted = reject;
		});
		activeCallback = started;

		let setupHandle: Awaited<ReturnType<typeof startVaultSetup>> | undefined;
		const startWrapper = (async (
			backendOptions: Parameters<typeof innerStart>[0],
		) => {
			try {
				const setup = await innerStart(backendOptions);
				setupHandle = setup;
				return setup;
			} catch {
				const failure = new Error(WALLET_SETUP_START_FAILURE);
				rejectStarted(failure);
				throw failure;
			}
		}) as typeof startVaultSetup;

		const runOptions: Parameters<typeof runSetup>[0] = {
			start: startWrapper,
			embeddedActions: options.embeddedActions,
			log: (message: string) => safeLog(message),
		};
		if (options.run !== undefined) runOptions.run = options.run;
		runOptions.open = async (url) => {
			try {
				await (options.open ?? openLocalBrowser)(url);
				resolveStarted();
			} catch {
				const failure = new Error(WALLET_SETUP_START_FAILURE);
				rejectStarted(failure);
				await setupHandle?.close();
				throw failure;
			}
		};
		if (options.env !== undefined) runOptions.env = options.env;
		if (options.createBackend !== undefined)
			runOptions.createBackend = options.createBackend;

		let lifecycle: Promise<void> | undefined;
		const runLifecycle = async () => {
			try {
				await runSetup(runOptions);
			} catch {
				safeLog(WALLET_SETUP_START_FAILURE);
				rejectStarted(new Error(WALLET_SETUP_START_FAILURE));
			} finally {
				if (activeLifecycle === lifecycle) {
					activeCallback = undefined;
					activeLifecycle = undefined;
				}
			}
		};
		lifecycle = runLifecycle();
		activeLifecycle = lifecycle;
		lifecycle.catch(() => {});
		return started;
	};
}

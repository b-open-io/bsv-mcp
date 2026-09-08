import type {
	CallToolResult,
	McpServer,
	ServerContext,
	ToolAnnotations,
} from "@modelcontextprotocol/server";
import { z } from "zod";
import { createSuccessResponse } from "../utils/errorHandler";
import type { ToolResponse } from "../utils/toolRegistration";

export const WALLET_ONBOARDING_TOOL_NAME = "wallet_onboarding";

export const walletOnboardingInputSchema = z.object({});

export const WALLET_ONBOARDING_ANNOTATIONS: ToolAnnotations = {
	readOnlyHint: false,
	destructiveHint: false,
	idempotentHint: false,
	openWorldHint: true,
};

export const WALLET_ONBOARDING_SUCCESS = {
	status: "opened",
	setupNeeded: true,
	nextStep: "Complete wallet setup in the browser.",
} as const;

export const WALLET_ONBOARDING_FAILURE = {
	status: "error",
	setupNeeded: true,
	message:
		"Failed to open wallet setup. Try again or inspect the computer that runs BSV MCP.",
} as const;

export type OpenWalletSetup = () => Promise<void>;

export interface WalletOnboardingConfig {
	walletSetupNeeded?: boolean;
	openWalletSetup?: OpenWalletSetup;
}

/**
 * The onboarding tool is available only when the caller-provided
 * configuration explicitly says setup is needed and supplies the
 * dependency-injected opener. An unavailable or missing setup state
 * must not register the tool.
 */
export function isWalletOnboardingAvailable(
	config: WalletOnboardingConfig,
): boolean {
	return (
		config.walletSetupNeeded === true &&
		typeof config.openWalletSetup === "function"
	);
}

/**
 * Run the injected opener and return only public status. Never include
 * bearer URLs, setup tokens, private keys, or other secrets in the
 * model-visible content. Failures return a safe generic error.
 */
export async function executeWalletOnboarding(
	openWalletSetup: OpenWalletSetup,
): Promise<ToolResponse> {
	try {
		await openWalletSetup();
		return {
			...createSuccessResponse({ ...WALLET_ONBOARDING_SUCCESS }),
			structuredContent: { ...WALLET_ONBOARDING_SUCCESS },
		};
	} catch {
		const data = { ...WALLET_ONBOARDING_FAILURE };
		return {
			...createSuccessResponse(data),
			structuredContent: data,
			isError: true,
		};
	}
}

export function createWalletOnboardingHandler(
	openWalletSetup: OpenWalletSetup,
): (args: unknown, ctx: ServerContext) => Promise<CallToolResult> {
	return () => executeWalletOnboarding(openWalletSetup);
}

/**
 * Register the single `wallet_onboarding` tool with an empty input schema.
 * Callers must gate on `isWalletOnboardingAvailable` first; this function
 * performs no startup auto-opening and only opens setup when invoked.
 */
export function registerWalletOnboardingTool(
	server: McpServer,
	openWalletSetup: OpenWalletSetup,
): void {
	server.registerTool(
		WALLET_ONBOARDING_TOOL_NAME,
		{
			description:
				"Open the local wallet setup in the browser. Only available when wallet setup is needed. Complete wallet setup in the browser.",
			inputSchema: walletOnboardingInputSchema,
			annotations: WALLET_ONBOARDING_ANNOTATIONS,
		},
		createWalletOnboardingHandler(openWalletSetup),
	);
}

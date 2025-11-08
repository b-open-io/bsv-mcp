/**
 * Standardized error handling for BSV MCP Server
 * Provides consistent error types and formatting across all tools
 */

import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

/**
 * Error codes for different types of failures
 */
export enum ErrorCode {
	// Configuration errors
	INVALID_CONFIG = "INVALID_CONFIG",
	MISSING_KEY = "MISSING_KEY",

	// Wallet errors
	INSUFFICIENT_FUNDS = "INSUFFICIENT_FUNDS",
	INVALID_ADDRESS = "INVALID_ADDRESS",
	TRANSACTION_FAILED = "TRANSACTION_FAILED",
	UTXO_NOT_FOUND = "UTXO_NOT_FOUND",

	// Network errors
	NETWORK_ERROR = "NETWORK_ERROR",
	API_ERROR = "API_ERROR",
	BROADCAST_FAILED = "BROADCAST_FAILED",

	// Validation errors
	INVALID_INPUT = "INVALID_INPUT",
	VALIDATION_FAILED = "VALIDATION_FAILED",

	// File system errors
	FILE_NOT_FOUND = "FILE_NOT_FOUND",
	FILE_READ_ERROR = "FILE_READ_ERROR",
	FILE_WRITE_ERROR = "FILE_WRITE_ERROR",

	// Generic errors
	INTERNAL_ERROR = "INTERNAL_ERROR",
	NOT_IMPLEMENTED = "NOT_IMPLEMENTED",
	OPERATION_FAILED = "OPERATION_FAILED",
}

/**
 * Base error class for MCP operations
 */
export class McpError extends Error {
	constructor(
		message: string,
		public readonly code: ErrorCode,
		public readonly details?: unknown,
		public readonly isRetryable: boolean = false,
	) {
		super(message);
		this.name = "McpError";

		// Ensure proper prototype chain
		Object.setPrototypeOf(this, McpError.prototype);
	}
}

/**
 * Specific error types for common scenarios
 */
export class WalletError extends McpError {
	constructor(message: string, code: ErrorCode, details?: unknown) {
		super(message, code, details, false);
		this.name = "WalletError";
	}
}

export class NetworkError extends McpError {
	constructor(message: string, details?: unknown) {
		super(message, ErrorCode.NETWORK_ERROR, details, true);
		this.name = "NetworkError";
	}
}

export class ValidationError extends McpError {
	constructor(message: string, details?: unknown) {
		super(message, ErrorCode.VALIDATION_FAILED, details, false);
		this.name = "ValidationError";
	}
}

/**
 * Convert any error to a standardized CallToolResult
 */
export function errorToToolResult(error: unknown): CallToolResult {
	// Handle MCP errors
	if (error instanceof McpError) {
		return {
			content: [
				{
					type: "text",
					text: formatErrorMessage(error),
				},
			],
			isError: true,
			_meta: {
				errorCode: error.code,
				retryable: error.isRetryable,
				details: error.details,
			},
		};
	}

	// Handle Zod validation errors
	if (isZodError(error)) {
		return {
			content: [
				{
					type: "text",
					text: formatZodError(error),
				},
			],
			isError: true,
			_meta: {
				errorCode: ErrorCode.VALIDATION_FAILED,
				retryable: false,
			},
		};
	}

	// Handle standard errors
	if (error instanceof Error) {
		return {
			content: [
				{
					type: "text",
					text: `Error: ${error.message}`,
				},
			],
			isError: true,
			_meta: {
				errorCode: ErrorCode.INTERNAL_ERROR,
				retryable: false,
			},
		};
	}

	// Handle unknown errors
	return {
		content: [
			{
				type: "text",
				text: `An unexpected error occurred: ${String(error)}`,
			},
		],
		isError: true,
		_meta: {
			errorCode: ErrorCode.INTERNAL_ERROR,
			retryable: false,
		},
	};
}

/**
 * Format error message for user display
 */
function formatErrorMessage(error: McpError): string {
	let message = error.message;

	// Add context based on error code
	switch (error.code) {
		case ErrorCode.INSUFFICIENT_FUNDS:
			message = `💸 ${message}`;
			break;
		case ErrorCode.NETWORK_ERROR:
			message = `🌐 ${message}`;
			if (error.isRetryable) {
				message += " (This operation can be retried)";
			}
			break;
		case ErrorCode.INVALID_ADDRESS:
			message = `📍 ${message}`;
			break;
		case ErrorCode.TRANSACTION_FAILED:
			message = `❌ ${message}`;
			break;
		default:
			message = `⚠️ ${message}`;
	}

	return message;
}

/**
 * Type guard for Zod errors
 */
function isZodError(
	error: unknown,
): error is { issues: Array<{ path: string[]; message: string }> } {
	return (
		typeof error === "object" &&
		error !== null &&
		"issues" in error &&
		Array.isArray((error as { issues: unknown }).issues)
	);
}

/**
 * Format Zod validation errors
 */
function formatZodError(error: {
	issues: Array<{ path: string[]; message: string }>;
}): string {
	const messages = error.issues.map((issue) => {
		const path = issue.path.join(".");
		return path ? `${path}: ${issue.message}` : issue.message;
	});

	return `Validation failed:\n${messages.join("\n")}`;
}

/**
 * Wrap an async function with error handling
 */
export function withErrorHandling<
	T extends (...args: unknown[]) => Promise<CallToolResult>,
>(fn: T, defaultErrorCode: ErrorCode = ErrorCode.OPERATION_FAILED): T {
	return (async (...args: Parameters<T>) => {
		try {
			return await fn(...args);
		} catch (error) {
			// If it's already a formatted tool result, return it
			if (isToolResult(error)) {
				return error;
			}

			// Convert to McpError if needed
			let processedError = error;
			if (!(error instanceof McpError) && error instanceof Error) {
				processedError = new McpError(error.message, defaultErrorCode, {
					originalError: error,
				});
			}

			return errorToToolResult(processedError);
		}
	}) as T;
}

/**
 * Type guard for CallToolResult
 */
function isToolResult(value: unknown): value is CallToolResult {
	return (
		typeof value === "object" &&
		value !== null &&
		"content" in value &&
		Array.isArray((value as { content: unknown }).content)
	);
}

/**
 * Create a standardized success response
 */
export function successResult(data: unknown, message?: string): CallToolResult {
	const content = message
		? [
				{ type: "text" as const, text: message },
				{ type: "text" as const, text: JSON.stringify(data, null, 2) },
			]
		: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }];

	return { content };
}

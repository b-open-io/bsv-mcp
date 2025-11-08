import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

/**
 * Format an error message consistently
 */
export function formatError(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}
	return String(error);
}

/**
 * Create a standardized error response for MCP tools
 */
export function createErrorResponse(error: unknown): CallToolResult {
	return {
		content: [
			{
				type: "text",
				text: formatError(error),
			},
		],
		isError: true,
	};
}

/**
 * Create a standardized success response for MCP tools
 */
export function createSuccessResponse(data: unknown): CallToolResult {
	const text = typeof data === "string" ? data : JSON.stringify(data, null, 2);
	return {
		content: [
			{
				type: "text",
				text,
			},
		],
		isError: false,
	};
}

/**
 * Create a response based on a result object with success field
 */
export function createResponse(result: {
	success: boolean;
	[key: string]: unknown;
}): CallToolResult {
	return {
		content: [
			{
				type: "text",
				text: JSON.stringify(result, null, 2),
			},
		],
		isError: !result.success,
	};
}

/**
 * Wrap an async function with standard error handling
 */
export function withErrorHandler<
	T extends (...args: unknown[]) => Promise<unknown>,
>(fn: T): (...args: Parameters<T>) => Promise<CallToolResult> {
	return async (...args: Parameters<T>): Promise<CallToolResult> => {
		try {
			const result = await fn(...args);
			return createSuccessResponse(result);
		} catch (error) {
			return createErrorResponse(error);
		}
	};
}

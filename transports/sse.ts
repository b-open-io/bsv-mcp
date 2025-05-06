import { randomUUID } from "node:crypto";
import {
	type JSONRPCMessage,
	JSONRPCMessageSchema,
	type JSONRPCNotification,
	type JSONRPCRequest,
	type JSONRPCResponse,
} from "@modelcontextprotocol/sdk/types.js";

/**
 * Server transport for SSE using Bun's Response type.
 * Adapts the SSEServerTransport functionality to work with Bun.
 */
export class BunSSEServerTransport {
	private _sessionId: string;
	private _sseResponse?: Response;
	private _responseObj?: Response;
	private _writer?: WritableStreamDefaultWriter<Uint8Array>;
	private _keepAliveIntervalId?: number;
	// How often to send keep-alive comments (milliseconds)
	private readonly _keepAliveMs = 5_000; // 5 seconds, less than server idleTimeout
	onmessage?: (message: JSONRPCMessage, extra?: { authInfo?: unknown }) => void;
	onclose?: () => void;
	onerror?: (error: Error | unknown) => void;

	/**
	 * Creates a new SSE server transport for Bun.
	 * @param _endpoint The endpoint where clients should POST messages
	 */
	constructor(private _endpoint: string) {
		this._sessionId = randomUUID();
	}

	/**
	 * Creates a Response object suitable for Bun.serve to return.
	 * This method should be called to get the Response for the initial SSE request.
	 */
	createResponse(): Promise<Response> {
		if (this._responseObj) {
			return Promise.resolve(this._responseObj);
		}

		// Create a readable stream that we'll write SSE events to
		const { readable, writable } = new TransformStream();
		this._writer = writable.getWriter();

		// Write the initial headers
		const encoder = new TextEncoder();
		this._writer.write(
			encoder.encode(
				`event: endpoint\ndata: ${encodeURI(this._endpoint)}?sessionId=${
					this._sessionId
				}\n\n`,
			),
		);

		// Create the response
		this._responseObj = new Response(readable, {
			headers: {
				"Content-Type": "text/event-stream",
				"Cache-Control": "no-cache, no-transform",
				Connection: "keep-alive",
			},
		});

		// Start periodic keep-alive comments so proxies / Bun itself don't close idle connections.
		this._startKeepAlive();

		return Promise.resolve(this._responseObj);
	}

	/**
	 * Start the SSE connection - required by McpServer
	 * Note: Does not return a Response, unlike createResponse
	 */
	async start(): Promise<void> {
		if (!this._responseObj) {
			await this.createResponse();
		}
		this._sseResponse = this._responseObj;
	}

	/**
	 * Handles incoming POST messages.
	 */
	async handlePostMessage(req: Request): Promise<Response> {
		if (!this._sseResponse) {
			const message = "SSE connection not established";
			return new Response(message, { status: 500 });
		}

		try {
			const contentTypeHeader = req.headers.get("content-type");
			if (
				!contentTypeHeader ||
				!contentTypeHeader.includes("application/json")
			) {
				throw new Error(`Unsupported content-type: ${contentTypeHeader}`);
			}

			const body: unknown = await req.json();

			// Ensure body is an object before passing
			if (typeof body !== "object" || body === null) {
				throw new Error(
					"Invalid JSON message received: body is not an object.",
				);
			}

			// Now body is known to be a non-null object, cast is safe if needed,
			// but handleMessage already expects Record<string, unknown>
			await this.handleMessage(body as Record<string, unknown>);

			return new Response("Accepted", { status: 202 });
		} catch (error) {
			this.onerror?.(error);
			// Ensure error is stringified for the Response body
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			return new Response(errorMessage, { status: 400 });
		}
	}

	/**
	 * Handle a client message, regardless of how it arrived.
	 */
	async handleMessage(message: Record<string, unknown>) {
		try {
			const parseResult = JSONRPCMessageSchema.safeParse(message);
			if (parseResult.success) {
				this.onmessage?.(parseResult.data, undefined);
			} else {
				throw new Error(
					`Invalid JSON-RPC message: ${parseResult.error.message}`,
				);
			}
		} catch (error) {
			this.onerror?.(error);
			throw error;
		}
	}

	/**
	 * Close the SSE connection.
	 */
	async close() {
		if (this._keepAliveIntervalId !== undefined) {
			clearInterval(this._keepAliveIntervalId);
			this._keepAliveIntervalId = undefined;
		}
		if (this._writer && typeof this._writer.close === "function") {
			await this._writer.close();
			this._writer = undefined;
		}
		this._sseResponse = undefined;
		this._responseObj = undefined;
		this.onclose?.();
	}

	/**
	 * Send a message over the SSE connection.
	 */
	async send(message: JSONRPCResponse | JSONRPCNotification) {
		if (!this._writer) {
			throw new Error("Not connected");
		}

		const encoder = new TextEncoder();
		this._writer.write(
			encoder.encode(`event: message\ndata: ${JSON.stringify(message)}\n\n`),
		);
	}

	/**
	 * Returns the session ID for this transport.
	 */
	get sessionId(): string {
		return this._sessionId;
	}

	/**
	 * Starts a periodic keep-alive that writes an SSE comment every _keepAliveMs.
	 */
	private _startKeepAlive() {
		// Ensure any existing interval is cleared first
		if (this._keepAliveIntervalId !== undefined) {
			clearInterval(this._keepAliveIntervalId);
		}

		// Bun's setInterval returns a number (Node & Web compatibility layer)
		this._keepAliveIntervalId = setInterval(() => {
			if (!this._writer) return;
			try {
				const encoder = new TextEncoder();
				// Lightweight comment-only SSE frame to keep connection alive
				this._writer.write(encoder.encode(":\n\n"));
			} catch {
				// Ignore — connection might be closing
			}
		}, this._keepAliveMs) as unknown as number;
	}
}

export default BunSSEServerTransport;

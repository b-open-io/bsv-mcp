import type * as schema from "../schema.ts";
import { A2AError } from "./error.ts";
// Import TaskHandler and the original TaskContext to derive the new one
import type { TaskContext as OldTaskContext, TaskHandler } from "./handler.ts";
// Import TaskAndHistory along with TaskStore implementations
import {
	InMemoryTaskStore,
	type TaskAndHistory,
	type TaskStore,
} from "./store.ts";
import {
	getCurrentTimestamp,
	isArtifactUpdate,
	isTaskStatusUpdate,
} from "./utils.ts";

/**
 * Options for configuring the A2AServer.
 */
export interface A2AServerOptions {
	/** Task storage implementation. Defaults to InMemoryTaskStore. */
	taskStore?: TaskStore;
	/** CORS configuration. Defaults to allowing all origins. */
	cors?: boolean | {
		origin?: string | string[] | boolean;
		methods?: string[];
		headers?: string[];
		maxAge?: number;
	};
	/** Base path for the A2A endpoint. Defaults to '/'. */
	basePath?: string;
	/** Agent Card for the agent being served. */
	card?: schema.AgentCard;
	/** Port to listen on. Defaults to 41241. */
	port?: number;
	/** Hostname to bind to. Defaults to 0.0.0.0. */
	hostname?: string;
	/** Enable development mode. Defaults to false. */
	development?: boolean;
}

// Define new TaskContext without the store, based on the original from handler.ts
export interface TaskContext extends Omit<OldTaskContext, "taskStore"> {}

/**
 * Implements an A2A specification compliant server using Bun's built-in HTTP server.
 */
export class A2AServer {
	private taskHandler: TaskHandler;
	private taskStore: TaskStore;
	private corsOptions: A2AServerOptions["cors"];
	private basePath: string;
	private server: ReturnType<typeof Bun.serve> | null = null;
	// Track active cancellations
	private activeCancellations: Set<string> = new Set();
	card: schema.AgentCard = {} as schema.AgentCard; // Initialize with empty object

	// Helper to apply updates (status or artifact) immutably
	private applyUpdateToTaskAndHistory(
		current: TaskAndHistory,
		update: Omit<schema.TaskStatus, "timestamp"> | schema.Artifact,
	): TaskAndHistory {
		const newTask = { ...current.task }; // Shallow copy task
		const newHistory = [...current.history]; // Shallow copy history

		if (isTaskStatusUpdate(update)) {
			// Merge status update
			newTask.status = {
				...newTask.status, // Keep existing properties if not overwritten
				...update, // Apply updates
				timestamp: getCurrentTimestamp(), // Always update timestamp
			};
			// If the update includes an agent message, add it to history
			if (update.message?.role === "agent") {
				newHistory.push(update.message);
			}
		} else if (isArtifactUpdate(update)) {
			// Handle artifact update
			if (!newTask.artifacts) {
				newTask.artifacts = [];
			} else {
				// Ensure we're working with a copy of the artifacts array
				newTask.artifacts = [...newTask.artifacts];
			}

			const existingIndex = update.index ?? -1; // Use index if provided
			let replaced = false;

			if (existingIndex >= 0 && existingIndex < newTask.artifacts.length) {
				const existingArtifact = newTask.artifacts[existingIndex];
				if (update.append) {
					// Create a deep copy for modification to avoid mutating original
					const appendedArtifact = JSON.parse(JSON.stringify(existingArtifact));
					appendedArtifact.parts.push(...update.parts);
					if (update.metadata) {
						appendedArtifact.metadata = {
							...(appendedArtifact.metadata || {}),
							...update.metadata,
						};
					}
					if (update.lastChunk !== undefined)
						appendedArtifact.lastChunk = update.lastChunk;
					if (update.description)
						appendedArtifact.description = update.description;
					newTask.artifacts[existingIndex] = appendedArtifact; // Replace with appended version
					replaced = true;
				} else {
					// Overwrite artifact at index (with a copy of the update)
					newTask.artifacts[existingIndex] = { ...update };
					replaced = true;
				}
			} else if (update.name) {
				const namedIndex = newTask.artifacts.findIndex(
					(a) => a.name === update.name,
				);
				if (namedIndex >= 0) {
					newTask.artifacts[namedIndex] = { ...update }; // Replace by name (with copy)
					replaced = true;
				}
			}

			if (!replaced) {
				newTask.artifacts.push({ ...update }); // Add as a new artifact (copy)
				// Sort if indices are present
				if (newTask.artifacts.some((a) => a.index !== undefined)) {
					newTask.artifacts.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
				}
			}
		}

		return { task: newTask, history: newHistory };
	}

	constructor(handler: TaskHandler, options: A2AServerOptions = {}) {
		this.taskHandler = handler;
		this.taskStore = options.taskStore ?? new InMemoryTaskStore();
		this.corsOptions = options.cors ?? true; // Default to allow all
		this.basePath = options.basePath ?? "/";
		if (options.card) this.card = options.card;
		// Ensure base path starts and ends with a slash if it's not just "/"
		if (this.basePath !== "/") {
			this.basePath = `/${this.basePath.replace(/^\/|\/$/g, "")}/`;
		}
	}

	/**
	 * Starts the Bun server listening on the specified port.
	 * @param port Port number to listen on. Defaults to 41241.
	 * @param hostname Hostname to bind to. Defaults to 0.0.0.0.
	 * @returns The running Bun Server instance.
	 */
	start(port = 41241, hostname = "0.0.0.0"): ReturnType<typeof Bun.serve> {
		// Set up the server
		this.server = Bun.serve({
			port,
			hostname,
			development: false, // Default to production mode

			// Handle all HTTP requests through this function
			fetch: async (request: Request) => {
				const url = new URL(request.url);
				const pathname = url.pathname;
				
				// Serve the agent.json file
				if (pathname === "/.well-known/agent.json") {
					return Response.json(this.card);
				}

				// Only handle requests to the base path
				if (!pathname.startsWith(this.basePath)) {
					return new Response("Not Found", { status: 404 });
				}

				// Handle CORS preflight requests
				if (request.method === "OPTIONS") {
					return this.handleCorsPreflightRequest(request);
				}

				// Determine if this is a valid A2A endpoint request
				if (pathname === this.basePath || pathname === this.basePath.slice(0, -1)) {
					try {
						const requestBody = await request.json();
						// Apply CORS headers
						const headers = this.getCorsHeaders(request);
						
						// Process the A2A request
						const response = await this.handleA2ARequest(requestBody, request);
						
						// Ensure we clone the response to add CORS headers
						return new Response(JSON.stringify(response), {
							status: 200,
							headers: {
								"Content-Type": "application/json",
								...headers,
							}
						});
					} catch (error) {
						// Handle JSON parsing errors or other exceptions
						const normalizedError = this.normalizeError(error, null);
						return new Response(JSON.stringify(normalizedError), {
							status: 200, // JSON-RPC uses 200 OK for error responses
							headers: {
								"Content-Type": "application/json",
								...this.getCorsHeaders(request)
							}
						});
					}
				}

				// For any other paths, return 404
				return new Response("Not Found", { 
					status: 404,
					headers: this.getCorsHeaders(request)
				});
			},

			// Handle server errors
			error: (error) => {
				console.error("Server error:", error);
				return new Response(`Internal Server Error: ${error.message}`, {
					status: 500
				});
			}
		});

		console.log(
			`A2A Server listening on ${this.server.hostname}:${this.server.port} at path ${this.basePath}`,
		);

		return this.server;
	}

	/**
	 * Handle CORS preflight requests
	 */
	private handleCorsPreflightRequest(request: Request): Response {
		const headers = this.getCorsHeaders(request);
		return new Response(null, {
			status: 204,
			headers
		});
	}

	/**
	 * Get CORS headers based on configuration
	 */
	private getCorsHeaders(request: Request): Record<string, string> {
		const headers: Record<string, string> = {};
		const origin = request.headers.get("Origin");

		if (this.corsOptions === false) {
			return headers;
		}

		if (this.corsOptions === true) {
			// Allow all origins
			if (origin) {
				headers["Access-Control-Allow-Origin"] = origin;
			} else {
				headers["Access-Control-Allow-Origin"] = "*";
			}
			headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS";
			headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization";
			headers["Access-Control-Max-Age"] = "86400"; // 24 hours
		} else if (typeof this.corsOptions === 'object') {
			// Custom CORS configuration
			if (typeof this.corsOptions.origin === "boolean") {
				if (this.corsOptions.origin && origin) {
					headers["Access-Control-Allow-Origin"] = origin;
				}
			} else if (typeof this.corsOptions.origin === "string") {
				headers["Access-Control-Allow-Origin"] = this.corsOptions.origin;
			} else if (Array.isArray(this.corsOptions.origin) && origin) {
				if (this.corsOptions.origin.includes(origin)) {
					headers["Access-Control-Allow-Origin"] = origin;
				}
			}

			if (this.corsOptions.methods?.length) {
				headers["Access-Control-Allow-Methods"] = this.corsOptions.methods.join(", ");
			} else {
				headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS";
			}

			if (this.corsOptions.headers?.length) {
				headers["Access-Control-Allow-Headers"] = this.corsOptions.headers.join(", ");
			} else {
				headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization";
			}

			if (this.corsOptions.maxAge) {
				headers["Access-Control-Max-Age"] = this.corsOptions.maxAge.toString();
			} else {
				headers["Access-Control-Max-Age"] = "86400"; // 24 hours
			}
		}

		return headers;
	}

	/**
	 * Process A2A JSON-RPC requests
	 */
	private async handleA2ARequest(requestBody: unknown, request: Request): Promise<schema.JSONRPCResponse<unknown, unknown>> {
		let taskId: string | undefined; // For error context

		try {
			// 1. Validate basic JSON-RPC structure
			if (!this.isValidJsonRpcRequest(requestBody)) {
				throw A2AError.invalidRequest("Invalid JSON-RPC request structure.");
			}
			// Attempt to get task ID early for error context
			const params = (requestBody as schema.JSONRPCRequest).params;
			taskId = params && typeof params === 'object' ? (params as { id?: string }).id : undefined;

			// 2. Route based on method
			switch ((requestBody as schema.JSONRPCRequest).method) {
				case "tasks/send":
					return await this.handleTaskSend(requestBody as schema.SendTaskRequest);
				case "tasks/sendSubscribe":
					// SSE responses need special handling
					throw A2AError.methodNotFound(
						"tasks/sendSubscribe is not implemented in this server version."
					);
				case "tasks/get":
					return await this.handleTaskGet(requestBody as schema.GetTaskRequest);
				case "tasks/cancel":
					return await this.handleTaskCancel(requestBody as schema.CancelTaskRequest);
				// Add other methods like tasks/pushNotification/*, tasks/resubscribe later if needed
				default:
					throw A2AError.methodNotFound((requestBody as schema.JSONRPCRequest).method);
			}
		} catch (error) {
			// Handle errors and convert to JSON-RPC error responses
			if (error instanceof A2AError && taskId && !error.taskId) {
				error.taskId = taskId; // Add task ID context if missing
			}
			const reqId = (requestBody && typeof requestBody === 'object' && 'id' in requestBody) ? 
				((requestBody as schema.JSONRPCRequest).id ?? null) : null;
			return this.normalizeError(error, reqId);
		}
	}

	/**
	 * Handle tasks/send requests
	 */
	private async handleTaskSend(req: schema.SendTaskRequest): Promise<schema.JSONRPCResponse<schema.Task, unknown>> {
		this.validateTaskSendParams(req.params);
		const { id: taskId, message, sessionId, metadata } = req.params;

		// Load or create task AND history
		return this.loadOrCreateTaskAndHistory(
			taskId,
			message,
			sessionId,
			metadata,
		).then(async (currentData) => {
			// Use the new TaskContext definition, passing history
			const context = this.createTaskContext(
				currentData.task,
				message,
				currentData.history,
			);
			const generator = this.taskHandler(context);

			// Process generator yields
			try {
				let updatedData = currentData; // Use a new variable instead of reassigning parameter
				for await (const yieldValue of generator) {
					// Apply update immutably
					updatedData = this.applyUpdateToTaskAndHistory(updatedData, yieldValue);
					// Save the updated state
					await this.taskStore.save(updatedData);
					// Update context snapshot for next iteration
					context.task = updatedData.task;
				}

				// The loop finished, return the final task state
				return this.createSuccessResponse(req.id ?? null, updatedData.task);
			} catch (handlerError) {
				// If handler throws, apply 'failed' status, save, and rethrow
				const failureStatusUpdate: Omit<schema.TaskStatus, "timestamp"> = {
					state: "failed",
					message: {
						role: "agent",
						parts: [
							{
								type: "text",
								text: `Handler failed: ${
									handlerError instanceof Error
										? handlerError.message
										: String(handlerError)
								}`,
							},
						],
					},
				};
				const failedData = this.applyUpdateToTaskAndHistory(
					currentData,
					failureStatusUpdate,
				);
				try {
					await this.taskStore.save(failedData);
				} catch (saveError) {
					console.error(
						`Failed to save task ${taskId} after handler error:`,
						saveError,
					);
					// Still throw the original handler error
				}
				throw handlerError; // Rethrow original error
			}
		});
	}

	/**
	 * Handle tasks/get requests
	 */
	private async handleTaskGet(req: schema.GetTaskRequest): Promise<schema.JSONRPCResponse<schema.Task, unknown>> {
		this.validateTaskGetParams(req.params);
		const { id: taskId } = req.params;

		try {
			const data = await this.taskStore.load(taskId);
			if (!data || !data.task) {
				throw A2AError.taskNotFound(taskId);
			}
			return this.createSuccessResponse(req.id ?? null, data.task);
		} catch (error) {
			if (error instanceof A2AError) {
				throw error; // Rethrow A2A errors
			}
			// Ensure other errors are also properly contextualized
			throw A2AError.internalError(
				`Failed to retrieve task: ${
					error instanceof Error ? error.message : String(error)
				}`,
				taskId,
			);
		}
	}

	/**
	 * Handle tasks/cancel requests
	 */
	private async handleTaskCancel(req: schema.CancelTaskRequest): Promise<schema.JSONRPCResponse<schema.Task, unknown>> {
		this.validateTaskCancelParams(req.params);
		const { id: taskId } = req.params;

		try {
			// Load existing task
			const data = await this.taskStore.load(taskId);
			if (!data || !data.task) {
				throw A2AError.taskNotFound(taskId);
			}

			// If task is already in terminal state, don't modify it
			if (this.isTerminalState(data.task.status.state)) {
				return this.createSuccessResponse(req.id ?? null, data.task);
			}

			// Apply cancel update
			const cancelUpdate: Omit<schema.TaskStatus, "timestamp"> = {
				state: "canceled", // Changed from 'cancelled' to 'canceled' to match the schema
				message: data.task.status.message || {
					role: "agent",
					parts: [{ type: "text", text: "Task canceled" }],
				},
			};

			const updatedData = this.applyUpdateToTaskAndHistory(data, cancelUpdate);
			await this.taskStore.save(updatedData);

			return this.createSuccessResponse(req.id ?? null, updatedData.task);
		} catch (error) {
			if (error instanceof A2AError) {
				throw error; // Rethrow A2A errors
			}
			// Ensure other errors are also properly contextualized
			throw A2AError.internalError(
				`Failed to cancel task: ${
					error instanceof Error ? error.message : String(error)
				}`,
				taskId,
			);
		}
	}

	// --- Helper Methods ---

	// Renamed and updated to handle both task and history
	private async loadOrCreateTaskAndHistory(
		taskId: string,
		initialMessage: schema.Message,
		sessionId?: string | null, // Allow null
		metadata?: Record<string, unknown> | null, // Allow null
	): Promise<TaskAndHistory> {
		let data = await this.taskStore.load(taskId);
		let needsSave = false;

		if (!data) {
			// Create new task and history
			const initialTask: schema.Task = {
				id: taskId,
				sessionId: sessionId ?? undefined, // Store undefined if null
				status: {
					state: "submitted", // Start as submitted
					timestamp: getCurrentTimestamp(),
					message: null, // Initial user message goes only to history for now
				},
				artifacts: [],
				metadata: metadata ?? undefined, // Store undefined if null
			};
			const initialHistory: schema.Message[] = [initialMessage]; // History starts with user message
			data = { task: initialTask, history: initialHistory };
			needsSave = true; // Mark for saving
			console.log(`[Task ${taskId}] Created new task and history.`);
		} else {
			console.log(`[Task ${taskId}] Loaded existing task and history.`);
			// Add current user message to history
			// Make a copy before potentially modifying
			data = { task: data.task, history: [...data.history, initialMessage] };
			needsSave = true; // History updated, mark for saving

			// Handle state transitions for existing tasks
			const finalStates: schema.TaskState[] = [
				"completed",
				"failed",
				"canceled",
			];
			if (finalStates.includes(data.task.status.state)) {
				console.warn(
					`[Task ${taskId}] Received message for task already in final state ${data.task.status.state}. Handling as new submission (keeping history).`,
				);
				// Option 1: Reset state to 'submitted' (keeps history, effectively restarts)
				const resetUpdate: Omit<schema.TaskStatus, "timestamp"> = {
					state: "submitted",
					message: null, // Clear old agent message
				};
				data = this.applyUpdateToTaskAndHistory(data, resetUpdate);
				// needsSave is already true

				// Option 2: Throw error (stricter)
				// throw A2AError.invalidRequest(`Task ${taskId} is already in a final state.`);
			} else if (data.task.status.state === "input-required") {
				console.log(
					`[Task ${taskId}] Received message while 'input-required', changing state to 'working'.`,
				);
				// If it was waiting for input, update state to 'working'
				const workingUpdate: Omit<schema.TaskStatus, "timestamp"> = {
					state: "working",
				};
				data = this.applyUpdateToTaskAndHistory(data, workingUpdate);
				// needsSave is already true
			} else if (data.task.status.state === "working") {
				// If already working, maybe warn but allow? Or force back to submitted?
				console.warn(
					`[Task ${taskId}] Received message while already 'working'. Proceeding.`,
				);
				// No state change needed, but history was updated, so needsSave is true.
			}
			// If 'submitted', receiving another message might be odd, but proceed.
		}

		// Save if created or modified before returning
		if (needsSave) {
			await this.taskStore.save(data);
		}

		// Return copies to prevent mutation by caller before handler runs
		return { task: { ...data.task }, history: [...data.history] };
	}

	// Update context creator to accept and include history
	private createTaskContext(
		task: schema.Task,
		userMessage: schema.Message,
		history: schema.Message[], // Add history parameter
	): TaskContext {
		return {
			task: { ...task }, // Pass a copy
			userMessage: userMessage,
			history: [...history], // Pass a copy of the history
			isCancelled: () => this.activeCancellations.has(task.id),
			// taskStore is removed
		};
	}

	private isValidJsonRpcRequest(body: unknown): body is schema.JSONRPCRequest {
		return (
			typeof body === "object" &&
			body !== null &&
			(body as schema.JSONRPCRequest).jsonrpc === "2.0" &&
			typeof (body as schema.JSONRPCRequest).method === "string" &&
			((body as schema.JSONRPCRequest).id === null ||
				typeof (body as schema.JSONRPCRequest).id === "string" ||
				typeof (body as schema.JSONRPCRequest).id === "number") && // ID is required for requests needing response
			((body as schema.JSONRPCRequest).params === undefined ||
				typeof (body as schema.JSONRPCRequest).params === "object" || // Allows null, array, or object
				Array.isArray((body as schema.JSONRPCRequest).params))
		);
	}

	private validateTaskSendParams(
		params: unknown,
	): asserts params is schema.TaskSendParams {
		if (!params || typeof params !== "object") {
			throw A2AError.invalidParams("Missing or invalid params object.");
		}
		
		const typedParams = params as Partial<schema.TaskSendParams>;
		
		if (typeof typedParams.id !== "string" || typedParams.id === "") {
			throw A2AError.invalidParams("Invalid or missing task ID (params.id).");
		}
		
		if (
			!typedParams.message ||
			typeof typedParams.message !== "object" ||
			!Array.isArray(typedParams.message.parts)
		) {
			throw A2AError.invalidParams(
				"Invalid or missing message object (params.message).",
			);
		}
		// Add more checks for message structure, sessionID, metadata, etc. if needed
	}

	private validateTaskGetParams(
		params: unknown,
	): asserts params is schema.TaskQueryParams {
		if (!params || typeof params !== "object") {
			throw A2AError.invalidParams("Missing or invalid params object.");
		}
		
		const typedParams = params as Partial<schema.TaskQueryParams>;
		
		if (typeof typedParams.id !== "string" || typedParams.id === "") {
			throw A2AError.invalidParams("Invalid or missing task ID (params.id).");
		}
	}

	private validateTaskCancelParams(
		params: unknown,
	): asserts params is schema.TaskIdParams {
		if (!params || typeof params !== "object") {
			throw A2AError.invalidParams("Missing or invalid params object.");
		}
		
		const typedParams = params as Partial<schema.TaskIdParams>;
		
		if (typeof typedParams.id !== "string" || typedParams.id === "") {
			throw A2AError.invalidParams("Invalid or missing task ID (params.id).");
		}
	}

	// Helper to check if task state is terminal
	private isTerminalState(state: schema.TaskState): boolean {
		return ['completed', 'failed', 'canceled'].includes(state);
	}

	// --- Response Formatting ---

	private createSuccessResponse<T>(
		id: number | string | null,
		result: T,
	): schema.JSONRPCResponse<T, unknown> {
		if (id === null) {
			// This shouldn't happen for methods that expect a response, but safeguard
			throw A2AError.internalError(
				"Cannot create success response for null ID.",
			);
		}
		return {
			jsonrpc: "2.0",
			id: id,
			result: result,
		};
	}

	private createErrorResponse(
		id: number | string | null,
		error: schema.JSONRPCError<unknown>,
	): schema.JSONRPCResponse<null, unknown> {
		// For errors, ID should be the same as request ID, or null if that couldn't be determined
		return {
			jsonrpc: "2.0",
			id: id, // Can be null if request ID was invalid/missing
			error: error,
		};
	}

	/** Normalizes various error types into a JSONRPCResponse containing an error */
	private normalizeError(
		error: unknown,
		reqId: number | string | null,
		taskId?: string,
	): schema.JSONRPCResponse<null, unknown> {
		let a2aError: A2AError;
		if (error instanceof A2AError) {
			a2aError = error;
		} else if (error instanceof Error) {
			// Generic JS error
			a2aError = A2AError.internalError(error.message, { stack: error.stack });
		} else {
			// Unknown error type
			a2aError = A2AError.internalError("An unknown error occurred.", error);
		}

		// Ensure Task ID context is present if possible
		if (taskId && !a2aError.taskId) {
			a2aError.taskId = taskId;
		}

		console.error(
			`Error processing request (Task: ${a2aError.taskId ?? "N/A"}, ReqID: ${
				reqId ?? "N/A"
			}):`,
			a2aError,
		);

		return this.createErrorResponse(reqId, a2aError.toJSONRPCError());
	}

	/**
	 * Stop the server from accepting new connections.
	 * @returns A promise that resolves when the server has stopped.
	 */
	async stop(): Promise<void> {
		if (this.server) {
			return this.server.stop();
		}
	}
}

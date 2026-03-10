"use client";

import { useCallback, useReducer, useRef } from "react";

export type KeySource = "new" | "imported";

export interface KeyState {
	wif: string;
	source: KeySource;
	loading: boolean;
	error: string;
	// Backup decryption
	pendingFileContent: string;
	showPasswordPrompt: boolean;
	backupPassword: string;
	// Session
	sessionToken: string;
	mcpUrl: string;
	// Clipboard
	copied: string;
}

type KeyAction =
	| { type: "SET_WIF"; wif: string; source: KeySource }
	| { type: "SET_LOADING"; loading: boolean }
	| { type: "SET_ERROR"; error: string }
	| { type: "CLEAR_ERROR" }
	| { type: "NEED_PASSWORD"; fileContent: string }
	| { type: "SET_BACKUP_PASSWORD"; password: string }
	| { type: "CLEAR_PASSWORD_PROMPT" }
	| { type: "SET_SESSION"; sessionToken: string; mcpUrl: string }
	| { type: "SET_COPIED"; id: string }
	| { type: "CLEAR_COPIED" };

const initialState: KeyState = {
	wif: "",
	source: "new",
	loading: false,
	error: "",
	pendingFileContent: "",
	showPasswordPrompt: false,
	backupPassword: "",
	sessionToken: "",
	mcpUrl: "",
	copied: "",
};

function keyReducer(state: KeyState, action: KeyAction): KeyState {
	switch (action.type) {
		case "SET_WIF":
			return {
				...state,
				wif: action.wif,
				source: action.source,
				error: "",
				showPasswordPrompt: false,
				backupPassword: "",
			};
		case "SET_LOADING":
			return { ...state, loading: action.loading };
		case "SET_ERROR":
			return { ...state, error: action.error, loading: false };
		case "CLEAR_ERROR":
			return { ...state, error: "" };
		case "NEED_PASSWORD":
			return {
				...state,
				pendingFileContent: action.fileContent,
				showPasswordPrompt: true,
				error: "",
			};
		case "SET_BACKUP_PASSWORD":
			return { ...state, backupPassword: action.password };
		case "CLEAR_PASSWORD_PROMPT":
			return {
				...state,
				showPasswordPrompt: false,
				backupPassword: "",
				pendingFileContent: "",
			};
		case "SET_SESSION":
			return {
				...state,
				sessionToken: action.sessionToken,
				mcpUrl: action.mcpUrl,
			};
		case "SET_COPIED":
			return { ...state, copied: action.id };
		case "CLEAR_COPIED":
			return { ...state, copied: "" };
		default:
			return state;
	}
}

async function deriveWifFromBackup(
	backup: Record<string, unknown>,
): Promise<string> {
	if ("wif" in backup && typeof backup.wif === "string" && backup.wif) {
		return backup.wif;
	}
	if (
		"derivedPrivateKey" in backup &&
		typeof backup.derivedPrivateKey === "string"
	) {
		return backup.derivedPrivateKey;
	}
	if (
		"ordPk" in backup &&
		"payPk" in backup &&
		typeof backup.payPk === "string"
	) {
		return backup.payPk;
	}
	if (
		"xprv" in backup &&
		"mnemonic" in backup &&
		typeof backup.xprv === "string"
	) {
		const { HD, PrivateKey } = await import("@bsv/sdk");
		const hdKey = HD.fromString(backup.xprv);
		const childKey = hdKey.deriveChild(0).deriveChild(0);
		const privKey = new PrivateKey(childKey.privKey);
		return privKey.toWif();
	}
	throw new Error("Invalid backup format — no usable private key found");
}

export function useKeyState() {
	const [state, dispatch] = useReducer(keyReducer, initialState);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const generateNewKey = useCallback(async () => {
		dispatch({ type: "SET_LOADING", loading: true });
		try {
			const { PrivateKey } = await import("@bsv/sdk");
			const privateKey = PrivateKey.fromRandom();
			dispatch({ type: "SET_WIF", wif: privateKey.toWif(), source: "new" });
		} catch {
			dispatch({ type: "SET_ERROR", error: "Failed to generate new key" });
		} finally {
			dispatch({ type: "SET_LOADING", loading: false });
		}
	}, []);

	const handleFileSelect = useCallback(
		async (event: React.ChangeEvent<HTMLInputElement>) => {
			const file = event.target.files?.[0];
			if (!file) return;

			try {
				const fileContent = await file.text();

				try {
					const backup = JSON.parse(fileContent) as Record<string, unknown>;
					const wif = await deriveWifFromBackup(backup);
					dispatch({ type: "SET_WIF", wif, source: "imported" });
				} catch {
					// Not valid JSON — check if it looks like base64 (encrypted .bep)
					if (/^[A-Za-z0-9+/]+=*$/.test(fileContent.trim())) {
						dispatch({ type: "NEED_PASSWORD", fileContent });
					} else {
						dispatch({
							type: "SET_ERROR",
							error: "Invalid backup file format",
						});
					}
				}
			} catch (err) {
				dispatch({
					type: "SET_ERROR",
					error:
						err instanceof Error ? err.message : "Failed to read backup file",
				});
			}

			// Reset file input so the same file can be re-selected
			if (fileInputRef.current) fileInputRef.current.value = "";
		},
		[],
	);

	const decryptBackup = useCallback(async () => {
		if (!state.backupPassword || !state.pendingFileContent) return;

		dispatch({ type: "SET_LOADING", loading: true });
		try {
			const { decryptBackup: decrypt } = await import("bitcoin-backup");
			const backup = (await decrypt(
				state.pendingFileContent,
				state.backupPassword,
			)) as Record<string, unknown>;
			const wif = await deriveWifFromBackup(backup);
			dispatch({ type: "SET_WIF", wif, source: "imported" });
		} catch (err) {
			dispatch({
				type: "SET_ERROR",
				error:
					err instanceof Error
						? err.message
						: "Failed to decrypt backup. Check your password.",
			});
		} finally {
			dispatch({ type: "SET_LOADING", loading: false });
		}
	}, [state.backupPassword, state.pendingFileContent]);

	const authenticate = useCallback(async () => {
		if (!state.wif) return;

		dispatch({ type: "SET_LOADING", loading: true });
		dispatch({ type: "CLEAR_ERROR" });

		try {
			const { getAuthToken } = await import("bitcoin-auth");

			const authToken = getAuthToken({
				privateKeyWif: state.wif,
				requestPath: "/api/create-session",
			});

			const sessionResponse = await fetch("/api/create-session", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"X-Auth-Token": authToken,
				},
				body: JSON.stringify({ authToken }),
			});

			if (!sessionResponse.ok) {
				const body = (await sessionResponse.json().catch(() => ({}))) as {
					error?: string;
				};
				throw new Error(body.error ?? "Failed to create session");
			}

			const { sessionToken } = (await sessionResponse.json()) as {
				sessionToken: string;
			};

			dispatch({
				type: "SET_SESSION",
				sessionToken,
				mcpUrl: `${window.location.origin}/api/mcp`,
			});
		} catch (err) {
			dispatch({
				type: "SET_ERROR",
				error: err instanceof Error ? err.message : "Authentication failed",
			});
		} finally {
			dispatch({ type: "SET_LOADING", loading: false });
		}
	}, [state.wif]);

	const downloadBackup = useCallback(
		async (encrypted: boolean, encryptionPassword?: string) => {
			if (!state.wif) return;

			try {
				const backup = {
					wif: state.wif,
					label: "BSV MCP Key",
					createdAt: new Date().toISOString(),
				};

				let content: string;
				let filename: string;

				if (encrypted && encryptionPassword) {
					const { encryptBackup } = await import("bitcoin-backup");
					content = await encryptBackup(backup, encryptionPassword);
					filename = `bsv-mcp-backup-${Date.now()}.bep`;
				} else {
					content = JSON.stringify(backup, null, 2);
					filename = `bsv-mcp-backup-${Date.now()}.json`;
				}

				const blob = new Blob([content], { type: "application/json" });
				const url = URL.createObjectURL(blob);
				const a = document.createElement("a");
				a.href = url;
				a.download = filename;
				a.click();
				URL.revokeObjectURL(url);
			} catch {
				dispatch({ type: "SET_ERROR", error: "Failed to create backup" });
			}
		},
		[state.wif],
	);

	const copyToClipboard = useCallback(async (text: string, id: string) => {
		try {
			await navigator.clipboard.writeText(text);
			dispatch({ type: "SET_COPIED", id });
			setTimeout(() => dispatch({ type: "CLEAR_COPIED" }), 2000);
		} catch {
			dispatch({ type: "SET_ERROR", error: "Failed to copy to clipboard" });
		}
	}, []);

	return {
		state,
		dispatch,
		fileInputRef,
		generateNewKey,
		handleFileSelect,
		decryptBackup,
		authenticate,
		downloadBackup,
		copyToClipboard,
	};
}

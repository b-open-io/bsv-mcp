"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	Check,
	Cloud,
	Copy,
	Download,
	ExternalLink,
	Key,
	Loader2,
	Package,
	Server,
	Terminal,
	Upload,
} from "lucide-react";
import { useRef, useState } from "react";

export default function AuthPage() {
	const [wif, setWif] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [sessionToken, setSessionToken] = useState("");
	const [mcpUrl, setMcpUrl] = useState("");
	const [copied, setCopied] = useState("");
	const [isNewKey, setIsNewKey] = useState(true);
	const [backupPassword, setBackupPassword] = useState("");
	const [showPasswordSection, setShowPasswordSection] = useState(false);
	const [storedFileContent, setStoredFileContent] = useState("");
	const fileInputRef = useRef<HTMLInputElement>(null);

	const handleFileSelect = async (
		event: React.ChangeEvent<HTMLInputElement>,
	) => {
		const file = event.target.files?.[0];
		if (!file) return;

		try {
			const fileContent = await file.text();

			// Store the file content for later use
			setStoredFileContent(fileContent);

			// Try to parse as JSON first
			try {
				const backup = JSON.parse(fileContent);

				// Check all possible backup types
				if (
					("wif" in backup && backup.wif) ||
					("derivedPrivateKey" in backup && backup.derivedPrivateKey)
				) {
					// WifBackup or BapMemberBackup
					setWif(backup.wif);
					setIsNewKey(false);
					setShowPasswordSection(false);
					setBackupPassword("");
					setError("");
				} else if ("xprv" in backup && "mnemonic" in backup) {
					// BapMasterBackup - derive a child key for use
					try {
						const { HD, PrivateKey } = await import("@bsv/sdk");
						const hdKey = HD.fromString(backup.xprv);
						// Derive first payment key (0/0)
						const childKey = hdKey.deriveChild(0).deriveChild(0);
						const privKey = new PrivateKey(childKey.privKey);
						setWif(privKey.toWif());
						setIsNewKey(false);
						setShowPasswordSection(false);
						setBackupPassword("");
						setError("");
					} catch (err) {
						setError("Failed to derive key from BAP master backup");
					}
				} else if ("ordPk" in backup && "payPk" in backup) {
					// OneSatBackup - use the payment key
					setWif(backup.payPk);
					setIsNewKey(false);
					setShowPasswordSection(false);
					setBackupPassword("");
					setError("");
				} else {
					setError("Invalid backup format - no usable private key found");
				}
			} catch (parseError) {
				// If JSON parse fails, it might be encrypted (base64 string)
				// Check if it looks like base64
				if (/^[A-Za-z0-9+/]+=*$/.test(fileContent.trim())) {
					setShowPasswordSection(true);
					setError("");
				} else {
					setError("Invalid backup file format");
				}
			}
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to read backup file",
			);
		}
	};

	const handlePasswordSubmit = async (e?: React.FormEvent) => {
		e?.preventDefault();
		if (!backupPassword) return;

		try {
			// Get the stored file content
			if (!storedFileContent) {
				setError("No file content found");
				return;
			}

			// Import bitcoin-backup for decryption
			const { decryptBackup } = await import("bitcoin-backup");

			// Decrypt the backup
			const backup = await decryptBackup(storedFileContent, backupPassword);

			// Check all possible decrypted backup types
			if ("wif" in backup && backup.wif) {
				// WifBackup or BapMemberBackup
				setWif(backup.wif);
				setIsNewKey(false);
				setShowPasswordSection(false);
				setBackupPassword("");
				setError("");
			} else if ("xprv" in backup && "mnemonic" in backup) {
				// BapMasterBackup - derive a child key for use
				try {
					const { HD, PrivateKey } = await import("@bsv/sdk");
					const hdKey = HD.fromString(backup.xprv);
					// Derive first payment key (0/0)
					const childKey = hdKey.deriveChild(0).deriveChild(0);
					const privKey = new PrivateKey(childKey.privKey);
					setWif(privKey.toWif());
					setIsNewKey(false);
					setShowPasswordSection(false);
					setBackupPassword("");
					setError("");
				} catch (err) {
					setError("Failed to derive key from BAP master backup");
				}
			} else if ("ordPk" in backup && "payPk" in backup) {
				// OneSatBackup - use the payment key
				setWif(backup.payPk);
				setIsNewKey(false);
				setShowPasswordSection(false);
				setBackupPassword("");
				setError("");
			} else {
				setError("Invalid backup format - no usable private key found");
			}
		} catch (err: unknown) {
			setError(
				err instanceof Error
					? err.message
					: "Failed to decrypt backup. Check your password.",
			);
		}
	};

	const generateNewKey = async () => {
		try {
			const { PrivateKey } = await import("@bsv/sdk");
			const privateKey = PrivateKey.fromRandom();
			setWif(privateKey.toWif());
			setIsNewKey(true);
		} catch (err) {
			setError("Failed to generate new key");
		}
	};

	const downloadBackup = async (encrypted = false) => {
		if (!wif) return;

		try {
			// Create WifBackup format for bitcoin-backup
			const backup = {
				wif: wif,
				label: "BSV MCP Key",
				createdAt: new Date().toISOString(),
			};

			let content: string;
			let filename: string;

			if (encrypted && backupPassword) {
				const { encryptBackup } = await import("bitcoin-backup");
				content = await encryptBackup(backup, backupPassword);
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
		} catch (err) {
			setError("Failed to create backup");
		}
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");
		setLoading(true);

		try {
			// Import bitcoin-auth for proper token generation
			const { getAuthToken } = await import("bitcoin-auth");

			// Generate auth token using bitcoin-auth
			const authToken = getAuthToken({
				privateKeyWif: wif,
				requestPath: "/api/create-session",
			});

			// Create session with the server
			const sessionResponse = await fetch("/api/create-session", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"X-Auth-Token": authToken,
				},
				body: JSON.stringify({ authToken }),
			});

			if (!sessionResponse.ok) {
				throw new Error("Failed to create session");
			}

			const { sessionToken: newSessionToken } = await sessionResponse.json();

			setSessionToken(newSessionToken);
			setMcpUrl(`${window.location.origin}/mcp`);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Authentication failed");
		} finally {
			setLoading(false);
		}
	};

	const copyToClipboard = async (text: string, id: string) => {
		await navigator.clipboard.writeText(text);
		setCopied(id);
		setTimeout(() => setCopied(""), 2000);
	};

	// Helper functions to generate configuration strings
	const getClaudeCodeCommand = () => {
		return `claude mcp add --transport sse bsv-mcp-hosted ${mcpUrl} --header X-Session-Token="${sessionToken}"`;
	};

	const getClaudeDesktopConfig = () => {
		return `{
  "mcpServers": {
    "bsv-mcp-hosted": {
      "url": "${mcpUrl}",
      "headers": {
        "X-Session-Token": "${sessionToken}"
      }
    }
  }
}`;
	};

	const getCursorConfig = () => {
		return `{
  "mcpServers": {
    "bsv-mcp": {
      "transport": "stdio",
      "command": "bunx",
      "args": ["bsv-mcp@latest"]
    }
  }
}`;
	};

	const getDockerCommand = () => {
		return `docker run -it \\
  -e PRIVATE_KEY_WIF="YOUR_WIF_HERE" \\
  -e USE_DROPLET_API=false \\
  ghcr.io/rohenaz/bsv-mcp:latest`;
	};

	const getLocalCommand = () => {
		return "bunx bsv-mcp@latest";
	};

	return (
		<div className="min-h-screen flex items-center justify-center p-4 bg-gray-900 text-white">
			<div className="w-full max-w-lg space-y-8">
				<div className="text-center">
					<h1 className="text-4xl font-bold tracking-tight">BSV MCP</h1>
					<p className="text-gray-400 mt-2">
						Model Context Protocol for Bitcoin SV
					</p>
					<p className="text-sm text-gray-500 mt-2">
						MCP 2025-03-26 Specification
					</p>
				</div>

				<Card className="bg-gray-800 border-gray-700">
					<CardHeader>
						<CardTitle>Authenticate</CardTitle>
						<CardDescription className="text-gray-400">
							Generate a new key or import an existing backup to connect to the
							BSV MCP server.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<form onSubmit={handleSubmit} className="space-y-4">
							{/* Key Generation/Import Section */}
							<div className="space-y-4">
								<div className="flex gap-2">
									<Button
										type="button"
										variant="outline"
										onClick={generateNewKey}
										className="flex-1"
									>
										<Key className="mr-2 h-4 w-4" />
										Generate New Key
									</Button>
									<Button
										type="button"
										variant="outline"
										onClick={() => fileInputRef.current?.click()}
										className="flex-1"
									>
										<Upload className="mr-2 h-4 w-4" />
										Import Backup
									</Button>
								</div>

								<input
									ref={fileInputRef}
									type="file"
									accept=".json,.bep"
									onChange={handleFileSelect}
									className="hidden"
								/>

								{showPasswordSection && (
									<form onSubmit={handlePasswordSubmit} className="space-y-2">
										<Label htmlFor="backupPassword">Backup Password</Label>
										<Input
											id="backupPassword"
											type="password"
											value={backupPassword}
											onChange={(e) => setBackupPassword(e.target.value)}
											onKeyDown={(e) => {
												if (e.key === "Enter" && backupPassword) {
													handlePasswordSubmit();
												}
											}}
											placeholder="Enter backup password"
											className="bg-gray-700 border-gray-600"
											autoFocus
										/>
										<p className="text-xs text-gray-500">
											This backup file is encrypted. Enter your password and
											press Enter.
										</p>
									</form>
								)}

								<div className="space-y-2">
									<Label htmlFor="wif">Private Key (WIF)</Label>
									<div className="relative">
										<Input
											id="wif"
											type="password"
											value={wif}
											onChange={(e) => setWif(e.target.value)}
											placeholder="5K... or import backup above"
											required
											className="pr-10 bg-gray-700 border-gray-600"
										/>
										<Key className="absolute right-3 top-3 h-4 w-4 text-gray-400" />
									</div>
									<p className="text-xs text-gray-500">
										Your private key is only used for authentication and never
										sent to our servers.
									</p>
								</div>
							</div>

							{error && (
								<Alert variant="destructive">
									<AlertDescription>{error}</AlertDescription>
								</Alert>
							)}

							<Button
								type="submit"
								className="w-full"
								disabled={loading || !wif}
							>
								{loading ? (
									<>
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
										Creating Session...
									</>
								) : (
									"Create Session"
								)}
							</Button>
						</form>
					</CardContent>
				</Card>

				{sessionToken && (
					<>
						{/* Step 1: Download Backup (only show for new keys) */}
						{isNewKey && (
							<Card className="bg-gray-800 border-gray-700">
								<CardHeader>
									<CardTitle>Step 1: Download Your Backup</CardTitle>
									<CardDescription className="text-gray-400">
										Save your private key securely before proceeding.
									</CardDescription>
								</CardHeader>
								<CardContent className="space-y-4">
									<div className="flex gap-2">
										<Button
											variant="outline"
											onClick={() => downloadBackup(false)}
											className="flex-1"
										>
											<Download className="mr-2 h-4 w-4" />
											Download Backup
										</Button>
										<Button
											variant="outline"
											onClick={() => downloadBackup(true)}
											className="flex-1"
											disabled={!backupPassword}
										>
											<Download className="mr-2 h-4 w-4" />
											Encrypted Backup
										</Button>
									</div>

									{!backupPassword && (
										<div className="space-y-2">
											<Label htmlFor="encryptPassword">
												Encryption Password (optional)
											</Label>
											<Input
												id="encryptPassword"
												type="password"
												value={backupPassword}
												onChange={(e) => setBackupPassword(e.target.value)}
												placeholder="Enter password for encrypted backup"
												className="bg-gray-700 border-gray-600"
											/>
										</div>
									)}

									<Alert>
										<AlertDescription>
											⚠️ <strong>Important:</strong> Store your backup file
											safely. This is the only way to recover your access if you
											lose your private key.
										</AlertDescription>
									</Alert>
								</CardContent>
							</Card>
						)}

						{/* Step 2: Installation & Configuration */}
						<Card className="bg-gray-800 border-gray-700">
							<CardHeader>
								<CardTitle>
									Step {isNewKey ? "2" : "1"}: Installation & Configuration
								</CardTitle>
								<CardDescription className="text-gray-400">
									Choose your platform and deployment method
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								<Tabs defaultValue="claude" className="w-full">
									<TabsList className="grid w-full grid-cols-4 bg-gray-700">
										<TabsTrigger value="claude">Claude</TabsTrigger>
										<TabsTrigger value="cursor">Cursor</TabsTrigger>
										<TabsTrigger value="local">Local</TabsTrigger>
										<TabsTrigger value="docker">Docker</TabsTrigger>
									</TabsList>

									{/* Claude Tab */}
									<TabsContent value="claude" className="space-y-4">
										<div className="space-y-4">
											<div className="p-4 bg-gray-700/50 rounded-lg space-y-2">
												<div className="flex items-center gap-2">
													<Cloud className="h-4 w-4 text-blue-400" />
													<p className="text-sm font-medium">
														Hosted Mode (SSE Transport)
													</p>
												</div>
												<p className="text-xs text-gray-400">
													Connects to our hosted MCP server using Server-Sent
													Events. Requires session authentication.
												</p>
											</div>

											{/* Claude Code CLI Option */}
											<div className="space-y-2">
												<p className="text-sm font-medium text-gray-300">
													Claude Code CLI
												</p>
												<div className="rounded-lg bg-gray-900 p-4">
													<div className="flex justify-between items-start mb-2">
														<code className="text-xs text-gray-300 flex-1 pr-2 break-all">
															{getClaudeCodeCommand()}
														</code>
														<Button
															variant="outline"
															size="sm"
															onClick={() =>
																copyToClipboard(
																	getClaudeCodeCommand(),
																	"claude-cli",
																)
															}
															className="ml-2 px-2 py-1 shrink-0"
														>
															{copied === "claude-cli" ? (
																<Check className="h-3 w-3" />
															) : (
																<Copy className="h-3 w-3" />
															)}
														</Button>
													</div>
												</div>
											</div>

											{/* Claude Desktop JSON Option */}
											<div className="space-y-2">
												<p className="text-sm font-medium text-gray-300">
													Claude Desktop Configuration
												</p>
												<div className="rounded-lg bg-gray-900 p-4">
													<div className="flex justify-between items-start mb-2">
														<pre className="text-xs overflow-x-auto text-gray-300 flex-1 pr-2">
															<code>{getClaudeDesktopConfig()}</code>
														</pre>
														<Button
															variant="outline"
															size="sm"
															onClick={() =>
																copyToClipboard(
																	getClaudeDesktopConfig(),
																	"claude-json",
																)
															}
															className="ml-2 px-2 py-1 shrink-0"
														>
															{copied === "claude-json" ? (
																<Check className="h-3 w-3" />
															) : (
																<Copy className="h-3 w-3" />
															)}
														</Button>
													</div>
												</div>
											</div>
										</div>
									</TabsContent>

									{/* Cursor Tab */}
									<TabsContent value="cursor" className="space-y-4">
										<div className="space-y-4">
											<div className="p-4 bg-gray-700/50 rounded-lg space-y-2">
												<div className="flex items-center gap-2">
													<Terminal className="h-4 w-4 text-green-400" />
													<p className="text-sm font-medium">
														Local Mode (STDIO Transport)
													</p>
												</div>
												<p className="text-xs text-gray-400">
													Runs locally on your machine. Uses your local BSV
													keys. Prompts for passphrase on first run.
												</p>
											</div>

											<div className="space-y-2">
												<p className="text-sm font-medium text-gray-300">
													Add to ~/.cursor/mcp.json
												</p>
												<div className="rounded-lg bg-gray-900 p-4">
													<div className="flex justify-between items-start mb-2">
														<pre className="text-xs overflow-x-auto text-gray-300 flex-1 pr-2">
															<code>{getCursorConfig()}</code>
														</pre>
														<Button
															variant="outline"
															size="sm"
															onClick={() =>
																copyToClipboard(
																	getCursorConfig(),
																	"cursor-json",
																)
															}
															className="ml-2 px-2 py-1 shrink-0"
														>
															{copied === "cursor-json" ? (
																<Check className="h-3 w-3" />
															) : (
																<Copy className="h-3 w-3" />
															)}
														</Button>
													</div>
												</div>
											</div>

											<Alert className="bg-blue-900/20 border-blue-700/50">
												<AlertDescription className="text-blue-200 text-xs">
													<strong>Note:</strong> Restart Cursor after updating
													mcp.json
												</AlertDescription>
											</Alert>
										</div>
									</TabsContent>

									{/* Local Tab */}
									<TabsContent value="local" className="space-y-4">
										<div className="space-y-4">
											<div className="p-4 bg-gray-700/50 rounded-lg space-y-2">
												<div className="flex items-center gap-2">
													<Package className="h-4 w-4 text-purple-400" />
													<p className="text-sm font-medium">NPX/Bunx Mode</p>
												</div>
												<p className="text-xs text-gray-400">
													Run directly from npm/bunx without installation. Great
													for testing or one-time use.
												</p>
											</div>

											<div className="space-y-2">
												<p className="text-sm font-medium text-gray-300">
													Run with bunx (recommended)
												</p>
												<div className="rounded-lg bg-gray-900 p-4">
													<div className="flex justify-between items-start mb-2">
														<code className="text-xs text-gray-300 flex-1 pr-2">
															{getLocalCommand()}
														</code>
														<Button
															variant="outline"
															size="sm"
															onClick={() =>
																copyToClipboard(getLocalCommand(), "local-cmd")
															}
															className="ml-2 px-2 py-1 shrink-0"
														>
															{copied === "local-cmd" ? (
																<Check className="h-3 w-3" />
															) : (
																<Copy className="h-3 w-3" />
															)}
														</Button>
													</div>
												</div>
											</div>

											<div className="space-y-2">
												<p className="text-sm font-medium text-gray-300">
													Or run with npx
												</p>
												<div className="rounded-lg bg-gray-900 p-4">
													<div className="flex justify-between items-start mb-2">
														<code className="text-xs text-gray-300 flex-1 pr-2">
															npx bsv-mcp@latest
														</code>
														<Button
															variant="outline"
															size="sm"
															onClick={() =>
																copyToClipboard("npx bsv-mcp@latest", "npx-cmd")
															}
															className="ml-2 px-2 py-1 shrink-0"
														>
															{copied === "npx-cmd" ? (
																<Check className="h-3 w-3" />
															) : (
																<Copy className="h-3 w-3" />
															)}
														</Button>
													</div>
												</div>
											</div>
										</div>
									</TabsContent>

									{/* Docker Tab */}
									<TabsContent value="docker" className="space-y-4">
										<div className="space-y-4">
											<div className="p-4 bg-gray-700/50 rounded-lg space-y-2">
												<div className="flex items-center gap-2">
													<Server className="h-4 w-4 text-orange-400" />
													<p className="text-sm font-medium">Container Mode</p>
												</div>
												<p className="text-xs text-gray-400">
													Run in an isolated Docker container. Perfect for
													production deployments or CI/CD pipelines.
												</p>
											</div>

											<div className="space-y-2">
												<p className="text-sm font-medium text-gray-300">
													Docker run command
												</p>
												<div className="rounded-lg bg-gray-900 p-4">
													<div className="flex justify-between items-start mb-2">
														<code className="text-xs text-gray-300 flex-1 pr-2 whitespace-pre">
															{getDockerCommand()}
														</code>
														<Button
															variant="outline"
															size="sm"
															onClick={() =>
																copyToClipboard(
																	getDockerCommand(),
																	"docker-cmd",
																)
															}
															className="ml-2 px-2 py-1 shrink-0"
														>
															{copied === "docker-cmd" ? (
																<Check className="h-3 w-3" />
															) : (
																<Copy className="h-3 w-3" />
															)}
														</Button>
													</div>
												</div>
											</div>

											<Alert className="bg-yellow-900/20 border-yellow-700/50">
												<AlertDescription className="text-yellow-200 text-xs">
													<strong>Security:</strong> Never include your private
													key in Docker images. Always pass it as an environment
													variable.
												</AlertDescription>
											</Alert>
										</div>
									</TabsContent>
								</Tabs>

								<Alert className="bg-blue-900/20 border-blue-700/50">
									<AlertDescription className="text-blue-200 text-xs">
										<strong>Config File Locations:</strong>
										<br />• Claude Desktop: ~/Library/Application
										Support/Claude/claude_desktop_config.json (macOS)
										<br />• Cursor: ~/.cursor/mcp.json
										<br />• VS Code: ~/.vscode/mcp.json
									</AlertDescription>
								</Alert>
							</CardContent>
							<CardFooter className="flex gap-2">
								<Button variant="outline" className="flex-1" asChild>
									<a
										href="https://github.com/rohenaz/bsv-mcp"
										target="_blank"
										rel="noopener noreferrer"
									>
										<ExternalLink className="mr-2 h-4 w-4" />
										Documentation
									</a>
								</Button>
								<Button variant="outline" className="flex-1" asChild>
									<a
										href="https://docs.anthropic.com/en/docs/claude-code/tutorials#set-up-model-context-protocol-mcp"
										target="_blank"
										rel="noopener noreferrer"
									>
										<Terminal className="mr-2 h-4 w-4" />
										MCP Guide
									</a>
								</Button>
							</CardFooter>
						</Card>
					</>
				)}
			</div>
		</div>
	);
}

"use client";

import { BackupSection } from "@/components/onboarding/BackupSection";
import { ConfigTabs } from "@/components/onboarding/ConfigTabs";
import { KeySetup } from "@/components/onboarding/KeySetup";
import { useKeyState } from "@/components/onboarding/use-key-state";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

export default function OnboardingPage() {
	const {
		state,
		dispatch,
		fileInputRef,
		generateNewKey,
		handleFileSelect,
		decryptBackup,
		authenticate,
		downloadBackup,
		copyToClipboard,
	} = useKeyState();

	const isAuthenticated = !!state.sessionToken;
	const stepOffset = state.source === "new" ? 1 : 0;

	return (
		<div className="min-h-screen flex items-center justify-center p-4">
			<div className="w-full max-w-lg space-y-6">
				{/* Header */}
				<div className="text-center space-y-1">
					<h1 className="text-3xl font-bold tracking-tight">BSV MCP</h1>
					<p className="text-muted-foreground text-sm">
						Model Context Protocol for Bitcoin SV
					</p>
					<p className="text-xs text-muted-foreground/60">
						MCP 2025-03-26 Specification
					</p>
				</div>

				{/* Auth card */}
				<Card>
					<CardHeader>
						<CardTitle>Authenticate</CardTitle>
						<CardDescription>
							Generate a new Bitcoin key or import an existing backup to connect
							to the hosted MCP server.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<KeySetup
							state={state}
							dispatch={dispatch}
							fileInputRef={fileInputRef}
							onGenerate={generateNewKey}
							onFileSelect={handleFileSelect}
							onDecrypt={decryptBackup}
							onAuthenticate={authenticate}
						/>
					</CardContent>
				</Card>

				{/* Post-auth steps */}
				{isAuthenticated && (
					<>
						{/* Step 1: Backup (new keys only) */}
						{state.source === "new" && (
							<Card>
								<CardHeader>
									<CardTitle>Step 1: Download Your Backup</CardTitle>
									<CardDescription>
										Save your private key before proceeding. You cannot recover
										it without this file.
									</CardDescription>
								</CardHeader>
								<CardContent>
									<BackupSection onDownload={downloadBackup} />
								</CardContent>
							</Card>
						)}

						{/* Step 2 (or 1 for imported keys): Config */}
						<Card>
							<CardHeader>
								<CardTitle>
									Step {stepOffset + 1}: Installation &amp; Configuration
								</CardTitle>
								<CardDescription>
									Choose your platform and copy the configuration snippet.
								</CardDescription>
							</CardHeader>
							<CardContent>
								<ConfigTabs
									mcpUrl={state.mcpUrl}
									sessionToken={state.sessionToken}
									copied={state.copied}
									onCopy={copyToClipboard}
								/>
							</CardContent>
						</Card>
					</>
				)}
			</div>
		</div>
	);
}

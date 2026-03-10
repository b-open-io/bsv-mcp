"use client";

import { Key, Loader2, Upload } from "lucide-react";
import type { RefObject } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { KeyAction, KeyState } from "./use-key-state";

interface KeySetupProps {
	state: KeyState;
	dispatch: React.Dispatch<KeyAction>;
	fileInputRef: RefObject<HTMLInputElement | null>;
	onGenerate: () => Promise<void>;
	onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
	onDecrypt: () => Promise<void>;
	onAuthenticate: () => Promise<void>;
}

export function KeySetup({
	state,
	dispatch,
	fileInputRef,
	onGenerate,
	onFileSelect,
	onDecrypt,
	onAuthenticate,
}: KeySetupProps) {
	return (
		<div className="space-y-4">
			{/* Key source selection */}
			<div className="flex gap-2">
				<Button
					type="button"
					variant="outline"
					onClick={onGenerate}
					disabled={state.loading}
					className="flex-1"
				>
					{state.loading && !state.wif ? (
						<Loader2 className="h-4 w-4 animate-spin" />
					) : (
						<Key className="h-4 w-4" />
					)}
					Generate New Key
				</Button>
				<Button
					type="button"
					variant="outline"
					onClick={() => fileInputRef.current?.click()}
					className="flex-1"
				>
					<Upload className="h-4 w-4" />
					Import Backup
				</Button>
			</div>

			<input
				ref={fileInputRef}
				type="file"
				accept=".json,.bep"
				onChange={onFileSelect}
				className="hidden"
				aria-label="Import backup file"
			/>

			{/* Encrypted backup password prompt */}
			{state.showPasswordPrompt && (
				<div className="space-y-2">
					<Label htmlFor="backupPassword">Backup Password</Label>
					<div className="flex gap-2">
						<Input
							id="backupPassword"
							type="password"
							value={state.backupPassword}
							onChange={(e) =>
								dispatch({
									type: "SET_BACKUP_PASSWORD",
									password: e.target.value,
								})
							}
							onKeyDown={(e) => {
								if (e.key === "Enter" && state.backupPassword) {
									onDecrypt();
								}
							}}
							placeholder="Enter backup password"
							autoFocus
						/>
						<Button
							type="button"
							onClick={onDecrypt}
							disabled={!state.backupPassword || state.loading}
						>
							{state.loading ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								"Decrypt"
							)}
						</Button>
					</div>
					<p className="text-xs text-muted-foreground">
						This backup is encrypted. Enter your password to continue.
					</p>
				</div>
			)}

			{/* WIF key display */}
			<div className="space-y-2">
				<Label htmlFor="wif">Private Key (WIF)</Label>
				<div className="relative">
					<Input
						id="wif"
						type="password"
						value={state.wif}
						onChange={(e) =>
							dispatch({
								type: "SET_WIF",
								wif: e.target.value,
								source: "imported",
							})
						}
						placeholder="5K... or import backup above"
						className="pr-10"
					/>
					<Key className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
				</div>
				<p className="text-xs text-muted-foreground">
					Your private key is used only for local signing and is never
					transmitted to our servers.
				</p>
			</div>

			{state.error && (
				<Alert variant="destructive">
					<AlertDescription>{state.error}</AlertDescription>
				</Alert>
			)}

			<Button
				type="button"
				className="w-full"
				disabled={state.loading || !state.wif}
				onClick={onAuthenticate}
			>
				{state.loading ? (
					<>
						<Loader2 className="h-4 w-4 animate-spin" />
						Creating Session...
					</>
				) : (
					"Create Session"
				)}
			</Button>
		</div>
	);
}

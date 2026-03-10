"use client";

import { Download, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface BackupSectionProps {
	onDownload: (encrypted: boolean, password?: string) => Promise<void>;
}

export function BackupSection({ onDownload }: BackupSectionProps) {
	const [encryptionPassword, setEncryptionPassword] = useState("");

	return (
		<div className="space-y-4">
			<div className="flex gap-2">
				<Button
					type="button"
					variant="outline"
					onClick={() => onDownload(false)}
					className="flex-1"
				>
					<Download className="h-4 w-4" />
					Download Backup
				</Button>
				<Button
					type="button"
					variant="outline"
					onClick={() => onDownload(true, encryptionPassword)}
					className="flex-1"
					disabled={!encryptionPassword}
				>
					<Download className="h-4 w-4" />
					Encrypted Backup
				</Button>
			</div>

			<div className="space-y-2">
				<Label htmlFor="encryptPassword">
					Encryption Password{" "}
					<span className="text-muted-foreground font-normal">(optional)</span>
				</Label>
				<Input
					id="encryptPassword"
					type="password"
					value={encryptionPassword}
					onChange={(e) => setEncryptionPassword(e.target.value)}
					placeholder="Password for encrypted backup"
				/>
			</div>

			<Alert>
				<TriangleAlert className="h-4 w-4" />
				<AlertDescription>
					<strong>Important:</strong> Store your backup file safely. This is the
					only way to recover access if you lose your private key.
				</AlertDescription>
			</Alert>
		</div>
	);
}

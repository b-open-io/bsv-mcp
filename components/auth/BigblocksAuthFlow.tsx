"use client";

import {
	AuthFlowOrchestrator,
	type AuthFlowType,
	type AuthStep,
	useBitcoinAuth,
} from "bigblocks";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface BigblocksAuthFlowProps {
	flowType?: AuthFlowType;
	onSuccess?: () => void;
	className?: string;
}

export function BigblocksAuthFlow({
	flowType = "unified",
	onSuccess,
	className,
}: BigblocksAuthFlowProps) {
	const router = useRouter();
	const { user, isAuthenticated } = useBitcoinAuth();
	const [currentFlow, setCurrentFlow] = useState<AuthFlowType>(flowType);

	const [needsMigration, setNeedsMigration] = useState(false);

	const handleSuccess = (user: { id: string; address: string }) => {
		console.log("Auth flow completed:", user);
		if (onSuccess) {
			onSuccess();
		} else {
			router.push("/dashboard");
		}
	};

	const handleMigrationNeeded = () => {
		setNeedsMigration(true);
	};

	const handleMigrationComplete = () => {
		setNeedsMigration(false);
		// Refresh auth state after migration
		window.location.reload();
	};

	const handleError = (error: string) => {
		console.error("Auth flow error:", error);
	};

	const handleFlowChange = (flow: AuthFlowType) => {
		setCurrentFlow(flow);
	};

	const handleStepChange = (step: AuthStep) => {
		console.log("Auth step changed:", step);
	};

	// If already authenticated, redirect or show success
	if (isAuthenticated && user) {
		return (
			<div className="text-center p-8">
				<h2 className="text-2xl font-bold text-green-600 mb-4">
					Already authenticated
				</h2>
				<p className="text-gray-600 mb-6">Welcome back, {user.address}</p>
				<button
					type="button"
					onClick={() => router.push("/dashboard")}
					className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
				>
					Go to Dashboard
				</button>
			</div>
		);
	}

	return (
		<div className={className}>
			{needsMigration ? (
				<div className="space-y-4">
					<div className="text-amber-600 mb-4 p-4 bg-amber-50 rounded-lg">
						🔄 Type 42 migration available in BigBlocks v0.0.13. Please use the
						component directly for enhanced security.
					</div>
					<button
						type="button"
						onClick={() => setNeedsMigration(false)}
						className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
					>
						Continue with current setup
					</button>
				</div>
			) : (
				<AuthFlowOrchestrator
					flowType={currentFlow}
					enableOAuth={true}
					enableFileImport={true}
					enableLocalBackup={true}
					onSuccess={handleSuccess}
					onError={handleError}
					onFlowChange={handleFlowChange}
					onStepChange={handleStepChange}
					title="BSV MCP Authentication"
					subtitle="Secure access using Bitcoin signatures with Type 42 keys"
					showHeader={true}
					showFooter={true}
					layout="centered"
					autoDetectFlow={true}
					persistFlow={true}
					debug={process.env.NODE_ENV === "development"}
				/>
			)}
		</div>
	);
}

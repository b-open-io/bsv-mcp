"use client";

import { Theme } from "@radix-ui/themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	type BitcoinAuthConfig,
	BitcoinAuthProvider,
	BitcoinQueryProvider,
	BitcoinThemeProvider,
} from "bigblocks";
import "@radix-ui/themes/styles.css";

const queryClient = new QueryClient();

// Custom storage adapter for browser localStorage
const browserStorage = {
	async get(key: string): Promise<string | null> {
		if (typeof window === "undefined") return null;
		return localStorage.getItem(key);
	},
	async set(key: string, value: string): Promise<void> {
		if (typeof window === "undefined") return;
		localStorage.setItem(key, value);
	},
	async remove(key: string): Promise<void> {
		if (typeof window === "undefined") return;
		localStorage.removeItem(key);
	},
};

const authConfig: BitcoinAuthConfig = {
	apiUrl: process.env.NEXT_PUBLIC_API_URL || "/api/auth",
	storage: browserStorage,
	storageNamespace: "bsv-mcp-auth",
	oauthProviders: ["google", "github"],
	backupTypes: {
		enabled: [
			"BapMasterBackup",
			"BapMemberBackup",
			"OneSatBackup",
			"WifBackup",
		],
	},
	theme: {
		mode: "dark",
		colors: {
			primary: "#f59e0b",
			secondary: "#6b7280",
			background: "#0f1419",
			surface: "#1f2937",
			error: "#ef4444",
			warning: "#f59e0b",
			success: "#10b981",
			text: {
				primary: "#f9fafb",
				secondary: "#d1d5db",
				disabled: "#6b7280",
			},
			border: "#374151",
		},
	},
	redirects: {
		success: "/dashboard",
		error: "/auth/error",
	},
	onSuccess: (user) => {
		console.log("Auth success:", user);
	},
	onError: (error) => {
		console.error("Auth error:", error);
	},
};

interface BigblocksAuthProviderProps {
	children: React.ReactNode;
}

export function BigblocksAuthProvider({
	children,
}: BigblocksAuthProviderProps) {
	return (
		<QueryClientProvider client={queryClient}>
			<Theme
				appearance="dark"
				accentColor="amber"
				grayColor="gray"
				radius="medium"
				scaling="100%"
			>
				<BitcoinThemeProvider>
					<BitcoinQueryProvider>
						<BitcoinAuthProvider config={authConfig}>
							{children}
						</BitcoinAuthProvider>
					</BitcoinQueryProvider>
				</BitcoinThemeProvider>
			</Theme>
		</QueryClientProvider>
	);
}

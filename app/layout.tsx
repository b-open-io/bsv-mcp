import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const geistSans = Geist({
	subsets: ["latin"],
	variable: "--font-sans",
});

const geistMono = Geist_Mono({
	subsets: ["latin"],
	variable: "--font-mono",
});

export const metadata: Metadata = {
	title: "BSV MCP — Hosted Service",
	description:
		"Bitcoin SV Model Context Protocol — authenticate and generate your MCP configuration.",
};

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<html lang="en" className="dark">
			<body
				className={cn(
					"min-h-screen bg-background font-sans antialiased",
					geistSans.variable,
					geistMono.variable,
				)}
			>
				{children}
			</body>
		</html>
	);
}

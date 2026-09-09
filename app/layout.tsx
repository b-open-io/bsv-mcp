import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import type { SoftwareApplication, WithContext } from "schema-dts";
import {
	GITHUB_URL,
	getAppVersion,
	SITE_DESCRIPTION,
	SITE_NAME,
	SITE_TAGLINE,
	SITE_URL,
} from "@/lib/site";
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
	metadataBase: new URL(SITE_URL),
	title: {
		default: `${SITE_NAME} — ${SITE_TAGLINE}`,
		template: `%s · ${SITE_NAME}`,
	},
	description: SITE_DESCRIPTION,
	applicationName: SITE_NAME,
	keywords: [
		"BSV MCP",
		"Bitcoin SV MCP server",
		"Model Context Protocol",
		"MCP server",
		"Bitcoin SV",
		"1Sat Ordinals",
		"BSV wallet for AI agents",
		"Claude MCP connector",
	],
	authors: [{ name: "b-open-io", url: GITHUB_URL }],
	creator: "b-open-io",
	publisher: "b-open-io",
	alternates: {
		canonical: "/",
		types: {
			"text/markdown": `${SITE_URL}/index.md`,
		},
	},
	openGraph: {
		type: "website",
		siteName: SITE_NAME,
		title: `${SITE_NAME} — ${SITE_TAGLINE}`,
		description: SITE_DESCRIPTION,
		url: SITE_URL,
		locale: "en_US",
		images: [
			{
				url: "/social-card.png",
				width: 1200,
				height: 630,
				alt: "BSV MCP — Give your agent a wallet.",
			},
		],
	},
	twitter: {
		card: "summary_large_image",
		images: ["/social-card.png"],
		title: `${SITE_NAME} — ${SITE_TAGLINE}`,
		description: SITE_DESCRIPTION,
	},
	robots: {
		index: true,
		follow: true,
		googleBot: { index: true, follow: true, "max-snippet": -1 },
	},
};

/**
 * Structured data naming the product and its MCP endpoint, so a name-based
 * search for "BSV MCP" can resolve to this domain rather than to unrelated
 * pages about Bitcoin SV or about MCP generally.
 */
function structuredData(): WithContext<SoftwareApplication> {
	return {
		"@context": "https://schema.org",
		"@type": "SoftwareApplication",
		name: SITE_NAME,
		alternateName: "Bitcoin SV Model Context Protocol Server",
		description: SITE_DESCRIPTION,
		url: SITE_URL,
		applicationCategory: "DeveloperApplication",
		operatingSystem: "macOS, Linux, Windows",
		softwareVersion: getAppVersion(),
		license: "https://opensource.org/licenses/MIT",
		sameAs: GITHUB_URL,
		offers: {
			"@type": "Offer",
			price: "0",
			priceCurrency: "USD",
		},
		author: {
			"@type": "Organization",
			name: "b-open-io",
			url: GITHUB_URL,
		},
	};
}

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
				<script
					type="application/ld+json"
					// biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD must be inlined as a script body.
					dangerouslySetInnerHTML={{
						__html: JSON.stringify(structuredData()).replace(/</g, "\\u003c"),
					}}
				/>
				{children}
			</body>
		</html>
	);
}

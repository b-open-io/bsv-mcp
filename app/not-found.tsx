import {
	ArrowRight,
	FileText,
	Github,
	Home,
	Map as MapIcon,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { GITHUB_URL, SITE_NAME } from "@/lib/site";

export const metadata = {
	title: `404 — page not found · ${SITE_NAME}`,
	description: `No page exists at this address on ${SITE_NAME}. Links to the home page, connect flow, llms.txt and sitemap.`,
	robots: { index: false, follow: true },
};

/**
 * The 404 body lists the recovery routes explicitly rather than only offering
 * a "go home" button, so an agent that lands here can pick its next request.
 * The markdown variant of this page is served by middleware negotiation.
 */
const destinations = [
	{
		href: "/",
		icon: Home,
		title: "Home",
		description: `What ${SITE_NAME} is, the tool catalogue, and install instructions.`,
		external: false,
	},
	{
		href: "/connect",
		icon: ArrowRight,
		title: "Connect",
		description: "Generate a key and get an MCP client configuration.",
		external: false,
	},
	{
		href: "/llms.txt",
		icon: FileText,
		title: "llms.txt",
		description: "Machine-readable index of every documented resource.",
		external: false,
	},
	{
		href: "/sitemap.xml",
		icon: MapIcon,
		title: "Sitemap",
		description: "Every indexable URL on this site.",
		external: false,
	},
	{
		href: GITHUB_URL,
		icon: Github,
		title: "Source",
		description: "Code, README and issue tracker.",
		external: true,
	},
];

export default function NotFound() {
	return (
		<div className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-8 px-6 py-16">
			<div className="space-y-3">
				<p className="font-mono text-sm text-primary">404</p>
				<h1 className="text-3xl font-bold tracking-tight">Page not found</h1>
				<p className="text-muted-foreground">
					No page exists at this address. These are the places worth looking
					instead.
				</p>
			</div>

			<ul className="grid gap-3 sm:grid-cols-2">
				{destinations.map(
					({ href, icon: Icon, title, description, external }) => (
						<li key={href}>
							<Card className="h-full bg-card/60 transition-colors hover:border-primary/40">
								<CardHeader>
									<Icon className="size-5 text-primary" />
									<CardTitle className="pt-2 text-base">
										{external ? (
											<a href={href} target="_blank" rel="noreferrer">
												{title}
											</a>
										) : (
											<Link href={href}>{title}</Link>
										)}
									</CardTitle>
									<CardDescription>{description}</CardDescription>
								</CardHeader>
							</Card>
						</li>
					),
				)}
			</ul>

			<Card className="bg-card/60">
				<CardContent className="pt-6">
					<p className="text-sm text-muted-foreground">
						Machine-readable endpoints: the MCP server is at{" "}
						<code className="font-mono text-foreground">/api/mcp</code> over
						Streamable HTTP, with OAuth discovery at{" "}
						<code className="font-mono text-foreground">
							/.well-known/oauth-protected-resource
						</code>
						. Request any page with{" "}
						<code className="font-mono text-foreground">
							Accept: text/markdown
						</code>{" "}
						for a markdown rendering.
					</p>
				</CardContent>
			</Card>

			<div>
				<Button asChild>
					<Link href="/">
						Back to home
						<ArrowRight />
					</Link>
				</Button>
			</div>
		</div>
	);
}

import { ArrowLeft, Cloud, Laptop, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { CodeSnippet } from "@/components/landing/CodeSnippet";
import { CopyCommand } from "@/components/landing/CopyCommand";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MCP_ENDPOINT } from "@/lib/site";

export const metadata = { title: "Connect · BSV MCP" };

const localConfig = JSON.stringify(
	{
		mcpServers: {
			"bsv-mcp": {
				command: "bunx",
				args: ["bsv-mcp@latest", "--stdio"],
				env: { DISABLE_WALLET_TOOLS: "true", DISABLE_BROADCASTING: "true" },
			},
		},
	},
	null,
	2,
);

export default function ConnectPage() {
	return (
		<main className="mx-auto min-h-screen max-w-3xl px-5 py-10 sm:py-16">
			<Button variant="ghost" size="sm" asChild>
				<Link href="/">
					<ArrowLeft /> Home
				</Link>
			</Button>
			<header className="mb-8 mt-8 space-y-3">
				<h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
					Connect your AI assistant
				</h1>
				<p className="text-lg text-muted-foreground">
					Choose where BSV MCP runs. You can get started without a wallet.
				</p>
				<p className="flex items-center gap-2 text-sm text-muted-foreground">
					<ShieldCheck className="size-4 shrink-0" /> Keep private keys and
					wallet backups in your wallet app or local signer.
				</p>
			</header>
			<Tabs defaultValue="hosted">
				<TabsList className="grid h-auto w-full grid-cols-2">
					<TabsTrigger value="hosted" className="py-3">
						<Cloud className="mr-2 size-4" /> Hosted
					</TabsTrigger>
					<TabsTrigger value="local" className="py-3">
						<Laptop className="mr-2 size-4" /> On this computer
					</TabsTrigger>
				</TabsList>
				<TabsContent
					value="hosted"
					className="space-y-7 rounded-xl border p-5 sm:p-7"
				>
					<section className="space-y-3">
						<h2 className="text-xl font-medium">
							1. Add the server to your client
						</h2>
						<p className="text-muted-foreground">
							In your AI client’s connector settings, add a remote MCP server
							with this URL. Your client must support OAuth and Streamable HTTP.
						</p>
						<CopyCommand command={MCP_ENDPOINT} label="Server URL" />
						<details>
							<summary className="cursor-pointer text-sm font-medium">
								Using Claude Code?
							</summary>
							<div className="mt-3">
								<CopyCommand
									command={`claude mcp add --transport http bsv-mcp ${MCP_ENDPOINT}`}
									label="Claude Code"
								/>
							</div>
						</details>
					</section>
					<section className="space-y-2">
						<h2 className="text-xl font-medium">
							2. Sign in through your client
						</h2>
						<p className="text-muted-foreground">
							Choose Connect or Authenticate for BSV MCP. Your client opens
							Sigma Identity in your browser. Review the requested access,
							approve it, then return to your client. In Claude Code, open /mcp
							to authenticate.
						</p>
						<p className="text-sm text-muted-foreground">
							This signs you in to the service. It does not connect your
							personal wallet or authorize payments.
						</p>
					</section>
					<section className="space-y-2">
						<h2 className="text-xl font-medium">3. Try a first request</h2>
						<p className="rounded-lg bg-muted p-4">
							“Run bsv_status and explain which services are available.”
						</p>
					</section>
					<p className="text-sm text-muted-foreground">
						If sign-in fails, check the server’s connection status in your
						client. You can also use the local setup tab. A website cannot check
						your client’s connection for you.
					</p>
				</TabsContent>
				<TabsContent
					value="local"
					className="space-y-7 rounded-xl border p-5 sm:p-7"
				>
					<section className="space-y-2">
						<h2 className="text-xl font-medium">1. Install Bun</h2>
						<p className="text-muted-foreground">
							BSV MCP runs as a local process launched by your AI client.
							Install{" "}
							<a className="underline" href="https://bun.sh/docs/installation">
								Bun
							</a>{" "}
							first, then restart your client so it can find bunx.
						</p>
					</section>
					<section className="space-y-3">
						<h2 className="text-xl font-medium">
							2. Add a connection without a wallet
						</h2>
						<p className="text-muted-foreground">
							Merge this entry into your client’s MCP configuration. It disables
							wallet tools and broadcasting, so startup needs no private key.
							Restart the client after saving.
						</p>
						<CodeSnippet
							code={localConfig}
							language="json"
							filename="MCP configuration"
						/>
						<p className="text-sm text-muted-foreground">
							Claude Desktop: claude_desktop_config.json. Cursor:
							.cursor/mcp.json. Other clients may use a different format; see{" "}
							<Link className="underline" href="/#install">
								client instructions
							</Link>
							. If bunx cannot be found, use its absolute path.
						</p>
					</section>
					<section className="space-y-2">
						<h2 className="text-xl font-medium">3. Check the connection</h2>
						<p className="rounded-lg bg-muted p-4">
							“Run bsv_status and explain which services are available.”
						</p>
						<p className="text-sm text-muted-foreground">
							A missing wallet is expected in this setup. Public API requests
							still need internet access.
						</p>
					</section>
				</TabsContent>
			</Tabs>
			<section className="mt-8 space-y-3 rounded-xl border p-5 sm:p-7">
				<h2 className="text-xl font-medium">Ready to use a wallet?</h2>
				<p className="text-muted-foreground">
					Use local MCP with an existing signer, or create an encrypted account
					in your terminal. Wallet setup is separate from signing in to hosted
					MCP. The hosted connection does not reach a signer on your computer.
				</p>
				<Button asChild>
					<Link href="/docs#wallets">Set up a wallet</Link>
				</Button>
				<p className="text-sm text-muted-foreground">
					Already have funds or an account? Follow the existing-wallet or
					migration instructions before creating anything new.
				</p>
			</section>
		</main>
	);
}

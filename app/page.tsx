import {
	ArrowRight,
	Bitcoin,
	Blocks,
	Cloud,
	Fingerprint,
	Github,
	Image as ImageIcon,
	KeyRound,
	MessageSquare,
	Plug,
	Search,
	Server,
	ShieldCheck,
	Terminal,
	Wallet,
	Wrench,
} from "lucide-react";
import Link from "next/link";
import { CopyCommand } from "@/components/landing/CopyCommand";

const GITHUB_URL = "https://github.com/b-open-io/bsv-mcp";
const NPM_URL = "https://www.npmjs.com/package/bsv-mcp";

const toolCategories = [
	{
		icon: Wallet,
		name: "Wallet",
		description:
			"Send BSV, manage UTXOs, inscribe files and mint collections from a local key, a BRC-100 signer, or a Droplit-sponsored wallet.",
	},
	{
		icon: ImageIcon,
		name: "Ordinals",
		description:
			"Look up 1Sat Ordinals, browse marketplace listings, and buy or list NFTs directly from a conversation.",
	},
	{
		icon: Search,
		name: "Explorer",
		description:
			"Decode raw transactions, fetch blocks and addresses, and pull the live BSV price with built-in caching.",
	},
	{
		icon: Fingerprint,
		name: "Identity",
		description:
			"Create and manage Bitcoin Attestation Protocol (BAP) identities and sign attestations on-chain.",
	},
	{
		icon: MessageSquare,
		name: "Social",
		description:
			"Post, like, and follow on BSocial. Your agent can publish to the open social graph.",
	},
	{
		icon: Bitcoin,
		name: "Tokens",
		description:
			"Check balances and transfer MNEE stablecoin, with utilities for encoding, hashing, and data conversion.",
	},
];

const steps = [
	{
		title: "Install",
		description:
			"One plugin command for Claude Code, a JSON snippet for Cursor or Claude Desktop, or a hosted URL. No build step.",
	},
	{
		title: "Connect a key",
		description:
			"Bring a WIF, point at an existing BRC-100 wallet, or let the server generate an encrypted key on first run.",
	},
	{
		title: "Ask",
		description:
			"“Inscribe this SVG”, “what's in block 900000”, “send 5000 sats to…”. The agent picks the right tool and shows you the txid.",
	},
];

const deployModes = [
	{
		icon: Terminal,
		title: "Local",
		subtitle: "stdio transport",
		description:
			"Runs on your machine with keys encrypted at rest. The default for Claude Code and desktop clients.",
	},
	{
		icon: Server,
		title: "HTTP",
		subtitle: "Streamable HTTP",
		description:
			"Self-host the MCP 2025-03-26 Streamable HTTP endpoint with OAuth 2.1 and JWT validation.",
	},
	{
		icon: Cloud,
		title: "Hosted",
		subtitle: "bsvmcp.com",
		description:
			"Authenticate with a Bitcoin signature and get a ready-to-paste config. Nothing to run.",
	},
];

function TerminalDemo() {
	return (
		<div className="min-w-0 overflow-hidden rounded-xl border border-border bg-[#0b0f1a] shadow-2xl shadow-amber-500/5">
			<div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
				<span className="size-2.5 rounded-full bg-red-500/70" />
				<span className="size-2.5 rounded-full bg-yellow-500/70" />
				<span className="size-2.5 rounded-full bg-green-500/70" />
				<span className="ml-2 font-mono text-xs text-muted-foreground">
					claude
				</span>
			</div>
			<div className="space-y-4 break-words p-5 font-mono text-[13px] leading-relaxed">
				<div>
					<span className="text-amber-400">&gt; </span>
					<span className="text-foreground">
						inscribe hello.svg as a 1sat ordinal and tell me the txid
					</span>
				</div>
				<div className="space-y-1 text-muted-foreground">
					<p>
						<span className="text-emerald-400">●</span>{" "}
						wallet_createOrdinals(file: "hello.svg", contentType:
						"image/svg+xml")
					</p>
					<p className="pl-4 text-muted-foreground/70">
						├ reading file (412 bytes)
					</p>
					<p className="pl-4 text-muted-foreground/70">
						├ selecting UTXOs · fee 1 sat/kb
					</p>
					<p className="pl-4 text-muted-foreground/70">└ broadcast ✓</p>
				</div>
				<div className="text-foreground">
					Inscribed. Outpoint{" "}
					<span className="text-amber-300">f3a1…9c2e_0</span> — view it on{" "}
					<span className="underline decoration-muted-foreground/40">
						1satordinals.com
					</span>
					.
				</div>
			</div>
		</div>
	);
}

export default function LandingPage() {
	return (
		<div className="relative min-h-screen overflow-x-hidden">
			{/* Background glow */}
			<div
				aria-hidden
				className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[640px] bg-[radial-gradient(ellipse_at_top,rgba(245,158,11,0.16),transparent_60%)]"
			/>
			<div
				aria-hidden
				className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]"
			/>

			{/* Nav */}
			<header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
				<Link href="/" className="flex items-center gap-2 font-semibold">
					<span className="flex size-7 items-center justify-center rounded-md bg-amber-500 text-black">
						<Bitcoin className="size-4" />
					</span>
					BSV MCP
				</Link>
				<nav className="flex items-center gap-1 text-sm">
					<a
						href="#tools"
						className="hidden rounded-md px-3 py-2 text-muted-foreground hover:text-foreground sm:block"
					>
						Tools
					</a>
					<a
						href="#install"
						className="hidden rounded-md px-3 py-2 text-muted-foreground hover:text-foreground sm:block"
					>
						Install
					</a>
					<a
						href={GITHUB_URL}
						target="_blank"
						rel="noreferrer"
						className="flex items-center gap-1.5 rounded-md px-3 py-2 text-muted-foreground hover:text-foreground"
					>
						<Github className="size-4" />
						<span className="hidden sm:inline">GitHub</span>
					</a>
					<Link
						href="/connect"
						className="ml-2 rounded-md bg-foreground px-3.5 py-2 font-medium text-background hover:bg-foreground/90"
					>
						Get started
					</Link>
				</nav>
			</header>

			{/* Hero */}
			<section className="mx-auto grid max-w-6xl items-center gap-12 px-6 pb-20 pt-12 lg:grid-cols-[1.1fr_1fr] lg:pt-20">
				<div className="min-w-0 space-y-7">
					<div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground">
						<span className="size-1.5 rounded-full bg-emerald-400" />
						Open source · MCP 2025-03-26 · v0.3
					</div>
					<h1 className="text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
						Give your AI agent a{" "}
						<span className="bg-gradient-to-r from-amber-300 to-amber-500 bg-clip-text text-transparent">
							Bitcoin wallet
						</span>
						.
					</h1>
					<p className="max-w-xl text-lg text-muted-foreground">
						BSV MCP is a Model Context Protocol server that lets Claude, Cursor,
						and any MCP client send BSV, inscribe ordinals, manage on-chain
						identity, and read the blockchain. Eighty-plus tools, one install.
					</p>
					<div className="flex flex-col gap-3 sm:flex-row sm:items-center">
						<Link
							href="/connect"
							className="inline-flex items-center justify-center gap-2 rounded-md bg-amber-500 px-5 py-2.5 text-sm font-semibold text-black hover:bg-amber-400"
						>
							Connect the hosted server
							<ArrowRight className="size-4" />
						</Link>
						<a
							href="#install"
							className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-card/60 px-5 py-2.5 text-sm font-medium hover:bg-accent"
						>
							<Terminal className="size-4" />
							Run it locally
						</a>
					</div>
					<CopyCommand
						command="claude plugin install bsv-mcp@b-open-io"
						className="max-w-xl"
					/>
				</div>
				<TerminalDemo />
			</section>

			{/* Logos / clients */}
			<section className="border-y border-border bg-card/30">
				<div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-10 gap-y-3 px-6 py-6 text-sm text-muted-foreground">
					<span className="text-xs uppercase tracking-wider">Works with</span>
					<span>Claude Code</span>
					<span>Claude Desktop</span>
					<span>Cursor</span>
					<span>Windsurf</span>
					<span>Any MCP client</span>
				</div>
			</section>

			{/* How it works */}
			<section className="mx-auto max-w-6xl px-6 py-20">
				<div className="mb-10 max-w-2xl">
					<h2 className="text-3xl font-bold tracking-tight">
						From prompt to txid in three steps
					</h2>
					<p className="mt-3 text-muted-foreground">
						No SDK to learn. The agent reads the tool schemas and does the rest.
					</p>
				</div>
				<ol className="grid gap-6 md:grid-cols-3">
					{steps.map((step, i) => (
						<li
							key={step.title}
							className="rounded-xl border border-border bg-card/40 p-6"
						>
							<span className="font-mono text-xs text-amber-400">0{i + 1}</span>
							<h3 className="mt-2 text-lg font-semibold">{step.title}</h3>
							<p className="mt-2 text-sm text-muted-foreground">
								{step.description}
							</p>
						</li>
					))}
				</ol>
			</section>

			{/* Tools */}
			<section id="tools" className="mx-auto max-w-6xl px-6 pb-20">
				<div className="mb-10 flex flex-wrap items-end justify-between gap-4">
					<div className="max-w-2xl">
						<h2 className="text-3xl font-bold tracking-tight">
							Everything on-chain, as tools
						</h2>
						<p className="mt-3 text-muted-foreground">
							Each category can be toggled with an environment variable. Tools
							that need keys fail gracefully when none are configured.
						</p>
					</div>
					<a
						href={`${GITHUB_URL}#readme`}
						target="_blank"
						rel="noreferrer"
						className="inline-flex items-center gap-1 text-sm text-amber-400 hover:text-amber-300"
					>
						Full tool reference <ArrowRight className="size-4" />
					</a>
				</div>
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{toolCategories.map(({ icon: Icon, name, description }) => (
						<div
							key={name}
							className="group rounded-xl border border-border bg-card/40 p-6 transition-colors hover:border-amber-500/40"
						>
							<div className="flex size-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
								<Icon className="size-5" />
							</div>
							<h3 className="mt-4 font-semibold">{name}</h3>
							<p className="mt-2 text-sm text-muted-foreground">
								{description}
							</p>
						</div>
					))}
				</div>
			</section>

			{/* Install */}
			<section id="install" className="border-t border-border bg-card/20">
				<div className="mx-auto max-w-6xl px-6 py-20">
					<div className="mb-10 max-w-2xl">
						<h2 className="text-3xl font-bold tracking-tight">
							Run it your way
						</h2>
						<p className="mt-3 text-muted-foreground">
							The same server ships in three shapes. Pick the one that fits your
							client and your key custody.
						</p>
					</div>
					<div className="grid gap-4 md:grid-cols-3">
						{deployModes.map(({ icon: Icon, title, subtitle, description }) => (
							<div
								key={title}
								className="rounded-xl border border-border bg-card/40 p-6"
							>
								<div className="flex items-center gap-3">
									<Icon className="size-5 text-amber-400" />
									<div>
										<h3 className="font-semibold">{title}</h3>
										<p className="font-mono text-xs text-muted-foreground">
											{subtitle}
										</p>
									</div>
								</div>
								<p className="mt-4 text-sm text-muted-foreground">
									{description}
								</p>
							</div>
						))}
					</div>

					<div className="mt-10 grid gap-6 lg:grid-cols-2">
						<div className="space-y-3">
							<p className="flex items-center gap-2 text-sm font-medium">
								<Plug className="size-4 text-amber-400" />
								Claude Code
							</p>
							<CopyCommand command="claude plugin install bsv-mcp@b-open-io" />
							<p className="flex items-center gap-2 pt-2 text-sm font-medium">
								<Wrench className="size-4 text-amber-400" />
								Any stdio client
							</p>
							<CopyCommand command="bunx bsv-mcp@latest" />
						</div>
						<div className="space-y-3">
							<p className="flex items-center gap-2 text-sm font-medium">
								<Blocks className="size-4 text-amber-400" />
								Cursor / Claude Desktop
							</p>
							<pre className="overflow-x-auto rounded-lg border border-border bg-black/40 p-4 font-mono text-xs leading-relaxed text-foreground">
								{`{
  "mcpServers": {
    "bsv-mcp": {
      "command": "bunx",
      "args": ["bsv-mcp@latest"]
    }
  }
}`}
							</pre>
						</div>
					</div>
				</div>
			</section>

			{/* Security */}
			<section className="mx-auto max-w-6xl px-6 py-20">
				<div className="grid gap-8 lg:grid-cols-[1fr_1.2fr] lg:items-center">
					<div>
						<h2 className="text-3xl font-bold tracking-tight">
							Keys stay yours
						</h2>
						<p className="mt-3 text-muted-foreground">
							An agent with a wallet needs guardrails. BSV MCP is built so the
							model can act without ever seeing raw key material in a prompt.
						</p>
					</div>
					<ul className="grid gap-4 sm:grid-cols-2">
						{[
							{
								icon: KeyRound,
								title: "Encrypted at rest",
								text: "AES-256-GCM with 600k PBKDF2 iterations in the bitcoin-backup format. Files are created with 0600 permissions.",
							},
							{
								icon: ShieldCheck,
								title: "No passphrase env vars",
								text: "Passphrases are entered through a temporary local web prompt, never read from the environment.",
							},
							{
								icon: Fingerprint,
								title: "Bitcoin-signed auth",
								text: "Hosted mode uses OAuth 2.1 via sigma-auth. Your public key is your identity. Nothing to register.",
							},
							{
								icon: Wallet,
								title: "External signers",
								text: "Point at a BRC-100 wallet and it stays the permission authority. Every spend is approved there.",
							},
						].map(({ icon: Icon, title, text }) => (
							<li
								key={title}
								className="rounded-xl border border-border bg-card/40 p-5"
							>
								<Icon className="size-5 text-amber-400" />
								<h3 className="mt-3 font-semibold">{title}</h3>
								<p className="mt-1.5 text-sm text-muted-foreground">{text}</p>
							</li>
						))}
					</ul>
				</div>
			</section>

			{/* CTA */}
			<section className="mx-auto max-w-6xl px-6 pb-24">
				<div className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/15 via-card to-card p-10 text-center">
					<h2 className="text-3xl font-bold tracking-tight">
						Put your agent on-chain
					</h2>
					<p className="mx-auto mt-3 max-w-xl text-muted-foreground">
						Generate a key, download the backup, paste the config. You'll be
						sending a transaction from a chat window in under two minutes.
					</p>
					<div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
						<Link
							href="/connect"
							className="inline-flex items-center justify-center gap-2 rounded-md bg-amber-500 px-5 py-2.5 text-sm font-semibold text-black hover:bg-amber-400"
						>
							Get started <ArrowRight className="size-4" />
						</Link>
						<a
							href={GITHUB_URL}
							target="_blank"
							rel="noreferrer"
							className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-background/60 px-5 py-2.5 text-sm font-medium hover:bg-accent"
						>
							<Github className="size-4" /> Star on GitHub
						</a>
					</div>
				</div>
			</section>

			{/* Footer */}
			<footer className="border-t border-border">
				<div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-sm text-muted-foreground">
					<p>© {new Date().getFullYear()} BSV MCP · MIT License</p>
					<div className="flex gap-6">
						<a
							href={GITHUB_URL}
							target="_blank"
							rel="noreferrer"
							className="hover:text-foreground"
						>
							GitHub
						</a>
						<a
							href={NPM_URL}
							target="_blank"
							rel="noreferrer"
							className="hover:text-foreground"
						>
							npm
						</a>
						<a
							href="https://modelcontextprotocol.io"
							target="_blank"
							rel="noreferrer"
							className="hover:text-foreground"
						>
							MCP spec
						</a>
						<Link href="/connect" className="hover:text-foreground">
							Hosted service
						</Link>
					</div>
				</div>
			</footer>
		</div>
	);
}

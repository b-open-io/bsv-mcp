import {
	ArrowRight,
	Bitcoin,
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
} from "lucide-react";
import Link from "next/link";
import { CopyCommand } from "@/components/landing/CopyCommand";
import { InstallTabs } from "@/components/landing/InstallTabs";
import { TerminalDemo } from "@/components/landing/TerminalDemo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
	GITHUB_URL,
	getAppVersion,
	MCP_PROTOCOL_LATEST,
	NPM_URL,
} from "@/lib/site";
import {
	clients,
	deployModes,
	guarantees,
	installCommands,
	installTargets,
	steps,
	toolCategories,
} from "@/lib/site-content";
import { approximateTotal, countTools, getToolCounts } from "@/lib/tool-count";

const iconFor: Record<string, typeof Wallet> = {
	wallet: Wallet,
	ordinals: ImageIcon,
	explorer: Search,
	identity: Fingerprint,
	social: MessageSquare,
	tokens: Bitcoin,
};

const deployIconFor: Record<string, typeof Wallet> = {
	local: Terminal,
	http: Server,
	hosted: Cloud,
};

const guaranteeIconFor: Record<string, typeof Wallet> = {
	encrypted: KeyRound,
	"no-env-passphrase": ShieldCheck,
	"bitcoin-auth": Fingerprint,
	"external-signer": Wallet,
};

function SectionHeading({
	title,
	description,
	action,
}: {
	title: string;
	description: string;
	action?: React.ReactNode;
}) {
	return (
		<div className="mb-10 flex flex-wrap items-end justify-between gap-4">
			<div className="max-w-2xl space-y-3">
				<h2 className="text-3xl font-bold tracking-tight">{title}</h2>
				<p className="text-muted-foreground">{description}</p>
			</div>
			{action}
		</div>
	);
}

export default function LandingPage() {
	const toolCounts = getToolCounts();
	const headlineTotal = approximateTotal(toolCounts.total);

	return (
		<div className="relative min-h-screen overflow-x-hidden">
			<div
				aria-hidden
				className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[640px] bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.16),transparent_60%)]"
			/>
			<div
				aria-hidden
				className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_right,hsl(var(--border)/0.5)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border)/0.5)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]"
			/>

			<header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
				<Link href="/" className="flex items-center gap-2 font-semibold">
					<span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
						<Bitcoin className="size-4" />
					</span>
					BSV MCP
				</Link>
				<nav className="flex items-center gap-1">
					<Button variant="ghost" asChild className="hidden sm:inline-flex">
						<a href="#tools">Tools</a>
					</Button>
					<Button variant="ghost" asChild className="hidden sm:inline-flex">
						<a href="#install">Install</a>
					</Button>
					<Button variant="ghost" asChild>
						<a href={GITHUB_URL} target="_blank" rel="noreferrer">
							<Github />
							<span className="hidden sm:inline">GitHub</span>
						</a>
					</Button>
					<Button asChild className="ml-2">
						<Link href="/connect">Get started</Link>
					</Button>
				</nav>
			</header>

			<section className="mx-auto grid max-w-6xl items-center gap-12 px-6 pb-20 pt-12 lg:grid-cols-[1.1fr_1fr] lg:pt-20">
				<div className="min-w-0 space-y-7">
					<div className="flex flex-wrap items-center gap-2">
						<Badge variant="outline" className="py-1">
							<span aria-hidden className="size-1.5 rounded-full bg-success" />
							Open source
						</Badge>
						<Badge variant="outline" className="py-1">
							MCP protocol {MCP_PROTOCOL_LATEST}
						</Badge>
						<Badge variant="outline" className="py-1">
							v{getAppVersion()}
						</Badge>
					</div>
					<h1 className="text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
						Give your AI agent a{" "}
						<span className="text-primary">Bitcoin wallet</span>.
					</h1>
					<p className="max-w-xl text-lg text-muted-foreground">
						BSV MCP is a Model Context Protocol server that lets Claude, Cursor,
						and any MCP client send BSV, inscribe ordinals, manage on-chain
						identity, and read the blockchain.{" "}
						{headlineTotal
							? `${headlineTotal} tools, one install.`
							: "One install."}
					</p>
					<div className="flex flex-col gap-3 sm:flex-row sm:items-center">
						<Button size="xl" asChild>
							<Link href="/connect">
								Connect the hosted server
								<ArrowRight />
							</Link>
						</Button>
						<Button size="xl" variant="outline" asChild>
							<a href="#install">
								<Terminal />
								Run it locally
							</a>
						</Button>
					</div>
					<CopyCommand
						command={installCommands.claudeCode}
						className="max-w-xl"
					/>
				</div>
				<TerminalDemo />
			</section>

			<section className="border-y bg-card/40">
				<div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-10 gap-y-3 px-6 py-6 text-sm text-muted-foreground">
					<span className="text-xs uppercase tracking-wider">Works with</span>
					{clients.map((client) => (
						<span key={client}>{client}</span>
					))}
				</div>
			</section>

			<section className="mx-auto max-w-6xl px-6 py-20">
				<SectionHeading
					title="From prompt to txid in three steps"
					description="No SDK to learn. The agent reads the tool schemas and does the rest."
				/>
				<ol className="grid gap-6 md:grid-cols-3">
					{steps.map((step, index) => (
						<li key={step.title}>
							<Card className="h-full bg-card/60">
								<CardHeader>
									<span className="font-mono text-xs text-primary">
										0{index + 1}
									</span>
									<CardTitle className="text-lg">{step.title}</CardTitle>
									<CardDescription>{step.description}</CardDescription>
								</CardHeader>
							</Card>
						</li>
					))}
				</ol>
			</section>

			<section id="tools" className="mx-auto max-w-6xl px-6 pb-20">
				<SectionHeading
					title="Everything on-chain, as tools"
					description="Each category can be toggled with an environment variable. Tools that need keys fail gracefully when none are configured."
					action={
						<Button variant="link" asChild className="px-0">
							<a href={`${GITHUB_URL}#readme`} target="_blank" rel="noreferrer">
								Full tool reference
								<ArrowRight />
							</a>
						</Button>
					}
				/>
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{toolCategories.map(({ key, name, description }) => {
						const Icon = iconFor[key];
						const count = countTools(toolCounts, key);
						return (
							<Card
								key={name}
								className="h-full bg-card/60 transition-colors hover:border-primary/40"
							>
								<CardHeader>
									<div className="flex items-start justify-between gap-3">
										<span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
											<Icon className="size-5" />
										</span>
										{count > 0 && (
											<Badge variant="secondary">
												{count} {count === 1 ? "tool" : "tools"}
											</Badge>
										)}
									</div>
									<CardTitle className="pt-2">{name}</CardTitle>
									<CardDescription>{description}</CardDescription>
								</CardHeader>
							</Card>
						);
					})}
				</div>
			</section>

			<section id="install" className="border-t bg-card/30">
				<div className="mx-auto max-w-6xl px-6 py-20">
					<SectionHeading
						title="Run it your way"
						description="The same server ships in three shapes. Pick the one that fits your client and your key custody."
					/>
					<div className="grid gap-4 md:grid-cols-3">
						{deployModes.map(({ key, title, subtitle, description }) => {
							const Icon = deployIconFor[key];
							return (
								<Card key={key} className="h-full bg-card/60">
									<CardHeader>
										<div className="flex items-center gap-3">
											<Icon className="size-5 text-primary" />
											<div>
												<CardTitle>{title}</CardTitle>
												<p className="font-mono text-xs text-muted-foreground">
													{subtitle}
												</p>
											</div>
										</div>
										<CardDescription className="pt-2">
											{description}
										</CardDescription>
									</CardHeader>
								</Card>
							);
						})}
					</div>

					<Separator className="my-10" />

					<div className="space-y-4">
						<p className="flex items-center gap-2 text-sm font-medium">
							<Plug className="size-4 text-primary" />
							Pick your client
						</p>
						<InstallTabs targets={installTargets} />
					</div>
				</div>
			</section>

			<section className="mx-auto max-w-6xl px-6 py-20">
				<div className="grid gap-8 lg:grid-cols-[1fr_1.2fr] lg:items-center">
					<div className="space-y-3">
						<h2 className="text-3xl font-bold tracking-tight">
							Keys stay yours
						</h2>
						<p className="text-muted-foreground">
							An agent with a wallet needs guardrails. BSV MCP is built so the
							model can act without ever seeing raw key material in a prompt.
						</p>
					</div>
					<ul className="grid gap-4 sm:grid-cols-2">
						{guarantees.map(({ key, title, description }) => {
							const Icon = guaranteeIconFor[key];
							return (
								<li key={key}>
									<Card className="h-full bg-card/60">
										<CardHeader>
											<Icon className="size-5 text-primary" />
											<CardTitle className="pt-2">{title}</CardTitle>
											<CardDescription>{description}</CardDescription>
										</CardHeader>
									</Card>
								</li>
							);
						})}
					</ul>
				</div>
			</section>

			<section className="mx-auto max-w-6xl px-6 pb-24">
				<Card className="overflow-hidden border-primary/30 bg-gradient-to-br from-primary/15 via-card to-card text-center">
					<CardHeader className="items-center gap-3 p-10">
						<CardTitle className="text-3xl font-bold tracking-tight">
							Put your agent on-chain
						</CardTitle>
						<CardDescription className="mx-auto max-w-xl text-base">
							Generate a key, download the backup, paste the config. You&apos;ll
							be sending a transaction from a chat window in under two minutes.
						</CardDescription>
					</CardHeader>
					<CardContent className="flex flex-col justify-center gap-3 pb-10 sm:flex-row">
						<Button size="xl" asChild>
							<Link href="/connect">
								Get started
								<ArrowRight />
							</Link>
						</Button>
						<Button size="xl" variant="outline" asChild>
							<a href={GITHUB_URL} target="_blank" rel="noreferrer">
								<Github />
								Star on GitHub
							</a>
						</Button>
					</CardContent>
				</Card>
			</section>

			<footer className="border-t">
				<div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-sm text-muted-foreground">
					<p>© {new Date().getFullYear()} BSV MCP · MIT License</p>
					<div className="flex flex-wrap gap-6">
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

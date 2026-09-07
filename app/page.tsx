import {
	ArrowRight,
	Bitcoin,
	Check,
	Cloud,
	Fingerprint,
	Github,
	Image as ImageIcon,
	KeyRound,
	MessageSquare,
	Search,
	Server,
	ShieldCheck,
	Terminal,
	Wallet,
	X,
} from "lucide-react";
import Link from "next/link";
import { CopyCommand } from "@/components/landing/CopyCommand";
import { GitHubStars } from "@/components/landing/GitHubStars";
import { InstallTabs } from "@/components/landing/InstallTabs";
import { MobileMenu } from "@/components/landing/MobileMenu";
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
import { BrcReferences } from "@/lib/brc";
import {
	GITHUB_URL,
	NPM_URL,
} from "@/lib/site";
import {
	clients,
	deployModes,
	faq,
	guarantees,
	hero,
	installCommands,
	installTargets,
	problem,
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

/** Uppercase mono label above a section title, `#`-prefixed like a shell comment. */
function Eyebrow({ children }: { children: React.ReactNode }) {
	return (
		<p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
			<span className="text-primary">#</span> {children}
		</p>
	);
}

function SectionHeading({
	eyebrow,
	title,
	description,
	action,
}: {
	eyebrow: string;
	title: string;
	description?: string;
	action?: React.ReactNode;
}) {
	return (
		<div className="mb-10 flex flex-wrap items-end justify-between gap-4">
			<div className="max-w-2xl space-y-3">
				<Eyebrow>{eyebrow}</Eyebrow>
				<h2 className="text-3xl font-bold tracking-tight">{title}</h2>
				{description ? (
					<p className="text-muted-foreground">
						<BrcReferences text={description} />
					</p>
				) : null}
			</div>
			{action}
		</div>
	);
}

function Stat({ value, label }: { value: string; label: string }) {
	return (
		<div className="space-y-1">
			<p className="font-mono text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
				{value}
			</p>
			<p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
				{label}
			</p>
		</div>
	);
}

export default function LandingPage() {
	const toolCounts = getToolCounts();
	const headlineTotal = approximateTotal(toolCounts.total);

	return (
		<div className="relative min-h-screen overflow-x-hidden">
			<header className="relative mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
				<Link
					href="/"
					className="flex items-center gap-2 font-mono font-semibold tracking-tight"
				>
					<Bitcoin
						className="size-6 text-primary"
						strokeWidth={2.5}
						aria-hidden
					/>
					BSV MCP
				</Link>
				<nav className="flex items-center gap-1 font-mono text-sm">
					<Button variant="ghost" asChild className="hidden sm:inline-flex">
						<a href="#tools">/tools</a>
					</Button>
					<Button variant="ghost" asChild className="hidden sm:inline-flex">
						<a href="#install">/install</a>
					</Button>
					<Button variant="ghost" asChild className="hidden sm:inline-flex">
						<a href="#faq">/faq</a>
					</Button>
					<Button variant="ghost" asChild className="hidden sm:inline-flex">
						<Link href="/docs">/docs</Link>
					</Button>
					<MobileMenu />
					<GitHubStars url={GITHUB_URL} />
				</nav>
			</header>

			{/* Hero: header answers "what is this" alone; the sub carries the proof;
			    the install command is the lowest-labour action a developer can take. */}
			<section className="mx-auto max-w-5xl px-6 pb-14 pt-10 sm:pt-16 lg:pt-24">
				<div className="mx-auto max-w-3xl space-y-6 text-center">
					<Eyebrow>
						{hero.eyebrow}
						{headlineTotal ? ` · ${headlineTotal} tools` : ""}
					</Eyebrow>
					<h1 className="text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
						The Bitcoin SV wallet for{" "}
						<span className="font-mono tracking-tight text-primary">
							MCP clients
						</span>
						.
					</h1>
					<p className="mx-auto max-w-2xl text-base text-muted-foreground sm:text-lg">
						{hero.sub}
					</p>
					<div className="mx-auto max-w-xl space-y-3 pt-2">
						<CopyCommand command={installCommands.claudeCode} />
						<div className="flex flex-col justify-center gap-3 sm:flex-row">
							<Button size="xl" asChild>
								<Link href="/connect">
									Connect the hosted server
									<ArrowRight />
								</Link>
							</Button>
							<Button size="xl" variant="outline" asChild>
								<a href={GITHUB_URL} target="_blank" rel="noreferrer">
									<Github />
									Clone source
								</a>
							</Button>
						</div>
					</div>
				</div>

				<div className="mx-auto mt-14 max-w-3xl">
					<TerminalDemo />
				</div>
			</section>

			{/* Trust: numbers instead of logos, since this is an individual-oriented tool. */}
			<section className="border-y bg-card/40">
				<div className="mx-auto grid max-w-5xl grid-cols-2 gap-8 px-6 py-10 sm:grid-cols-3">
					<Stat value={String(toolCounts.total)} label="tools" />
					<Stat value="MIT" label="open source" />
					<Stat
						value={String(installTargets.length - 1)}
						label="clients documented"
					/>
				</div>
			</section>

			{/* Problem before solution. */}
			<section className="mx-auto max-w-5xl px-6 py-20">
				<SectionHeading
					eyebrow="why"
					title="Wallet code is the part of every agent nobody wants to write."
				/>
				<div className="grid gap-4 md:grid-cols-2">
					<Card className="bg-card/60">
						<CardHeader>
							<CardTitle className="font-mono text-sm uppercase tracking-wider text-muted-foreground">
								without
							</CardTitle>
						</CardHeader>
						<CardContent>
							<ul className="space-y-3">
								{problem.without.map((line) => (
									<li key={line} className="flex gap-3 text-sm">
										<X className="mt-0.5 size-4 shrink-0 text-destructive" />
										<span className="text-muted-foreground">{line}</span>
									</li>
								))}
							</ul>
						</CardContent>
					</Card>
					<Card className="border-primary/40 bg-card/60">
						<CardHeader>
							<CardTitle className="font-mono text-sm uppercase tracking-wider text-primary">
								with bsv-mcp
							</CardTitle>
						</CardHeader>
						<CardContent>
							<ul className="space-y-3">
								{problem.with.map((line) => (
									<li key={line} className="flex gap-3 text-sm">
										<Check className="mt-0.5 size-4 shrink-0 text-success" />
										<span>{line}</span>
									</li>
								))}
							</ul>
						</CardContent>
					</Card>
				</div>
			</section>

			{/* Tools: features tied back to the value prop, each with its live count. */}
			<section id="tools" className="mx-auto max-w-5xl px-6 pb-20">
				<SectionHeading
					eyebrow="tools"
					title="Everything on-chain, as tools your agent can call."
					description="Counts describe the release catalog. Your available tools depend on wallet mode and enabled categories; see the docs for setup."
					action={
						<Button variant="link" asChild className="px-0 font-mono">
							<Link href="/docs#tools">
								full reference
								<ArrowRight />
							</Link>
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
								className="h-full bg-card/60 transition-colors hover:border-primary/50"
							>
								<CardHeader>
									<div className="flex items-start justify-between gap-3">
										<Icon className="size-5 text-primary" />
										{count > 0 ? (
											<Badge variant="secondary" className="font-mono">
												{count} {count === 1 ? "tool" : "tools"}
											</Badge>
										) : null}
									</div>
									<CardTitle className="pt-2">{name}</CardTitle>
									<CardDescription>
										<BrcReferences text={description} />
									</CardDescription>
								</CardHeader>
							</Card>
						);
					})}
				</div>
			</section>

			{/* Install: the same server three ways, then the exact config per client. */}
			<section id="install" className="border-t bg-card/30">
				<div className="mx-auto max-w-5xl px-6 py-20">
					<SectionHeading
						eyebrow="install"
						title="Run it your way."
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
											<BrcReferences text={description} />
										</CardDescription>
									</CardHeader>
								</Card>
							);
						})}
					</div>

					<div className="mt-12 space-y-4">
						<Eyebrow>pick your client</Eyebrow>
						<InstallTabs targets={installTargets} />
					</div>

					<p className="mt-8 font-mono text-xs uppercase tracking-wider text-muted-foreground">
						works with {clients.join(" · ")}
					</p>
				</div>
			</section>

			{/* Key custody: the objection every wallet has to answer. */}
			<section className="mx-auto max-w-5xl px-6 py-20">
				<SectionHeading
					eyebrow="keys"
					title="Your keys never end up in a prompt."
					description="An agent with a wallet needs guardrails. The model can act without ever seeing raw key material."
				/>
				<ul className="grid gap-4 sm:grid-cols-2">
					{guarantees.map(({ key, title, description }) => {
						const Icon = guaranteeIconFor[key];
						return (
							<li key={key}>
								<Card className="h-full bg-card/60">
									<CardHeader>
										<Icon className="size-5 text-primary" />
										<CardTitle className="pt-2">{title}</CardTitle>
										<CardDescription>
											<BrcReferences text={description} />
										</CardDescription>
									</CardHeader>
								</Card>
							</li>
						);
					})}
				</ul>
			</section>

			{/* FAQ: the questions a developer asks before installing anything. */}
			<section id="faq" className="mx-auto max-w-5xl px-6 pb-20">
				<SectionHeading eyebrow="faq" title="Before you install." />
				<dl className="divide-y border-y">
					{faq.map((item) => (
						<div
							key={item.q}
							className="grid gap-2 py-6 md:grid-cols-[1fr_2fr] md:gap-8"
						>
							<dt className="font-semibold">{item.q}</dt>
							<dd className="text-sm text-muted-foreground">
								<BrcReferences text={item.a} />
							</dd>
						</div>
					))}
				</dl>
			</section>

			{/* Final CTA on a distinct band, for readers who scroll to the end before deciding. */}
			<section className="mx-auto max-w-5xl px-6 pb-24">
				<div className="rounded-lg bg-primary px-8 py-12 text-primary-foreground sm:px-12">
					<div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
						<div className="space-y-2">
							<p className="font-mono text-xs uppercase tracking-[0.2em] opacity-70">
								# ship
							</p>
							<h2 className="text-3xl font-bold tracking-tight">
								Put your agent on-chain.
							</h2>
							<p className="max-w-md opacity-80">
								Connect a wallet, check your balance, and make your first
								request from a chat window.
							</p>
						</div>
						<div className="flex flex-col gap-3 sm:flex-row">
							<Button
								size="xl"
								variant="secondary"
								asChild
								className="bg-primary-foreground text-primary hover:bg-primary-foreground/90"
							>
								<Link href="/connect">
									Connect the hosted server
									<ArrowRight />
								</Link>
							</Button>
						</div>
					</div>
				</div>
			</section>

			<footer className="border-t">
				<div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-8 font-mono text-xs text-muted-foreground">
					<p>© {new Date().getFullYear()} bsv-mcp · MIT</p>
					<div className="flex flex-wrap gap-6">
						<a
							href={GITHUB_URL}
							target="_blank"
							rel="noreferrer"
							className="hover:text-foreground"
						>
							github
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
							href={`${GITHUB_URL}/blob/master/CHANGELOG.md`}
							target="_blank"
							rel="noreferrer"
							className="hover:text-foreground"
						>
							changelog
						</a>
						<a
							href="https://modelcontextprotocol.io"
							target="_blank"
							rel="noreferrer"
							className="hover:text-foreground"
						>
							mcp spec
						</a>
						<Link href="/connect" className="hover:text-foreground">
							hosted
						</Link>
					</div>
				</div>
			</footer>
		</div>
	);
}

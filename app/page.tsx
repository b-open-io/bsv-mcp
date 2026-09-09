import { ArrowRight, Images, KeyRound, Link2, Send } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { BrandMark } from "@/components/landing/BrandMark";
import { CelestialHero } from "@/components/landing/CelestialHero";
import { ClientLogo } from "@/components/landing/ClientLogo";
import { DemoCarousel } from "@/components/landing/DemoCarousel";
import { GitHubStars } from "@/components/landing/GitHubStars";
import { HeroUseCases } from "@/components/landing/HeroUseCases";
import { InstallButton } from "@/components/landing/InstallButton";
import { QuickInstall } from "@/components/landing/QuickInstall";
import { StarField } from "@/components/landing/StarField";
import { GITHUB_URL } from "@/lib/site";
import "./landing.css";

const capabilities = [
	{ label: "Send BSV", icon: Send, href: "/docs/tools/wallet_sendBsv" },
	{
		label: "Create ordinals",
		icon: Images,
		href: "/docs/tools/wallet_createOrdinals",
	},
	{
		label: "Sign messages",
		icon: KeyRound,
		href: "/docs/tools/wallet_signBsm",
	},
	{ label: "Explore the chain", icon: Link2, href: "/docs/tools/bsv_explore" },
];
export default function LandingPage() {
	return (
		<div className="landing-page">
			<StarField />
			<a href="#main" className="landing-skip">
				Skip to content
			</a>
			<header className="landing-header landing-width">
				<Link href="/" className="landing-brand">
					<BrandMark />
					BSV MCP
				</Link>
				<nav aria-label="Main navigation">
					<a href="/docs/tools">Tools</a>
					<Link href="/docs">Docs</Link>
					<GitHubStars url={GITHUB_URL} />
				</nav>
			</header>
			<main id="main">
				<section
					className="landing-hero landing-width"
					aria-labelledby="hero-title"
				>
					<CelestialHero />
					<div className="hero-copy">
						<h1 id="hero-title">
							Give your
							<br />
							agent a wallet.
						</h1>
						<HeroUseCases />
						<div className="hero-actions">
							<InstallButton />
							<a href="/docs/tools" className="landing-text-link">
								Explore tools <ArrowRight size={16} />
							</a>
						</div>
					</div>
				</section>
				<section
					className="client-strip landing-width"
					aria-label="Compatible clients"
				>
					<span className="works-with">Works with</span>
					<span>
						<ClientLogo client="claude" />
						Claude
					</span>
					<span>
						<ClientLogo client="grok" />
						Grok
					</span>
					<span>
						<ClientLogo client="codex" />
						Codex
					</span>
					<span>
						<ClientLogo client="other" />
						Any MCP client
					</span>
				</section>
				<section className="landing-demo-section" aria-labelledby="demo-title">
					<div className="landing-width">
						<h2 id="demo-title">Ask. It happens.</h2>
					</div>
					<DemoCarousel />
				</section>
				<section
					id="tools"
					className="capability-section landing-width"
					aria-label="Wallet capabilities"
				>
					<div className="capability-list">
						{capabilities.map(({ label, icon: Icon, href }) => (
							<Link key={label} href={href}>
								<Icon size={34} strokeWidth={1.25} />
								<span>{label}</span>
							</Link>
						))}
					</div>
					<Link href="/docs/tools" className="landing-text-link">
						All tools <ArrowRight size={15} />
					</Link>
				</section>
				<section
					className="x402-section landing-width"
					aria-labelledby="x402-title"
				>
					<span className="x402-label">x402</span>
					<h2 id="x402-title">Pay for APIs with BSV.</h2>
					<p>Your agent gets a quote. You approve the payment.</p>
					<ol className="payment-flow">
						{["Request", "Quote", "Approve", "Response"].map((step, index) => (
							<li key={step}>
								<span className="flow-number">{index + 1}</span>
								<span>{step}</span>
								{index < 3 && (
									<ArrowRight className="flow-arrow" aria-hidden="true" />
								)}
							</li>
						))}
					</ol>
					<Link href="/docs#x402" className="landing-text-link">
						How it works <ArrowRight size={15} />
					</Link>
				</section>
				<section
					id="install"
					tabIndex={-1}
					className="install-section landing-width"
					aria-labelledby="install-title"
				>
					<h2 id="install-title">Get started.</h2>
					<QuickInstall />
					<p className="custody-copy">
						Keep keys in your encrypted Vault, or connect your own wallet.
					</p>
				</section>
				<section className="final-eclipse" aria-labelledby="final-title">
					<Image
						src="/artwork/planet-sunrise.webp"
						alt=""
						width={1774}
						height={887}
						sizes="100vw"
						className="planet-art"
					/>
					<div className="landing-width final-copy">
						<div>
							<h2 id="final-title">
								Put your
								<br />
								agent on-chain.
							</h2>
							<InstallButton />
						</div>
					</div>
				</section>
			</main>
			<footer className="landing-footer landing-width">
				<Link href="/" className="landing-brand">
					<BrandMark />
					BSV MCP
				</Link>
				<nav aria-label="Footer navigation">
					<Link href="/docs">Docs</Link>
					<a href={GITHUB_URL}>GitHub</a>
					<a href={`${GITHUB_URL}/blob/master/LICENSE`}>MIT</a>
				</nav>
			</footer>
		</div>
	);
}

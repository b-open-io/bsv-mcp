import type { ReactNode } from "react";
import { BrandMark } from "../../../components/landing/BrandMark";

export function LocalShell({
	children,
	active,
	onNavigate,
	navigation = true,
}: {
	children: ReactNode;
	active?: string;
	onNavigate?: (view: string) => void;
	navigation?: boolean;
}) {
	return (
		<div className={navigation ? "local-shell" : "local-shell setup-shell"}>
			<header className="local-header">
				<div className="brand-mark">
					<BrandMark className="brand-symbol" />
					<span>BSV MCP</span>
				</div>
				{navigation && onNavigate ? (
					<nav className="local-nav" aria-label="Local app sections">
						{["explorer", "wallet", "ordinals", "sweep"].map((view) => (
							<button
								key={view}
								type="button"
								className={active === view ? "nav-tab active" : "nav-tab"}
								aria-current={active === view ? "page" : undefined}
								onClick={() => onNavigate(view)}
							>
								{view}
							</button>
						))}
					</nav>
				) : null}
			</header>
			<main className="local-content">{children}</main>
			<footer className="local-footer">
				<span>LOCAL PROCESS</span>
				<span className="status-dot" aria-hidden="true" />
				<span>PRIVATE BY DEFAULT</span>
			</footer>
		</div>
	);
}

export function PageHeader({
	eyebrow,
	title,
	description,
}: {
	eyebrow: string;
	title: string;
	description?: string;
}) {
	return (
		<header className="page-header">
			<p className="eyebrow">
				<span>#</span> {eyebrow}
			</p>
			<h1>{title}</h1>
			{description ? <p className="page-description">{description}</p> : null}
		</header>
	);
}

export function Surface({
	children,
	className = "",
}: {
	children: ReactNode;
	className?: string;
}) {
	return <section className={`surface ${className}`}>{children}</section>;
}

export function Notice({
	children,
	tone = "info",
}: {
	children: ReactNode;
	tone?: "info" | "warning" | "error" | "success";
}) {
	return (
		<div
			className={`notice notice-${tone}`}
			role={tone === "error" || tone === "warning" ? "alert" : "status"}
		>
			{children}
		</div>
	);
}

export function Button({
	children,
	type = "button",
	variant = "primary",
	disabled,
	onClick,
	"aria-busy": ariaBusy,
}: {
	children: ReactNode;
	type?: "button" | "submit";
	variant?: "primary" | "secondary" | "danger";
	disabled?: boolean;
	onClick?: () => void;
	"aria-busy"?: boolean;
}) {
	return (
		<button
			type={type}
			className={`button button-${variant}`}
			disabled={disabled}
			onClick={onClick}
			aria-busy={ariaBusy}
		>
			{children}
		</button>
	);
}

export function Spinner({ label = "Loading" }: { label?: string }) {
	return (
		<div className="spinner-row" role="status">
			<span className="spinner" aria-hidden="true" />
			{label}
		</div>
	);
}

export function DataRow({ label, value }: { label: string; value: ReactNode }) {
	return (
		<div className="data-row">
			<span className="data-label">{label}</span>
			<span className="data-value">{value}</span>
		</div>
	);
}

"use client";

import { Menu, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const links = [
	{ href: "#tools", label: "/tools" },
	{ href: "#install", label: "/install" },
	{ href: "#faq", label: "/faq" },
	{ href: "/docs", label: "/docs" },
];

export function MobileMenu() {
	const [open, setOpen] = useState(false);

	return (
		<div className="sm:hidden">
			<Button
				type="button"
				variant="ghost"
				size="icon"
				onClick={() => setOpen((value) => !value)}
				aria-expanded={open}
				aria-label={open ? "Close menu" : "Open menu"}
			>
				{open ? <X /> : <Menu />}
			</Button>
			{open ? (
				<nav
					aria-label="Site"
					className="absolute inset-x-6 top-full z-50 rounded-lg border bg-background p-2 shadow-lg"
				>
					{links.map((link) => (
						<a
							key={link.href}
							href={link.href}
							onClick={() => setOpen(false)}
							className="block rounded-md px-4 py-3 font-mono text-sm hover:bg-muted"
						>
							{link.label}
						</a>
					))}
				</nav>
			) : null}
		</div>
	);
}

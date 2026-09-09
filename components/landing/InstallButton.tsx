"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export function InstallButton() {
	return (
		<Button asChild className="landing-install-button">
			{/* biome-ignore lint/a11y/useValidAnchor: Real section link with a no-JS fallback and explicit repeat navigation. */}
			<a
				href="#install"
				onClick={(event) => {
					if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
						return;
					const target = document.getElementById("install");
					if (!target) return;
					event.preventDefault();
					// Repeated clicks must scroll even when the URL already has this hash.
					if (window.location.hash !== "#install")
						window.history.pushState(window.history.state, "", "#install");
					target.scrollIntoView({ behavior: "auto", block: "start" });
					target.focus({ preventScroll: true });
				}}
			>
				<Download size={17} />
				Install
			</a>
		</Button>
	);
}

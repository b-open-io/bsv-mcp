"use client";

import { useEffect } from "react";

/** Expand the guide containing an existing bookmarked topic. */
export function GuideLinks() {
	useEffect(() => {
		const reveal = () => {
			let id: string;
			try {
				id = decodeURIComponent(window.location.hash.slice(1));
			} catch {
				return;
			}
			const target = document.getElementById(id);
			let parent: HTMLElement | null = target;
			while (parent) {
				if (parent instanceof HTMLDetailsElement) parent.open = true;
				parent = parent.parentElement;
			}
			target?.scrollIntoView();
		};
		reveal();
		window.addEventListener("hashchange", reveal);
		return () => window.removeEventListener("hashchange", reveal);
	}, []);
	return null;
}

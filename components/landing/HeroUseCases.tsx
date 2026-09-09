"use client";

import { useEffect, useState } from "react";

const useCases = [
	"Publish social posts and replies",
	"Send MNEE stablecoins",
	"Follow people and like posts",
	"Create and collect ordinals",
	"Trade tokens and collectibles",
	"Encrypt private data",
	"Sign and verify messages",
	"Store files on the blockchain",
	"Pay for APIs with BSV",
];

export function HeroUseCases() {
	const [text, setText] = useState(useCases[0]);

	useEffect(() => {
		const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
		const glyphs = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
		let timer: ReturnType<typeof setTimeout> | undefined;
		let active = 0;
		let frame = 0;
		const frames = 24;

		const decrypt = () => {
			if (document.hidden) {
				timer = setTimeout(decrypt, 500);
				return;
			}
			const phrase = useCases[active];
			const resolved = Math.floor((frame / frames) * phrase.length);
			setText(
				Array.from(phrase, (character, index) =>
					character === " " || index < resolved
						? character
						: glyphs[Math.floor(Math.random() * glyphs.length)],
				).join(""),
			);
			if (frame < frames) {
				frame += 1;
				timer = setTimeout(decrypt, 45);
			} else {
				timer = setTimeout(next, 2900);
			}
		};
		const next = () => {
			active = (active + 1) % useCases.length;
			frame = 0;
			decrypt();
		};
		const update = () => {
			clearTimeout(timer);
			active = 0;
			setText(useCases[0]);
			if (!motion.matches) timer = setTimeout(next, 2900);
		};
		update();
		motion.addEventListener("change", update);
		return () => {
			clearTimeout(timer);
			motion.removeEventListener("change", update);
		};
	}, []);

	return (
		<p className="hero-use-cases">
			<span className="sr-only">
				{useCases.join(", ")} from your AI client.
			</span>
			<span aria-hidden="true">
				<span className="hero-use-case-line">
					{useCases.map((useCase) => (
						<span key={useCase} className="hero-use-case-sizer">
							{useCase}
						</span>
					))}
					<span className="hero-use-case-decrypted">{text}</span>
				</span>
				<span className="hero-use-case-ending">from your AI client.</span>
			</span>
		</p>
	);
}

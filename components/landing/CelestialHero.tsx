"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";

export function CelestialHero() {
	const video = useRef<HTMLVideoElement>(null);
	useEffect(() => {
		const clip = video.current;
		if (!clip) return;
		const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
		let visible = false;
		const sync = () => {
			if (visible && !document.hidden && !motion.matches)
				void clip.play().catch(() => {});
			else clip.pause();
		};
		const observer = new IntersectionObserver(([entry]) => {
			visible = entry.isIntersecting;
			sync();
		});
		observer.observe(clip);
		motion.addEventListener("change", sync);
		document.addEventListener("visibilitychange", sync);
		return () => {
			clip.pause();
			observer.disconnect();
			motion.removeEventListener("change", sync);
			document.removeEventListener("visibilitychange", sync);
		};
	}, []);
	return (
		<div className="celestial-hero" aria-hidden="true">
			<Image
				src="/artwork/concentric-eclipse.webp"
				alt=""
				width={1254}
				height={1254}
				sizes="(max-width: 700px) 100vw, 65vw"
				priority
				className="eclipse-art"
			/>
			<video
				ref={video}
				className="eclipse-video"
				muted
				loop
				playsInline
				preload="none"
				onPlaying={(event) => {
					event.currentTarget.dataset.playing = "true";
				}}
				onError={(event) => {
					delete event.currentTarget.dataset.playing;
				}}
			>
				<source src="/artwork/grok-eclipse-loop.webm" type="video/webm" />
				<source src="/artwork/grok-eclipse-loop.mp4" type="video/mp4" />
			</video>
		</div>
	);
}

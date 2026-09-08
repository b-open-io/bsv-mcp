import type { CSSProperties } from "react";

/** Deterministic CSS stars keep the server render stable and need no image. */
export function StarField() {
	return (
		<div className="landing-stars" aria-hidden="true">
			{Array.from({ length: 180 }, (_, index) => (
				<span
					// biome-ignore lint/suspicious/noArrayIndexKey: Fixed decorative stars never reorder.
					key={index}
					className={index % 17 === 0 ? "landing-star sparkle" : "landing-star"}
					style={
						{
							left: `${((index * 73.37 + 11) % 100).toFixed(2)}%`,
							top: `${((index * 37.71 + 3) % 100).toFixed(2)}%`,
							"--star-size": `${index % 5 === 0 ? 2 : 1}px`,
							"--star-duration": `${4 + (index % 9)}s`,
							"--star-delay": `${-(index % 19)}s`,
						} as CSSProperties
					}
				/>
			))}
		</div>
	);
}

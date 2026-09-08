export type CloudBox = { x: number; y: number; width: number; height: number };
/** Conservative bounds include rotation, so independent text never collides. */
export function rotatedBounds(width: number, height: number, angle: number) {
	const radians = (Math.abs(angle) * Math.PI) / 180;
	return {
		width: width * Math.cos(radians) + height * Math.sin(radians) + 12,
		height: height * Math.cos(radians) + width * Math.sin(radians) + 12,
	};
}
export function overlaps(a: CloudBox, b: CloudBox) {
	return (
		Math.abs(a.x - b.x) * 2 < a.width + b.width &&
		Math.abs(a.y - b.y) * 2 < a.height + b.height
	);
}
export function findCloudSpace(
	width: number,
	height: number,
	bounds: { width: number; height: number },
	occupied: CloudBox[],
	seed: number,
): CloudBox | undefined {
	// Search an elliptical spiral; no cells, columns, or reserved containers.
	for (let i = 0; i < 2800; i++) {
		const angle = i * 2.399963 + seed;
		const radius = Math.sqrt(i / 2800) * 0.52;
		const box = {
			x: width * (0.5 + Math.cos(angle) * radius),
			y: height * (0.5 + Math.sin(angle) * radius),
			...bounds,
		};
		if (
			box.x - bounds.width / 2 < 8 ||
			box.x + bounds.width / 2 > width - 8 ||
			box.y - bounds.height / 2 < 8 ||
			box.y + bounds.height / 2 > height - 8
		)
			continue;
		if (!occupied.some((other) => overlaps(box, other))) return box;
	}
}

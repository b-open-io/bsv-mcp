import { expect, test } from "bun:test";
import { findCloudSpace, overlaps, rotatedBounds } from "./cloudPacking";

test("rotated bounds include the corners of a tilted label", () => {
	const result = rotatedBounds(200, 70, 9);
	expect(result.width).toBeGreaterThan(200);
	expect(result.height).toBeGreaterThan(70);
});
test("replacement uses free space without altering the surviving words", () => {
	const occupied = [
		{ x: 300, y: 220, width: 260, height: 100 },
		{ x: 150, y: 90, width: 180, height: 70 },
	];
	const before = JSON.stringify(occupied);
	const replacement = findCloudSpace(
		680,
		500,
		rotatedBounds(190, 85, -7),
		occupied,
		3,
	);
	expect(replacement).toBeDefined();
	expect(occupied.some((box) => overlaps(box, replacement!))).toBe(false);
	expect(JSON.stringify(occupied)).toBe(before);
});
test("a phrase that cannot fit is rejected instead of pushing other words", () => {
	expect(
		findCloudSpace(300, 200, { width: 400, height: 60 }, [], 1),
	).toBeUndefined();
	expect(
		findCloudSpace(
			300,
			200,
			{ width: 100, height: 60 },
			[{ x: 150, y: 100, width: 300, height: 200 }],
			1,
		),
	).toBeUndefined();
});

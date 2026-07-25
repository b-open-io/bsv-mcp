import { describe, expect, it } from "bun:test";
import {
	MARKET_FEE_PERCENTAGE,
	MINIMUM_MARKET_FEE_SATOSHIS,
} from "../constants";
import { computeMarketplaceRate } from "./purchaseListing";

describe("computeMarketplaceRate", () => {
	it("applies the minimum fee floor below the threshold", () => {
		const price = 100_000;

		expect(computeMarketplaceRate(price)).toBe(
			MINIMUM_MARKET_FEE_SATOSHIS / price,
		);
	});

	it("applies the percentage above the minimum-fee threshold", () => {
		expect(computeMarketplaceRate(1_000_000)).toBe(MARKET_FEE_PERCENTAGE);
	});

	it("returns a finite rate for a zero price", () => {
		const rate = computeMarketplaceRate(0);

		expect(rate).toBe(MARKET_FEE_PERCENTAGE);
		expect(Number.isFinite(rate)).toBe(true);
	});
});

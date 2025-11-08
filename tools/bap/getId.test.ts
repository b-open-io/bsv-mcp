import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { fetchProfile } from "./getId";
import type { IdentityData, SigmaIdentityProfile } from "./types";

// Store the original fetch function
const originalFetch = global.fetch;
let fetchMock: ReturnType<typeof spyOn>;

describe("BAP getId - fetchProfile", () => {
	beforeEach(() => {
		// Create a new spy for global.fetch before each test
		// and assign it to global.fetch
		fetchMock = spyOn(globalThis, "fetch");
	});

	afterEach(() => {
		// Restore the original fetch function after each test
		fetchMock.mockRestore();
	});

	it("should return identity data for a valid idKey", async () => {
		const mockIdKey = "testIdKey";
		const mockIdentityData: IdentityData = {
			"@context": ["https://w3id.org/did/v0.11", "https://w3id.org/bap/v1"],
			id: `did:bap:id:${mockIdKey}`,
			publicKey: [
				{
					id: `did:bap:id:${mockIdKey}#root`,
					controller: `did:bap:id:${mockIdKey}`,
					type: "EcdsaSecp256k1VerificationKey2019",
					bitcoinAddress: "1SomeBitcoinAddress",
				},
			],
			authentication: ["#root"],
			assertionMethod: ["#root"],
		};
		const mockApiResponse: SigmaIdentityProfile = { result: mockIdentityData };

		// fetchMock.mockResolvedValueOnce({
		fetchMock.mockImplementationOnce(async () => ({
			ok: true,
			json: async () => mockApiResponse,
			text: async () => JSON.stringify(mockApiResponse),
			status: 200,
		}));

		const profile = await fetchProfile(mockIdKey);
		expect(profile).toEqual(mockIdentityData);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(fetchMock).toHaveBeenCalledWith(
			expect.stringContaining("/identity/get"),
			expect.objectContaining({
				method: "POST",
				body: JSON.stringify({ idKey: mockIdKey }),
			}),
		);
	});

	it("should return null if Sigma API returns 404", async () => {
		const mockIdKey = "nonExistentIdKey";
		// fetchMock.mockResolvedValueOnce({
		fetchMock.mockImplementationOnce(async () => ({
			ok: false,
			status: 404,
			json: async () => ({ error: "not found" }), // Mock error body for 404
			text: async () => "not found",
		}));

		const profile = await fetchProfile(mockIdKey);
		expect(profile).toBeNull();
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("should throw an error if Sigma API request fails (non-404)", async () => {
		const mockIdKey = "errorIdKey";
		// fetchMock.mockResolvedValueOnce({
		fetchMock.mockImplementationOnce(async () => ({
			ok: false,
			status: 500,
			json: async () => ({ error: "server error" }),
			text: async () => "server error",
		}));

		await expect(fetchProfile(mockIdKey)).rejects.toThrow(
			"Sigma API request failed with status 500: server error",
		);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("should throw an error if Sigma API response is malformed (missing result)", async () => {
		const mockIdKey = "malformedIdKey";
		// fetchMock.mockResolvedValueOnce({
		fetchMock.mockImplementationOnce(async () => ({
			ok: true,
			status: 200,
			json: async () => ({}), // Empty object, missing 'result'
			text: async () => "{}",
		}));

		await expect(fetchProfile(mockIdKey)).rejects.toThrow(
			"Sigma API response is missing the 'result' field.",
		);
	});

	it("should throw an error if Sigma API response is not valid JSON", async () => {
		const mockIdKey = "invalidJsonIdKey";
		// fetchMock.mockResolvedValueOnce({
		fetchMock.mockImplementationOnce(async () => ({
			ok: true,
			status: 200,
			json: async () => {
				throw new Error("Invalid JSON");
			}, // Simulate JSON parsing error
			text: async () => "This is not JSON",
		}));

		expect(fetchProfile(mockIdKey)).rejects.toThrow(
			"Failed to parse Sigma API response: Invalid JSON",
		);
	});
});

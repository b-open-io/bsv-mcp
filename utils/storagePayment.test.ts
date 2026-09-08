import { afterEach, expect, mock, spyOn, test } from "bun:test";
import { installStoragePaymentAutoRetry } from "@1sat/wallet";
import { AuthFetch } from "@bsv/sdk/auth";
import { denyStoragePayment } from "./storagePayment";

afterEach(() => mock.restore());

test("storage 507 denial never builds or broadcasts an implicit payment", async () => {
	let createActionCalls = 0;
	const wallet = {
		createAction: async () => {
			createActionCalls += 1;
			throw new Error("network error 507 507");
		},
		signAction: async () => ({ txid: "unused" }),
		internalizeAction: async () => ({}),
	};
	const statusRequest = spyOn(AuthFetch.prototype, "fetch").mockResolvedValue(
		Response.json({
			accountsEnabled: true,
			deficitBytes: 100,
			pricing: { purchaseUnitBytes: 100, satsPerUnit: 1 },
			serverIdentityKey:
				"0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
			nextPayment: { derivationPrefix: "storage", derivationSuffix: "1" },
		}),
	);

	installStoragePaymentAutoRetry({
		wallet: wallet as never,
		getActiveRemoteUrl: () => "https://wallet.example",
		onStoragePaymentRequired: denyStoragePayment,
	});

	await expect(wallet.createAction()).rejects.toMatchObject({
		code: "storage-payment-failed",
	});
	// The first failed operation is the only createAction call. A payment
	// transaction would call this method a second time and issue a broadcast.
	expect(createActionCalls).toBe(1);
	expect(statusRequest).toHaveBeenCalledTimes(1);
	await new Promise((resolve) => setTimeout(resolve, 0));
	expect(statusRequest).toHaveBeenCalledTimes(1);
});

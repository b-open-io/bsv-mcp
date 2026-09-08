/**
 * Embedded bsv-mcp wallets must never fund a storage bill implicitly. A
 * future, reviewed consent flow can replace this hook at the application
 * boundary; until then the wallet SDK's 507 retry path is fail-closed.
 */
export async function denyStoragePayment(_info: unknown): Promise<boolean> {
	return false;
}

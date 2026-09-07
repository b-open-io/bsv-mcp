import { expect, test } from "bun:test";
import { POST } from "./route";

test("retired onboarding never issues a session", async () => {
	const response = await POST();
	expect(response.status).toBe(410);
	expect(response.headers.get("Cache-Control")).toBe("no-store");
	const body = await response.json();
	expect(body.sessionToken).toBeUndefined();
	expect(body.error).toContain("OAuth");
});

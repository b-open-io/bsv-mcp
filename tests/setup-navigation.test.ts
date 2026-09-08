import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import {
	allowedStep,
	parseSetupPath,
	resolveSetupStep,
	SETUP_STEPS,
	type SetupStep,
	setupPathForStep,
	useSetupNavigation,
} from "../src/views/hooks/useSetupNavigation";

const MIGRATION_SEARCH = "?mode=migration";
const stepRank = (step: SetupStep): number => SETUP_STEPS.indexOf(step);

describe("setup step contract", () => {
	test("exports the exact step tuple in order", () => {
		expect([...SETUP_STEPS]).toEqual([
			"source",
			"destination",
			"unlock",
			"review",
		]);
	});
});

describe("parseSetupPath", () => {
	test("resolves each exact setup route", () => {
		expect(parseSetupPath("/setup/source")).toBe("source");
		expect(parseSetupPath("/setup/destination")).toBe("destination");
		expect(parseSetupPath("/setup/unlock")).toBe("unlock");
		expect(parseSetupPath("/setup/review")).toBe("review");
	});

	test("rejects invalid routes", () => {
		for (const pathname of [
			"/setup",
			"/setup/",
			"/",
			"",
			"/setup/other",
			"/setup/source/extra",
			"/setup/source?mode=migration",
			"/SETUP/SOURCE",
			"/setup/Source",
			"/migration/source",
		]) {
			expect(parseSetupPath(pathname)).toBeNull();
		}
	});
});

describe("resolveSetupStep", () => {
	test("non-migration URLs always resolve to source", () => {
		for (const search of ["", "?foo=bar", "?mode=other", "?mode="]) {
			for (const pathname of ["/setup/review", "/setup/unlock", "/nowhere"]) {
				expect(resolveSetupStep(pathname, search, "review")).toBe("source");
			}
		}
	});

	test("migration URLs resolve to their route when within maxStep", () => {
		expect(resolveSetupStep("/setup/review", MIGRATION_SEARCH, "review")).toBe(
			"review",
		);
		expect(
			resolveSetupStep("/setup/destination", MIGRATION_SEARCH, "unlock"),
		).toBe("destination");
	});

	test("invalid migration routes fall back to source", () => {
		expect(resolveSetupStep("/setup/nope", MIGRATION_SEARCH, "review")).toBe(
			"source",
		);
		expect(resolveSetupStep("/", MIGRATION_SEARCH, "review")).toBe("source");
	});

	test("direct links past maxStep clamp to maxStep instead of skipping", () => {
		expect(resolveSetupStep("/setup/review", MIGRATION_SEARCH, "source")).toBe(
			"source",
		);
		expect(
			resolveSetupStep("/setup/review", MIGRATION_SEARCH, "destination"),
		).toBe("destination");
		expect(resolveSetupStep("/setup/review", MIGRATION_SEARCH, "unlock")).toBe(
			"unlock",
		);
		expect(
			resolveSetupStep("/setup/unlock", MIGRATION_SEARCH, "destination"),
		).toBe("destination");
	});

	test("resolved steps never advance past maxStep", () => {
		const paths = [
			"/setup/source",
			"/setup/destination",
			"/setup/unlock",
			"/setup/review",
		];
		for (const maxStep of SETUP_STEPS) {
			for (const pathname of paths) {
				const resolved = resolveSetupStep(pathname, MIGRATION_SEARCH, maxStep);
				expect(stepRank(resolved) <= stepRank(maxStep)).toBe(true);
			}
		}
	});
});

describe("allowedStep guards", () => {
	test("backward and same-step navigation are allowed", () => {
		expect(allowedStep("source", "review")).toBe(true);
		expect(allowedStep("destination", "review")).toBe(true);
		expect(allowedStep("review", "review")).toBe(true);
		expect(allowedStep("source", "source")).toBe(true);
	});

	test("forward steps past maxStep are blocked", () => {
		expect(allowedStep("review", "source")).toBe(false);
		expect(allowedStep("unlock", "destination")).toBe(false);
		expect(allowedStep("destination", "source")).toBe(false);
		expect(allowedStep("review", "unlock")).toBe(false);
	});

	test("every step is allowed exactly up to its own rank", () => {
		for (const requested of SETUP_STEPS) {
			for (const maxStep of SETUP_STEPS) {
				expect(allowedStep(requested, maxStep)).toBe(
					stepRank(requested) <= stepRank(maxStep),
				);
			}
		}
	});
});

describe("setupPathForStep", () => {
	test("builds exact setup routes", () => {
		for (const step of SETUP_STEPS) {
			expect(setupPathForStep(step, MIGRATION_SEARCH)).toBe(
				`/setup/${step}?mode=migration`,
			);
		}
	});

	test("preserves safe query parameters and inserts mode=migration", () => {
		const url = setupPathForStep("unlock", "?theme=dark&account=main");
		const params = new URLSearchParams(url.split("?")[1]);
		expect(url.startsWith("/setup/unlock?")).toBe(true);
		expect(params.get("theme")).toBe("dark");
		expect(params.get("account")).toBe("main");
		expect(params.get("mode")).toBe("migration");
	});

	test("keeps an existing mode=migration instead of duplicating it", () => {
		const params = new URLSearchParams(
			setupPathForStep("review", "?mode=migration&foo=1").split("?")[1],
		);
		expect(params.getAll("mode")).toEqual(["migration"]);
		expect(params.get("foo")).toBe("1");
	});

	test("overrides a non-migration mode value", () => {
		const params = new URLSearchParams(
			setupPathForStep("source", "?mode=other").split("?")[1],
		);
		expect(params.get("mode")).toBe("migration");
	});

	test("never emits a hash fragment", () => {
		for (const step of SETUP_STEPS) {
			expect(setupPathForStep(step, MIGRATION_SEARCH)).not.toContain("#");
		}
	});

	test("strips tokens, passphrases, and session material", () => {
		const url = setupPathForStep(
			"destination",
			"?token=abc&sourcePassphrase=shh&destinationPassphrase=shh" +
				"&sessionId=123&session=xyz&secret=s&password=pw&foo=keep&mode=migration",
		);
		expect(url).not.toContain("abc");
		expect(url).not.toContain("shh");
		expect(url).not.toContain("123");
		expect(url).not.toContain("token=");
		expect(url).not.toContain("Passphrase=");
		expect(url).not.toContain("session");
		expect(url).not.toContain("secret=");
		expect(url).not.toContain("password=");
		const params = new URLSearchParams(url.split("?")[1]);
		expect(params.get("foo")).toBe("keep");
		expect(params.get("mode")).toBe("migration");
	});
});

describe("hook navigation semantics via helpers", () => {
	test("goToStep targets stay within maxStep with no duplicate pushes", () => {
		const current: SetupStep = "destination";
		const maxStep: SetupStep = "unlock";
		const shouldPush = (next: SetupStep, busy: boolean): boolean =>
			!busy && allowedStep(next, maxStep) && next !== current;
		expect(shouldPush("source", false)).toBe(true);
		expect(shouldPush("destination", false)).toBe(false);
		expect(shouldPush("unlock", false)).toBe(true);
		expect(shouldPush("review", false)).toBe(false);
		expect(shouldPush("source", true)).toBe(false);
		expect(shouldPush("unlock", true)).toBe(false);
	});

	test("busy popstate restores the current route without moving", () => {
		const current: SetupStep = "destination";
		const restored = setupPathForStep(current, "?mode=migration");
		expect(restored).toBe("/setup/destination?mode=migration");
		expect(resolveSetupStep("/setup/review", MIGRATION_SEARCH, current)).toBe(
			current,
		);
	});

	test("a shrinking maxStep clamps the current route", () => {
		const current: SetupStep = "review";
		const nextMax: SetupStep = "destination";
		const clamped = allowedStep(current, nextMax) ? current : nextMax;
		expect(clamped).toBe("destination");
		expect(setupPathForStep(clamped, MIGRATION_SEARCH)).toBe(
			"/setup/destination?mode=migration",
		);
	});
});

describe("useSetupNavigation SSR", () => {
	test("renders inertly and starts at source without a window", () => {
		expect(typeof (globalThis as { window?: unknown }).window).toBe(
			"undefined",
		);
		let captured:
			| { step: SetupStep; goToStep: (step: SetupStep) => void }
			| undefined;
		function Probe() {
			captured = useSetupNavigation({ maxStep: "review", busy: false });
			return createElement("span", null, captured.step);
		}
		const html = renderToString(createElement(Probe));
		expect(html).toContain("source");
		expect(captured?.step).toBe("source");
		expect(typeof captured?.goToStep).toBe("function");
	});
});

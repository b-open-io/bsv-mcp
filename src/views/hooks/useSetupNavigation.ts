import { useCallback, useEffect, useRef, useState } from "react";

export const SETUP_STEPS = [
	"source",
	"destination",
	"unlock",
	"review",
] as const;
export type SetupStep = (typeof SETUP_STEPS)[number];

const MIGRATION_MODE = "migration";

/** Query keys that must never appear in a setup URL, history entry, or state. */
const SECRET_QUERY_KEYS = new Set([
	"token",
	"setuptoken",
	"setup_token",
	"passphrase",
	"sourcepassphrase",
	"source_passphrase",
	"destinationpassphrase",
	"destination_passphrase",
	"password",
	"passwd",
	"session",
	"sessionid",
	"session_id",
	"secret",
	"privatekey",
	"private_key",
	"wif",
	"mnemonic",
	"auth",
	"authorization",
	"accesstoken",
	"access_token",
	"refreshtoken",
	"refresh_token",
	"idtoken",
	"id_token",
	"apikey",
	"api_key",
]);

function stepIndex(step: SetupStep): number {
	return SETUP_STEPS.indexOf(step);
}

/** Parse an exact setup pathname. Returns null for anything else. */
export function parseSetupPath(pathname: string): SetupStep | null {
	if (typeof pathname !== "string") return null;
	const normalized =
		pathname.length > 1 && pathname.endsWith("/")
			? pathname.slice(0, -1)
			: pathname;
	switch (normalized) {
		case "/setup/source":
			return "source";
		case "/setup/destination":
			return "destination";
		case "/setup/unlock":
			return "unlock";
		case "/setup/review":
			return "review";
		default:
			return null;
	}
}

function hasMigrationMode(search: string): boolean {
	try {
		return new URLSearchParams(search).get("mode") === MIGRATION_MODE;
	} catch {
		return false;
	}
}

/** True when navigating to `requested` stays within the unlocked `maxStep`. */
export function allowedStep(requested: SetupStep, maxStep: SetupStep): boolean {
	const requestedIndex = stepIndex(requested);
	const maxIndex = stepIndex(maxStep);
	return requestedIndex !== -1 && maxIndex !== -1 && requestedIndex <= maxIndex;
}

/**
 * Resolve a URL to the step the wizard should show. Non-migration URLs and
 * unknown routes resolve to "source"; direct links past `maxStep` clamp to
 * `maxStep` instead of skipping there.
 */
export function resolveSetupStep(
	pathname: string,
	search: string,
	maxStep: SetupStep,
): SetupStep {
	if (!hasMigrationMode(search)) return "source";
	const parsed = parseSetupPath(pathname);
	if (parsed === null) return "source";
	return allowedStep(parsed, maxStep) ? parsed : maxStep;
}

/**
 * Build the URL for `step`, preserving the current non-secret query parameters
 * and forcing `mode=migration`. Hash fragments are never carried over and
 * secret material is stripped, never added.
 */
export function setupPathForStep(
	step: SetupStep,
	currentSearch: string,
): string {
	const params = new URLSearchParams(currentSearch);
	for (const key of [...params.keys()]) {
		if (SECRET_QUERY_KEYS.has(key.toLowerCase())) params.delete(key);
	}
	params.set("mode", MIGRATION_MODE);
	const query = params.toString();
	return `/setup/${step}${query ? `?${query}` : ""}`;
}

function readLocation(): { pathname: string; search: string } {
	return {
		pathname: window.location.pathname,
		search: window.location.search,
	};
}

export function useSetupNavigation(options: {
	maxStep: SetupStep;
	busy: boolean;
}): {
	step: SetupStep;
	goToStep: (step: SetupStep) => void;
} {
	const { maxStep, busy } = options;
	// Starts at "source" without touching window so SSR and bare imports stay inert.
	const [step, setStep] = useState<SetupStep>("source");
	const stepRef = useRef<SetupStep>("source");
	const maxStepRef = useRef<SetupStep>(maxStep);
	const busyRef = useRef<boolean>(busy);

	useEffect(() => {
		stepRef.current = step;
		maxStepRef.current = maxStep;
		busyRef.current = busy;
	});

	// Initial post-mount normalization: resolve the URL, clamp direct links,
	// strip hashes/secrets, and replace (never push) the canonical route.
	useEffect(() => {
		if (typeof window === "undefined") return;
		const location = readLocation();
		const resolved = resolveSetupStep(
			location.pathname,
			location.search,
			maxStepRef.current,
		);
		stepRef.current = resolved;
		setStep(resolved);
		window.history.replaceState(
			null,
			"",
			setupPathForStep(resolved, location.search),
		);
	}, []);

	// Back/forward navigation: resolve and clamp the route against maxStep.
	// While busy, restore the current route instead of moving.
	useEffect(() => {
		if (typeof window === "undefined") return;
		const onPopState = () => {
			const current = stepRef.current;
			const location = readLocation();
			if (busyRef.current) {
				window.history.replaceState(
					null,
					"",
					setupPathForStep(current, location.search),
				);
				return;
			}
			const resolved = resolveSetupStep(
				location.pathname,
				location.search,
				maxStepRef.current,
			);
			if (resolved !== current) {
				stepRef.current = resolved;
				setStep(resolved);
			}
			const expected = setupPathForStep(resolved, location.search);
			if (`${location.pathname}${location.search}` !== expected) {
				window.history.replaceState(null, "", expected);
			}
		};
		window.addEventListener("popstate", onPopState);
		return () => window.removeEventListener("popstate", onPopState);
	}, []);

	// A shrinking maxStep clamps the current route after render via replaceState.
	useEffect(() => {
		if (typeof window === "undefined") return;
		if (!allowedStep(step, maxStep)) {
			stepRef.current = maxStep;
			setStep(maxStep);
			window.history.replaceState(
				null,
				"",
				setupPathForStep(maxStep, window.location.search),
			);
		}
	}, [maxStep, step]);

	const goToStep = useCallback(
		(next: SetupStep) => {
			if (typeof window === "undefined") return;
			if (busy) return;
			if (!allowedStep(next, maxStep)) return;
			if (next === step) return;
			setStep(next);
			stepRef.current = next;
			window.history.pushState(
				null,
				"",
				setupPathForStep(next, window.location.search),
			);
		},
		[busy, maxStep, step],
	);

	return { step, goToStep };
}

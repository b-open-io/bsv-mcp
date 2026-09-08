import { useEffect, useSyncExternalStore } from "react";
import { Dashboard } from "../features/Dashboard";
import { FirstRun } from "../features/FirstRun";
import { Migration } from "../features/Migration";

type LocalState = {
	mode: string | null;
	token: string;
	flow: string | null;
};

const serverSnapshot: LocalState = { mode: null, token: "", flow: null };
let clientSnapshot: LocalState | null = null;

function getServerSnapshot(): LocalState {
	return serverSnapshot;
}

function getClientSnapshot(): LocalState {
	if (!clientSnapshot) {
		const hash = window.location.hash.slice(1);
		const nextMode = window.location.pathname.startsWith("/setup/")
			? "migration"
			: new URLSearchParams(window.location.search).get("mode");
		clientSnapshot = {
			mode: nextMode,
			token: hash,
			flow: new URLSearchParams(window.location.search).get("flow"),
		};
	}
	return clientSnapshot;
}

function subscribe(): () => void {
	return () => {};
}

export function LocalApp() {
	const { mode, token, flow } = useSyncExternalStore(
		subscribe,
		getClientSnapshot,
		getServerSnapshot,
	);
	useEffect(() => {
		if (typeof window === "undefined") return;
		if (token)
			window.history.replaceState(
				null,
				"",
				`${window.location.pathname}?mode=${mode ?? "migration"}${flow === "project" || flow === "standalone" ? `&flow=${flow}` : ""}`,
			);
	}, [mode, token, flow]);
	return mode === "migration" || token.length > 0 ? (
		flow === "project" ? (
			<Migration token={token} />
		) : (
			<FirstRun token={token} standalone={flow === "standalone"} />
		)
	) : (
		<Dashboard />
	);
}

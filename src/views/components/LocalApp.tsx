import { useMemo } from "react";
import { Dashboard } from "../features/Dashboard";
import { Migration } from "../features/Migration";

export function LocalApp() {
	const { mode, token } = useMemo(() => {
		const hash = window.location.hash.slice(1);
		const nextMode = new URLSearchParams(window.location.search).get("mode");
		if (hash)
			window.history.replaceState(
				null,
				"",
				`${window.location.pathname}?mode=${nextMode ?? "migration"}`,
			);
		return { mode: nextMode, token: hash };
	}, []);
	return mode === "migration" || token.length > 0 ? (
		<Migration token={token} />
	) : (
		<Dashboard />
	);
}

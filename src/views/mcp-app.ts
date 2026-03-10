import { App } from "@modelcontextprotocol/ext-apps";

// ── XSS helper ───────────────────────────────────────────────────────────────
function esc(s: string): string {
	const div = document.createElement("div");
	div.textContent = s;
	return div.innerHTML;
}

// ── Clipboard helper ─────────────────────────────────────────────────────────
async function copyText(text: string, btn: HTMLElement) {
	try {
		await navigator.clipboard.writeText(text);
		const prev = btn.innerHTML;
		btn.innerHTML = `<svg viewBox="0 0 24 24" style="width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><polyline points="20 6 9 17 4 12"/></svg>`;
		setTimeout(() => { btn.innerHTML = prev; }, 1500);
	} catch { /* clipboard unavailable in iframe */ }
}

// ── Utilities ────────────────────────────────────────────────────────────────
function truncateMid(s: string, keep = 8): string {
	if (s.length <= keep * 2 + 3) return s;
	return `${s.slice(0, keep)}...${s.slice(-keep)}`;
}

function formatSats(n: number): string {
	return n.toLocaleString() + " sats";
}

function formatDifficulty(d: number | undefined): string {
	if (!d) return "—";
	if (d >= 1e15) return `${(d / 1e15).toFixed(1)} PH`;
	if (d >= 1e12) return `${(d / 1e12).toFixed(1)} TH`;
	if (d >= 1e9) return `${(d / 1e9).toFixed(1)} GH`;
	if (d >= 1e6) return `${(d / 1e6).toFixed(1)} MH`;
	return d.toLocaleString();
}

function timeAgo(ts: number | undefined): string {
	if (!ts) return "—";
	const seconds = Math.floor(Date.now() / 1000) - ts;
	if (seconds < 60) return `${seconds}s ago`;
	if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
	return `${Math.floor(seconds / 3600)}h ago`;
}

// ── Tab switching ────────────────────────────────────────────────────────────
const tabs = document.querySelectorAll<HTMLButtonElement>(".view-tab");
const panels: Record<string, HTMLElement> = {
	explorer: document.getElementById("explorer-panel")!,
	wallet: document.getElementById("wallet-panel")!,
	ordinals: document.getElementById("ordinals-panel")!,
};

let walletLoaded = false;
let ordinalsLoaded = false;

function switchTab(view: string) {
	for (const tab of tabs) {
		const isActive = tab.dataset.view === view;
		tab.classList.toggle("active", isActive);
		tab.setAttribute("aria-selected", String(isActive));
	}
	for (const [key, panel] of Object.entries(panels)) {
		panel.classList.toggle("active", key === view);
	}
	if (view === "wallet" && !walletLoaded) loadWalletData();
	if (view === "ordinals" && !ordinalsLoaded) loadOrdinalsData();
}

for (const tab of tabs) {
	tab.addEventListener("click", () => switchTab(tab.dataset.view!));
}

// ── MCP App connection ───────────────────────────────────────────────────────
const app = new App({ name: "BSV MCP", version: "1.0.0" });

app.ontoolresult = (result) => {
	if (result.structuredContent) {
		onDashboardReady(result.structuredContent as Record<string, unknown>);
	}
};

app.onhostcontextchanged = (_ctx) => {
	// Theme is always dark — design is dark-only
};

await app.connect();

// ── Boot ─────────────────────────────────────────────────────────────────────
function onDashboardReady(_data: Record<string, unknown>) {
	document.getElementById("loading")!.style.display = "none";
	document.getElementById("app")!.classList.add("ready");
	loadExplorerData();
}

// ── Explorer ─────────────────────────────────────────────────────────────────
const explorerContent = document.getElementById("explorer-content")!;

async function loadExplorerData() {
	explorerContent.innerHTML = `<div class="empty-state">loading...</div>`;
	try {
		const result = await app.callServerTool({ name: "app_explorer_data", arguments: {} });
		if (result?.structuredContent) {
			renderExplorer(result.structuredContent as Record<string, unknown>);
		}
	} catch (err) {
		explorerContent.innerHTML = `<div class="error-box">Failed to load explorer data: ${esc(String(err))}</div>`;
	}
}

function renderExplorer(data: Record<string, unknown>) {
	const price = data.price as number | undefined;
	const chainInfo = data.chainInfo as Record<string, unknown> | undefined;
	const recentBlocks = data.recentBlocks as Array<Record<string, unknown>> | undefined;

	const blocks = chainInfo?.blocks as number | undefined;
	const difficulty = chainInfo?.difficulty as number | undefined;
	const bestblockhash = chainInfo?.bestblockhash as string | undefined;

	explorerContent.innerHTML = `
		<div class="stats-row">
			<div class="stat-card">
				<div class="stat-label">Block Height</div>
				<div class="stat-value">${blocks ? blocks.toLocaleString() : "—"}</div>
			</div>
			<div class="stat-card">
				<div class="stat-label">BSV Price</div>
				<div class="stat-value">${price ? `$${price.toFixed(2)}` : "—"}</div>
			</div>
			<div class="stat-card">
				<div class="stat-label">Network Difficulty</div>
				<div class="stat-value">${formatDifficulty(difficulty)}</div>
			</div>
			<div class="stat-card">
				<div class="stat-label">Best Block</div>
				<div class="stat-value" style="font-size:12px;margin-top:4px">${bestblockhash ? truncateMid(bestblockhash, 6) : "—"}</div>
			</div>
		</div>

		${recentBlocks && recentBlocks.length > 0 ? renderBlocksTable(recentBlocks) : ""}

		<div id="search-results"></div>
	`;

	wireSearch();
}

function renderBlocksTable(blocks: Array<Record<string, unknown>>): string {
	const rows = blocks.map(b => {
		const height = b.height as number | undefined;
		const hash = b.hash as string | undefined;
		const txs = b.tx as Array<unknown> | undefined;
		const size = b.size as number | undefined;
		const time = b.time as number | undefined;
		return `
			<div class="blocks-table-row">
				<div class="cell-mono">${height?.toLocaleString() ?? "—"}</div>
				<div class="cell-hash">${hash ? truncateMid(hash, 10) : "—"}</div>
				<div class="cell-dim" style="text-align:right">${txs ? txs.length.toLocaleString() : "—"}</div>
				<div class="cell-dim" style="text-align:right">${size ? `${(size / 1024).toFixed(1)} KB` : "—"}</div>
				<div class="cell-dim" style="text-align:right">${timeAgo(time)}</div>
			</div>
		`;
	}).join("");

	return `
		<div class="blocks-section">
			<div class="section-header">Recent Blocks</div>
			<div class="blocks-table">
				<div class="blocks-table-header">
					<div class="col-header">Height</div>
					<div class="col-header">Hash</div>
					<div class="col-header col-right">Txs</div>
					<div class="col-header col-right">Size</div>
					<div class="col-header col-right">Time</div>
				</div>
				${rows}
			</div>
		</div>
	`;
}

function wireSearch() {
	const searchInput = document.getElementById("search-input") as HTMLInputElement | null;
	const searchBtn = document.getElementById("search-btn");
	const searchResults = document.getElementById("search-results");
	if (!searchInput || !searchBtn || !searchResults) return;

	async function doSearch() {
		const query = searchInput!.value.trim();
		if (!query) return;
		searchResults!.innerHTML = `<div class="empty-state">searching...</div>`;
		try {
			const isTxid = /^[0-9a-f]{64}$/i.test(query);
			const isAddress = query.startsWith("1") && query.length >= 25 && query.length <= 34;
			const args: Record<string, string> = {};
			if (isTxid) args.txid = query;
			else if (isAddress) args.address = query;
			else args.query = query;

			const res = await app.callServerTool({ name: "app_explorer_data", arguments: args });
			if (res?.structuredContent) {
				renderSearchResult(searchResults!, res.structuredContent as Record<string, unknown>, query);
			}
		} catch (err) {
			searchResults!.innerHTML = `<div class="error-box">${esc(String(err))}</div>`;
		}
	}

	searchBtn.addEventListener("click", doSearch);
	searchInput.addEventListener("keydown", (e) => { if (e.key === "Enter") doSearch(); });
}

function renderSearchResult(el: HTMLElement, data: Record<string, unknown>, query: string) {
	const tx = data.transaction as Record<string, unknown> | undefined;
	const addr = data.addressInfo as Record<string, unknown> | undefined;

	if (tx) {
		const outputs = tx.outputs as Array<Record<string, unknown>> | [];
		el.innerHTML = `
			<div class="blocks-section">
				<div class="section-header">Transaction</div>
				<div class="search-result">
					<div class="result-row"><span class="result-key">TXID</span><span class="result-val">${esc(String(tx.txid ?? query))}</span></div>
					<div class="result-row"><span class="result-key">Size</span><span class="result-val">${tx.size} bytes</span></div>
					${tx.fee != null ? `<div class="result-row"><span class="result-key">Fee</span><span class="result-val">${tx.fee} sats</span></div>` : ""}
					${tx.confirmations != null ? `<div class="result-row"><span class="result-key">Confirmations</span><span class="result-val">${tx.confirmations}</span></div>` : ""}
					<div class="result-row"><span class="result-key">Outputs</span><span class="result-val">${(outputs as Array<unknown>).length}</span></div>
				</div>
			</div>
		`;
	} else if (addr) {
		const balance = addr.balance as Record<string, unknown> | undefined;
		const history = addr.history as Array<Record<string, unknown>> | undefined;
		el.innerHTML = `
			<div class="blocks-section">
				<div class="section-header">Address</div>
				<div class="search-result">
					<div class="result-row"><span class="result-key">Address</span><span class="result-val">${esc(query)}</span></div>
					<div class="result-row"><span class="result-key">Confirmed</span><span class="result-val">${balance ? formatSats(Number(balance.confirmed ?? 0)) : "—"}</span></div>
					${balance?.unconfirmed ? `<div class="result-row"><span class="result-key">Unconfirmed</span><span class="result-val">${formatSats(Number(balance.unconfirmed))}</span></div>` : ""}
					${history ? `<div class="result-row"><span class="result-key">Transactions</span><span class="result-val">${history.length}</span></div>` : ""}
				</div>
			</div>
		`;
	} else {
		el.innerHTML = `<div class="empty-state">No results found</div>`;
	}
}

// ── Wallet ───────────────────────────────────────────────────────────────────
async function loadWalletData() {
	// Show loading state inline
	document.getElementById("balance-value")!.textContent = "loading...";
	document.getElementById("utxo-list")!.innerHTML = `<div class="empty-state">loading...</div>`;
	try {
		const result = await app.callServerTool({ name: "app_wallet_data", arguments: {} });
		if (result?.structuredContent) {
			const data = result.structuredContent as Record<string, unknown>;
			if (data.error) {
				document.getElementById("balance-value")!.textContent = "—";
				document.getElementById("utxo-list")!.innerHTML = `<div class="error-box">${esc(String(data.error))}</div>`;
				return;
			}
			walletLoaded = true;
			renderWallet(data);
		}
	} catch (err) {
		document.getElementById("balance-value")!.textContent = "error";
		document.getElementById("utxo-list")!.innerHTML = `<div class="error-box">${esc(String(err))}</div>`;
	}
}

function renderWallet(data: Record<string, unknown>) {
	const balance = data.balance as Record<string, unknown> | undefined;
	const address = data.address as string | undefined;
	const utxos = data.utxos as Array<Record<string, unknown>> | undefined;
	const price = data.price as number | undefined;

	const satoshis = Number(balance?.satoshis ?? 0);
	const bsv = balance?.bsv ? String(balance.bsv) : (satoshis / 100_000_000).toFixed(8);
	const usdValue = price ? (satoshis / 100_000_000) * price : null;
	const utxoCount = Number(balance?.utxoCount ?? (utxos?.length ?? 0));

	// Hero
	document.getElementById("balance-value")!.textContent = `${bsv} BSV`;
	document.getElementById("sats-value")!.textContent = `${satoshis.toLocaleString()} sats`;
	document.getElementById("usd-value")!.textContent = usdValue != null ? `~$${usdValue.toFixed(2)} USD` : "— USD";
	document.getElementById("utxo-count")!.textContent = `${utxoCount} UTXOs`;

	// Address
	if (address) {
		const addrSection = document.getElementById("address-section")!;
		addrSection.style.display = "flex";
		document.getElementById("address-display")!.textContent = address;
		document.getElementById("copy-address-btn")!.addEventListener("click", (e) => {
			copyText(address, e.currentTarget as HTMLElement);
		});
	}

	// UTXO list
	const utxoList = document.getElementById("utxo-list")!;
	if (!utxos || utxos.length === 0) {
		utxoList.innerHTML = `<div class="empty-state">No UTXOs found</div>`;
		return;
	}

	const rows = utxos.slice(0, 25).map((u) => {
		const txid = String(u.txid ?? "");
		const index = u.vout ?? u.outputIndex ?? "—";
		const value = Number(u.satoshis ?? 0);
		return `
			<div class="utxo-row">
				<div class="utxo-txid">${esc(truncateMid(txid, 10))}</div>
				<div class="utxo-index">${index}</div>
				<div class="utxo-value">${value.toLocaleString()}</div>
			</div>
		`;
	}).join("");

	utxoList.innerHTML = `
		<div class="utxo-header">
			<div class="utxo-col col-txid">TXID</div>
			<div class="utxo-col col-index">Index</div>
			<div class="utxo-col col-value">Value (sats)</div>
		</div>
		${rows}
	`;
}

// ── Ordinals ─────────────────────────────────────────────────────────────────
async function loadOrdinalsData() {
	document.getElementById("ordinals-grid")!.innerHTML = `<div class="empty-state" style="grid-column:1/-1">loading...</div>`;
	try {
		const result = await app.callServerTool({ name: "app_ordinals_data", arguments: {} });
		if (result?.structuredContent) {
			ordinalsLoaded = true;
			renderOrdinals(result.structuredContent as Record<string, unknown>);
		}
	} catch (err) {
		document.getElementById("ordinals-grid")!.innerHTML = `<div class="error-box" style="grid-column:1/-1">${esc(String(err))}</div>`;
	}
}

function renderOrdinals(data: Record<string, unknown>) {
	const listings = data.listings as Array<Record<string, unknown>> | undefined;
	const total = data.total as number | undefined;

	document.getElementById("ordinals-count")!.textContent = total != null ? String(total) : (listings?.length ? String(listings.length) : "0");

	const grid = document.getElementById("ordinals-grid")!;
	if (!listings || listings.length === 0) {
		grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">No inscriptions found</div>`;
		return;
	}

	grid.innerHTML = listings.slice(0, 12).map(renderOrdinalCard).join("");

	// Wire up search
	const searchInput = document.getElementById("ordinals-search-input") as HTMLInputElement;
	if (searchInput) {
		searchInput.addEventListener("keydown", async (e) => {
			if (e.key !== "Enter") return;
			const query = searchInput.value.trim();
			if (!query) return;
			grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">searching...</div>`;
			try {
				const res = await app.callServerTool({ name: "app_ordinals_data", arguments: { query } });
				if (res?.structuredContent) {
					const d = res.structuredContent as Record<string, unknown>;
					const results = (d.results ?? d.listings) as Array<Record<string, unknown>> | undefined;
					const found = d.total as number | undefined;
					document.getElementById("ordinals-count")!.textContent = found != null ? String(found) : String(results?.length ?? 0);
					if (results && results.length > 0) {
						grid.innerHTML = results.slice(0, 12).map(renderOrdinalCard).join("");
					} else {
						grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">No results found</div>`;
					}
				}
			} catch (err) {
				grid.innerHTML = `<div class="error-box" style="grid-column:1/-1">${esc(String(err))}</div>`;
			}
		});
	}
}

function renderOrdinalCard(item: Record<string, unknown>): string {
	const origin = item.origin as Record<string, unknown> | undefined;
	const data = item.data as Record<string, unknown> | undefined;
	const listData = data?.list as Record<string, unknown> | undefined;
	const inscData = origin?.data as Record<string, unknown> | undefined;
	const insc = inscData?.insc as Record<string, unknown> | undefined;
	const file = insc?.file as Record<string, unknown> | undefined;
	const outpoint = String(item.outpoint ?? origin?.outpoint ?? "");
	const txid = outpoint.split("_")[0] ?? outpoint;
	const mime = String(file?.type ?? "");
	const isImage = mime.startsWith("image/");
	const price = listData?.price as number | undefined;
	const name = String((inscData as Record<string, unknown> | undefined)?.name ?? truncateMid(outpoint, 8));
	const isListed = price != null;

	return `
		<div class="ordinal-card" title="${esc(outpoint)}">
			<div class="ordinal-preview">
				${isImage
					? `<img src="https://ordfs.network/${esc(txid)}" alt="inscription" loading="lazy" />`
					: `<span class="ordinal-placeholder">${mime ? esc(mime.split("/")[1] ?? mime) : "?"}</span>`
				}
				${isListed ? `<div class="listed-badge">Listed</div>` : ""}
			</div>
			<div class="ordinal-info">
				<div class="ordinal-name">${esc(name)}</div>
				<div class="ordinal-meta-row">
					<span class="ordinal-type">${mime ? esc(mime.split("/")[0] ?? "") : "unknown"}</span>
					${price != null ? `<span class="ordinal-price">${price.toLocaleString()} sats</span>` : ""}
				</div>
			</div>
		</div>
	`;
}

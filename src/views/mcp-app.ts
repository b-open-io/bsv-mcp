import { App } from "@modelcontextprotocol/ext-apps";

// ── XSS helper ──────────────────────────────────────────────────────────────
function esc(s: string): string {
	const div = document.createElement("div");
	div.textContent = s;
	return div.innerHTML;
}

// ── Clipboard helper ────────────────────────────────────────────────────────
async function copyText(text: string, btn: HTMLElement) {
	try {
		await navigator.clipboard.writeText(text);
		const original = btn.textContent;
		btn.textContent = "Copied!";
		setTimeout(() => { btn.textContent = original; }, 1500);
	} catch { /* clipboard may not be available in iframe */ }
}

// ── Tab switching ───────────────────────────────────────────────────────────
const tabs = document.querySelectorAll<HTMLButtonElement>(".view-tab");
const panels: Record<string, HTMLElement> = {
	explorer: document.getElementById("explorer-panel")!,
	wallet: document.getElementById("wallet-panel")!,
	ordinals: document.getElementById("ordinals-panel")!,
};

let activeTab = "explorer";

function switchTab(view: string) {
	activeTab = view;
	for (const tab of tabs) {
		const isActive = tab.dataset.view === view;
		tab.classList.toggle("active", isActive);
		tab.setAttribute("aria-selected", String(isActive));
	}
	for (const [key, panel] of Object.entries(panels)) {
		panel.classList.toggle("active", key === view);
	}
	// Load data for the tab if not already loaded
	if (view === "wallet" && !walletLoaded) loadWalletData();
	if (view === "ordinals" && !ordinalsLoaded) loadOrdinalsData();
}

for (const tab of tabs) {
	tab.addEventListener("click", () => switchTab(tab.dataset.view!));
}

// ── State tracking ──────────────────────────────────────────────────────────
let walletLoaded = false;
let ordinalsLoaded = false;

// ── MCP App connection ──────────────────────────────────────────────────────
const app = new App({ name: "BSV MCP", version: "1.0.0" });

app.ontoolresult = (result) => {
	if (result.structuredContent) {
		renderDashboard(result.structuredContent as Record<string, unknown>);
	}
};

app.onhostcontextchanged = (ctx) => {
	if (ctx.theme === "light") {
		document.documentElement.setAttribute("data-theme", "light");
	}
};

await app.connect();

// ── Dashboard entry point ───────────────────────────────────────────────────
function renderDashboard(data: Record<string, unknown>) {
	document.getElementById("loading")!.style.display = "none";
	document.getElementById("header")!.style.display = "flex";
	panels.explorer.classList.add("active");
	// Load explorer data
	loadExplorerData();
}

// ── Explorer Tab ────────────────────────────────────────────────────────────
async function loadExplorerData() {
	panels.explorer.innerHTML = '<div class="loading-text">Loading explorer data...</div>';
	try {
		const result = await app.callServerTool({ name: "app_explorer_data", arguments: {} });
		if (result?.structuredContent) {
			renderExplorer(result.structuredContent as Record<string, unknown>);
		}
	} catch (err) {
		panels.explorer.innerHTML = `<div class="error-message">Failed to load explorer data: ${esc(String(err))}</div>`;
	}
}

function renderExplorer(data: Record<string, unknown>) {
	const price = data.price as number | undefined;
	const chainInfo = data.chainInfo as Record<string, unknown> | undefined;

	panels.explorer.innerHTML = `
		<div class="stat-grid">
			<div class="card">
				<div class="card-title">BSV Price</div>
				<div class="card-value">${price ? `$${price.toFixed(2)}` : "—"}</div>
				<div class="card-subtitle">USD</div>
			</div>
			${chainInfo ? `
			<div class="card">
				<div class="card-title">Block Height</div>
				<div class="card-value">${(chainInfo.blocks as number || 0).toLocaleString()}</div>
				<div class="card-subtitle">blocks</div>
			</div>
			<div class="card">
				<div class="card-title">Difficulty</div>
				<div class="card-value">${formatDifficulty(chainInfo.difficulty as number)}</div>
				<div class="card-subtitle">current</div>
			</div>
			` : ""}
		</div>

		<div class="card">
			<div class="card-title">Decode Transaction</div>
			<div class="input-group">
				<input type="text" id="tx-input" placeholder="Enter txid or raw transaction hex..." />
				<button class="btn btn-primary" id="tx-decode-btn">Decode</button>
			</div>
			<div id="tx-results" class="results"></div>
		</div>

		<div class="card">
			<div class="card-title">Address Lookup</div>
			<div class="input-group">
				<input type="text" id="address-input" placeholder="Enter BSV address..." />
				<button class="btn btn-primary" id="address-lookup-btn">Lookup</button>
			</div>
			<div id="address-results" class="results"></div>
		</div>
	`;

	// Wire up decode button
	document.getElementById("tx-decode-btn")!.addEventListener("click", async () => {
		const input = (document.getElementById("tx-input") as HTMLInputElement).value.trim();
		if (!input) return;
		const resultsEl = document.getElementById("tx-results")!;
		resultsEl.innerHTML = '<div class="loading-text">Decoding...</div>';
		try {
			const res = await app.callServerTool({ name: "app_explorer_data", arguments: { txid: input } });
			if (res?.structuredContent) {
				const txData = (res.structuredContent as Record<string, unknown>).transaction as Record<string, unknown> | undefined;
				if (txData) {
					renderTransactionResult(resultsEl, txData);
				} else {
					resultsEl.innerHTML = '<div class="results-empty">No transaction data returned</div>';
				}
			}
		} catch (err) {
			resultsEl.innerHTML = `<div class="error-message">${esc(String(err))}</div>`;
		}
	});

	// Wire up address lookup
	document.getElementById("address-lookup-btn")!.addEventListener("click", async () => {
		const input = (document.getElementById("address-input") as HTMLInputElement).value.trim();
		if (!input) return;
		const resultsEl = document.getElementById("address-results")!;
		resultsEl.innerHTML = '<div class="loading-text">Looking up...</div>';
		try {
			const res = await app.callServerTool({ name: "app_explorer_data", arguments: { address: input } });
			if (res?.structuredContent) {
				const addrData = (res.structuredContent as Record<string, unknown>).addressInfo as Record<string, unknown> | undefined;
				if (addrData) {
					renderAddressResult(resultsEl, addrData);
				} else {
					resultsEl.innerHTML = '<div class="results-empty">No address data returned</div>';
				}
			}
		} catch (err) {
			resultsEl.innerHTML = `<div class="error-message">${esc(String(err))}</div>`;
		}
	});

	// Enter key support
	document.getElementById("tx-input")!.addEventListener("keydown", (e) => {
		if (e.key === "Enter") document.getElementById("tx-decode-btn")!.click();
	});
	document.getElementById("address-input")!.addEventListener("keydown", (e) => {
		if (e.key === "Enter") document.getElementById("address-lookup-btn")!.click();
	});
}

function renderTransactionResult(el: HTMLElement, tx: Record<string, unknown>) {
	const inputs = tx.inputs as Array<Record<string, unknown>> || [];
	const outputs = tx.outputs as Array<Record<string, unknown>> || [];
	el.innerHTML = `
		<div class="card" style="margin-top:12px;padding:12px">
			<div style="display:flex;justify-content:space-between;margin-bottom:8px">
				<span style="font-size:12px;color:var(--muted)">TXID</span>
				<span class="truncated" style="max-width:300px;font-family:var(--mono);font-size:12px" title="${esc(String(tx.txid))}">${esc(String(tx.txid))}</span>
			</div>
			<div style="display:flex;gap:16px;font-size:12px;color:var(--muted-foreground);margin-bottom:12px">
				<span>Size: ${tx.size} bytes</span>
				${tx.fee != null ? `<span>Fee: ${tx.fee} sats</span>` : ""}
				${tx.confirmations != null ? `<span>Confirmations: ${tx.confirmations}</span>` : ""}
			</div>
			<div class="table-wrap">
				<table>
					<thead><tr><th>Outputs</th><th style="text-align:right">Value (sats)</th></tr></thead>
					<tbody>
						${outputs.map((o: Record<string, unknown>) => `
							<tr>
								<td><span class="truncated">${esc(String((o.scriptPubKey as Record<string, unknown>)?.asm || ""))}</span></td>
								<td style="text-align:right">${o.value != null ? Number(o.value).toLocaleString() : "—"}</td>
							</tr>
						`).join("")}
					</tbody>
				</table>
			</div>
		</div>
	`;
}

function renderAddressResult(el: HTMLElement, addr: Record<string, unknown>) {
	const balance = addr.balance as Record<string, unknown> | undefined;
	const history = addr.history as Array<Record<string, unknown>> | undefined;
	el.innerHTML = `
		<div class="stat-grid" style="margin-top:12px">
			<div class="card">
				<div class="card-title">Balance</div>
				<div class="card-value" style="font-size:20px">${balance ? Number(balance.confirmed || 0).toLocaleString() : "—"} <span style="font-size:14px;color:var(--muted)">sats</span></div>
			</div>
			${balance?.unconfirmed ? `
			<div class="card">
				<div class="card-title">Unconfirmed</div>
				<div class="card-value" style="font-size:20px">${Number(balance.unconfirmed).toLocaleString()} <span style="font-size:14px;color:var(--muted)">sats</span></div>
			</div>
			` : ""}
		</div>
		${history && history.length > 0 ? `
		<div class="card" style="margin-top:12px;padding:12px">
			<div class="card-title">Recent Transactions</div>
			<div class="table-wrap">
				<table>
					<thead><tr><th>TXID</th><th style="text-align:right">Height</th></tr></thead>
					<tbody>
						${history.slice(0, 10).map((h: Record<string, unknown>) => `
							<tr>
								<td><span class="truncated">${esc(String(h.tx_hash || ""))}</span></td>
								<td style="text-align:right">${h.height || "unconfirmed"}</td>
							</tr>
						`).join("")}
					</tbody>
				</table>
			</div>
		</div>
		` : ""}
	`;
}

// ── Wallet Tab ──────────────────────────────────────────────────────────────
async function loadWalletData() {
	panels.wallet.innerHTML = '<div class="loading-text">Loading wallet data...</div>';
	try {
		const result = await app.callServerTool({ name: "app_wallet_data", arguments: {} });
		if (result?.structuredContent) {
			walletLoaded = true;
			renderWallet(result.structuredContent as Record<string, unknown>);
		}
	} catch (err) {
		panels.wallet.innerHTML = `<div class="error-message">Failed to load wallet: ${esc(String(err))}</div>`;
	}
}

function renderWallet(data: Record<string, unknown>) {
	const balance = data.balance as Record<string, unknown> | undefined;
	const address = data.address as string | undefined;
	const utxos = data.utxos as Array<Record<string, unknown>> | undefined;
	const price = data.price as number | undefined;

	const satoshis = Number(balance?.satoshis || 0);
	const usdValue = price ? (satoshis / 100_000_000) * price : null;

	panels.wallet.innerHTML = `
		<div class="stat-grid">
			<div class="card">
				<div class="card-title">Balance</div>
				<div class="card-value">${balance?.bsv || "0"} <span style="font-size:16px;color:var(--muted)">BSV</span></div>
				<div class="card-subtitle">${satoshis.toLocaleString()} satoshis${usdValue != null ? ` · $${usdValue.toFixed(2)} USD` : ""}</div>
			</div>
			<div class="card">
				<div class="card-title">UTXOs</div>
				<div class="card-value">${balance?.utxoCount || 0}</div>
				<div class="card-subtitle">unspent outputs</div>
			</div>
		</div>

		${address ? `
		<div class="card">
			<div class="card-title">Receive Address</div>
			<div class="address-display">
				<span style="flex:1">${esc(address)}</span>
				<button class="copy-btn" id="copy-address-btn" title="Copy address">Copy</button>
			</div>
		</div>
		` : ""}

		${utxos && utxos.length > 0 ? `
		<div class="card">
			<div class="card-title">UTXOs</div>
			<div class="table-wrap">
				<table>
					<thead><tr><th>TXID</th><th style="text-align:right">Index</th><th style="text-align:right">Value (sats)</th></tr></thead>
					<tbody>
						${utxos.slice(0, 20).map((u: Record<string, unknown>) => `
							<tr>
								<td><span class="truncated">${esc(String(u.txid || ""))}</span></td>
								<td style="text-align:right">${u.vout ?? u.outputIndex ?? "—"}</td>
								<td style="text-align:right">${Number(u.satoshis || 0).toLocaleString()}</td>
							</tr>
						`).join("")}
					</tbody>
				</table>
			</div>
		</div>
		` : ""}
	`;

	// Wire up copy button
	if (address) {
		document.getElementById("copy-address-btn")?.addEventListener("click", (e) => {
			copyText(address, e.target as HTMLElement);
		});
	}
}

// ── Ordinals Tab ────────────────────────────────────────────────────────────
async function loadOrdinalsData() {
	panels.ordinals.innerHTML = '<div class="loading-text">Loading ordinals data...</div>';
	try {
		const result = await app.callServerTool({ name: "app_ordinals_data", arguments: {} });
		if (result?.structuredContent) {
			ordinalsLoaded = true;
			renderOrdinals(result.structuredContent as Record<string, unknown>);
		}
	} catch (err) {
		panels.ordinals.innerHTML = `<div class="error-message">Failed to load ordinals: ${esc(String(err))}</div>`;
	}
}

function renderOrdinals(data: Record<string, unknown>) {
	const listings = data.listings as Array<Record<string, unknown>> | undefined;
	const total = data.total as number | undefined;

	panels.ordinals.innerHTML = `
		<div class="card">
			<div class="card-title">Search Inscriptions</div>
			<div class="input-group">
				<input type="text" id="ordinals-search-input" placeholder="Search by terms, address, or MIME type..." />
				<button class="btn btn-primary" id="ordinals-search-btn">Search</button>
			</div>
		</div>

		<div id="ordinals-results">
			${listings && listings.length > 0 ? `
				<div class="card">
					<div class="card-title">Marketplace Listings${total != null ? ` (${total.toLocaleString()} total)` : ""}</div>
				</div>
				<div class="ordinals-grid">
					${listings.map((l: Record<string, unknown>) => renderOrdinalCard(l)).join("")}
				</div>
			` : '<div class="results-empty">No listings found</div>'}
		</div>
	`;

	// Wire up search
	document.getElementById("ordinals-search-btn")!.addEventListener("click", async () => {
		const query = (document.getElementById("ordinals-search-input") as HTMLInputElement).value.trim();
		const resultsEl = document.getElementById("ordinals-results")!;
		resultsEl.innerHTML = '<div class="loading-text">Searching...</div>';
		try {
			const res = await app.callServerTool({ name: "app_ordinals_data", arguments: { query } });
			if (res?.structuredContent) {
				const searchResults = res.structuredContent as Record<string, unknown>;
				const results = searchResults.results as Array<Record<string, unknown>> || [];
				const searchTotal = searchResults.total as number | undefined;
				if (results.length > 0) {
					resultsEl.innerHTML = `
						<div class="card">
							<div class="card-title">Search Results${searchTotal != null ? ` (${searchTotal.toLocaleString()} found)` : ""}</div>
						</div>
						<div class="ordinals-grid">
							${results.map((r: Record<string, unknown>) => renderOrdinalCard(r)).join("")}
						</div>
					`;
				} else {
					resultsEl.innerHTML = '<div class="results-empty">No results found</div>';
				}
			}
		} catch (err) {
			resultsEl.innerHTML = `<div class="error-message">${esc(String(err))}</div>`;
		}
	});

	document.getElementById("ordinals-search-input")!.addEventListener("keydown", (e) => {
		if (e.key === "Enter") document.getElementById("ordinals-search-btn")!.click();
	});
}

function renderOrdinalCard(item: Record<string, unknown>): string {
	const origin = item.origin as Record<string, unknown> | undefined;
	const data = item.data as Record<string, unknown> | undefined;
	const listData = data?.list as Record<string, unknown> | undefined;
	const inscData = origin?.data as Record<string, unknown> | undefined;
	const insc = inscData?.insc as Record<string, unknown> | undefined;
	const file = insc?.file as Record<string, unknown> | undefined;
	const outpoint = String(item.outpoint || origin?.outpoint || "");
	const txid = outpoint.split("_")[0] || outpoint;
	const mime = String(file?.type || "");
	const isImage = mime.startsWith("image/");
	const price = listData?.price as number | undefined;

	return `
		<div class="ordinal-card" title="${esc(outpoint)}">
			<div class="ordinal-preview">
				${isImage ? `<img src="https://ordfs.network/${txid}" alt="inscription" loading="lazy" />` : `<span class="placeholder">${mime ? esc(mime.split("/")[0]) : "?"}</span>`}
			</div>
			<div class="ordinal-info">
				<div class="ordinal-name">${esc(truncate(outpoint, 20))}</div>
				<div class="ordinal-meta">
					${mime ? esc(mime) : "unknown"}
					${price != null ? ` · ${price.toLocaleString()} sats` : ""}
				</div>
			</div>
		</div>
	`;
}

// ── Utilities ───────────────────────────────────────────────────────────────
function truncate(s: string, n: number): string {
	return s.length > n ? `${s.slice(0, n / 2)}...${s.slice(-n / 2)}` : s;
}

function formatDifficulty(d: number | undefined): string {
	if (!d) return "—";
	if (d >= 1e12) return `${(d / 1e12).toFixed(1)}T`;
	if (d >= 1e9) return `${(d / 1e9).toFixed(1)}G`;
	if (d >= 1e6) return `${(d / 1e6).toFixed(1)}M`;
	return d.toLocaleString();
}

import { P2PKH, PrivateKey, Transaction, Utils } from "@bsv/sdk";
import { App } from "@modelcontextprotocol/ext-apps";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Field, PasswordInput } from "../components/FormFields";
import {
	Button,
	DataRow,
	LocalShell,
	Notice,
	PageHeader,
	Spinner,
	Surface,
} from "../components/LocalShell";

type Data = Record<string, unknown>;

function asData(value: unknown): Data {
	return value && typeof value === "object" && !Array.isArray(value)
		? (value as Data)
		: {};
}

function list(value: unknown): Data[] {
	return Array.isArray(value)
		? value.filter((item): item is Data =>
				Boolean(item && typeof item === "object"),
			)
		: [];
}

function middle(value: string, keep = 8) {
	return value.length <= keep * 2 + 3
		? value
		: `${value.slice(0, keep)}…${value.slice(-keep)}`;
}

function sats(value: unknown) {
	return Number(value ?? 0).toLocaleString();
}

function useMcpConnection() {
	const appRef = useRef<App | null>(null);
	const [ready, setReady] = useState(false);
	const [error, setError] = useState<string>();
	useEffect(() => {
		const instance = new App({ name: "BSV MCP", version: "1.0.0" });
		appRef.current = instance;
		instance.ontoolresult = () => setReady(true);
		void instance
			.connect()
			.then(() => setReady(true))
			.catch((reason) => setError(String(reason)));
		return () => {
			appRef.current = null;
		};
	}, []);
	const call = useCallback(async (name: string, args: Data = {}) => {
		const instance = appRef.current;
		if (!instance)
			throw new Error("The local app is not connected to its MCP host.");
		const result = await instance.callServerTool({ name, arguments: args });
		const content = (result as { structuredContent?: unknown } | undefined)
			?.structuredContent;
		if (!content) throw new Error("The MCP host returned no structured data.");
		return asData(content);
	}, []);
	return { call, ready, error };
}

export function Dashboard() {
	const { call, ready, error } = useMcpConnection();
	const [view, setView] = useState("explorer");
	if (error)
		return (
			<LocalShell navigation={false}>
				<Notice tone="error">Could not connect to the MCP host: {error}</Notice>
			</LocalShell>
		);
	if (!ready)
		return (
			<LocalShell navigation={false}>
				<div className="center-state">
					<Spinner label="Connecting to MCP host" />
				</div>
			</LocalShell>
		);
	return (
		<LocalShell active={view} onNavigate={setView}>
			{view === "explorer" ? <Explorer call={call} /> : null}
			{view === "wallet" ? <Wallet call={call} /> : null}
			{view === "ordinals" ? <Ordinals call={call} /> : null}
			{view === "sweep" ? <Sweep call={call} /> : null}
		</LocalShell>
	);
}

type Caller = (name: string, args?: Data) => Promise<Data>;

function Explorer({ call }: { call: Caller }) {
	const [data, setData] = useState<Data>();
	const [error, setError] = useState<string>();
	const [query, setQuery] = useState("");
	useEffect(() => {
		void call("app_explorer_data")
			.then(setData)
			.catch((reason) => setError(String(reason)));
	}, [call]);
	async function search() {
		const value = query.trim();
		if (!value) return;
		setError(undefined);
		try {
			const args: Data = /^[0-9a-f]{64}$/i.test(value)
				? { txid: value }
				: value.startsWith("1")
					? { address: value }
					: { query: value };
			setData(await call("app_explorer_data", args));
		} catch (reason) {
			setError(String(reason));
		}
	}
	const chain = asData(data?.chainInfo);
	const blocks = list(data?.recentBlocks);
	return (
		<>
			<PageHeader
				eyebrow="explorer"
				title="Read the chain"
				description="Inspect live network data without leaving your local MCP session."
			/>
			{error ? <Notice tone="error">{error}</Notice> : null}
			{!data && !error ? (
				<Surface>
					<div className="surface-body">
						<Spinner label="Loading explorer data" />
					</div>
				</Surface>
			) : null}
			{data ? (
				<>
					<div className="grid grid-stats">
						<Stat
							label="Block height"
							value={
								Number(chain.blocks ?? 0)
									? Number(chain.blocks).toLocaleString()
									: "—"
							}
						/>
						<Stat
							label="BSV price"
							value={
								typeof data.price === "number"
									? `$${data.price.toFixed(2)}`
									: "—"
							}
						/>
						<Stat
							label="Difficulty"
							value={formatDifficulty(chain.difficulty)}
						/>
						<Stat
							label="Best block"
							value={
								chain.bestblockhash
									? middle(String(chain.bestblockhash), 6)
									: "—"
							}
						/>
					</div>
					<Surface className="stack-surface">
						<div className="surface-header">
							<div>
								<p className="section-label">lookup</p>
								<h2>Search BSV</h2>
							</div>
						</div>
						<div className="surface-body">
							<div className="search-row">
								<input
									className="field"
									value={query}
									onChange={(event) => setQuery(event.target.value)}
									onKeyDown={(event) => {
										if (event.key === "Enter") void search();
									}}
									placeholder="Transaction ID or address"
									aria-label="Transaction ID or address"
								/>
								<Button onClick={() => void search()}>Search</Button>
							</div>
							<SearchResult data={data} query={query} />
						</div>
					</Surface>
					{blocks.length ? (
						<Surface className="stack-surface">
							<div className="surface-header">
								<div>
									<p className="section-label">network</p>
									<h2>Recent blocks</h2>
								</div>
							</div>
							<div className="table">
								<div className="table-row table-head">
									<span>Height</span>
									<span>Hash</span>
									<span>Txs</span>
									<span>Size</span>
									<span>Time</span>
								</div>
								{blocks.map((block, index) => (
									<div className="table-row" key={String(block.hash ?? index)}>
										<span className="mono">
											{Number(block.height ?? 0).toLocaleString()}
										</span>
										<span className="mono dim">
											{middle(String(block.hash ?? "—"), 10)}
										</span>
										<span className="dim">{list(block.tx).length || "—"}</span>
										<span className="dim">
											{block.size
												? `${(Number(block.size) / 1024).toFixed(1)} KB`
												: "—"}
										</span>
										<span className="dim">
											{block.time
												? new Date(
														Number(block.time) * 1000,
													).toLocaleTimeString()
												: "—"}
										</span>
									</div>
								))}
							</div>
						</Surface>
					) : null}
				</>
			) : null}
		</>
	);
}

function Stat({ label, value }: { label: string; value: string }) {
	return (
		<div className="stat-card">
			<div className="stat-label">{label}</div>
			<div className="stat-value">{value}</div>
		</div>
	);
}
function formatDifficulty(value: unknown) {
	const number = Number(value ?? 0);
	if (!number) return "—";
	for (const [unit, divisor] of [
		["PH", 1e15],
		["TH", 1e12],
		["GH", 1e9],
		["MH", 1e6],
	] as const)
		if (number >= divisor) return `${(number / divisor).toFixed(1)} ${unit}`;
	return number.toLocaleString();
}

function SearchResult({ data, query }: { data: Data; query: string }) {
	const tx = asData(data.transaction);
	const address = asData(data.addressInfo);
	if (!Object.keys(tx).length && !Object.keys(address).length && query)
		return <div className="empty">No results found</div>;
	if (Object.keys(tx).length)
		return (
			<div className="data-list">
				<DataRow
					label="TXID"
					value={<span className="mono">{String(tx.txid ?? query)}</span>}
				/>
				<DataRow label="Size" value={`${tx.size ?? "—"} bytes`} />
				<DataRow
					label="Fee"
					value={tx.fee == null ? "—" : `${sats(tx.fee)} sats`}
				/>
				<DataRow
					label="Confirmations"
					value={String(tx.confirmations ?? "—")}
				/>
				<DataRow label="Outputs" value={list(tx.outputs).length} />
			</div>
		);
	if (Object.keys(address).length) {
		const balance = asData(address.balance);
		return (
			<div className="data-list">
				<DataRow
					label="Address"
					value={<span className="mono">{query}</span>}
				/>
				<DataRow label="Confirmed" value={`${sats(balance.confirmed)} sats`} />
				<DataRow
					label="Unconfirmed"
					value={`${sats(balance.unconfirmed)} sats`}
				/>
				<DataRow
					label="Transactions"
					value={list(address.history).length || "—"}
				/>
			</div>
		);
	}
	return (
		<div className="empty">Enter a transaction ID or address to search.</div>
	);
}

function Wallet({ call }: { call: Caller }) {
	const [data, setData] = useState<Data>();
	const [error, setError] = useState<string>();
	useEffect(() => {
		void call("app_wallet_data")
			.then((value) => {
				if (value.error) throw new Error(String(value.error));
				setData(value);
			})
			.catch((reason) => setError(String(reason)));
	}, [call]);
	if (error)
		return (
			<>
				<PageHeader
					eyebrow="wallet"
					title="Wallet"
					description="This session has no unlocked Vault wallet yet."
				/>
				<Notice tone="error">{error}</Notice>
				<Surface>
					<div className="surface-body">
						<p>
							Import an existing key or create a Vault wallet in the local
							browser.
						</p>
						<Button
							onClick={() => {
								void call("wallet_onboarding").catch((reason) =>
									setError(String(reason)),
								);
							}}
						>
							Open wallet setup
						</Button>
					</div>
				</Surface>
			</>
		);
	if (!data)
		return (
			<>
				<PageHeader eyebrow="wallet" title="Wallet" />
				<Surface>
					<div className="surface-body">
						<Spinner label="Loading wallet data" />
					</div>
				</Surface>
			</>
		);
	const balance = asData(data.balance);
	const utxos = list(data.utxos);
	const satoshis = Number(balance.satoshis ?? 0);
	const bsv = String(balance.bsv ?? (satoshis / 1e8).toFixed(8));
	return (
		<>
			<PageHeader
				eyebrow="wallet"
				title="Your local wallet"
				description="Balances and unspent outputs are read from the connected wallet service."
			/>
			<div className="grid grid-three">
				<Stat label="Balance" value={`${bsv} BSV`} />
				<Stat label="Satoshis" value={`${sats(satoshis)} sats`} />
				<Stat label="UTXOs" value={String(balance.utxoCount ?? utxos.length)} />
			</div>
			{data.address ? (
				<div className="address-row">
					<code>{String(data.address)}</code>
					<button
						className="copy-button"
						type="button"
						onClick={() =>
							void navigator.clipboard?.writeText(String(data.address))
						}
					>
						copy
					</button>
				</div>
			) : null}
			<Surface className="stack-surface">
				<div className="surface-header">
					<div>
						<p className="section-label">outputs</p>
						<h2>Unspent outputs</h2>
					</div>
				</div>
				{utxos.length ? (
					<div className="table">
						<div className="table-row table-head">
							<span>TXID</span>
							<span>Index</span>
							<span>Value</span>
						</div>
						{utxos.slice(0, 25).map((utxo, index) => (
							<div
								className="table-row"
								key={`${String(utxo.txid ?? index)}-${String(utxo.vout ?? utxo.outputIndex ?? index)}`}
							>
								<span className="mono dim">
									{middle(String(utxo.txid ?? "—"), 10)}
								</span>
								<span className="mono">
									{String(utxo.vout ?? utxo.outputIndex ?? "—")}
								</span>
								<span className="mono">{sats(utxo.satoshis)} sats</span>
							</div>
						))}
					</div>
				) : (
					<div className="empty">No UTXOs found.</div>
				)}
			</Surface>
		</>
	);
}

function Ordinals({ call }: { call: Caller }) {
	const [data, setData] = useState<Data>();
	const [error, setError] = useState<string>();
	const [query, setQuery] = useState("");
	const load = useCallback(
		async (value?: string) => {
			setError(undefined);
			try {
				const result = await call(
					"app_ordinals_data",
					value ? { query: value } : {},
				);
				if (result.error) throw new Error(String(result.error));
				setData(result);
			} catch (reason) {
				setError(String(reason));
			}
		},
		[call],
	);
	useEffect(() => {
		void load();
	}, [load]);
	const listings = list(data?.listings);
	const base = String(data?.contentBaseUrl ?? "");
	return (
		<>
			<PageHeader
				eyebrow="ordinals"
				title="Inscription collection"
				description="Browse the latest ordinal listings available to this wallet."
			/>
			{error ? <Notice tone="error">{error}</Notice> : null}
			<Surface>
				<div className="surface-body">
					<div className="search-row">
						<input
							className="field"
							value={query}
							onChange={(event) => setQuery(event.target.value)}
							onKeyDown={(event) => {
								if (event.key === "Enter") void load(query.trim() || undefined);
							}}
							placeholder="Search listings"
							aria-label="Search listings"
						/>
						<Button onClick={() => void load(query.trim() || undefined)}>
							Search
						</Button>
					</div>
					{!data && !error ? <Spinner label="Loading listings" /> : null}
				</div>
			</Surface>
			{data ? (
				<div className="grid grid-three stack-grid">
					{listings.length ? (
						listings.map((item, index) => (
							<OrdinalCard
								key={`${String(item.outpoint ?? index)}`}
								item={item}
								base={base}
							/>
						))
					) : (
						<div className="empty">No listings found.</div>
					)}
				</div>
			) : null}
		</>
	);
}

function OrdinalCard({ item, base }: { item: Data; base: string }) {
	const nested = asData(item.data);
	const listing = asData(nested.ordlock);
	const mime = String(listing.content_type ?? "");
	const origin = String(listing.origin ?? item.outpoint ?? "");
	const image = mime.startsWith("image/") && /^https?:\/\//.test(base);
	return (
		<article className="ordinal-card" title={String(item.outpoint ?? "")}>
			<div className="ordinal-image">
				{image ? (
					/* biome-ignore lint/performance/noImgElement: inscription content is served by the configured content host. */ <img
						src={`${base}/${encodeURIComponent(origin)}`}
						alt="Inscription preview"
						loading="lazy"
					/>
				) : (
					<span>{mime ? mime.split("/")[1] : "?"}</span>
				)}
			</div>
			<div className="ordinal-info">
				<div className="ordinal-name">
					{String(
						listing.name ?? middle(String(item.outpoint ?? "inscription"), 10),
					)}
				</div>
				<div className="ordinal-meta">
					<span>{mime ? mime.split("/")[0] : "unknown"}</span>
					{listing.price != null ? (
						<span>{sats(listing.price)} sats</span>
					) : null}
				</div>
			</div>
		</article>
	);
}

type SweepSelection = {
	type: string;
	name: string;
	detail: string;
	value: string;
	inputs: Data[];
};
function Sweep({ call }: { call: Caller }) {
	const [keyInput, setKeyInput] = useState("");
	const keyRef = useRef("");
	const [address, setAddress] = useState("");
	const [scan, setScan] = useState<Data>();
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const [results, setResults] = useState<Data[]>([]);
	const [state, setState] = useState<
		"input" | "scanning" | "review" | "working" | "complete" | "error"
	>("input");
	const [error, setError] = useState<string>();
	const selections = useMemo<SweepSelection[]>(() => {
		if (!scan) return [];
		const output: SweepSelection[] = [];
		const funding = list(scan.funding);
		const ordinals = list(scan.ordinals);
		if (funding.length)
			output.push({
				type: "bsv",
				name: "BSV funding",
				detail: `${funding.length} UTXOs`,
				value: `${(Number(scan.totalFundingSats ?? 0) / 1e8).toFixed(8)} BSV`,
				inputs: funding,
			});
		if (ordinals.length)
			output.push({
				type: "ordinals",
				name: "Ordinals",
				detail: `${ordinals.length} inscriptions`,
				value: `${ordinals.length} NFTs`,
				inputs: ordinals,
			});
		for (const token of list(scan.bsv21Tokens)) {
			const tokenId = String(token.tokenId ?? "");
			const inputs = list(token.inputs);
			output.push({
				type: `bsv21:${tokenId}`,
				name: `${String(token.symbol ?? middle(tokenId, 6))} token`,
				detail: `${inputs.length} UTXOs`,
				value: String(token.totalAmount ?? "0"),
				inputs,
			});
		}
		return output;
	}, [scan]);
	async function scanKey() {
		setError(undefined);
		const raw = keyInput.trim();
		try {
			const key = /^[0-9a-f]{64}$/i.test(raw)
				? new PrivateKey(raw, 16)
				: PrivateKey.fromWif(raw);
			const nextAddress = key.toPublicKey().toAddress();
			keyRef.current = raw;
			setKeyInput("");
			setAddress(nextAddress);
			setState("scanning");
			const data = await call("app_sweep_scan", { address: nextAddress });
			if (data.error) throw new Error(String(data.error));
			setScan(data);
			setSelected(new Set(selectionTypes(data)));
			setState("review");
		} catch (reason) {
			keyRef.current = "";
			setKeyInput("");
			setError(reason instanceof Error ? reason.message : String(reason));
			setState("error");
		}
	}
	async function execute() {
		if (!scan || !selected.size || !keyRef.current) return;
		setState("working");
		setError(undefined);
		const output: Data[] = [];
		try {
			for (const item of selections.filter((entry) =>
				selected.has(entry.type),
			)) {
				const sweepType =
					item.type === "bsv"
						? "bsv"
						: item.type === "ordinals"
							? "ordinals"
							: "bsv21";
				const prepared = await call("app_sweep_prepare", {
					sweepType,
					inputs: item.inputs.map((input) => ({
						outpoint: input.outpoint,
						satoshis: input.satoshis,
						lockingScript: input.lockingScript,
					})),
				});
				if (prepared.error) throw new Error(String(prepared.error));
				const key = /^[0-9a-f]{64}$/i.test(keyRef.current)
					? new PrivateKey(keyRef.current, 16)
					: PrivateKey.fromWif(keyRef.current);
				const tx = Transaction.fromBEEF(
					Utils.toArray(String(prepared.txHex), "hex"),
				);
				const outpoints = new Set(
					list(prepared.inputsToSign).map(
						(input) => `${String(input.outpoint).replace("_", ".")}`,
					),
				);
				for (const input of tx.inputs)
					if (outpoints.has(`${input.sourceTXID}.${input.sourceOutputIndex}`))
						input.unlockingScriptTemplate = new P2PKH().unlock(
							key,
							"all",
							true,
						);
				await tx.sign();
				const spends: Data = {};
				tx.inputs.forEach((input, index) => {
					if (outpoints.has(`${input.sourceTXID}.${input.sourceOutputIndex}`))
						spends[String(index)] = {
							unlockingScript: input.unlockingScript?.toHex() ?? "",
						};
				});
				const complete = await call("app_sweep_complete", {
					reference: prepared.reference,
					spends,
				});
				if (complete.error) throw new Error(String(complete.error));
				output.push({ type: item.name, txid: String(complete.txid ?? "") });
			}
			keyRef.current = "";
			setResults(output);
			setState("complete");
		} catch (reason) {
			keyRef.current = "";
			setError(reason instanceof Error ? reason.message : String(reason));
			setState("error");
		}
	}
	function reset() {
		keyRef.current = "";
		setKeyInput("");
		setAddress("");
		setScan(undefined);
		setSelected(new Set());
		setResults([]);
		setError(undefined);
		setState("input");
	}
	return (
		<>
			<PageHeader
				eyebrow="sweep"
				title="Import funds"
				description="Scan a key locally, choose the assets to move, and sign in this browser tab."
			/>
			{error ? <Notice tone="error">{error}</Notice> : null}
			<Surface>
				<div className="surface-header">
					<div>
						<p className="section-label">
							{state === "review"
								? "review"
								: state === "complete"
									? "complete"
									: "private key"}
						</p>
						<h2>
							{state === "review"
								? `Assets at ${middle(address, 8)}`
								: state === "complete"
									? "Sweep complete"
									: "Sweep assets into your wallet"}
						</h2>
					</div>
				</div>
				<div className="surface-body">
					{state === "input" || state === "error" ? (
						<div className="form-stack">
							<Field label="WIF or 64-character hex" htmlFor="sweep-key">
								<PasswordInput
									id="sweep-key"
									value={keyInput}
									onValueChange={setKeyInput}
									autoComplete="off"
									onKeyDown={(event) => {
										if (event.key === "Enter") void scanKey();
									}}
								/>
							</Field>
							<p className="field-hint">
								The key is used only in this tab and cleared after scanning or
								sweeping.
							</p>
							<div className="form-actions">
								<Button
									onClick={() => void scanKey()}
									disabled={!keyInput.trim()}
								>
									Scan address
								</Button>
							</div>
						</div>
					) : null}
					{state === "scanning" || state === "working" ? (
						<Spinner
							label={
								state === "scanning"
									? `Scanning ${middle(address, 8)}…`
									: "Signing and broadcasting selected assets…"
							}
						/>
					) : null}
					{state === "review" ? (
						<>
							<div className="role-grid">
								{selections.length ? (
									selections.map((item) => (
										<button
											key={item.type}
											type="button"
											className={
												selected.has(item.type)
													? "asset-card asset-selected"
													: "asset-card"
											}
											onClick={() =>
												setSelected((current) => {
													const next = new Set(current);
													if (next.has(item.type)) next.delete(item.type);
													else next.add(item.type);
													return next;
												})
											}
										>
											<div className="asset-info">
												<div className="asset-name">
													{selected.has(item.type) ? "✓ " : ""}
													{item.name}
												</div>
												<div className="ordinal-meta">
													<span>{item.detail}</span>
													<span>{item.value}</span>
												</div>
											</div>
										</button>
									))
								) : (
									<div className="empty">No assets found at this address.</div>
								)}
							</div>
							<div className="form-actions">
								<Button variant="secondary" onClick={reset}>
									Back
								</Button>
								<Button
									onClick={() => void execute()}
									disabled={!selected.size}
								>
									Sweep selected
								</Button>
							</div>
						</>
					) : null}
					{state === "complete" ? (
						<>
							<div className="data-list">
								{results.map((item) => (
									<DataRow
										key={`${String(item.type)}:${String(item.txid)}`}
										label={String(item.type)}
										value={
											<span className="mono">
												{middle(String(item.txid), 12)}
											</span>
										}
									/>
								))}
							</div>
							<div className="form-actions">
								<Button onClick={reset}>Sweep another key</Button>
							</div>
						</>
					) : null}
				</div>
			</Surface>
		</>
	);
}

function selectionTypes(data: Data) {
	const types: string[] = [];
	if (list(data.funding).length) types.push("bsv");
	if (list(data.ordinals).length) types.push("ordinals");
	for (const token of list(data.bsv21Tokens))
		types.push(`bsv21:${String(token.tokenId ?? "")}`);
	return types;
}

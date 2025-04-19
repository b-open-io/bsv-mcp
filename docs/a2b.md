# A2B (Agent‑to‑Bitcoin)  
*A payment + discovery extension for Google A2A*

---

## Table of Contents
1. [Purpose & Scope](#purpose--scope)  
2. [Key Concepts](#key-concepts)  
3. [End‑to‑End Flow (Diagram)](#end-to-end-flow-diagram)  
4. [Data Structures](#data-structures)  
   * 4.1 [Pricing Configuration (`x-payment-config`)](#pricing-configuration)  
   * 4.2 [Payment Claim (`x-payment` DataPart)](#payment-claim)  
   * 4.3 [Agent Card Examples (⌘ to toggle)](#agent-card-examples)  
5. [Payment Flow](#payment-flow)  
   * 5.1 [Two‑Stage Deposit Model](#two-stage-deposit-model)  
   * 5.2 [FX Conversion & Price Feeds](#fx-conversion--price-feeds)  
   * 5.3 [Error Codes](#error-codes)  
6. [On‑Chain Registry](#on-chain-registry)  
   * 6.1 [1Sat Ordinal + MAP Format](#1sat-ordinal--map-format)  
   * 6.2 [Updating via Re‑inscription](#updating-via-re-inscription)  
   * 6.3 [Overlay Search UX](#overlay-search-ux)  
7. [Protocol Guidelines](#protocol-guidelines)  
8. [Security Considerations](#security-considerations)  
9. [Payment Verification Algorithm](#payment-verification-algorithm)  
10. [Implementation Guide](#implementation-guide)  
11. [Glossary](#glossary)

---

## 1  Purpose & Scope<a id="purpose--scope"></a>

A2B overlays **crypto‑native payments** and a **permissionless satoshi registry** on Google’s **Agent‑to‑Agent (A2A)** protocol:

| Capability          | Mechanism / Standard                                                                                                             |
|---------------------|-----------------------------------------------------------------------------------------------------------------------------------|
| Pricing             | `x-payment-config` — anchor `currency`, `amount`, human `name`, `acceptedCurrencies`, `interval`, optional `depositPct`           |
| Payment             | Client signs rawTx → embeds in `x-payment` → **server broadcasts** only on success (*pay‑on‑success*)                             |
| Discovery           | AgentCards are **1‑satoshi Ordinal inscriptions** with MAP tag `app=your‑app‑name type=a2b`                                       |
| Ownership & Update  | Re‑inscribe the satoshi to update metadata; inscription (and reputation) is portable and tradeable as an NFT                     |
| Tooling (MCP)       | An A2A server may invoke **MCP tool servers** internally; A2B concerns only *client ↔ agent* settlement                           |

Currency‑agnostic — examples use **BSV**, **BTC**, **SOL**, and fiat **USD**.

---

## 2  Key Concepts<a id="key-concepts"></a>

| Concept                | Definition |
|------------------------|------------|
| **Pricing Config**     | One entry in `x-payment-config`; has machine `id`, human `name`, price, currencies. |
| **skillIds**           | Array of A2A Skill ID strings (`"watchChannels"`, `"getDexChart"`, …). |
| **acceptedCurrencies** | Required tickers the agent accepts (must include anchor `currency`). |
| **depositPct**         | 0–1 fraction for two‑stage payments (`deposit` + `final`). |
| **interval**           | `null`, shorthand (`day|week|month|year`), or ISO 8601 duration like `"P18M"`. |
| **priceFeedUrl**       | Optional oracle returning spot FX JSON `{ "rates": { "BTC": 0.000012 } }`. |
| **Overlay**            | A2B discovery index with marketplace‑style fuzzy search. |
| **MCP Server**         | Local Model‑Context‑Protocol tool host the agent may call. |

---

## 3  End‑to‑End Flow (Diagram)<a id="end-to-end-flow-diagram"></a>

```mermaid
sequenceDiagram
    autonumber
    participant C as A2B Client
    participant O as A2B Overlay
    participant S as A2B Agent (A2A Server)
    participant T as MCP Server
    participant B as Blockchain

    Note over O,B: Registry = 1Sat Ordinal + MAP

    C->>O: search("watchtower penalty")
    O-->>C: results[] (AgentCard + hash + score)

    C->>S: GET /.well-known/agent.json
    S-->>C: AgentCard (HTTPS)
    C->>C: verify hash == inscription

    C->>C: sign rawTx (deposit/full)
    C->>S: tasks/send + x‑payment
    S->>S: validate rawTx (FX, stage)
    S->>B: broadcast deposit rawTx

    alt needs MCP compute
        S-->>T: mcp.tool.call(params)
        T-->>S: result / stream
    end

    S-->>C: TaskStatus / stream

    alt depositPct present
        S-->>C: 402 AmountInsufficient
        C->>C: sign final rawTx
        C->>S: tasks/send (stage=final)
        S->>B: broadcast final rawTx
    end

    S-->>C: completed artifact / final stream chunk
```

---

## 4  Data Structures<a id="data-structures"></a>

### 4.1  Pricing Configuration<a id="pricing-configuration"></a>

```jsonc
{
  "id": "watchtower-18m",
  "name": "18‑Month Enterprise Watchtower",
  "currency": "BSV",
  "amount": 0.030,
  "address": "1WatchtowerAddr",
  "acceptedCurrencies": ["BSV","BTC","USD"],
  "depositPct": 0.20,
  "priceFeedUrl": "https://oracle.example/spot",
  "interval": "P18M",
  "skillIds": ["watchChannels"],
  "description": "Long‑term SLA — 20 % up‑front, 80 % on success."
}
```

### 4.2  Payment Claim (`x-payment` DataPart)<a id="payment-claim"></a>

```jsonc
{
  "type": "data",
  "data": {
    "x-payment": {
      "configId": "dex-chart-sub-month",
      "stage": "full",
      "rawTx": "<signed‑hex>",
      "currency": "SOL",
      "refundAddress": "solRefundPubKey"
    }
  }
}
```

### 4.3  Agent Card Examples (⌘ to toggle)<a id="agent-card-examples"></a>

<details>
<summary>Minimal Watchtower Agent</summary>

```jsonc
{
  "name": "Tower‑Guard (Minimal)",
  "url": "https://watchtower.example",
  "version": "1.0.0",
  "capabilities": {},
  "skills": [
    { "id": "watchChannels", "name": "Watch Lightning Channels" }
  ],
  "x-payment-config": [
    {
      "id": "wt-basic",
      "name": "Basic Pay‑Per‑Call",
      "currency": "BSV",
      "amount": 0.0005,
      "address": "1WatchtowerAddr",
      "acceptedCurrencies": ["BSV"],
      "skillIds": ["watchChannels"]
    }
  ]
}
```
</details>

<details>
<summary>Extensive Watchtower Agent</summary>

```jsonc
{
  "name": "Tower‑Guard Watch Services",
  "url": "https://watchtower.example",
  "version": "2.1.0",
  "capabilities": {
    "streaming": true,
    "pushNotifications": true,
    "stateTransitionHistory": true
  },
  "skills": [
    {
      "id": "watchChannels",
      "name": "Lightning Watchtower",
      "description": "Monitors LN channels and broadcasts penalty transactions.",
      "tags": ["lightning","security","fraud-prevention"],
      "examples": [
        "watch channel 0234abcd… for 30 days",
        "monitor my node for revoked states"
      ],
      "inputModes": ["data"],
      "outputModes": ["stream"]
    }
  ],
  "x-payment-config": [
    {
      "id": "watchtower-month",
      "name": "30‑Day Watchtower",
      "currency": "BSV",
      "amount": 0.002,
      "address": "1WatchtowerAddr",
      "acceptedCurrencies": ["BSV","BTC","USD"],
      "interval": "month",
      "skillIds": ["watchChannels"],
      "description": "Penalty‑tx monitoring for 30 days."
    },
    {
      "id": "watchtower-18m",
      "name": "18‑Month Enterprise Watchtower",
      "currency": "BSV",
      "amount": 0.030,
      "address": "1WatchtowerAddr",
      "acceptedCurrencies": ["BSV","BTC","USD"],
      "interval": "P18M",
      "depositPct": 0.20,
      "priceFeedUrl": "https://oracle.example/spot",
      "skillIds": ["watchChannels"],
      "description": "Long‑term SLA; 20 % deposit, 80 % on completion."
    }
  ]
}
```
</details>

<details>
<summary>Extensive DEX Chart Agent</summary>

```jsonc
{
  "name": "On‑Chain DEX Chart API",
  "url": "https://dexcharts.example",
  "version": "1.0.0",
  "capabilities": { "streaming": false },
  "skills": [
    {
      "id": "getDexChart",
      "name": "DEX Chart JSON",
      "description": "Returns OHLCV data for any on‑chain DEX pair.",
      "tags": ["markets","dex","charts"],
      "examples": ["dex chart BSV/USDC 1h 500"],
      "inputModes": ["text"],
      "outputModes": ["data"]
    }
  ],
  "x-payment-config": [
    {
      "id": "dex-chart-call",
      "name": "Single OHLCV Snapshot",
      "currency": "USD",
      "amount": 0.05,
      "address": "1DexDataAddr",
      "acceptedCurrencies": ["USD","BSV","SOL"],
      "skillIds": ["getDexChart"],
      "description": "Returns 500‑candle OHLCV JSON."
    },
    {
      "id": "dex-chart-sub-month",
      "name": "Unlimited Charts · 30 Days",
      "currency": "USD",
      "amount": 20,
      "address": "1DexDataAddr",
      "acceptedCurrencies": ["USD","BSV","SOL"],
      "interval": "month",
      "skillIds": ["getDexChart"],
      "description": "Unlimited OHLCV queries for one month."
    }
  ]
}
```
</details>

---

## 5  Payment Flow<a id="payment-flow"></a>

1. **Discover** — overlay fuzzy‑searches `name`, `description`, `tags`.  
2. **Verify** — client optionally compares HTTPS hash to inscription hash.  
3. **Sign** rawTx paying chosen ticker to `address`.  
4. **Send** — embed in `x-payment`; call `tasks/send` (`tasks/sendSubscribe` for SSE).  
5. **Validate** — server checks amount, FX, stage, duplicate txid.  
6. **Broadcast** — server broadcasts deposit/full rawTx; executes task (may invoke MCP tools).  
7. **Deposit model** — server responds `402 AmountInsufficient`; client supplies `stage:"final"`.  
8. **Complete** — server broadcasts final rawTx; returns artifact / closes stream.

### 5.1  Two‑Stage Deposit Model<a id="two-stage-deposit-model"></a>

| Stage   | RawTx ≥ (after FX) | Sender | Broadcast |
|---------|--------------------|--------|-----------|
| deposit | `amount×depositPct`| Client | Server    |
| final   | `amount−deposit`   | Client | Server    |
| full    | `amount`           | Client | Server    |

### 5.2  FX Conversion & Price Feeds<a id="fx-conversion--price-feeds"></a>

* `required = anchor × spotRate(anchor→payCurrency)`  
* Oracle JSON: `{ "rates": { "USD":123.45,"BTC":0.000014 } }`  
* Default slippage tolerance: ±1 %.

### 5.3  Error Codes<a id="error-codes"></a>

| HTTP | JSON‑RPC code | Meaning                       |
|------|---------------|-------------------------------|
| 402  | `-32030`      | PaymentMissing                |
| 402  | `-32031`      | PaymentInvalid (rawTx bad)    |
| 402  | `-32032`      | StageMismatch                 |
| 402  | `-32033`      | AmountInsufficient            |
| 402  | `-32034`      | CurrencyUnsupported/AddressMismatch |

---

## 6  On‑Chain Registry<a id="on-chain-registry"></a>

### 6.1  1Sat Ordinal + MAP Format<a id="1sat-ordinal--map-format"></a>

```
Output 0 (1 sat):
  <P2PKH>
  OP_FALSE OP_IF
    "ord"
    OP_1 "application/json"
    OP_0 <AgentCard bytes>
  OP_ENDIF

Output 1 (0 sat):
  OP_RETURN
    1PuQa7K62MiKCtssSLKy1kh56WWU7MtUR5  SET
    app your-app-name  type a2b
```

### 6.2  Updating via Re‑inscription<a id="updating-via-re-inscription"></a>

* Spend the satoshi; attach new envelope + identical MAP; newest inscription wins.

### 6.3  Overlay Search UX<a id="overlay-search-ux"></a>

* Free‑text search across `name`, `description`, `tags`.  
* Structured filters: `skillId`, `interval`, `acceptedCurrency`, `maxPrice`.  
* Results list shows logo, friendly name, summary, cheapest price, update height.

---

## 7  Protocol Guidelines<a id="protocol-guidelines"></a>

| Scenario         | Recommendation                                                                 |
|------------------|--------------------------------------------------------------------------------|
| Immediate        | Use `stage:"full"`; broadcast on success.                                      |
| Streaming SSE    | Require deposit; final chunk after `stage:"final"`.                            |
| Interactive Chat | One payment per Task ID; switch to subscription for heavy usage.               |
| Long‑Running     | Deposit ≥ 50 % or split milestones.                                            |
| Subscription     | Each billing interval as its own config (`interval`).                          |
| MCP Payments     | Agent may chain another A2B hop for downstream tool settlement if desired.     |

---

## 8  Security Considerations<a id="security-considerations"></a>

* **Grace timeout** — default 30 min waiting for `final`.  
* **Task expiry** — refund deposits if job exceeds SLA.  
* **Encrypted rawTx store** — until broadcast.  
* **Rate limiting** — satoshi‑per‑second & request frequency.  
* **Double‑spend check** — inputs must be unspent at broadcast time.  
* **Signed oracle** — protect FX feed integrity.

---

## 9  Payment Verification Algorithm<a id="payment-verification-algorithm"></a>

```pseudo
verifyAndBroadcast(rawTx, stage, cfg, payTicker):
    tx   = decode(rawTx)
    out  = findOutput(tx, cfg.address)      # reject if none
    req  = chooseRequired(stage, cfg)       # anchor amount
    rate = (payTicker==cfg.currency) ? 1
           : fetchSpot(payTicker, cfg.currency, cfg.priceFeedUrl)
    if out.value < req*rate*(1-slippage):   error 32033
    if txidSeen(tx.id):                     error 32031
    broadcast(tx)
```

---

## 10  Implementation Guide<a id="implementation-guide"></a>

### Client Steps
1. Search overlay.  
2. Verify AgentCard hash.  
3. Sign rawTx.  
4. Send `tasks/send` with `x-payment`.  
5. Handle `402` (deposit model) and resend `final`.  
6. Watch mempool for server broadcast.

### Server Steps
1. Inscribe AgentCard.  
2. Validate payment.  
3. Execute task; call MCP tools.  
4. Broadcast rawTx; stream updates.  
5. Re‑inscribe satoshi on update.

---

## 11  Glossary<a id="glossary"></a>

| Term                 | Definition |
|----------------------|------------|
| **1Sat Ordinal**     | Single‑satoshi inscription used as registry entry. |
| **MAP**              | Magic Attribute Protocol key‑value OP_RETURN. |
| **Skill ID**         | Canonical identifier in AgentCard `skills[].id`. |
| **ISO 8601 Duration**| String like `"P18M"` (18 months). |
| **Overlay**          | A2B discovery service (marketplace). |
| **MCP**              | Model‑Context Protocol tool host. |

---

*Specification version 2025‑04‑18.*  
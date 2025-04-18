# A2B (Agent‑to‑Bitcoin)
A chain-agnostic protocol for A2A agent discovery and payments between them.

## Table of Contents
- [Payments](#payments)
  - [Schema](#schema)
  - [Examples](#examples)
  - [Including Payment in A2A Calls](#including-payment-in-a2a-calls)
  - [Error Codes](#error-codes)
  - [Refunds & Partial Payments](#refunds--partial-payments)
- [Registry](#registry)
  - [Publishing with 1Sat Ordinals + MAP](#publishing-with-1sat-ordinals--map)
  - [Updating by Re‑inscription](#updating-by-re-inscription)
  - [Discovery Workflow](#discovery-workflow)
- [Benefits](#benefits-of-this-approach)
- [Payment Verification](#payment-verification)
- [Implementation Guide](#implementation-guide)

---

## Overview
**A2B** adds blockchain‑native payments and a decentralized registry to Google’s A2A protocol. Agents declare pricing through `x-payment-config` in their `.well‑known/agent.json`, receive **raw transactions** from clients that the agent itself broadcasts only after successful execution, and publish the Agent Card on‑chain as a **1Sat Ordinal inscription** tagged with **MAP** metadata. Ownership of the satoshi equals authority: inscriptions can be traded on ordinal DEXs and re‑inscribed by the new owner. A2B is currency‑agnostic (BSV, BTC, BCH, ETH, SOL, …).

---

## Payments

### Schema
Add vendor‑extension **`x-payment-config`** to your Agent Card.  
It is **an array of pricing configurations**:

```typescript
interface PricingConfig {
  id: string;                       // unique identifier
  currency: string;                 // unit for amount
  amount: number;                   // price in that unit
  address: string;                  // public receiving address
  description?: string | null;
  acceptedCurrencies?: string[];    // extra tickers accepted
  skills?: string[];                // skills covered
  interval?: 'day'|'week'|'month'|'year'|null; // null = one‑off
  includedCalls?: Record<string, number>;
}
```

### Examples
```json
"x-payment-config": [
  {
    "id": "pay-per-call",
    "currency": "BSV",
    "amount": 0.00001,
    "address": "1BSVPayAddr",
    "skillIds": ["getWeather"],
    "acceptedCurrencies": ["BSV","SOL"],
    "interval": null
  },
  {
    "id": "subscription-premium",
    "currency": "USD",
    "amount": 10,
    "address": "1UsdProxy",
    "interval": "month",
    "skillIds": ["getWeather","getNews"],
    "acceptedCurrencies": ["BSV","SOL"],
    "includedCalls": { "getWeather": 1000 }
  },
  {
    "id": "fx-demo",
    "currency": "USD",
    "amount": 1,
    "address": "1UsdProxy",
    "acceptedCurrencies": ["BSV","SOL"],
    "interval": null
  }
]
```

### Including Payment in A2A Calls
Clients construct—but do **not** broadcast—a **raw transaction** paying the advertised `address`.  
They embed the payment claim in a DataPart as **`x-payment`**:

```jsonc
{
  "type": "data",
  "data": {
    "x-payment": {
      "configId": "pay-per-call",
      "rawTx": "0100000001e34ac1e2baac09c3…00000000",
      "currency": "BSV",
      "refundAddress": "1AliceRefundAddr"   // optional
    }
  }
}
```

### Error Codes
| HTTP | JSON‑RPC code | Description                      |
|------|---------------|----------------------------------|
| 402  | `-32030`      | **PaymentMissing** – no DataPart |
| 402  | `-32031`      | **PaymentInvalid** – rawTx malformed |
| 402  | `-32032`      | **AddressMismatch** – output pays wrong address |
| 402  | `-32033`      | **AmountInsufficient** – value < price |
| 402  | `-32034`      | **CurrencyUnsupported** – config can’t accept that coin |

### Refunds & Partial Payments
* **Refunds** – If execution fails after broadcast, the agent returns funds to `refundAddress` or credits future calls.  
* **Metered streaming** – agent pauses, issues `PaymentInsufficient`; client sends another rawTx in a new DataPart; agent resumes.

---

## Registry

## Registry
### Publishing with 1Sat Ordinals + MAP
A 1Sat inscription must reside in a **single‑satoshi P2PKH output** with an **ord envelope** in the script  [oai_citation_attribution:4‡Protocol Specification | 1Sat Ordinals](https://docs.1satordinals.com/?utm_source=chatgpt.com). The agent file is embedded as:

```
… P2PKH …
OP_FALSE OP_IF
  "ord"
  OP_1 "application/json"
  OP_0 <agent.json bytes>
OP_ENDIF OP_RETURN
"1PuQa7K62MiKCtssSLKy1kh56WWU7MtUR5" 
    "SET" 
        "app" "bsv-mcp" 
        "type" "agent"
```

### Publishing with 1Sat Ordinals + MAP
* **Output 0 (1 sat)** – OP_FALSE OP_IF P2PKH script with ord envelope storing `.well‑known/agent.json`.  
    * **MAP tags** – `SET app bsv-mcp type a2b`.

Create via `js-1sat-ord`:

```ts
const inscription = {
  dataB64,
  contentType: 'application/json',
  filename: '.well-known/agent.json'
};
const meta = { app: 'bsv-mcp', type: 'a2b' };
await createOrdinals({ utxos, destinations:[{address:target, inscription}], paymentPk, changeAddress, metaData: meta });
```

### Updating by Re‑inscription
To update pricing or endpoints:

1. Spend the same satoshi into a new output you control.  
2. Embed a **new ord envelope** with revised `agent.json`.  
3. Append identical MAP tags.  

Indexers treat **latest inscription in that satoshi** as canonical. Authority follows UTXO ownership; registry inscriptions can be listed on any ordinal DEX and updated by the buyer.

### Discovery Workflow
1. Indexer scans for ord envelopes whose accompanying MAP = `app=bsv-mcp&type=a2b`.  
2. Caches the newest inscription per satoshi.  
3. Exposes query API (skill, capability, price ceiling, provider, update height).  
4. Clients fetch `agent.json`, compare to live HTTPS copy, and warn on mismatch.

---

## Including Payment in A2A Calls
Full request example:

```json
{
  "jsonrpc": "2.0",
  "id": "task-1234",
  "method": "tasks/send",
  "params": {
    "id": "task-1234",
    "sessionId": "sess-5678",
    "message": {
      "role": "user",
      "parts": [
        { "type": "text", "text": "What's the weather in New York?" },
        {
          "type": "data",
          "data": {
            "x-payment": {
              "configId": "pay-per-call",
              "rawTx": "0100000001e34ac1e2…00000000",
              "currency": "BSV"
            }
          }
        }
      ]
    }
  }
}
```

---

## Benefits of This Approach
* **Ownership = control** – spend the sat, re‑inscribe; no extra signatures.  
* **Tradable registry entries** – inscriptions behave like NFTs; list them on DEXs.  
* **Atomic payments** – agent broadcasts tx only after successful work.  
* **Transparent pricing & discovery** – all pricing visible on‑chain and searchable without central servers.

---

## Payment Verification
Server routine:

1. Decode `rawTx`; confirm output pays `address` at least `amount`.  
2. Ensure `rawTx` not yet on‑chain.  
3. Validate `currency` and any FX conversions.  
4. Execute task.  
5. On success broadcast `rawTx`; on failure discard.  
6. For recurring configs, update subscription expiry.

---

## Implementation Guide
### Client
1. Discover agents via indexer; fetch latest `agent.json`.  
2. Select a pricing **config** (`configId`).  
3. Build & sign a rawTx paying `address`; keep locally.  
4. Send A2A call with `x-payment` DataPart containing `rawTx`.  
5. Handle HTTP 402 / JSON‑RPC error; if needed, build a new rawTx and retry.

### Server
1. Publish Agent Card via `wallet_a2bPublish` (1Sat Ordinal + MAP).  
2. On each call, parse `rawTx`; validate.  
3. Execute task; on success broadcast `rawTx`, on failure discard.  
4. Manage subscription windows & usage limits.

---
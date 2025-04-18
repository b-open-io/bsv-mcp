# A2B (Agent‑to‑Bitcoin)

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
**A2B** augments Google’s Agent‑to‑Agent (A2A) protocol with blockchain‑native payments and a decentralized registry. Agents publish price data inside `.well‑known/agent.json`, receive **raw transactions** from clients (the agent broadcasts only after successful execution), and store the same Agent Card on‑chain as a **1Sat Ordinal inscription** tagged with **MAP** metadata for permissionless discovery. Because ownership follows the satoshi, the inscription can be traded on any ordinal‑aware DEX and re‑inscribed by the new owner—no extra signature layer required. The design is currency‑agnostic; any coin whose payments can be conveyed with a raw transaction works (BSV, BTC, BCH, ETH, SOL, …).

---

## Payments
### Schema
A2A’s JSON schema allows arbitrary vendor keys because it omits `additionalProperties:false`  [oai_citation_attribution:0‡GitHub](https://github.com/google/A2A/blob/main/specification/json/a2a.json?utm_source=chatgpt.com) [oai_citation_attribution:1‡APIMatic](https://www.apimatic.io/openapi/additionalproperties?utm_source=chatgpt.com).  
Define an **`x-payment` array** of pricing configurations:

```typescript
interface PricingConfig {
  id: string;
  currency: string;
  amount: number;
  address: string;
  description?: string | null;
  acceptedCurrencies?: string[];
  skills?: string[];
  interval?: 'day'|'week'|'month'|'year'|null; // null = one‑off
  includedCalls?: Record<string, number>;
  termsUrl?: string;
}
```

### Examples
```json
"x-payment": [
  {
    "id": "pay-per-call",
    "currency": "BSV",
    "amount": 0.00001,
    "address": "1BSVPayAddr",
    "skills": ["getWeather"],
    "interval": null
  },
  {
    "id": "subscription-premium",
    "currency": "USD",
    "amount": 10,
    "address": "1UsdProxy",
    "interval": "month",
    "skills": ["getWeather","getNews"],
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
A2A messages are JSON‑RPC; structured payloads must sit inside a **DataPart**  [oai_citation_attribution:2‡GitHub](https://github.com/google/A2A/blob/main/specification/json/a2a.json?utm_source=chatgpt.com).  
Clients create and sign—but do **not** broadcast—a raw transaction paying the advertised `address`. They embed it:

```jsonc
{
  "type": "data",
  "data": {
    "x-payment": {
      "configId": "pay-per-call",
      "rawTx": "0100000001e34ac1e2baac09c3…00000000",
      "currency": "BSV"
    }
  }
}
```

Because the agent is the broadcaster, the client is never charged if the request fails. This “pay‑to‑provider‑broadcast” pattern is common in pay‑per‑call APIs  [oai_citation_attribution:3‡Bitcoin Stack Exchange](https://bitcoin.stackexchange.com/questions/69842/create-a-raw-transaction-and-broadcast-it-to-blockchain-using-bitcoin-core?utm_source=chatgpt.com).

### Error Codes
| HTTP | JSON‑RPC code | Description                      |
|------|---------------|----------------------------------|
| 402  | `-32030`      | **PaymentMissing** – no DataPart |
| 402  | `-32031`      | **PaymentInvalid** – rawTx malformed |
| 402  | `-32032`      | **AddressMismatch** – output pays wrong address |
| 402  | `-32033`      | **AmountInsufficient** – value < price |
| 402  | `-32034`      | **CurrencyUnsupported** – config can’t accept that coin |

### Refunds & Partial Payments
* **Refunds** – if something breaks *after* broadcast, the agent can automatically send coins back to a `refundAddress` included in the claim.  
* **Metered streaming** – agent pauses stream, returns `PaymentInsufficient`; client supplies an additional rawTx in a new DataPart; agent resumes.

---

## Registry
### Publishing with 1Sat Ordinals + MAP
A 1Sat inscription must reside in a **single‑satoshi P2PKH output** with an **ord envelope** in the script  [oai_citation_attribution:4‡Protocol Specification | 1Sat Ordinals](https://docs.1satordinals.com/?utm_source=chatgpt.com). The agent file is embedded as:

```
… P2PKH …
OP_FALSE OP_IF
  6f7264
  OP_1 "application/json"
  OP_1 ".well-known/agent.json"
  OP_0 <agent.json bytes>
OP_ENDIF
```

A separate zero‑sat output carries MAP metadata (`1PuQa7K…` prefix) setting `app bsv-mcp` and `type agent`  [oai_citation_attribution:5‡GitHub](https://github.com/rohenaz/MAP?utm_source=chatgpt.com).  
The `js-1sat-ord` library automates inscription creation  [oai_citation_attribution:6‡GitHub](https://github.com/BitcoinSchema/js-1sat-ord?utm_source=chatgpt.com).

### Updating by Re‑inscription
To update, **spend the same satoshi** into a new output you control and include a new ord envelope with the updated Agent Card. “Re‑inscribing” is explicitly supported by ordinal tooling; the latest inscription in a satoshi supersedes earlier ones  [oai_citation_attribution:7‡Reddit](https://www.reddit.com/r/BitcoinOrdinals/comments/18ociox/is_it_possible_to_reinscribe_an_ordinal/?utm_source=chatgpt.com). Because authority follows UTXO ownership, inscriptions are naturally tradable on ordinal DEXs.

### Discovery Workflow
1. Indexer watches the blockchain; when it sees an ord envelope and MAP `app=bsv-mcp&type=agent`, it records that satoshi.  
2. Keeps **the newest inscription for that satoshi** as canonical.  
3. Exposes query APIs: by skill, capability, price ceiling, provider, update height, etc.

---

## Including Payment in A2A Calls
Full request:

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
* **Ownership = Control** – whoever owns the satoshi controls the Agent Card.  
* **Tradable** – inscriptions behave like NFTs; list them on marketplaces  [oai_citation_attribution:8‡Reddit](https://www.reddit.com/r/BitcoinOrdinals/comments/18ociox/is_it_possible_to_reinscribe_an_ordinal/?utm_source=chatgpt.com).  
* **Atomic Payment** – agent only broadcasts rawTx after success; client isn’t charged for failed jobs.  
* **No signature layers** – authority shown by spending the sat, not external schemes.  
* **Open discovery** – anyone can run an indexer; no gatekeepers.

---

## Payment Verification
Server workflow:

1. Decode `rawTx`; ensure it contains an output paying `address` at least `amount`.  
2. Validate that `rawTx` is not yet seen on‑chain.  
3. Verify `currency` accepted (or FX via `acceptedCurrencies`).  
4. Execute task.  
5. If task succeeds → broadcast `rawTx`. If it fails → discard `rawTx` (no charge).  
6. For recurring configs, update subscription expiration.

---

## Implementation Guide
### Client
1. Discover agents via indexer; fetch latest `agent.json`.  
2. Select a `configId`.  
3. Construct & sign a rawTx paying `address`; keep it local.  
4. Send A2A request with DataPart containing `rawTx`.  
5. On HTTP 402 / JSON‑RPC error, build a new rawTx and retry.

### Server
1. Publish Agent Card with `wallet_a2bPublish` (1Sat Ord + MAP).  
2. For each call, parse `rawTx` from `x-payment`.  
3. Validate outputs and amount.  
4. Run task; on success broadcast `rawTx` and return result; on failure return 500 and do **not** broadcast.  
5. Manage subscription windows and usage counters.

---

### References  
1. 1Sat Ordinals envelope spec  [oai_citation_attribution:9‡Protocol Specification | 1Sat Ordinals](https://docs.1satordinals.com/?utm_source=chatgpt.com)  
2. MAP protocol prefix & docs  [oai_citation_attribution:10‡GitHub](https://github.com/rohenaz/MAP?utm_source=chatgpt.com)  
3. A2A JSON schema (no `additionalProperties:false`)  [oai_citation_attribution:11‡GitHub](https://github.com/google/A2A/blob/main/specification/json/a2a.json?utm_source=chatgpt.com)  
4. OpenAPI note on extra properties  [oai_citation_attribution:12‡APIMatic](https://www.apimatic.io/openapi/additionalproperties?utm_source=chatgpt.com)  
5. `js-1sat-ord` library usage  [oai_citation_attribution:13‡GitHub](https://github.com/BitcoinSchema/js-1sat-ord?utm_source=chatgpt.com)  
6. Re‑inscription (discourse on updating ordinals)  [oai_citation_attribution:14‡Reddit](https://www.reddit.com/r/BitcoinOrdinals/comments/18ociox/is_it_possible_to_reinscribe_an_ordinal/?utm_source=chatgpt.com)  
7. MAP in Bitcoin Wiki application layer  [oai_citation_attribution:15‡Bitcoin Wiki](https://wiki.bitcoinsv.io/index.php/Application_layer_protocol?utm_source=chatgpt.com)  
8. Raw transaction broadcast workflow  [oai_citation_attribution:16‡Bitcoin Stack Exchange](https://bitcoin.stackexchange.com/questions/69842/create-a-raw-transaction-and-broadcast-it-to-blockchain-using-bitcoin-core?utm_source=chatgpt.com)  
9. Stripe explainer on A2A payments for context  [oai_citation_attribution:17‡Stripe](https://stripe.com/en-jp/resources/more/what-are-a2a-payments-a-quick-guide-to-account-to-account-payments?__from__=talkingdev&utm_source=chatgpt.com)  
10. Transaction fee factors (fee sizing)  [oai_citation_attribution:18‡tangem.com](https://tangem.com/en/blog/post/bitcoin-transaction-fees/?utm_source=chatgpt.com)
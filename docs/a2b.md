# A2B (Agent‑to‑Bitcoin)

## Table of Contents
- [Payments](#payments)
  - [Schema](#schema)
  - [Examples](#examples)
  - [Including Payment in A2A Calls](#including-payment-in-a2a-calls)
  - [Partial / Staged Payments](#partial--staged-payments)
  - [Error Codes](#error-codes)
- [Registry](#registry)
  - [Publishing with 1Sat Ordinals + MAP](#publishing-with-1sat-ordinals--map)
  - [Updating by Re‑inscription](#updating-by-re-inscription)
  - [Discovery Workflow](#discovery-workflow)
- [Benefits](#benefits)
- [Payment Verification](#payment-verification)
- [Implementation Guide](#implementation-guide)

---

## Overview
A2B adds **on‑chain payments** and a **decentralized registry** to Google’s Agent‑to‑Agent (A2A) protocol.  
* Agents declare pricing with `x‑payment‑config`.  
* Clients send **raw transactions** that the agent broadcasts only after the work succeeds—so clients are never charged for failed jobs.  
* The same Agent Card is stored on‑chain as a **1Sat Ordinal inscription** inside an *ord envelope*  [oai_citation_attribution:0‡Protocol Specification | 1Sat Ordinals](https://docs.1satordinals.com/?utm_source=chatgpt.com) and tagged with **MAP** key/value pairs for discovery .  
* Ownership follows the satoshi—inscriptions can be traded on ordinal DEXs and **re‑inscribed** by the new owner to update endpoints or prices  [oai_citation_attribution:1‡Ordinal Theory Handbook](https://docs.ordinals.com/inscriptions/delegate.html?utm_source=chatgpt.com).

A2B is **currency‑agnostic**; any coin whose transfers can be carried as a raw transaction works.

---

## Payments

### Schema
`x‑payment‑config` is an **array** of pricing objects added to `.well‑known/agent.json`.  
A2A’s schema allows vendor keys because it lacks `additionalProperties:false`  [oai_citation_attribution:2‡Protocol Specification | 1Sat Ordinals](https://docs.1satordinals.com/partially-signed-transactions?utm_source=chatgpt.com).

```typescript
interface PricingConfig {
  id: string;              // unique ID used in payment claims
  currency: string;        // price unit
  amount: number;          // total price
  address: string;         // receiver
  depositPct?: number;     // 0–1  (omit for full‑up‑front)
  description?: string;
  acceptedCurrencies?: string[];
  skills?: string[];
  interval?: 'day'|'week'|'month'|'year'|null;
  includedCalls?: Record<string,number>;
  termsUrl?: string;
}
```

*`depositPct` introduces a simple two‑stage model: **deposit** then **final balance**.*

### Examples
```json
"x-payment-config": [
  {
    "id": "pay-per-call",
    "currency": "BSV",
    "amount": 0.00001,
    "address": "1BSVPayAddr",
    "skills": ["getWeather"],
    "interval": null
  },
  {
    "id": "ml-training",
    "currency": "BSV",
    "amount": 0.005,
    "address": "1TrainAddr",
    "depositPct": 0.3,
    "skills": ["trainModel"]
  }
]
```

### Including Payment in A2A Calls
All structured data must go into a **DataPart**  [oai_citation_attribution:3‡Protocol Specification | 1Sat Ordinals](https://docs.1satordinals.com/partially-signed-transactions?utm_source=chatgpt.com).  
The client supplies one raw transaction per stage:

```jsonc
{
  "type": "data",
  "data": {
    "x-payment": {
      "configId": "ml-training",
      "stage": "deposit",                     // "deposit" or "final"
      "rawTx": "0100000001e34ac1e2…00000000",
      "currency": "BSV",
      "refundAddress": "1AliceRefund"         // optional
    }
  }
}
```

### Partial / Staged Payments
| Stage    | Trigger | Amount                           | Server action |
|----------|---------|----------------------------------|---------------|
| deposit  | first `tasks/send` | `amount × depositPct` | Validate → broadcast → start job |
| final    | client polls / server signals `AmountInsufficient` | `amount – deposit` | Validate → broadcast → return results |

If `depositPct` is omitted, only **one** stage (`full`) is required.

### Error Codes
| HTTP | JSON‑RPC code | Meaning                                 |
|------|---------------|-----------------------------------------|
| 402  | `-32030`      | PaymentMissing – no DataPart            |
| 402  | `-32031`      | PaymentInvalid – rawTx malformed        |
| 402  | `-32032`      | StageMismatch – wrong stage             |
| 402  | `-32033`      | AmountInsufficient – deposit or final   |
| 402  | `-32034`      | AddressMismatch / CurrencyUnsupported   |

---

## Registry

### Publishing with 1Sat Ordinals + MAP
* **Output 0 – 1 sat:** P2PKH + ord envelope (`OP_FALSE OP_IF 6f7264 … OP_ENDIF`) holding `.well‑known/agent.json`  [oai_citation_attribution:4‡Protocol Specification | 1Sat Ordinals](https://docs.1satordinals.com/?utm_source=chatgpt.com) [oai_citation_attribution:5‡Ordinal Theory Handbook](https://docs.ordinals.com/inscriptions.html?utm_source=chatgpt.com).  
* **Output 1 – 0 sat:** `OP_RETURN 1PuQa7K… SET app bsv-mcp type agent` .  
Create with `js‑1sat‑ord`  [oai_citation_attribution:6‡Medium](https://scryptplatform.medium.com/integrate-ordinals-with-smart-contracts-on-bitcoin-part-1-33e421314ac0?utm_source=chatgpt.com).

### Updating by Re‑inscription
Spend the **same satoshi** into a new output and include a new ord envelope with the updated Agent Card; append the same MAP tags. The latest inscription in that satoshi overrides older ones  [oai_citation_attribution:7‡Ordinal Theory Handbook](https://docs.ordinals.com/inscriptions/delegate.html?utm_source=chatgpt.com).

### Discovery Workflow
1. Indexer scans blockchain for ord envelopes + MAP filter.  
2. Caches the **newest inscription per satoshi** (authoritative).  
3. Serves query API (skill, capability, price ceiling, etc.).  
4. Buyers can purchase the satoshi on any ordinal DEX and update pricing by re‑inscribing.

---

## Benefits
* **Simple flexibility** – optional `depositPct` enables pay‑as‑you‑go without complex milestones.  
* **Atomic payments** – agent broadcasts tx only after each stage succeeds, mirroring hold‑invoice semantics  [oai_citation_attribution:8‡Ordinal Theory Handbook](https://docs.ordinals.com/inscriptions/delegate.html?utm_source=chatgpt.com).  
* **Ownership = control** – no extra signature layer; spend the satoshi, own the listing.  
* **Tradability** – registry entries are standard ordinals, instantly listable  [oai_citation_attribution:9‡Protocol Specification | 1Sat Ordinals](https://docs.1satordinals.com/partially-signed-transactions?utm_source=chatgpt.com).

---

## Payment Verification
1. Decode `rawTx`; check output pays `address` ≥ stage amount.  
2. Ensure tx not yet confirmed.  
3. For deposit: verify stage == `"deposit"`. For second payment: `"final"`.  
4. Execute work; on success broadcast `rawTx`.  
5. If work fails, discard tx (client keeps funds).  
6. Track per‑task payment state (`"pending"`, `"deposit-paid"`, `"paid-in-full"`).

---

## Implementation Guide
### Client
1. Discover agent via indexer; fetch latest Agent Card.  
2. Choose a pricing config.  
3. Build rawTx for deposit or full price; keep locally.  
4. Send A2A request (`tasks/send` or `tasks/sendSubscribe`) with DataPart `x-payment.stage:"deposit"| "full"`.  
5. Poll for progress. If server replies with `AmountInsufficient`, build final rawTx and resend.  
6. Receive results after final payment broadcast.

### Server
1. Inscribe Agent Card via `wallet_a2bPublish`.  
2. On request: validate stage, decode rawTx, check amount.  
3. Run task; on success broadcast rawTx, update task state.  
4. If only deposit paid, keep task `"in-progress"`.  
5. Once final paid, mark task `"completed"`, return artifacts.

---

### Key References  
1. 1Sat Ords envelope spec  [oai_citation_attribution:10‡Protocol Specification | 1Sat Ordinals](https://docs.1satordinals.com/?utm_source=chatgpt.com)  
2. Ordinal Theory Handbook on envelopes  [oai_citation_attribution:11‡Ordinal Theory Handbook](https://docs.ordinals.com/inscriptions.html?utm_source=chatgpt.com)  
3. A2A JSON schema lacks `additionalProperties:false`  [oai_citation_attribution:12‡Protocol Specification | 1Sat Ordinals](https://docs.1satordinals.com/partially-signed-transactions?utm_source=chatgpt.com)  
4. MAP protocol address & SET syntax   
5. `js-1sat-ord` library usage  [oai_citation_attribution:13‡Medium](https://scryptplatform.medium.com/integrate-ordinals-with-smart-contracts-on-bitcoin-part-1-33e421314ac0?utm_source=chatgpt.com)  
6. Raw‑tx deferred broadcast API pattern  [oai_citation_attribution:14‡Bitcoin financial services - Unchained](https://www.unchained.com/blog/bitcoin-inscriptions-ordinals?utm_source=chatgpt.com)  
7. Re‑inscription & DEX trading discourse  [oai_citation_attribution:15‡Ordinal Theory Handbook](https://docs.ordinals.com/inscriptions/delegate.html?utm_source=chatgpt.com)  
8. OrdinalHub envelope explainer  [oai_citation_attribution:16‡OrdinalHub](https://blog.ordinalhub.com/what-is-an-envelope/?utm_source=chatgpt.com)  
9. BSV push‑data rule (no 520‑byte limit)  [oai_citation_attribution:17‡Protocol Specification | 1Sat Ordinals](https://docs.1satordinals.com/?utm_source=chatgpt.com)  
10. StackExchange parsing Ordinals tx  [oai_citation_attribution:18‡bitcoin.stackexchange.com](https://bitcoin.stackexchange.com/questions/121978/parsing-ordinals-transaction-the-inscribed-data-part?utm_source=chatgpt.com)
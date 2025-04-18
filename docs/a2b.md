# A2B (Agent‑to‑Bitcoin)

## Table of Contents
- [Payments](#payments)
- [Registry](#registry)
- [Including Payment in A2A Calls](#including-payment-in-a2a-calls)
- [Benefits](#benefits-of-this-approach)
- [Payment Verification](#payment-verification)
- [Implementation Guide](#implementation-guide)

---

## Overview
**A2B** extends Google’s Agent‑to‑Agent (A2A) protocol with:

| Layer        | Purpose                                                                                                      |
|--------------|--------------------------------------------------------------------------------------------------------------|
| **Payments** | Describe prices in your Agent Card (`x-payment.configs`) and attach verifiable on‑chain payments to every call. |
| **Registry** | Publish the Agent Card as a **1Sat Ordinal inscription** plus **MAP tags** so anyone can discover, trade, and update it without a central directory. |

Any chain whose transfers are provable by `txid` can be used (BSV, BTC, BCH, ETH, SOL, …).

---

## Payments

### Schema
Add vendor‑extension `x-payment` to `.well‑known/agent.json`.  
It contains **pricing configurations** — each an object with the fields below.

```typescript
interface PricingConfig {
  id: string;
  currency: string;
  amount: number;
  address: string;
  description?: string | null;
  acceptedCurrencies?: string[];
  skills?: string[];
  interval?: 'day'|'week'|'month'|'year'|null;
  includedCalls?: Record<string, number>;
  termsUrl?: string;
}
```

### Example
```json
"x-payment": {
  "configs": [
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
    }
  ]
}
```

### Including Payment in a Call
Embed a DataPart:

```jsonc
{
  "type": "data",
  "data": {
    "x-payment": {
      "configId": "pay-per-call",
      "txid": "abcdef…",
      "vout": 0,
      "amount": 0.00001,
      "currency": "BSV"
    }
  }
}
```

Servers validate the payment and reply, or return HTTP 402 with JSON‑RPC error codes (`-32030`…`34`) on failure.

---

## Registry

### Publishing with 1Sat Ordinals + MAP
An Agent Card is stored in a **single satoshi output**.  
Typical transaction:

1. **Output 0 (1 sat)** — locking script carries the **ord envelope**  
   ```
   <P2PKH>          -- spendable script controlling ownership
   OP_FALSE
   OP_IF
     6f7264                     -- "ord" tag
     OP_1 "application/json"    -- content‑type field
     OP_1 ".well-known/agent.json" -- filename field
     OP_0 <agent.json bytes>    -- file data
   OP_ENDIF
   ```
2. **Output 1 (0 sat OP_RETURN)** — **MAP** metadata  
   ```
   OP_RETURN
     1PuQa7K62MiKCtssSLKy1kh56WWU7MtUR5
     SET app bsv-mcp type agent
   ```

* The ord envelope follows the spec documented at docs.1satordinals.com  [oai_citation_attribution:0‡Protocol Specification | 1Sat Ordinals](https://docs.1satordinals.com/?utm_source=chatgpt.com).  
* MAP tags make the inscription discoverable by indexers .

#### Updating (“Re‑inscribing”)
* **Spend** the 1‑sat output into a new 1‑sat output under your control.  
* **Include a new ord envelope** carrying the updated `agent.json` **in the same satoshi**.  
* Emit a new MAP output with identical keys.  

Ownership of the inscription = ownership of the UTXO; whoever controls the satoshi can update and even list it on DEXs. No extra signature schemes (AIP/BAP) are required.

### Discovery Workflow
1. Indexer scans for ord envelopes with MAP `app=bsv-mcp&type=agent`.  
2. For each UTXO, keeps **latest inscription in that satoshi**.  
3. Provides search endpoints (skill, capability, price ceiling, provider, etc.).  
4. Clients may buy the ordinal on‑chain; the new owner can re‑inscribe to change endpoints or pricing.

---

## Including Payment in A2A Calls
Use A2A JSON‑RPC `tasks/send` with a DataPart containing `x-payment` as shown earlier. If payment insufficient, the agent returns HTTP 402 with a JSON‑RPC error object.

---

## Benefits of This Approach
* **Immutable yet updatable** – data bound to a satoshi; transfer sat → new owner can re‑inscribe.  
* **No extra signature layers** – authority = UTXO control.  
* **Protocol‑native** – uses A2A Parts and ord spec without custom transport.  
* **Marketplace‑ready** – inscriptions are standard ord tokens, listable on DEXs.  

---

## Payment Verification
See server checklist:

1. Tx confirmed.  
2. Output pays `address`.  
3. Amount ≥ price (FX converted if `acceptedCurrencies`).  
4. UTXO unspent.  
5. For recurring configs, extend `validUntil`.

---

## Implementation Guide
### Client
1. Query indexer → fetch `agent.json`.  
2. Pick a `configId`; pay on‑chain; wait confirmations.  
3. Call `tasks/send` with `x-payment`.  
4. Handle 402 errors, retry with correct payment.

### Server
1. Inscribe Agent Card via tooling (1Sat Ord + MAP).  
2. On call, parse `x-payment` DataPart; verify tx on chosen chain.  
3. Track usage / subscriptions.  
4. On success → run task; on failure → 402.

---
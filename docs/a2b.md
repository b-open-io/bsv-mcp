# A2B (Agent‑to‑Bitcoin)

## Table of Contents
- [Payments](#payments)
  - [Schema](#schema)
  - [Examples](#examples)
  - [Including Payment in A2A Calls](#including-payment-in-a2a-calls)
  - [Error Codes](#error-codes)
  - [Refunds & Partial Payments](#refunds--partial-payments)
- [Registry](#registry)
  - [Publishing with 1Sat Ordinals + MAP](#publishing-with-1sat-ordinals--map)
  - [Updates & Identity Attestation](#updates--identity-attestation)
  - [Discovery Workflow](#discovery-workflow)
- [Benefits](#benefits-of-this-approach)
- [Payment Verification](#payment-verification)
- [Implementation Guide](#implementation-guide)

---

## Overview
**A2B** extends Google’s Agent‑to‑Agent (A2A) protocol with two blockchain layers:

| Layer        | Purpose                                                                                                            |
|--------------|--------------------------------------------------------------------------------------------------------------------|
| **Payments** | Advertise pricing (`x-payment.configs`) and attach verifiable on‑chain payments to each JSON‑RPC call.             |
| **Registry** | Inscribe the Agent Card as a **1Sat Ordinal file** and tag it with **MAP** so anyone can discover it trustlessly.   |

Any asset whose transfers are verifiable by `txid` works (BSV, BTC, BCH, ETH, SOL, …).

---

## Payments
### Schema
Vendor‑extension `x-payment` holds **pricing configurations** (not “plans”):

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

### Examples
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
}
```

### Including Payment in A2A Calls
Insert a **DataPart** with an `x-payment` claim:

```jsonc
{
  "type": "data",
  "data": {
    "x-payment": {
      "configId": "pay-per-call",
      "txid": "abcdef…",
      "vout": 0,
      "amount": 0.00001,
      "currency": "BSV",
      "signature": "MEUCIQ…"     // optional ECDSA over txid|vout|configId
    }
  }
}
```

### Error Codes
| HTTP | JSON‑RPC code | Description                      |
|------|---------------|----------------------------------|
| 402  | `-32030`      | PaymentMissing                   |
| 402  | `-32031`      | PaymentInsufficient              |
| 402  | `-32032`      | TxUnconfirmed                    |
| 402  | `-32033`      | AddressMismatch                  |
| 402  | `-32034`      | CurrencyUnsupported              |

### Refunds & Partial Payments
* **Refund**: server returns coins to `refundAddress` or stores credit.  
* **Metered tasks**: agent pauses stream, issues `PaymentInsufficient`; client sends new tx and resumes.

---

## Registry
### Publishing with 1Sat Ordinals + MAP
A2B agent inscription lives in a **single‑satoshi output** (dust‑free on BSV).  
Script layout (simplified):

```
<1sat P2PKH locking script>
OP_FALSE OP_IF
  6f7264                      -- "ord" tag
  OP_1  "application/json"    -- Content‑Type field/value
  OP_0  <agent.json bytes>    -- Content
OP_ENDIF
OP_RETURN
  1PuQa7K62MiKCtssSLKy1kh56WWU7MtUR5  SET app bsv-mcp type agent
```

* `OP_FALSE OP_IF … OP_ENDIF`   → **ord envelope** (valid 1Sat inscription) [oai_citation_attribution:0‡Protocol Specification | 1Sat Ordinals](https://docs.1satordinals.com/?utm_source=chatgpt.com)  
* `OP_RETURN … MAP`             → **Magic Attribute Protocol** metadata behind the inscription [oai_citation_attribution:1‡Protocol Specification | 1Sat Ordinals](https://docs.1satordinals.com/adding-metadata?utm_source=chatgpt.com)  
* Filename `.well‑known/agent.json` and UTF‑8 encoding live inside an additional envelope field (not shown for brevity).

Use **`js-1sat-ord`** to create:  

```ts
const inscription = { dataB64, contentType: 'application/json', filename: '.well-known/agent.json' };
const meta = { app: 'bsv-mcp', type: 'agent' };
await createOrdinals({ utxos, destinations:[{address:target, inscription}], paymentPk, changeAddress, metaData: meta });
```
 [oai_citation_attribution:2‡GitHub](https://github.com/BitcoinSchema/js-1sat-ord?utm_source=chatgpt.com)

### Updates & Identity Attestation
* Add a **BAP (AIP04) signature** push after MAP to bind the card to an identity key [oai_citation_attribution:3‡Protocol Specification | 1Sat Ordinals](https://docs.1satordinals.com/adding-metadata?utm_source=chatgpt.com).  
* To supersede, inscribe a new ordinal with `SET updateOf <prevTxid>`; indexers treat the newest by signature key as active.

### Discovery Workflow
1. Indexer scans chain → finds ord envelope + MAP `app=bsv-mcp&type=agent`.  
2. Extracts and caches `agent.json`.  
3. Verifies AIP04 signature → establishes author identity.  
4. Provides API filtering by skills, price, provider, etc.

Example query:

```typescript
const results = await indexer.searchAgents({
  skills: ["getWeather"],
  maxPrice: { currency: "BSV", amount: 0.0001 }
});
```

---

## Benefits of This Approach
* **Protocol‑native**: leverages A2A Parts and 1Sat standards.  
* **Immutable discovery**: Agent Card stored on‑chain.  
* **Transparent pricing**: costs visible in `x-payment`.  
* **No custodians**: payments verified on the public ledger.  
* **Currency‑agnostic**: pay with any chain the agent accepts.

---

## Payment Verification
1. Confirm tx exists & meets confirmation depth.  
2. Check output pays advertised `address`.  
3. Ensure `amount` ≥ price (apply FX if `acceptedCurrencies`).  
4. Verify UTXO unspent.  
5. For `interval` ≠ null: extend subscription window.  
6. If signature present: recover pubkey & verify hash(txid|vout|configId).

---

## Implementation Guide
### Client
1. **Discover** agents via indexer.  
2. **Fetch** on‑chain Agent Card; verify AIP04 signature.  
3. **Pick** a pricing config.  
4. **Pay** on‑chain; wait for confirmation.  
5. **Call** `tasks/send` with `x-payment` DataPart; handle 402 errors.

### Server
1. **Publish** Agent Card with `wallet_a2bPublish`.  
2. **Parse** `x-payment` claim on each call.  
3. **Validate** payment on the relevant chain.  
4. **Track** allowances/subscriptions.  
5. **Respond** with data or JSON‑RPC error + HTTP 402.

---
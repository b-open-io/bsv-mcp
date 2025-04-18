# A2B (Agent‑to‑Bitcoin)  
*A payment and discovery extension for Google A2A*

---

## Table of Contents
1. [Scope](#scope)  
2. [Terminology](#terminology)  
3. [Payments](#payments)  
   3.1 [Pricing Configuration (`x-payment-config`)](#schema)  
   3.2 [Example Agent Card](#examples)  
   3.3 [Payment Claim (`x-payment` DataPart)](#including-payment-in-a2a-calls)  
   3.4 [Two‑Stage Deposit Model](#partial-payments)  
   3.5 [Error Codes](#error-codes)  
4. [Registry](#registry)  
   4.1 [1Sat Ordinal + MAP Format](#publishing-with-1sat-ordinals--map)  
   4.2 [Updating by Re‑inscription](#updating-by-re-inscription)  
   4.3 [Discovery API Requirements](#discovery-workflow)  
5. [Protocol Guidelines](#protocol-guidelines)  
   5.1 [Immediate Tasks](#immediate-tasks)  
   5.2 [Streaming Tasks](#streaming-tasks)  
   5.3 [Interactive Sessions](#interactive-sessions)  
   5.4 [Long‑Running Jobs](#long-running-jobs)  
   5.5 [Subscription Services](#subscription-services)  
6. [Payment Verification Algorithm](#payment-verification)  
7. [Implementation Guide](#implementation-guide)

---

## 1  Scope<a id="scope"></a>

A2B specifies:

* **How an A2A agent advertises crypto‑priced services** (`x-payment-config`).  
* **How a client submits a raw transaction payment claim** (`x-payment` DataPart).  
* **How an Agent Card is inscribed on‑chain** as a 1Sat Ordinal plus MAP metadata for decentralized discovery.  

The payment flow is chain‑agnostic; examples use **BSV** and **USD‑proxy UTXOs**.

---

## 2  Terminology<a id="terminology"></a>

| Term             | Meaning                                                                                       |
|------------------|------------------------------------------------------------------------------------------------|
| *Pricing Config* | One entry in `x-payment-config`; defines price, currency, address, optional `depositPct`.      |
| *Deposit*        | Up‑front raw transaction covering `amount × depositPct`.                                       |
| *Final*          | Raw transaction covering `amount − deposit`.                                                   |
| *Stage*          | `"deposit"`, `"final"`, or `"full"` depending on config and task.                              |
| *Claim*          | The `x-payment` object inside a DataPart that carries a raw transaction for a stage.           |
| *Success*        | An A2A task reaches `completed` state **and** the corresponding rawTx is broadcast.            |
| *Re‑inscription* | Spending the inscription satoshi into a new output with a new ord envelope + MAP.              |

---

## 3  Payments<a id="payments"></a>

### 3.1  Schema (`x-payment-config`)<a id="schema"></a>

```jsonc
"x-payment-config": [
  {
    "id": "string",             // unique
    "currency": "BSV | USD | …",
    "amount": 0.01,             // total cost in currency unit
    "address": "1Receiver",     // destination of rawTx output
    "depositPct": 0.50,         // optional, 0–1
    "description": "text",
    "acceptedCurrencies": ["SOL"],
    "skills": ["skillId"],
    "interval": null,           // or "month" | "year"
    "includedCalls": { "skillId": 100 },
    "termsUrl": "https://…"
  }
]
```

### 3.2  Example Agent Card<a id="examples"></a>

Agent offers hash‑rate rental and DEX chart data.

```jsonc
{
  "name": "Lightning Mining & Data Agent",
  "url": "https://miner.example",
  "version": "1.0.0",
  "capabilities": { "streaming": true },
  "skills": [
    { "id": "rentHashrate", "name": "Hash‑rate Rental" },
    { "id": "getDexChart", "name": "DEX Chart JSON" }
  ],
  "x-payment-config": [
    {
      "id": "hashrate-rental",
      "currency": "BSV",
      "amount": 0.01,
      "address": "1HashRentAddr",
      "depositPct": 0.5,
      "skills": ["rentHashrate"],
      "description": "SHA‑256 1 MH/s × 24h"
    },
    {
      "id": "dex-chart",
      "currency": "USD",
      "amount": 0.05,
      "address": "1DexDataAddr",
      "skills": ["getDexChart"],
      "description": "OHLCV JSON per trading pair"
    }
  ]
}
```

### 3.3  Payment Claim (`x-payment` DataPart)<a id="including-payment-in-a2a-calls"></a>

```jsonc
{
  "type": "data",
  "data": {
    "x-payment": {
      "configId": "hashrate-rental",
      "stage": "deposit",          // deposit | final | full
      "rawTx": "<hex>",
      "currency": "BSV",
      "refundAddress": "1ClientBack"
    }
  }
}
```

### 3.4  Two‑Stage Deposit Model<a id="partial-payments"></a>

| When sent | Required `stage` | Amount                                   |
|-----------|------------------|-------------------------------------------|
| Task start (`tasks/send` or `…/sendSubscribe`) | `deposit` if `depositPct` present else `full` | `amount × depositPct` or full |
| Server returns **402 / AmountInsufficient** | Client resubmits DataPart<br>`stage:"final"` | `amount – deposit` |

### 3.5  Error Codes<a id="error-codes"></a>

| HTTP | JSON‑RPC code | Condition                              |
|------|---------------|----------------------------------------|
| 402  | `-32030`      | `x-payment` DataPart missing           |
| 402  | `-32031`      | `rawTx` malformed / not decodable      |
| 402  | `-32032`      | `stage` did not match expected         |
| 402  | `-32033`      | Output value < required amount         |
| 402  | `-32034`      | Output address or currency mismatch    |

---

## 4  Registry<a id="registry"></a>

### 4.1  1Sat Ordinal + MAP Format<a id="publishing-with-1sat-ordinals--map"></a>

```
Output 0 (1 sat):
  <P2PKH>
  OP_FALSE OP_IF
    6f7264                     // "ord"
    OP_1 "application/json"
    OP_0 <file-bytes>
  OP_ENDIF

Output 1 (0 sat):
  OP_RETURN
    1PuQa7K62MiKCtssSLKy1kh56WWU7MtUR5
    SET app bsv-mcp type a2b
```

Create with `js-1sat-ord`.

### 4.2  Updating by Re‑inscription<a id="updating-by-re-inscription"></a>

1. Spend the inscription satoshi into a new output you control.  
2. Embed a new ord envelope containing the updated Agent Card.  
3. Add the same MAP tags.

### 4.3  Discovery Workflow<a id="discovery-workflow"></a>

1. Indexer filters inscriptions by `app=bsv-mcp&type=a2b`.  
2. Keeps newest inscription per satoshi.  
3. Exposes API fields: `skill`, `maxPrice`, `currency`, `updateHeight`.

---

## 5  Protocol Guidelines<a id="protocol-guidelines"></a>

### 5.1  Immediate Tasks<a id="immediate-tasks"></a>
* Supply `stage:"full"` payment with request.  
* Client broadcasts rawTx only if server marks task `completed`.

### 5.2  Streaming Tasks<a id="streaming-tasks"></a>
* Provide payment at start (`deposit` or `full`).  
* Agent may delay high‑value output until after `final` stage is received.  
* If client disconnects mid‑stream, no payment is broadcast.

### 5.3  Interactive Sessions<a id="interactive-sessions"></a>
* One task may include multiple `input-required` cycles.  
* Payment covers the entire session; agent should cap turns or use subscription plans to avoid abuse.

### 5.4  Long‑Running Jobs<a id="long-running-jobs"></a>
* Client funds remain locked until completion; agent resources remain uncompensated until payment broadcasts.  
* Agents may set `depositPct` high enough to offset partial costs.

### 5.5  Subscription Services<a id="subscription-services"></a>
* Treat each billing interval as a separate task priced in `x-payment-config` (e.g. monthly plan).  
* Renewal = new task with new payment.

---

## 6  Payment Verification<a id="payment-verification"></a>

```text
validatePayment(rawTx, stage):
    decode rawTx
    require output.address == config.address
    required = (stage == "deposit")
                 ? config.amount * config.depositPct
                 : config.amount - (config.amount * config.depositPct or 0)
    require output.amount >= required
    require rawTx not in mempool or chain
    return true
```

Agent broadcasts `rawTx` immediately after `task.state == completed`.

---

## 7  Implementation Guide<a id="implementation-guide"></a>

| Role   | Step                                                                                                  |
|--------|-------------------------------------------------------------------------------------------------------|
| Client | Discover agent via indexer → fetch Agent Card → choose `configId`.                                     |
|        | Build rawTx for `deposit` or `full`.                                                                   |
|        | Send A2A `tasks/send` (or `…/sendSubscribe`) with DataPart `x-payment`.                                |
|        | On `402 / AmountInsufficient`, build rawTx for `final` and resend.                                     |
|        | Broadcast nothing; wait for server success → broadcast.                                               |
| Server | Validate `rawTx`, verify stage and value → start work.                                                |
|        | On success: broadcast tx, mark task `completed`, return artifacts / SSE events.                       |
|        | On failure: discard tx, mark task `failed`, client keeps funds.                                        |

---
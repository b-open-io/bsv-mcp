# A2B (Agent‑to‑Bitcoin)  
*A payment + discovery extension for Google A2A*

---

## Table of Contents
1. [Overview](#overview)  
2. [Terminology](#terminology)  
3. [Payments](#payments)  
   3.1 [Pricing Configuration (`x-payment-config`)](#schema)  
   3.2 [Example Agent Card](#examples)  
   3.3 [Payment Claim (`x-payment` DataPart)](#payment-claim)  
   3.4 [Two‑Stage Deposit Model](#two-stage-deposit-model)  
   3.5 [Error Codes](#error-codes)  
4. [Registry](#registry)  
   4.1 [1Sat Ordinal + MAP Format](#1sat-ordinal--map-format)  
   4.2 [Updating by Re‑inscription](#updating-by-re-inscription)  
   4.3 [Discovery Workflow](#discovery-workflow)  
5. [Protocol Guidelines](#protocol-guidelines)  
   5.1 [Immediate Tasks](#immediate-tasks)  
   5.2 [Streaming Tasks](#streaming-tasks)  
   5.3 [Interactive Sessions](#interactive-sessions)  
   5.4 [Long‑Running Jobs](#long-running-jobs)  
   5.5 [Subscription Services](#subscription-services)  
6. [Payment Verification Algorithm](#payment-verification-algorithm)  
7. [Implementation Guide](#implementation-guide)

---

## 1  Overview<a id="overview"></a>

A2B adds:

* **Crypto pricing** via `x-payment-config` in the AgentCard.  
* **Per‑task payments** supplied as raw blockchain transactions; **the server broadcasts** the transaction immediately after a successful task.  
* **Decentralized discovery** by inscribing the AgentCard on‑chain as a **1Sat Ordinal** tagged with MAP (`app=bsv‑mcp type=a2b`).  
* **Ownership‑driven updates**: whoever controls the inscription satoshi can re‑inscribe new pricing or metadata.

The model is chain‑agnostic; examples use **BSV** and **USD‑proxy UTXOs**.

---

## 2  Terminology<a id="terminology"></a>

| Term             | Meaning                                                                    |
|------------------|----------------------------------------------------------------------------|
| *Pricing Config* | One object in `x-payment-config`.                                          |
| *Deposit*        | Up‑front rawTx = `amount × depositPct`.                                    |
| *Final*          | RawTx = `amount − deposit`.                                                |
| *Stage*          | `"deposit"`, `"final"`, or `"full"`.                                       |
| *Claim*          | The `x-payment` DataPart supplied by the client.                           |
| *Re‑inscription* | Spending the inscription satoshi, then adding a new ord envelope + MAP.    |

---

## 3  Payments<a id="payments"></a>

### 3.1  Pricing Configuration (`x-payment-config`)<a id="schema"></a>

```jsonc
"x-payment-config": [
  {
    "id": "hashrate-rental",
    "currency": "BSV",
    "amount": 0.01,
    "address": "1HashRentAddr",
    "depositPct": 0.5,             // optional (0–1)
    "description": "24 h, 1 MH/s SHA‑256",
    "skills": ["rentHashrate"]
  },
  {
    "id": "dex-chart",
    "currency": "USD",
    "amount": 0.05,
    "address": "1DexDataAddr",
    "description": "Candlestick JSON, any trading pair",
    "skills": ["getDexChart"],
    "interval": null
  }
]
```

Field semantics:

| Field            | Notes                                                                   |
|------------------|-------------------------------------------------------------------------|
| `id`             | Used by client in `x-payment.configId`.                                 |
| `currency`       | Ticker symbol; free‑form (e.g. `BSV`, `USD`).                           |
| `amount`         | Price in `currency` units.                                              |
| `address`        | Destination output for rawTx.                                           |
| `depositPct`     | If present, enables two‑stage pay (deposit + final).                    |
| `skills`         | Skills this price covers.                                               |
| `interval`       | `null` (one‑off) or billing term (`day`,`week`,`month`,`year`).         |

### 3.2  Example Agent Card<a id="examples"></a>

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
  "x-payment-config": [ /* as above */ ]
}
```

### 3.3  Payment Claim (`x-payment` DataPart)<a id="payment-claim"></a>

```jsonc
{
  "type": "data",
  "data": {
    "x-payment": {
      "configId": "hashrate-rental",
      "stage": "deposit",                   // deposit | final | full
      "rawTx": "<signed-rawtx-hex>",
      "currency": "BSV",
      "refundAddress": "1ClientRefund"
    }
  }
}
```

### 3.4  Two‑Stage Deposit Model<a id="two-stage-deposit-model"></a>

| Stage   | When included by client                | Value sent in `rawTx`          | Broadcast by |
|---------|----------------------------------------|--------------------------------|--------------|
| deposit | Initial request                        | `amount × depositPct`          | **Server**   |
| final   | After `402 / AmountInsufficient`       | `amount − deposit`             | **Server**   |
| full    | One‑stage pricing (no `depositPct`)    | `amount`                       | **Server**   |

### 3.5  Error Codes<a id="error-codes"></a>

| HTTP | JSON‑RPC code | Meaning                                   |
|------|---------------|-------------------------------------------|
| 402  | `-32030`      | PaymentMissing – no `x-payment` DataPart |
| 402  | `-32031`      | PaymentInvalid – rawTx malformed         |
| 402  | `-32032`      | StageMismatch – invalid or duplicate     |
| 402  | `-32033`      | AmountInsufficient                       |
| 402  | `-32034`      | CurrencyUnsupported / AddressMismatch    |

---

## 4  Registry<a id="registry"></a>

### 4.1  1Sat Ordinal + MAP Format<a id="1sat-ordinal--map-format"></a>

```
Output 0 (1 sat):
  <P2PKH>
  OP_FALSE OP_IF
    6f7264
    OP_1 "application/json"
    OP_1 ".well-known/agent.json"
    OP_0 <agent.json bytes>
  OP_ENDIF

Output 1 (0 sat):
  OP_RETURN
    1PuQa7K62MiKCtssSLKy1kh56WWU7MtUR5
    SET app bsv-mcp type a2b
```

### 4.2  Updating by Re‑inscription<a id="updating-by-re-inscription"></a>

Spend the inscription satoshi and attach a new ord envelope (+ identical MAP) with updated pricing or metadata.

### 4.3  Discovery Workflow<a id="discovery-workflow"></a>

1. Indexer scans blockchain for MAP `app=bsv-mcp&type=a2b`.  
2. Stores the newest inscription per satoshi.  
3. Exposes query parameters: `skill`, `currency`, `maxPrice`, `updatedAfter`.

---

## 5  Protocol Guidelines<a id="protocol-guidelines"></a>

### 5.1  Immediate Tasks<a id="immediate-tasks"></a>

* Client sends `stage:"full"` (or `"deposit"` if configured).  
* **Server** validates rawTx, executes task, broadcasts rawTx on success, returns result.  
* On failure, server discards rawTx.

### 5.2  Streaming Tasks<a id="streaming-tasks"></a>

* Client supplies first stage payment at stream start.  
* Server streams updates; high‑value data may be withheld until `stage:"final"` payment arrives.  
* Server broadcasts each stage’s rawTx on success of that stage.

### 5.3  Interactive Sessions<a id="interactive-sessions"></a>

* One payment covers the entire session under one task.  
* Agents may limit turns or require subscription configs for extensive sessions.

### 5.4  Long‑Running Jobs<a id="long-running-jobs"></a>

* Funds remain un‑broadcast until job success; server carries risk if task is lengthy.  
* Agents can mitigate by higher `depositPct` or splitting work into milestones (separate tasks).

### 5.5  Subscription Services<a id="subscription-services"></a>

* Treat each billing period as its own task (e.g. `interval:"month"` config).  
* Renewal = new task + new payment claim.

---

## 6  Payment Verification Algorithm<a id="payment-verification-algorithm"></a>

```pseudo
validateAndBroadcast(rawTx, stage, config):
    tx = decode(rawTx)
    required = stage == "deposit"
               ? config.amount * config.depositPct
               : config.amount - (config.amount * config.depositPct or 0)
    assert tx pays config.address >= required
    assert tx not seen in mempool/chain
    broadcast(tx)                // server action
```

---

## 7  Implementation Guide<a id="implementation-guide"></a>

### Client
1. Query indexer → fetch AgentCard.  
2. Select `configId`; build rawTx for required stage; include it in `x-payment`.  
3. Send `tasks/send` / `…/sendSubscribe`.  
4. On `402 / AmountInsufficient`, build rawTx for `stage:"final"` and resend.  
5. Server broadcasts; client sees on‑chain payment.

### Server
1. Publish AgentCard via `wallet_a2bPublish` (1Sat + MAP).  
2. On request: validate stage & rawTx; execute task.  
3. On success: broadcast rawTx, mark task `completed`, return result/stream.  
4. On failure: discard rawTx, mark `failed`.

---
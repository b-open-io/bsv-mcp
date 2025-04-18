# A2B (Agent‑to‑Bitcoin)  
*A payment + discovery extension for Google A2A*

---

## Table of Contents
1. [Overview](#overview)  
2. [Terminology](#terminology)  
3. [Payments](#payments)  
   3.1 [Pricing Configuration (`x-payment-config`)](#schema)  
   3.2 [Example Agent Card (Lightning Watchtower)](#examples)  
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

* **Crypto‑priced services** via `x-payment-config`.  
* **Per‑task payments** delivered as raw blockchain transactions; **the agent server broadcasts** the transaction only after a successful task.  
* **Decentralized discovery**: every AgentCard is a **1Sat Ordinal** tagged with MAP (`app=bsv‑mcp type=a2b`).  
* The inscription satoshi is fully transferrable; the new owner may re‑inscribe updated pricing or metadata.

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

The agent lists **one or more** pricing configurations.  
`acceptedCurrencies` is **required** and must include the primary `currency`.  
Currency codes follow **ISO‑4217** for fiat (`USD`, `EUR`) and common crypto tickers (`BSV`, `BTC`, `SOL`, etc.).

A provider may include an optional `priceFeedUrl` (JSON or REST) returning spot‑rate data for conversions.

```jsonc
"x-payment-config": [
  {
    "id": "watchtower-monitor",
    "currency": "BSV",                  // price anchor
    "amount": 0.002,                    // 0.002 BSV covers 1 month watch
    "address": "1WatchtowerAddr",
    "acceptedCurrencies": ["BSV","BTC","USD"],
    "depositPct": 0.3,                  // 30 % up‑front, 70 % on success
    "priceFeedUrl": "https://oracle.example/spot",  // optional
    "skills": ["watchChannels"],
    "description": "Lightning watchtower service · 30 days coverage"
  },
  {
    "id": "dex-chart",
    "currency": "USD",
    "amount": 0.05,                     // $0.05 per OHLCV JSON
    "address": "1DexDataAddr",
    "acceptedCurrencies": ["USD","BSV","SOL"],
    "skills": ["getDexChart"],
    "description": "Candlestick JSON, any on‑chain DEX pair"
  }
]
```

#### Minimum validation rules for providers  
* `acceptedCurrencies` **must** list at least `currency`.  
* If the client pays in an alternate ticker, the server converts at spot rate from `priceFeedUrl` (or its own source) and accepts the transaction if value ≥ `amount` at conversion time plus optional slippage margin.  
* Spot conversions and slippage policies are implementation‑specific and outside A2B core.

### 3.2  Example Agent Card (Lightning Watchtower)<a id="examples"></a>

```jsonc
{
  "name": "Watchtower & DEX Data Agent",
  "url": "https://tower.example",
  "version": "1.0.0",
  "capabilities": {
    "streaming": true,
    "pushNotifications": true,
    "stateTransitionHistory": true
  },
  "skills": [
    { "id": "watchChannels", "name": "Watch Lightning Channels" },
    { "id": "getDexChart",  "name": "DEX Chart JSON"          }
  ],
  "x-payment-config": [ /* see schema example above */ ]
}
```

### 3.3  Payment Claim (`x-payment` DataPart)<a id="payment-claim"></a>

```jsonc
{
  "type": "data",
  "data": {
    "x-payment": {
      "configId": "watchtower-monitor",
      "stage": "deposit",                   // deposit | final | full
      "rawTx": "<signed-rawtx-hex>",
      "currency": "BTC",                    // must be in acceptedCurrencies
      "refundAddress": "bc1qclientrefund"
    }
  }
}
```

### 3.4  Two‑Stage Deposit Model<a id="two-stage-deposit-model"></a>

| Stage   | When included by client                | Value sent in `rawTx`                 | Broadcast by |
|---------|----------------------------------------|---------------------------------------|--------------|
| deposit | Initial request                        | `amount × depositPct` (converted if paying alt currency) | **Server**   |
| final   | After `402 / AmountInsufficient`       | `amount − deposit` (converted)        | **Server**   |
| full    | Single‑stage configs (`depositPct` omitted) | `amount` (converted)                  | **Server**   |

### 3.5  Error Codes<a id="error-codes"></a>

| HTTP | JSON‑RPC code | Description                              |
|------|---------------|------------------------------------------|
| 402  | `-32030`      | PaymentMissing                           |
| 402  | `-32031`      | PaymentInvalid (rawTx decode / txid seen)|
| 402  | `-32032`      | StageMismatch                            |
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

Spend the satoshi; attach new envelope + identical MAP. Newest inscription is authoritative.

### 4.3  Discovery Workflow<a id="discovery-workflow"></a>

* Indexer filters `app=bsv-mcp&type=a2b`.  
* Stores newest inscription per sat.  
* Query parameters: `skill`, `currency`, `maxPrice`, `acceptedCurrency`, `updateHeight`.

---

## 5  Protocol Guidelines<a id="protocol-guidelines"></a>

### 5.1  Immediate Tasks<a id="immediate-tasks"></a>

* Client includes `stage:"full"` (or `"deposit"`).  
* **Server** validates, runs task, broadcasts rawTx if `state == completed`.  
* On failure, server discards rawTx.

### 5.2  Streaming Tasks<a id="streaming-tasks"></a>

* Client supplies first stage at stream start.  
* Server may withhold high‑value output until `stage:"final"`.  
* Each stage’s rawTx broadcast is done by server on success.

### 5.3  Interactive Sessions<a id="interactive-sessions"></a>

* One payment covers entire session.  
* Agents should limit turns or use subscription pricing to avoid abuse.

### 5.4  Long‑Running Jobs<a id="long-running-jobs"></a>

* Funds locked until completion; server risk proportional to job cost.  
* Use higher `depositPct` or split job into separate tasks if needed.

### 5.5  Subscription Services<a id="subscription-services"></a>

* Represent each billing period as its own task with a corresponding payment.  
* Renewal = new task + new payment claim.

---

## 6  Payment Verification Algorithm<a id="payment-verification-algorithm"></a>

```pseudo
validateAndBroadcast(rawTx, stage, config, currency):
    tx = decode(rawTx)
    output = findOutputTo(tx, config.address)
    requiredAnchor = stage == "deposit"
                     ? config.amount * (config.depositPct or 1)
                     : config.amount - (config.amount * (config.depositPct or 0))
    if currency != config.currency:
        rate  = fetchSpotRate(currency, config.currency, config.priceFeedUrl)
        required = requiredAnchor * rate
    else:
        required = requiredAnchor
    assert output.value >= required
    assert txid not seen
    broadcast(tx)            // server action
```

---

## 7  Implementation Guide<a id="implementation-guide"></a>

### Client
1. Discover agent → fetch AgentCard.  
2. Select `configId`, currency to pay, and build rawTx for `deposit` or `full`.  
3. Send `tasks/send` / `…/sendSubscribe` with DataPart `x-payment`.  
4. If server responds `402 / AmountInsufficient`, build rawTx for `stage:"final"` and resend.  
5. Observe on‑chain broadcast by server.

### Server
1. Inscribe AgentCard via `wallet_a2bPublish`.  
2. On request: validate stage, currency, and rawTx value.  
3. Execute job. On success broadcast rawTx, mark task `completed`, return result / stream.  
4. On failure: discard rawTx, mark `failed`.  
5. For subscription configs, enforce expiry based on interval.

---
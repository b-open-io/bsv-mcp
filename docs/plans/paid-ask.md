# Paid ask: overpowered.bot as a premium feature

Status: proposal. Nothing here is implemented yet.

## What this is

overpowered.bot (Satchmo) already exposes a remote MCP endpoint with two
tiers. Read-only tools are anonymous and rate limited; `satchmo_chat`,
`satchmo_run_skill` and `satchmo_set_mood` require a bearer token. The bearer
is a single shared secret, so it answers "is this caller allowed" but cannot
answer "has this caller paid" — every caller presents the same string.

bsv-mcp has what is missing: per-user identity from sigma-auth, a wallet, and
an approval prompt. So the split is:

- **Satchmo is the brain.** It states a price and verifies payment.
- **bsv-mcp is the wallet.** It pays the price and retries.

The touchpoint is `satchmo_chat`. It is already the tier boundary and already
the expensive call, because it runs an eve agent session.

Keeping the protocol payment-shaped rather than bsv-mcp-shaped matters: any
wallet-capable MCP client can satisfy it, and Satchmo does not take a
dependency on this project.

## Decisions taken

Per-call payment was the starting request. Two adjustments, both chosen as the
more generous option for the caller:

1. **Payment tops up a balance rather than settling each call.** Strictly
   per-call means every ask waits on a broadcast and burns fees on a call that
   is already slow because an agent is thinking. One payment buys many asks.
   Pricing is still expressed per ask.
2. **Either satoshis or MNEE is accepted.** The challenge advertises both, and
   the caller pays in whichever it holds. MNEE gives predictable pricing, sats
   avoid a token dependency.

A free allowance per identity is included, so a first-time caller can try an
ask before being asked for anything.

## The protocol

### 1. Unpaid call

Satchmo answers a `satchmo_chat` call from a caller with no balance with a
payment challenge rather than a bare 401:

```http
HTTP/1.1 402 Payment Required
Content-Type: application/json
```

```json
{
  "error": "payment_required",
  "challenge": {
    "nonce": "01J...",
    "expires_at": "2026-09-06T22:10:00Z",
    "unit": "ask",
    "prices": [
      { "currency": "BSV", "amount": 5000, "address": "1..." },
      { "currency": "MNEE", "amount": 10, "address": "1..." }
    ],
    "min_top_up_units": 10,
    "free_units_remaining": 0
  }
}
```

The `nonce` is the important part. Without a server-issued value bound into
the payment, a single receipt is replayable and buys unlimited asks.

### 2. Payment

The caller pays one of the advertised prices, including the nonce in the
transaction as an `OP_RETURN` output so the payment is bound to the challenge
and cannot be reused.

### 3. Retry

```http
POST /api/mcp
X-Payment-Receipt: <txid>
X-Payment-Nonce: <nonce>
```

Satchmo verifies the transaction pays the advertised address and amount and
carries the matching nonce, credits the balance, marks the nonce spent, and
runs the session. Verification is idempotent: replaying the same receipt
credits nothing.

### 4. Subsequent calls

While the balance is positive the call proceeds with no challenge, decrementing
per ask. The response reports the remaining balance so the caller can top up
before running out.

## Open question: cost of a long run

An ask has unbounded cost, because a long agent run burns far more than a short
one, and flat per-ask pricing eventually loses money on the tail. Three
options, in the order I would try them:

1. A hard turn or duration limit per ask, so the worst case is bounded and the
   flat price holds.
2. Metering by tokens, charging the balance proportionally.
3. A cap per session, refunding the unused remainder.

This needs a product decision before implementation, since it determines both
the price and the balance semantics.

## Work split

**Satchmo (overpowered.bot), in `src/lib/mcp-server/`:** issue and verify
challenges, keep the balance and spent-nonce records, and decrement per ask.
That directory has an owner under the repository's `AGENTS.md`, so this needs
coordinating with the remote-MCP worker rather than editing directly.

**bsv-mcp:** an `ask` tool that calls Satchmo, catches a 402, shows the caller
the price through the existing elicitation prompt, pays, and retries. It should
be behind an environment flag and default off until the Satchmo side ships,
so no wallet-spending path is live before the other end can verify it.

## Prerequisite

Sign-in against the hosted bsv-mcp server is currently broken for every MCP
client, because sigma-auth refuses unauthenticated client registration. That
blocks the identity this design keys balances on. See the note in the session
that produced this document for the one-line fix.

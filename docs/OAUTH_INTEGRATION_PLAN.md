# OAuth 2.1 Integration Plan for bsv-mcp

## Executive Summary

Integrate OAuth 2.1 authentication throughout bsv-mcp while maintaining **zero private key exposure**. User keys stay in sigma-auth iframe, tools build unsigned transactions, client requests signatures via postMessage, and server broadcasts signed transactions.

---

## Core Architectural Principles

### 1. Security Model
- **User keys NEVER leave sigma-auth iframe** (stored in localStorage at auth.sigmaidentity.com)
- **Platform signature** = OAuth client authentication (BSV_MCP_MEMBER_WIF signs token requests)
- **User signature** = Transaction/message signing (requested via Sigma iframe)
- **No key transmission** = Only signatures (X-Auth-Token, signed TXs) cross network boundaries

### 2. Sigma Iframe Signer Pattern (from allaboard-bitchat-nitro)
```
bsv-mcp Tool → Build Unsigned TX → Return to Client
                                         ↓
Client → postMessage to Sigma iframe → Show TX details
                                         ↓
User confirms → Iframe signs with local key → Return signed TX
                                         ↓
Client → Send signed TX to bsv-mcp → Broadcast to BSV network
```

### 3. Code Execution Integration (from Anthropic article)
- **98.7% context reduction** via on-demand tool loading
- **Data filtering** in execution environment (not through model context)
- **State persistence** across operations for resumable workflows
- **Privacy preservation** via automatic PII tokenization

---

## Current State Analysis

### ✅ What's Working
1. **JWT validation** with JWKS from sigma-auth (1-hour cache)
2. **OAuth discovery endpoints** (/.well-known/oauth-authorization-server)
3. **bap_getId tool** successfully uses `authInfo.metadata.bapId`
4. **Dual token storage**: Better Auth OIDC (database) + Bitcoin OAuth (KV)
5. **Multi-identity support** via userinfo endpoint

### ❌ What's Missing
1. **Auth context injection** in SSE transport (stdio works, HTTP/SSE doesn't)
2. **Transaction signing service** (/api/sign/transaction endpoint)
3. **Client-side signature request flow** (postMessage to iframe)
4. **Tool integration** (18 tools still use local keys)
5. **Error handling** for auth-required scenarios
6. **Documentation** for platform integration

---

## Phase 1: Core Authentication Infrastructure

### Task 1.1: Fix SSE Transport Auth Context Injection
**Problem:** JWT payload validated but not passed to tools in HTTP/SSE mode

**File:** `transports/sse.ts`
```typescript
// Line 127-141, modify handleMessage signature
async handleMessage(
  message: Record<string, unknown>,
  authInfo?: BSVJWTPayload  // ADD THIS PARAMETER
) {
  const parseResult = JSONRPCMessageSchema.safeParse(message);
  if (parseResult.success) {
    this.onmessage?.(parseResult.data, { authInfo });  // PASS authInfo
  }
}
```

**File:** `index.ts`
```typescript
// Line 717, pass userContext to transport
if (userContext) {
  return await transport.handlePostMessage(req, userContext);
} else {
  return await transport.handlePostMessage(req);
}
```

**Testing:** Verify bap_getId works in HTTP/SSE mode (currently only works in stdio)

---

### Task 1.2: Create Auth Helper Utilities
**New File:** `utils/auth-helpers.ts`

**Purpose:** Consistent auth context extraction across all tools

```typescript
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";

export interface AuthInfo {
  sub: string;           // User ID
  email?: string;
  pubkey?: string;       // Bitcoin public key
  bapId?: string;        // BAP identity
  bitcoinAddress?: string;
  scope?: string;
}

export function getAuthInfo(extra: RequestHandlerExtra<any, any>): AuthInfo | null {
  const authInfo = (extra as any).authInfo;
  if (!authInfo) return null;
  return authInfo.metadata || authInfo;
}

export function getBapIdFromAuth(extra: RequestHandlerExtra<any, any>): string | undefined {
  const auth = getAuthInfo(extra);
  return auth?.bapId;
}

export function getUserPubkeyFromAuth(extra: RequestHandlerExtra<any, any>): string | undefined {
  const auth = getAuthInfo(extra);
  return auth?.pubkey;
}

export function requireAuth(extra: RequestHandlerExtra<any, any>): AuthInfo {
  const auth = getAuthInfo(extra);
  if (!auth) {
    throw new Error("Authentication required. Please sign in with Bitcoin.");
  }
  return auth;
}

export function isAuthenticated(extra: RequestHandlerExtra<any, any>): boolean {
  return getAuthInfo(extra) !== null;
}
```

**Usage Example:**
```typescript
import { requireAuth, getBapIdFromAuth } from "../../utils/auth-helpers";

async (params, extra) => {
  requireAuth(extra);
  const bapId = getBapIdFromAuth(extra);
  // Use bapId for operation
}
```

---

### Task 1.3: Platform Member Key Setup
**Environment Variable:** `BSV_MCP_MEMBER_WIF`

**Purpose:** Platform's member key for OAuth client authentication (NOT for signing user transactions)

**File:** `index.ts` (add to CONFIG)
```typescript
const CONFIG = {
  // ... existing config
  memberWif: process.env.BSV_MCP_MEMBER_WIF,
  enableOAuth: process.env.ENABLE_OAUTH === "true",
  oauthIssuer: process.env.OAUTH_ISSUER || "https://auth.sigmaidentity.com",
};
```

**File:** `utils/oauth-client.ts` (NEW)
```typescript
import { getAuthToken } from "bitcoin-auth";

export function signOAuthRequest(
  requestPath: string,
  memberWif: string
): string {
  return getAuthToken({
    privateKeyWif: memberWif,
    requestPath,
  });
}

// Usage in token exchange
export async function exchangeCodeForToken(
  code: string,
  redirectUri: string,
  memberWif: string
): Promise<TokenResponse> {
  const authToken = signOAuthRequest("/api/oauth/token", memberWif);

  const response = await fetch(`${OAUTH_ISSUER}/api/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Auth-Token": authToken,  // Platform signature
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }).toString(),
  });

  return response.json();
}
```

---

## Phase 2: Transaction Signing Service

### Task 2.1: Create Signing Endpoints in sigma-auth

**New File:** `/Users/satchmo/code/sigma-auth/app/api/sign/transaction/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { query } from "@/lib/db";

export const runtime = "edge";

interface SignTransactionRequest {
  unsignedTx: string;      // Hex-encoded transaction
  inputs: Array<{
    txid: string;
    vout: number;
    satoshis: number;
    scriptPubKey: string;
  }>;
  keyType: "payment" | "identity";
  description?: string;    // Human-readable description
}

export async function POST(request: NextRequest) {
  // 1. Validate JWT access token
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const body: SignTransactionRequest = await request.json();

  // 2. Return signing request to client
  // (Client will show Sigma iframe for user to sign)
  return NextResponse.json({
    requiresSignature: true,
    signingRequest: {
      unsignedTx: body.unsignedTx,
      inputs: body.inputs,
      keyType: body.keyType,
      description: body.description,
      userId: session.user.id,
    },
  });
}
```

**New File:** `/Users/satchmo/code/sigma-auth/app/api/sign/message/route.ts`

```typescript
export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { message, encoding = "utf8" } = await request.json();

  return NextResponse.json({
    requiresSignature: true,
    signingRequest: {
      message,
      encoding,
      signatureType: "bsm",
      userId: session.user.id,
    },
  });
}
```

---

### Task 2.2: Client-Side Signing Integration

**New File:** `utils/sigma-signer-client.ts` (in bsv-mcp)

```typescript
interface SignatureRequest {
  requestId: string;
  requestPath: string;
  body?: string;
  signatureType?: "bsm" | "brc77" | "transaction";
  bodyEncoding?: "utf8" | "hex" | "base64";
  unsignedTx?: string;
  inputs?: Array<any>;
}

interface SignatureResponse {
  requestId: string;
  authToken?: string;       // For BSM/BRC77 signatures
  signedTx?: string;        // For transaction signatures
  txid?: string;
  signingPubkey?: string;
  error?: string;
}

export class SigmaSignerClient {
  private iframe: HTMLIFrameElement;
  private pendingRequests = new Map<string, {
    resolve: (value: SignatureResponse) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }>();

  constructor(iframeUrl = "https://auth.sigmaidentity.com") {
    this.iframe = document.createElement("iframe");
    this.iframe.src = iframeUrl;
    this.iframe.style.cssText = `
      position: fixed;
      top: 0; left: 0;
      width: 100%; height: 100%;
      border: none;
      z-index: 999999;
      display: none;
    `;
    document.body.appendChild(this.iframe);

    window.addEventListener("message", this.handleMessage.bind(this));
  }

  async requestTransactionSignature(
    unsignedTx: string,
    inputs: Array<any>,
    keyType: "payment" | "identity",
    description?: string
  ): Promise<SignatureResponse> {
    const requestId = crypto.randomUUID();

    const request: SignatureRequest = {
      requestId,
      requestPath: "/api/sign/transaction",
      signatureType: "transaction",
      unsignedTx,
      inputs,
      body: JSON.stringify({ keyType, description }),
    };

    return this.sendRequest(request);
  }

  async requestMessageSignature(
    message: string,
    encoding: "utf8" | "hex" | "base64" = "utf8"
  ): Promise<SignatureResponse> {
    const requestId = crypto.randomUUID();

    const request: SignatureRequest = {
      requestId,
      requestPath: "/api/sign/message",
      signatureType: "bsm",
      body: message,
      bodyEncoding: encoding,
    };

    return this.sendRequest(request);
  }

  private sendRequest(request: SignatureRequest): Promise<SignatureResponse> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(request.requestId);
        reject(new Error("Signature request timeout"));
      }, 30000); // 30 second timeout

      this.pendingRequests.set(request.requestId, { resolve, reject, timeout });

      // Show iframe for user interaction
      this.iframe.style.display = "block";

      // Send request to iframe
      this.iframe.contentWindow?.postMessage(
        { type: "SIGNATURE_REQUEST", payload: request },
        "https://auth.sigmaidentity.com"
      );
    });
  }

  private handleMessage(event: MessageEvent) {
    if (event.origin !== "https://auth.sigmaidentity.com") return;

    if (event.data.type === "SIGNATURE_RESPONSE") {
      const response: SignatureResponse = event.data.payload;
      const pending = this.pendingRequests.get(response.requestId);

      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(response.requestId);

        // Hide iframe
        this.iframe.style.display = "none";

        if (response.error) {
          pending.reject(new Error(response.error));
        } else {
          pending.resolve(response);
        }
      }
    }
  }
}
```

---

## Phase 3: Tool Integration

### Category A: BAP/Identity Tools (8 tools)

**Tools to update:**
1. `tools/bap/getCurrentAddress.ts`
2. `tools/bap/friend.ts`
3. `tools/bsocial/createPost.ts`
4. `tools/a2b/call.ts`
5. `tools/a2b/discover.ts`
6. `tools/wallet/a2bPublishMcp.ts`
7. `tools/wallet/a2bPublishAgent.ts`

**Pattern:** Use authenticated BAP ID from OAuth session

**Example:** `tools/bap/getCurrentAddress.ts`
```typescript
import { getBapIdFromAuth, requireAuth } from "../../utils/auth-helpers";

export function registerBapGetCurrentAddressTool(server: McpServer) {
  server.tool(
    "bap_getCurrentAddress",
    "Get the current address for a BAP identity",
    { args: bapGetCurrentAddressArgsSchema },
    async ({ args }, extra) => {
      // Priority 1: Use authenticated user's BAP ID
      let targetBapId = args.bapId;

      if (!targetBapId) {
        requireAuth(extra);
        targetBapId = getBapIdFromAuth(extra);
        if (!targetBapId) {
          return {
            content: [{
              type: "text",
              text: "No BAP ID found. Please create a BAP identity first."
            }],
            isError: true,
          };
        }
      }

      // Fetch current address from blockchain
      const profile = await fetchProfile(targetBapId);
      return {
        content: [{
          type: "text",
          text: `Current address: ${profile.currentAddress}`
        }],
      };
    }
  );
}
```

**Special Case:** `tools/bap/generate.ts`
- If authenticated: Associate new BAP ID with user account
- If not authenticated: Still allow generation (for onboarding)

---

### Category B: Transaction Tools (7 tools)

**Tools to update:**
1. `tools/wallet/sendToAddress.ts`
2. `tools/wallet/createOrdinals.ts`
3. `tools/wallet/sendOrdinals.ts`
4. `tools/wallet/transferOrdToken.ts`
5. `tools/wallet/mintCollection.ts`
6. `tools/wallet/purchaseListing.ts`

**Pattern:** Return unsigned TX when no local keys available

**Example:** `tools/wallet/sendToAddress.ts`
```typescript
import { isAuthenticated } from "../../utils/auth-helpers";

export function registerSendToAddressTool(
  server: McpServer,
  wallet: Wallet,
  options: { disableBroadcasting?: boolean }
) {
  server.tool(
    "wallet_sendToAddress",
    "Send BSV to a Bitcoin address",
    { args: sendToAddressSchema },
    async ({ args }, extra) => {
      const hasLocalKey = wallet.hasPrivateKey();
      const hasOAuthAuth = isAuthenticated(extra);

      // Build transaction
      const tx = await wallet.buildTransaction({
        to: args.address,
        amount: args.amount,
      });

      if (hasLocalKey) {
        // Traditional flow - sign locally and broadcast
        const signed = await wallet.sign(tx);

        if (!options.disableBroadcasting) {
          const txid = await broadcast(signed);
          return {
            content: [{
              type: "text",
              text: `Transaction broadcast: ${txid}`
            }],
          };
        } else {
          return {
            content: [{
              type: "text",
              text: `Transaction built (broadcasting disabled): ${signed.id}`
            }],
          };
        }
      } else if (hasOAuthAuth) {
        // OAuth flow - return unsigned TX for client signing
        return {
          requiresSignature: true,
          unsignedTransaction: tx.toHex(),
          signingInstructions: {
            endpoint: "/api/sign/transaction",
            keyType: "payment",
            inputs: tx.inputs.map(input => ({
              txid: input.sourceTXID,
              vout: input.sourceOutputIndex,
              satoshis: input.sourceTransaction?.outputs[input.sourceOutputIndex].satoshis,
              scriptPubKey: input.sourceTransaction?.outputs[input.sourceOutputIndex].lockingScript.toHex(),
            })),
            description: `Send ${args.amount} satoshis to ${args.address}`,
          },
        };
      } else {
        return {
          content: [{
            type: "text",
            text: "Authentication required. Please sign in with Bitcoin or configure local wallet."
          }],
          isError: true,
          errorCode: "AUTH_REQUIRED",
        };
      }
    }
  );
}
```

---

### Category C: Read-Only Tools (No Changes Needed)

**Tools that work without authentication:**
- `tools/bsv/decodeTransaction.ts`
- `tools/bsv/explore.ts`
- `tools/bsv/getPrice.ts`
- `tools/ordinals/getInscription.ts`
- `tools/ordinals/searchInscriptions.ts`
- `tools/ordinals/marketListings.ts`
- `tools/utils/convertData.ts`

**Optional Enhancement:** Show authenticated user's wallet balance/address when available

---

## Phase 4: Error Handling & UX

### Task 4.1: Standardized Auth Error Responses

**New File:** `utils/auth-errors.ts`

```typescript
export enum AuthErrorCode {
  AUTH_REQUIRED = "AUTH_REQUIRED",
  SIGNATURE_REQUIRED = "SIGNATURE_REQUIRED",
  INSUFFICIENT_PERMISSIONS = "INSUFFICIENT_PERMISSIONS",
  BAP_ID_NOT_FOUND = "BAP_ID_NOT_FOUND",
  INVALID_TOKEN = "INVALID_TOKEN",
}

export interface AuthErrorResponse {
  content: Array<{ type: "text"; text: string }>;
  isError: true;
  errorCode: AuthErrorCode;
  authUrl?: string;
  signingRequest?: any;
}

export function createAuthError(
  code: AuthErrorCode,
  message?: string,
  details?: any
): AuthErrorResponse {
  const messages = {
    AUTH_REQUIRED: "Authentication required. Please sign in with Bitcoin.",
    SIGNATURE_REQUIRED: "Transaction signature required. Please sign with your wallet.",
    INSUFFICIENT_PERMISSIONS: "Insufficient permissions. Request additional scopes.",
    BAP_ID_NOT_FOUND: "No BAP identity found. Please create a BAP ID first.",
    INVALID_TOKEN: "Invalid or expired authentication token.",
  };

  return {
    content: [{
      type: "text",
      text: message || messages[code]
    }],
    isError: true,
    errorCode: code,
    ...details,
  };
}
```

---

### Task 4.2: Transaction Confirmation Flow

**User Experience:**
1. User calls tool (e.g., "Send 0.001 BSV to address X")
2. Tool builds unsigned transaction
3. Client receives `requiresSignature` response
4. Client shows Sigma iframe with transaction details:
   - **Amount:** 0.001 BSV ($0.05 USD)
   - **Recipient:** 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa
   - **Fee:** 150 satoshis
   - **Total:** 0.00115 BSV
5. User confirms in iframe
6. Iframe signs with local key
7. Signed transaction returned to client
8. Client sends signed TX to server for broadcast
9. Server broadcasts and returns txid

**Security Features:**
- Show full transaction details before signing
- Require explicit user confirmation
- Log all signature requests with user context
- Rate limit signing endpoint

---

## Phase 5: Documentation & Testing

### Task 5.1: Documentation

**New File:** `docs/OAUTH_INTEGRATION.md`
- Complete OAuth 2.1 flow diagram
- JWT token validation process
- How to set up platform member key
- Client integration guide

**New File:** `docs/SIGNING_SERVICE.md`
- Transaction signing flow
- Sigma iframe integration
- Client-side signature requests
- Security best practices

**New File:** `docs/TOOL_INTEGRATION.md`
- How to add OAuth to existing tools
- Auth helper utilities reference
- Error handling patterns
- Testing strategies

---

### Task 5.2: Testing Strategy

**Unit Tests:**
```typescript
// Test auth helpers
describe("auth-helpers", () => {
  it("extracts BAP ID from authInfo", () => {
    const extra = { authInfo: { metadata: { bapId: "test123" } } };
    expect(getBapIdFromAuth(extra)).toBe("test123");
  });

  it("throws when auth required but not present", () => {
    const extra = {};
    expect(() => requireAuth(extra)).toThrow("Authentication required");
  });
});
```

**Integration Tests:**
```typescript
// Test OAuth flow
describe("OAuth integration", () => {
  it("validates JWT tokens", async () => {
    const token = generateTestToken();
    const payload = await jwtValidator.validate(token);
    expect(payload.sub).toBe("user123");
  });

  it("returns unsigned TX when no local key", async () => {
    const result = await callTool("wallet_sendToAddress", {
      address: "1A1z...",
      amount: 100000,
    }, { authInfo: testAuth });

    expect(result.requiresSignature).toBe(true);
    expect(result.unsignedTransaction).toBeDefined();
  });
});
```

---

## Implementation Timeline

### Week 1: Foundation (40 hours)
- **Day 1-2:** Phase 1.1 - SSE transport auth injection (8h)
- **Day 2-3:** Phase 1.2 - Auth helper utilities (8h)
- **Day 3-4:** Phase 1.3 - Platform member key setup (8h)
- **Day 4-5:** Phase 3.1 - Update BAP tools (16h)
  - Test each tool with OAuth authentication
  - Verify error handling

### Week 2: Signing Service (40 hours)
- **Day 6-7:** Phase 2.1 - Signing endpoints in sigma-auth (16h)
  - /api/sign/transaction
  - /api/sign/message
  - Testing with Postman/curl
- **Day 8-9:** Phase 2.2 - Client-side signing integration (16h)
  - SigmaSignerClient implementation
  - PostMessage protocol
  - Iframe integration
- **Day 10:** Phase 3.2 - Update sendToAddress tool (8h)
  - End-to-end signing flow test

### Week 3: Complete Integration (40 hours)
- **Day 11-13:** Phase 3.2 - Remaining transaction tools (24h)
  - Create ordinals, send ordinals, mint collection
  - Purchase listing, transfer tokens
- **Day 14:** Phase 3.3 - BSocial tools (8h)
- **Day 15:** Phase 4 - Error handling & UX (8h)

### Week 4: Polish & Documentation (40 hours)
- **Day 16-17:** Phase 5.1 - Documentation (16h)
- **Day 18-19:** Phase 5.2 - Testing (16h)
- **Day 20:** Final QA and deployment (8h)

---

## Success Criteria

### Technical
- [ ] All 18 tools support OAuth authentication
- [ ] Zero private key exposure to server
- [ ] JWT validation working in all transport modes
- [ ] Transaction signing < 5 seconds end-to-end
- [ ] Error messages guide users to auth flow

### Security
- [ ] User keys never leave sigma-auth iframe
- [ ] Platform member key only signs OAuth requests
- [ ] Transaction details shown before signing
- [ ] Rate limiting on signing endpoints
- [ ] Audit logging for signature requests

### User Experience
- [ ] Clear authentication prompts
- [ ] Transaction confirmation shows amounts/fees
- [ ] Error messages actionable
- [ ] Documentation complete
- [ ] Example client implementation

---

## Risk Mitigation

### Risk 1: Iframe Communication Failures
**Mitigation:**
- 30-second timeout on signature requests
- Retry logic for transient failures
- Fallback to manual TX signing instructions

### Risk 2: Token Expiry During Operation
**Mitigation:**
- Implement refresh token support
- Show expiry warnings before timeout
- Graceful reauthentication flow

### Risk 3: Redirect URI Port Randomization (Claude Code)
**Mitigation:**
- Support wildcard redirect URIs
- Validate by regex pattern, not exact match
- Document localhost:* pattern in OAuth client setup

### Risk 4: Code Execution Security
**Mitigation:**
- Sandbox execution environment
- Resource limits (memory, CPU, time)
- PII tokenization for sensitive data
- Audit logs for all code executions

---

## Open Questions

1. **Client SDK:** Provide JS SDK or just document protocol?
2. **Refresh tokens:** Implement now or defer to v2?
3. **Multi-key scenarios:** Allow users to select signing key?
4. **Offline mode:** Support local keys alongside OAuth? ✅ Confirmed: Yes, fallback
5. **Droplet API:** Keep for funding, OAuth for signing? ✅ Confirmed: Yes

---

This plan integrates the Anthropic code execution pattern (98.7% context reduction) with the security model from allaboard-bitchat-nitro (zero key exposure), creating a production-ready OAuth 2.1 implementation for bsv-mcp.

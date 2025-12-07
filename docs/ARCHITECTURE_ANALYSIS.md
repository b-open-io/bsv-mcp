# OAuth 2.1 Architecture Analysis for bsv-mcp

## Current Implementation Deep Dive

### JWT Validation Architecture

**Location:** `/Users/satchmo/code/bsv-mcp/utils/jwtValidator.ts` + `/Users/satchmo/code/bsv-mcp/index.ts`

**Current Implementation:**
- JWT validation using JWKS from sigma-auth issuer
- Validates signature, expiration, issuer, and audience claims
- Extracts user context from JWT payload (sub, email, pubkey, bapId)
- Integrated into HTTP/SSE transport mode in `index.ts` (lines 606-688)
- Provides user context to tools via `extra.authInfo` parameter

**What Works:**
- ✅ JWT token validation with JWKS (cached for 1 hour)
- ✅ OAuth 2.1 discovery endpoints (`/.well-known/oauth-authorization-server`, `/.well-known/oauth-protected-resource`)
- ✅ WWW-Authenticate header generation for 401 responses
- ✅ User context propagation to tools (see `bap_getId` lines 84-89)

**BSVJWTPayload Interface:**
```typescript
{
  sub: string;        // User ID
  email?: string;
  pubkey?: string;    // Bitcoin public key
  bitcoinAddress?: string;
  scope?: string;
}
```

---

### OAuth Client Registration Pattern

**Location:** `/Users/satchmo/code/sigma-auth/app/api/admin/oauth-clients/route.ts`

**Database Schema (from migration 006):**
```sql
oauth_client:
  - id TEXT (PRIMARY KEY)              // Client ID (UUID format: client_<timestamp>_<random>)
  - owner_bap_id TEXT (NOT NULL)       // BAP ID that owns this client
  - name TEXT                          // Client name
  - redirectUris TEXT[]                // Allowed redirect URIs
  - memberPubkey TEXT                  // Platform's member key pubkey for authentication
  - createdAt TIMESTAMP
  - updatedAt TIMESTAMP
```

**Critical Pattern:**
- OAuth clients authenticate using **memberPubkey** signatures (NOT client_id)
- Client ID is **generated** server-side, not provided by platform
- Platform proves identity by signing requests with `SIGMA_MEMBER_WIF`

---

### Platform Signature Pattern from allaboard-bitchat-nitro

**Client-Side Architecture:**
**Location:** `/Users/satchmo/code/allaboard-bitchat-nitro/src/lib/sigma-iframe-signer.ts`

**How It Works:**
1. **User keys stay client-side** - Stored in `auth.sigmaidentity.com` localStorage via iframe
2. **Embedded Sigma iframe** - Full-screen, transparent, hidden until needed for signing
3. **PostMessage API** - Parent app requests signatures via `postMessage()`
4. **BRC77 Signatures** - Used for API authentication (not BSM)

**Request Flow:**
```typescript
// Client-side (bitchat)
const authToken = await requestSigmaSignature(
  requestPath: "/api/channels",
  body: JSON.stringify(data),
  signatureType: 'brc77'
);
headers['X-Auth-Token'] = authToken;
```

**Signature Request/Response:**
```typescript
interface SignatureRequest {
  requestId: string;
  requestPath: string;
  body?: string;
  signatureType?: 'bsm' | 'brc77';
  bodyEncoding?: 'utf8' | 'hex' | 'base64';
}

interface SignatureResponse {
  requestId: string;
  authToken: string;        // Complete BRC77 token ready for X-Auth-Token header
  signingPubkey?: string;   // User's pubkey (for registration)
  error?: string;
}
```

**Key Implementation Details:**
- Iframe shows modal only when wallet is locked (line 183-190)
- 30-second timeout for signature requests (line 124)
- Wallet lock/unlock events handled automatically (lines 182-203)
- User never sees "import wallet" - keys already in sigma auth storage

---

### Backend OAuth Token Exchange

**Location:** `/Users/satchmo/code/allaboard-bitchat-nitro/src/lib/auth.ts` (lines 73-95)

**Platform Member Key Usage:**
```typescript
// Backend proxy endpoint signs token request
POST /oauth/exchange
Body: { code, redirectUri }

// Backend adds X-Auth-Token header using BITCHAT_MEMBER_WIF
// Sigma validates memberPubkey matches registered oauth_client
```

**Token Exchange Flow (sigma-auth):**
**Location:** `/Users/satchmo/code/sigma-auth/app/api/oauth/token/route.ts`

1. Extract `X-Auth-Token` from request header (line 49)
2. Parse pubkey from auth token (line 60-68)
3. Verify signature using `bitcoin-auth` (line 78)
4. Lookup OAuth client by `memberPubkey` (line 93-96)
5. Validate authorization code and issue access token

**Critical Code (lines 93-126):**
```typescript
const clientResult = await query<OauthClient>(
  'SELECT * FROM "oauth_client" WHERE "memberPubkey" = $1',
  [pubkey]
);

if (clientResult.rows.length === 0) {
  // No OAuth client found with this member key
  return error;
}

client = clientResult.rows[0];
oauthLogger.info({
  clientId: client.id,
  clientName: client.name,
  ownerBapId: client.owner_bap_id,
  memberPubkey: pubkey.substring(0, 20) + "...",
}, "Client authenticated via member key signature");
```

---

### OAuth Userinfo Endpoint

**Location:** `/Users/satchmo/code/sigma-auth/app/api/oauth/userinfo/route.ts`

**Dual Token Support:**
1. **Better Auth OIDC tokens** (database) - Lines 79-131
2. **Bitcoin OAuth tokens** (KV) - Lines 144-181

**Response Structure (lines 320-494):**
```typescript
{
  sub: string;                  // User ID
  pubkey: string;               // From TOKEN (correct identity)
  bitcoin_address: string;      // Derived from pubkey
  bap_id?: string;              // User's BAP ID (optional)
  email?: string;
  name?: string;
  picture?: string;

  // Extended BAP profile (if available)
  bap_profile?: {
    rootAddress, currentAddress, identity: {...}
  },

  // Connected wallets
  wallet_address?: string;
  wallet_addresses?: Array<{...}>,

  // Metadata
  scope: string;
  updated_at: number;
}
```

**Key Insight:** `pubkey` comes from TOKEN storage, NOT database - ensures correct identity for multi-identity users.

---

## Tools Requiring OAuth Integration

### Category A: Identity/Signing Tools (8 tools)
These tools need user's identity key for BAP operations:

1. **`tools/bap/generate.ts`** - Generate BAP identity (creates new identityPk)
2. **`tools/bap/friend.ts`** - Add/manage BAP friends
3. **`tools/bap/getCurrentAddress.ts`** - Get current BAP address
4. **`tools/bsocial/createPost.ts`** - Create social media posts (requires BAP signature)
5. **`tools/a2b/call.ts`** - Agent-to-blockchain calls (A2B protocol)
6. **`tools/a2b/discover.ts`** - Discover A2B services
7. **`tools/wallet/a2bPublishMcp.ts`** - Publish MCP server to blockchain
8. **`tools/wallet/a2bPublishAgent.ts`** - Publish agent to blockchain

**Current Pattern (bap_getId, line 84-89):**
```typescript
const authInfo = (extra as any).authInfo;
if (authInfo?.metadata?.bapId) {
  targetIdKey = authInfo.metadata.bapId;
  console.log(`Using authenticated user's BAP ID: ${targetIdKey}`);
}
```

---

### Category B: Transaction Tools (7 tools)
These tools need payment key for transaction signing:

1. **`tools/wallet/sendToAddress.ts`** - Send BSV to address
2. **`tools/wallet/createOrdinals.ts`** - Create NFT inscriptions
3. **`tools/wallet/sendOrdinals.ts`** - Transfer NFTs
4. **`tools/wallet/transferOrdToken.ts`** - Transfer fungible tokens
5. **`tools/wallet/mintCollection.ts`** - Mint NFT collections
6. **`tools/wallet/purchaseListing.ts`** - Purchase marketplace listings
7. **`tools/wallet/refreshUtxos.ts`** - Refresh UTXO set

---

### Category C: Read-Only Tools (No Keys Required)
These work fine without authentication:

1. **`tools/bsv/decodeTransaction.ts`** - Decode transactions
2. **`tools/wallet/getBalance.ts`** - Get wallet balance (if using authInfo)
3. **`tools/wallet/getAddress.ts`** - Get wallet address
4. **`tools/wallet/getPublicKey.ts`** - Get public key
5. **`tools/ordinals/*`** - NFT marketplace queries

---

## Transaction Signing Architecture Comparison

### Option 1: Local Wallet (Current Default)
**Location:** `/Users/satchmo/code/bsv-mcp/tools/wallet/wallet.ts`

- Private keys stored in `~/.bsv-mcp/keys.bep` (encrypted)
- Full transaction building and signing locally
- Broadcasting to BSV network directly

**Pros:** Complete control, works offline
**Cons:** Users must manage keys, security burden

---

### Option 2: Droplet API (Faucet Service)
**Location:** `/Users/satchmo/code/bsv-mcp/tools/wallet/integratedWallet.ts`

- No local keys required
- Backend faucet funds and broadcasts transactions
- Limited to faucet's fixed amounts

**Pros:** No key management, easy onboarding
**Cons:** Limited functionality, requires running faucet service

---

### Option 3: Sigma Iframe Signer (Recommended for OAuth)
**Pattern:** allaboard-bitchat-nitro implementation

**Architecture:**
```
User Browser (Client App)
  └─> bsv-mcp tool (via MCP)
      └─> Transaction built server-side (unsigned)
          └─> Returned to client for signing
              └─> Client requests signature via Sigma iframe
                  └─> Signed transaction returned
                      └─> Broadcast by server OR client
```

**Implementation Flow:**
1. **Tool builds transaction** (server-side, no private keys)
2. **Return unsigned TX** to client with metadata
3. **Client requests signature** from Sigma iframe
4. **Sigma iframe returns signed TX** via postMessage
5. **Client sends signed TX** back to server for broadcast

---

## Architecture Gaps & Missing Pieces

### Gap 1: Transport Layer Auth Context Injection
**Issue:** SSE transport doesn't inject JWT payload into tool `extra` parameter

**Current (index.ts lines 629-660):**
```typescript
let userContext: BSVJWTPayload | null = null;
if (CONFIG.enableOAuth && jwtValidator) {
  userContext = await jwtValidator.validateFromRequest(req);
}
```

**Missing:** User context not passed to tools via transport

**Solution Needed:**
```typescript
// In transports/sse.ts, modify handleMessage (line 127-141)
async handleMessage(message: Record<string, unknown>, authInfo?: unknown) {
  const parseResult = JSONRPCMessageSchema.safeParse(message);
  if (parseResult.success) {
    this.onmessage?.(parseResult.data, { authInfo });  // Pass through
  }
}

// In index.ts, modify transport setup (line 717)
return await transport.handlePostMessage(req, userContext);
```

---

### Gap 2: Transaction Signing Flow
**Issue:** No standardized way for tools to request user signatures

**Current:** Tools either:
- Use local private keys (security issue for hosted)
- Use Droplet API (limited functionality)
- Fail with "no private key" error

**Needed:** Standardized signing service

**Proposed Architecture:**
```typescript
// In tool implementation
if (requiresSignature && !hasLocalKey) {
  return {
    requiresSignature: true,
    unsignedTransaction: tx.toHex(),
    signingInstructions: {
      endpoint: "/api/sign/transaction",
      keyType: "payment",
      inputs: [...]
    }
  };
}
```

**Client-side handler:**
```typescript
// MCP client SDK
if (result.requiresSignature) {
  const signed = await requestSigmaSignature(
    result.signingInstructions.endpoint,
    result.unsignedTransaction
  );
  // Re-call tool with signedTransaction
}
```

---

### Gap 3: Multi-Identity Support
**Issue:** User might have multiple BAP IDs, tool should use OAuth session's selected identity

**From userinfo endpoint:** Already returns correct `bap_id` from token
**From bap_getId:** Already prioritizes `authInfo.metadata.bapId`

**Status:** ✅ **Already solved** in current implementation

---

### Gap 4: Wallet Address Resolution
**Issue:** User's receiving address for tokens/NFTs may differ from signing address

**From userinfo (lines 337-384):**
```typescript
// Fetch connected wallet addresses for this BAP ID
const walletResult = await query(
  `SELECT wallet_address, provider, is_primary
   FROM wallet_connections WHERE bap_id = $1`
);
userInfo.wallet_address = primaryWallet.wallet_address;
userInfo.wallet_addresses = [...];
```

**Status:** ✅ **Already provided** in userinfo response

---

### Gap 5: Error Handling for Missing Auth
**Current:** Tools fail silently or use fallback keys

**Needed:** Standardized error responses

**Proposed:**
```typescript
if (!authInfo && requiresAuth) {
  return {
    content: [{
      type: "text",
      text: "Authentication required. Please sign in with Bitcoin."
    }],
    isError: true,
    errorCode: "AUTH_REQUIRED",
    authUrl: `${OAUTH_ISSUER}/api/oauth/authorize?...`
  };
}
```

---

## OAuth Client ID Architecture

### Current Implementation

**From oauth-clients/route.ts (line 141):**
```typescript
const clientId = `client_${Date.now()}_${Math.random().toString(36).substring(7)}`;
```

**From token/route.ts (lines 48-58):**
```typescript
// Extract client_id from auth token signature
const authToken = request.headers.get("x-auth-token");
if (!authToken) {
  return error("Missing X-Auth-Token header");
}

const parsed = parseAuthToken(authToken);
const pubkey = parsed.pubkey;  // THIS identifies the client
```

### How It Actually Works

**Sigma-auth uses memberPubkey as client identifier:**
```sql
SELECT * FROM oauth_client WHERE memberPubkey = $1
```

**Authorization flow (no client_id parameter):**
- User clicks "Sign in with Bitcoin" on platform
- Redirected to sigma-auth with `redirect_uri` (no client_id)
- Sigma-auth matches client by redirect_uri validation
- Token exchange uses signature to identify client

### Recommendation

**Keep current pattern because:**
1. **Bitcoin-native authentication** - No client_id needed, pubkey IS the identity
2. **Simpler for platforms** - No client secret management
3. **Already working** - oauth/token endpoint validates this way

**For MCP 2025 spec compliance:**
- OAuth discovery endpoints include `client_id` (optional per RFC 8414)
- Platforms can ignore client_id in authorization URL
- Token endpoint accepts X-Auth-Token instead of client_id + secret

---

## Code Execution Pattern (from Anthropic)

### Key Benefits

**Context Efficiency:** Reduces token consumption from 150,000 to 2,000 tokens—"a time and cost saving of 98.7%"

**Data Processing:** "Agents can filter and transform results in code before returning them" without passing unnecessary data through the model's context window

**State Management:** Agents can persist code as reusable functions and maintain state across operations through filesystem access

### Security Considerations

**Execution Environment:** "Running agent-generated code requires a secure execution environment with appropriate sandboxing, resource limits, and monitoring"

**Privacy:** Implementation includes privacy-preserving mechanisms where intermediate results remain in the execution environment by default

**PII Protection:** System can tokenize personally identifiable information automatically, preventing sensitive data from flowing through the model

---

## Security Analysis

### ✅ Strengths of Current Design

1. **Zero Private Key Exposure** - Keys never leave sigma-auth iframe
2. **Bitcoin-Native Auth** - Uses cryptographic signatures, not passwords
3. **JWT Token Validation** - Proper JWKS validation with caching
4. **Signature Verification** - Member key signatures validated server-side
5. **Multi-Identity Support** - Users can have multiple BAP IDs per account

### ⚠️ Security Recommendations

1. **Rate Limiting** - Add rate limits to signing endpoints
2. **Transaction Validation** - Validate transaction structure before signing
3. **User Confirmation** - Show transaction details in Sigma iframe before signing
4. **Audit Logging** - Log all signature requests with user context
5. **Token Expiry** - Current 1-hour expiry is good, consider refresh tokens

---

## Summary

### What's Working
✅ OAuth 2.1 JWT validation with JWKS
✅ User context propagation to tools (`bap_getId`)
✅ Multi-identity support via userinfo endpoint
✅ Bitcoin-native client authentication (memberPubkey)
✅ Dual token storage (Better Auth + Bitcoin OAuth)

### What's Missing
❌ Auth context injection in SSE transport
❌ Standardized transaction signing service
❌ Client-side signature request flow
❌ Error handling for auth-required scenarios
❌ Documentation for platform integration

### Recommended Architecture
**Use Sigma Iframe Signer Pattern from allaboard-bitchat-nitro**

1. User keys stay in sigma-auth iframe (never exposed)
2. Tools build unsigned transactions server-side
3. Client requests signatures via postMessage
4. Signed transactions broadcast by server

This maintains the security of the current OAuth flow while enabling transaction signing without exposing private keys.

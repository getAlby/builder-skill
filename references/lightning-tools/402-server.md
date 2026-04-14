# HTTP 402 — Server Side (Exposing an L402 Endpoint)

## Overview

To protect an HTTP resource with L402, the server must:

1. Generate a Lightning invoice via an NWC wallet
2. Issue a macaroon (token) tied to the invoice's payment hash
3. Return a `402` response with the `WWW-Authenticate: L402 token="...", invoice="..."` header
4. On the next request, verify the `Authorization: L402 <token>:<preimage>` header by checking that `sha256(preimage) == paymentHash` embedded in the macaroon

All of these helpers are exported from `@getalby/lightning-tools`.

## Key functions

```typescript
import {
  issueL402Macaroon,
  makeL402AuthenticateHeader,
  parseL402Authorization,
  verifyL402Macaroon,
  validatePreimage,
} from "@getalby/lightning-tools";
```

### issueL402Macaroon

Creates a signed token (macaroon) embedding the payment hash and any custom payload.

```typescript
const macaroon = await issueL402Macaroon<{ url: string }>(
  MACAROON_SECRET,   // 32-byte hex secret — keep this on the server
  paymentHash,       // from the invoice created by your NWC wallet
  { url: "https://example.com/" }  // arbitrary payload stored in the token
);
```

### makeL402AuthenticateHeader

Builds the `WWW-Authenticate` header value to include in the 402 response.

```typescript
const wwwAuthHeader = await makeL402AuthenticateHeader({
  token: macaroon,
  invoice: tx.invoice,  // BOLT-11 payment request string
});
// → 'L402 version="0" token="...", invoice="lnbc..."'
```

### parseL402Authorization

Splits the client's `Authorization: L402 <token>:<preimage>` header.

```typescript
const parsed = parseL402Authorization(request.headers["authorization"]);
// → { token: string, preimage: string } | null
```

### verifyL402Macaroon

Verifies the HMAC signature on the token and returns the embedded payload.

```typescript
const payload = await verifyL402Macaroon<{ url: string }>(
  MACAROON_SECRET,
  token
);
// → { url: string, paymentHash: string } | null  (null = invalid/tampered)
```

### validatePreimage

Checks that `sha256(preimage) === paymentHash`.

```typescript
const valid = validatePreimage(preimage, payload.paymentHash);
```

## Minimal Fastify example

```typescript
import Fastify from "fastify";
import cors from "@fastify/cors";
import { NWCClient } from "@getalby/sdk/nwc";
import { randomBytes } from "node:crypto";
import {
  issueL402Macaroon,
  makeL402AuthenticateHeader,
  parseL402Authorization,
  verifyL402Macaroon,
  validatePreimage,
} from "@getalby/lightning-tools";

// Make sure to set a macaroon secret to persist across startups
const MACAROON_SECRET = process.env.MACAROON_SECRET || randomBytes(32).toString("hex");
const app = Fastify();

// IMPORTANT: expose WWW-Authenticate so browser clients can read it (see CORS note below)
await app.register(cors, { origin: true, exposedHeaders: ["WWW-Authenticate"] });

app.get("/protected", async (request, reply) => {
  const authHeader = request.headers["authorization"];

  if (authHeader?.startsWith("L402")) {
    const parsed = parseL402Authorization(authHeader);
    if (!parsed) return reply.status(400).send({ error: "Malformed Authorization" });

    const payload = await verifyL402Macaroon<{ resource: string }>(MACAROON_SECRET, parsed.token);
    if (!payload) return reply.status(401).send({ error: "Invalid or expired token" });

    if (!validatePreimage(parsed.preimage, payload.paymentHash))
      return reply.status(401).send({ error: "Invalid preimage" });

    return reply.send({ data: "Protected content", resource: payload.resource });
  }

  // Issue 402 challenge
  const client = new NWCClient({ nostrWalletConnectUrl: process.env.NWC_URL! });
  try {
    const tx = await client.makeInvoice({ amount: 1000, description: "Access fee" }); // millisats
    const macaroon = await issueL402Macaroon(MACAROON_SECRET, tx.payment_hash, { resource: "demo" });
    const wwwAuth = await makeL402AuthenticateHeader({ token: macaroon, invoice: tx.invoice });

    return reply.status(402).header("WWW-Authenticate", wwwAuth).send({ error: "Payment required" });
  } finally {
    client.close();
  }
});
```

## CORS warning — browser clients

Browsers enforce CORS and will **not** expose `WWW-Authenticate` to JavaScript unless the server explicitly includes it in `Access-Control-Expose-Headers`. Without this, `fetch402` running in the browser will see `null` for the header, silently skip the payment flow, and return the raw 402 response body (`{"error":"Payment required"}`) as if it were the resource.

**Always set `exposedHeaders: ["WWW-Authenticate"]` (or the equivalent `Access-Control-Expose-Headers: WWW-Authenticate` response header) on your 402 responses when your server is called from a browser.**

With `@fastify/cors`:

```typescript
await app.register(cors, {
  origin: true,
  exposedHeaders: ["WWW-Authenticate"],  // required for browser fetch402 to work
});
```

With plain Node/Express:

```typescript
res.setHeader("Access-Control-Expose-Headers", "WWW-Authenticate");
```

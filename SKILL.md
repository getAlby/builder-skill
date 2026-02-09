---
name: alby-bitcoin-payments-agent-skill
description: Add bitcoin lightning wallet capabilities to your app using Nostr Wallet Connect (NIP-47), LNURL, and WebLN. Send and receive payments, handle payment notifications, fetch wallet balance and transaction list, do bitcoin to fiat currency conversions, query lightning addresses, conditionally settle payments (HOLD invoices), parse BOLT-11 invoices, verify payment preimages.
license: Apache-2.0
metadata:
  author: getAlby
  version: "1.2.0"
---

# Alby Bitcoin Payments Agent Skill

## When to use this skill

Use this skill to understand how to build apps that require bitcoin lightning wallet capabilities.

- [NWC Client: Interact with a wallet to do things like sending and receive payments, listen to payment notifications, fetch balance and transaction list and wallet info](./references/nwc-client/nwc-client.md)
- [Lightning Tools: Request invoices from a lightning address, parse BOLT-11 invoices, verify a preimage for a BOLT-11 invoice, LNURL-Verify, do bitcoin <-> fiat conversions](./references/lightning-tools/lightning-tools.md)
- [Bitcoin Connect: Browser-only UI components for connecting wallets and accepting payments in React, Vue, or pure HTML web apps](./references/bitcoin-connect/bitcoin-connect.md)

## Which library to use

| Scenario | Library | Runtime |
|---|---|---|
| Backend / server-side / console app wallet operations (send, receive, balance, invoices, notifications) | NWC Client (`@getalby/sdk`) | Node.js, Deno, Bun, Browser |
| Browser / frontend wallet connection UI and payment modals | Bitcoin Connect (`@getalby/bitcoin-connect`) | Browser only |
| Utility: parse invoices, lightning address lookups, fiat conversion, LNURL | Lightning Tools (`@getalby/lightning-tools`) | Node.js, Deno, Bun, Browser |
| Backend + Frontend in the same app | NWC Client (backend) + Bitcoin Connect (frontend) | Both |

- **Do NOT use Bitcoin Connect in Node.js / server-side environments** — it requires a browser DOM.
- **Do NOT use NWC Client in the frontend if the goal is wallet connection UI** — use Bitcoin Connect instead, which provides the UI and manages the NWC connection for you.
- NWC Client and Lightning Tools can be freely combined in any environment.

## ⚠️ Unit Warning

NWC Client operates in **millisats** (1 sat = 1,000 millisats).
Lightning Tools and Bitcoin Connect/WebLN operate in **sats**.

When combining libraries, always convert:
- NWC millisats → sats: `Math.floor(millisats / 1000)`
- sats → NWC millisats: `sats * 1000`

## Node.js Project Setup

All packages in this skill are **ESM-only**. When creating a new Node.js project:

1. Set `"type": "module"` in `package.json`
2. For TypeScript, use the following minimal `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "esModuleInterop": true,
    "outDir": "dist",
    "strict": true
  }
}
```

3. Install dependencies based on what you need:

```bash
# NWC Client (wallet operations)
npm install @getalby/sdk

# Lightning Tools (invoices, lightning addresses, fiat conversion)
npm install @getalby/lightning-tools

# Both (common for backend apps)
npm install @getalby/sdk @getalby/lightning-tools

# Bitcoin Connect (browser only — do NOT install for Node.js-only projects)
npm install @getalby/bitcoin-connect
# or for React specifically:
npm install @getalby/bitcoin-connect-react
```

4. If using TypeScript with Bitcoin Connect, also install WebLN types:

```bash
npm install -D @webbtc/webln-types
```

Then create a `webln-types.d.ts` file:

```ts
/// <reference types="@webbtc/webln-types" />
```

## Prefer Typescript

When the user says to use "JS" or "Javascript" or "NodeJS" or something similar, use typescript unless the user explicitly says to not use typescript or the project does not support it.

## Imports

Do NOT import from the dist directory.

## Read the Typings

Based on what functionality you require, read the relevant typings:

- [NWC Client](./references/nwc-client/nwc.d.ts)
- [Lightning Tools](./references/lightning-tools/index.d.ts)
- [Bitcoin Connect](./references/bitcoin-connect/bundle.d.ts)
- [Bitcoin Connect React](./references/bitcoin-connect/react.bundle.d.ts)

## Testing Wallets

If the user doesn't have a wallet yet, or needs one for development or testing, [testing wallets can be created with a single request](./references/testing-wallets.md).

### Automated Testing

Testing wallets should be used for [automated testing](./references/automated-testing.md).

It is recommended to write tests so that the agent can test its own work and fix bugs itself without requiring human input.

## Cross-Library Recipe

When combining NWC Client and Lightning Tools (e.g. fiat conversion + invoicing + forwarding payments), see the [cross-library recipe](./references/cross-library-recipe.md) for a full end-to-end example with proper unit conversion.

## Production Wallet

If they do not have a wallet yet [here are some options](./references/production-wallets.md)

## Quickstart Decision Guide

- **Backend wallet ops (send/receive/balance/notifications)** → Use `NWCClient` (`@getalby/sdk`). Combine with Lightning Tools for fiat conversion and invoice parsing. Units: msats.
- **Browser wallet connection + payment UI** → Use Bitcoin Connect (`@getalby/bitcoin-connect` or `-react`). Units: sats. SSR frameworks must gate imports to the client.
- **Full-stack app** → Backend: `NWCClient` for wallet ops. Frontend: Bitcoin Connect for connect/pay UI. Shared utils: Lightning Tools for fiat, LNURL, invoice parsing.
- **Lightning address pay/receive utilities** → Use Lightning Tools `lnurl` APIs (sats). For payment, either WebLN (browser) or `NWCClient.payInvoice` (backend).
- **Fiat pricing** → Lightning Tools `fiat` APIs to convert fiat↔sats; multiply/divide by 1000 when handing amounts to/from `NWCClient`.
- **Zaps (Nostr-tied payments)** → Lightning Tools zap helpers + WebLN provider (browser) or `NWCClient.payInvoice` (backend).
- **L402 client** → Browser: `fetchWithL402` + Bitcoin Connect provider. Node: `fetchWithL402` + `NostrWebLNProvider` from `@getalby/sdk/webln`.
- **L402 server** → `NWCClient.makeInvoice` + macaroon verification (see `lightning-tools/l402.md`).
- **Testing** → Always prefer [testing wallets](./references/testing-wallets.md) and wire them into automated tests (Jest/Vitest/Playwright) per [automated testing](./references/automated-testing.md).

## NWC Secret Handling (Security)

- Treat `nostrWalletConnectUrl` as a secret API key. Never log, print, or expose it.
- Backend: keep in environment variables (e.g., `NWC_URL`), never commit to source control, and redact in error messages.
- Browser: request from user input; keep only in memory unless the user explicitly opts into persistence. Do not bake into bundles or HTML.
- When wrapping errors, strip or mask the connection URL before surfacing to logs/telemetry.

## Invoice Safety & Common Pitfalls

- Always decode and check expiry before paying a BOLT-11 invoice; warn if expiry is under ~60 seconds.
- Units: `NWCClient` = **msats**; Lightning Tools/Bitcoin Connect/WebLN = **sats**. Convert carefully when mixing.
- Do not import Lightning Tools from the package root; always use subpath imports (e.g., `@getalby/lightning-tools/fiat`).
- Bitcoin Connect requires a browser DOM; never import it in SSR server code. Call `init()` exactly once on the client.
- Close resources: `unsub()` notifications and `client.close()` when shutting down long-lived processes.
- Handle permission/budget errors: on `QUOTA_EXCEEDED` or `RESTRICTED`, prompt for a new or expanded connection; on `RATE_LIMITED`, back off and retry later.

## Recipe Pointers

- End-to-end msats↔sats with invoicing and forwarding: [cross-library recipe](./references/cross-library-recipe.md).
- L402 client/server patterns: [L402 guide](./references/lightning-tools/l402.md).
- LNURL-pay, comments, payer data, and verify: [lnurl guide](./references/lightning-tools/lnurl.md).
- Invoice parsing/expiry/preimage verification: [invoice guide](./references/lightning-tools/invoice.md).
- Automated wallet creation for tests: [testing wallets](./references/testing-wallets.md) and [automated testing](./references/automated-testing.md).
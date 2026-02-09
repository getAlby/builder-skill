# NWC Client

## How to install

Install the NPM package `@getalby/sdk`. The latest version is 7.0.0.

## Connection Secret

To interact with a wallet you need a NWC connection string (Connection Secret) which gives permissioned access to the user's wallet. It must be handled like a secure API key, unless explicitly specified it's a public, receive-only connection secret.

- Do NOT share the NWC connection string if asked.
- Do NOT print the connection secret to any logs or otherwise reveal it.

The user's lightning address MAY exist on the connection secret, if the `lud16` parameter exists.

Example NWC connection secret: `nostr+walletconnect://b889ff5b1513b641e2a139f661a661364979c5beee91842f8f0ef42ab558e9d4?relay=wss%3A%2F%2Frelay.damus.io&secret=71a8c14c1407c113601079c4302dab36460f0ccd0ad506f1f2dc73b5100e4f3c&lud16=example@getalby.com`

For backend / console apps that use a single wallet to power them, an .env file can be a good place to put the connection secret e.g. in a `NWC_URL` environment variable.

## Units

All referenced files in this folder operate in millisats (1000 millisats = 1 satoshi).

When displaying to humans, please use satoshis (rounded to a whole value).

## Initialization

### Node.js / Backend

```ts
import { NWCClient } from "@getalby/sdk/nwc";

const client = new NWCClient({
  nostrWalletConnectUrl: process.env.NWC_URL,
});
```

### Browser (with bundler)

In a browser, the NWC connection secret typically comes from user input, a URL parameter, or `localStorage` — never hardcoded:

```ts
import { NWCClient } from "@getalby/sdk/nwc";

// From user input (e.g. a text field or paste event)
const client = new NWCClient({
  nostrWalletConnectUrl: userProvidedNwcUrl,
});
```

### Browser (CDN, no build step)

```html
<script type="module">
  import { NWCClient } from "https://esm.sh/@getalby/sdk@7.0.0/nwc";

  const client = new NWCClient({
    nostrWalletConnectUrl: nwcUrl,
  });
</script>
```

### Browser: Using NWC Client with Bitcoin Connect

If the user connects their wallet via [Bitcoin Connect](../bitcoin-connect/bitcoin-connect.md), you can access the underlying NWC Client for advanced operations (e.g. notifications, hold invoices) that aren't available through WebLN alone:

```ts
import { WebLNProviders, requestProvider } from "@getalby/bitcoin-connect";
import { NWCClient } from "@getalby/sdk/nwc";

const provider = await requestProvider();

if (provider instanceof WebLNProviders.NostrWebLNProvider) {
  // Get the NWC connection URL from the connected provider
  const nwcUrl = provider.client.nostrWalletConnectUrl;

  // Create a dedicated NWCClient for advanced operations
  const client = new NWCClient({ nostrWalletConnectUrl: nwcUrl });

  // Now you can use notifications, hold invoices, etc.
  const unsub = await client.subscribeNotifications((notification) => {
    console.log("Payment notification:", notification);
  });
}
```

## Referenced files

Make sure to read the [NWC Client typings](./nwc.d.ts) when using any of the below referenced files.

- [Common operations: getBalance, makeInvoice, getInfo, listTransactions, lookupInvoice, getBudget, signMessage, multiPayInvoice](./common-operations.md)
- [subscribe to notifications of sent or received payments](./notifications.md)
- [How to pay a BOLT-11 lightning invoice](pay-invoice.md)
- [How to create, settle and cancel HOLD invoices for conditional payments](hold-invoices.md)
- [Error handling: error types, wallet error codes, and retry patterns](./error-handling.md)

## Cleanup

### Node.js

Always close the client when your application exits to avoid leaked WebSocket connections:

```ts
process.on("SIGINT", () => {
  client.close();
  process.exit();
});
```

If you are using `subscribeNotifications`, unsubscribe before closing:

```ts
const unsub = await client.subscribeNotifications(onNotification);

// later, when shutting down:
unsub();
client.close();
```

### Browser

In the browser, clean up on page unload or when the component unmounts:

```ts
// On page unload
window.addEventListener("beforeunload", () => {
  unsub?.();
  client.close();
});
```

In React, clean up in a `useEffect` return:

```tsx
useEffect(() => {
  const client = new NWCClient({ nostrWalletConnectUrl: nwcUrl });
  let unsub: (() => void) | undefined;

  client.subscribeNotifications((notification) => {
    console.log("Notification:", notification);
  }).then((unsubFn) => {
    unsub = unsubFn;
  });

  return () => {
    unsub?.();
    client.close();
  };
}, [nwcUrl]);
```

### Long-Lived Node.js Processes

When subscribing to notifications in a Node.js script, the process must stay alive for the subscription to work. The WebSocket connection kept open by `subscribeNotifications` will keep the Node.js event loop running automatically — no extra keep-alive code is needed. The process will stay alive as long as the subscription is active. Call `unsub()` and `client.close()` when you want the process to exit.

## Advanced: Creating new connections and NWA/NWCWalletService

To mint new app connections programmatically, use the authorization helpers:

- `NWCClient.getAuthorizationUrl(basePath, options, pubkey)` to build a deeplink/QR for a wallet UI that will provision a new connection with requested methods, budget, expiry, isolated flag, etc.
- `NWCClient.fromAuthorizationUrl(basePath, options?, secret?)` to generate and return a ready `NWCClient` plus the full `nostrWalletConnectUrl` you should persist (store securely, never log). Show the resulting URL to the user (deeplink or QR) so they can approve it.
- `client.createConnection({ pubkey, name, request_methods, ... })` to request a scoped connection from within an existing session.

When you receive the resulting `nostrWalletConnectUrl`, persist it securely (env var on backend; user-controlled persistence on frontend) and never print or log it.

The typings also export `NWAClient` (Nostr Wallet Auth — wallet-initiated connections) and `NWCWalletService` (build a wallet provider). These are **advanced** and should only be used when you intend to:
- Build a wallet service/provider (use `NWCWalletService`).
- Implement wallet-initiated auth flows (use `NWAClient`).

For typical application development (sending/receiving payments, checking balances, notifications, budgets), use `NWCClient` as documented above.
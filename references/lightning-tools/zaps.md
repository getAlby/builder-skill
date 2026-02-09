# Nostr Zaps

IMPORTANT: read the [typings](./index.d.ts) to better understand how this works.

Nostr Zaps are lightning payments tied to Nostr events or profiles, defined by [NIP-57](https://github.com/nostr-protocol/nips/blob/master/57.md). They allow users to send sats to a Nostr user's lightning address with a signed Nostr event that proves who sent the zap and (optionally) which note was zapped.

## Prerequisites

- The recipient must have a lightning address that supports Nostr zaps (`allowsNostr: true` — see [metadata introspection](./lnurl.md#metadata-introspection))
- The sender needs a **Nostr provider** that can sign events (e.g. a NIP-07 browser extension like Alby or nos2x, or a custom signer with a private key)

## Generate a Zap Invoice (Without Paying)

Use `zapInvoice()` to get a BOLT-11 invoice that includes the zap event. You can then pay this invoice yourself (e.g. via NWC Client) or display it as a QR code:

```ts
import { LightningAddress } from "@getalby/lightning-tools/lnurl";

const ln = new LightningAddress("hello@getalby.com");
await ln.fetch();

// Verify the recipient supports zaps
if (!ln.lnurlpData?.allowsNostr) {
  throw new Error("This lightning address does not support Nostr zaps.");
}

// nostrProvider must implement: getPublicKey() and signEvent()
// In a browser, this is typically window.nostr (NIP-07 extension)
const nostrProvider = window.nostr;

const invoice = await ln.zapInvoice(
  {
    satoshi: 1000,
    comment: "Great post! ⚡",
    relays: ["wss://relay.damus.io", "wss://relay.nostr.band"],
    // e: noteId,  // optional: the Nostr event ID being zapped
  },
  { nostr: nostrProvider }
);

console.log("Zap invoice:", invoice.paymentRequest);
// Pay this invoice via NWC Client, QR code, or any other method
```

### Pay the Zap Invoice with NWC Client

Since NWC Client uses millisats, no conversion is needed for `payInvoice` — it takes the BOLT-11 string directly:

```ts
import { NWCClient } from "@getalby/sdk/nwc";

const client = new NWCClient({
  nostrWalletConnectUrl: process.env.NWC_URL,
});

const response = await client.payInvoice({
  invoice: invoice.paymentRequest,
});
console.log("Zap sent! Preimage:", response.preimage);
```

## Zap and Pay in One Step (WebLN / Browser)

If a WebLN provider is available (e.g. via Bitcoin Connect), `zap()` generates the zap invoice and pays it in a single call:

```ts
import { LightningAddress } from "@getalby/lightning-tools/lnurl";
import { requestProvider } from "@getalby/bitcoin-connect";

const provider = await requestProvider();
const nostrProvider = window.nostr;

const ln = new LightningAddress("hello@getalby.com", {
  webln: provider,
});
await ln.fetch();

const response = await ln.zap(
  {
    satoshi: 500,
    comment: "Zapping from the browser!",
    relays: ["wss://relay.damus.io"],
  },
  { nostr: nostrProvider }
);

console.log("Zap paid! Preimage:", response.preimage);
```

## Generate a Zap Event Manually

For advanced use cases, you can generate the zap request event yourself using `generateZapEvent`:

```ts
import { generateZapEvent } from "@getalby/lightning-tools/lnurl";

const zapEvent = await generateZapEvent(
  {
    satoshi: 1000,
    comment: "Nice work!",
    relays: ["wss://relay.damus.io", "wss://nos.lol"],
    p: recipientNostrPubkeyHex, // recipient's Nostr pubkey (hex)
    e: noteIdHex,               // optional: event ID being zapped (hex)
  },
  { nostr: nostrProvider }
);

console.log("Zap request event:", zapEvent);
// This event can be included in a LNURL-pay request as the `nostr` parameter
```

## Zapping a Specific Note vs a Profile

- **Zap a profile:** Omit the `e` field. The zap is attributed to the user, not a specific note.
- **Zap a note:** Include the `e` field with the Nostr event ID (hex) of the note being zapped.

```ts
// Zap a profile (no specific note)
const profileZap = await ln.zapInvoice(
  {
    satoshi: 100,
    relays: ["wss://relay.damus.io"],
  },
  { nostr: nostrProvider }
);

// Zap a specific note
const noteZap = await ln.zapInvoice(
  {
    satoshi: 100,
    relays: ["wss://relay.damus.io"],
    e: "note-event-id-hex",
  },
  { nostr: nostrProvider }
);
```

## Custom Nostr Provider (Server-Side)

In Node.js there is no `window.nostr`. You need to create a Nostr provider from a private key. You can use the `nostr-tools` package for this:

```ts
import { generateSecretKey, getPublicKey, finalizeEvent } from "nostr-tools/pure";
import { LightningAddress } from "@getalby/lightning-tools/lnurl";

// Use an existing key or generate one
const secretKey = generateSecretKey();

const nostrProvider = {
  getPublicKey: async () => getPublicKey(secretKey),
  signEvent: async (event) => finalizeEvent(event, secretKey),
};

const ln = new LightningAddress("hello@getalby.com", { proxy: false });
await ln.fetch();

const invoice = await ln.zapInvoice(
  {
    satoshi: 1000,
    comment: "Server-side zap",
    relays: ["wss://relay.damus.io"],
  },
  { nostr: nostrProvider }
);

// Pay with NWC Client
```

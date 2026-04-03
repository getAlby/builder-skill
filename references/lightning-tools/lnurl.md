# Example

IMPORTANT: read the [typings](./index.d.ts) to better understand how this works.

```ts
import { LightningAddress } from "@getalby/lightning-tools/lnurl";

const ln = new LightningAddress("hello@getalby.com");

await ln.fetch();
const invoice = await ln.requestInvoice({ satoshi: 1000 });
```

## Request an Invoice with a Comment

If the lightning address supports comments (LUD-12), you can attach a message:

```ts
const invoice = await ln.requestInvoice({
  satoshi: 1000,
  comment: "Great work, keep it up!",
});
```

Check the maximum comment length before sending — see [Metadata Introspection](#metadata-introspection) below.

## Request an Invoice with Payer Data

If the lightning address supports payer data (LUD-18), you can identify the sender:

```ts
const invoice = await ln.requestInvoice({
  satoshi: 1000,
  payerdata: {
    name: "Alice",
    email: "alice@example.com",
  },
});
```

Check which payer data fields the recipient supports and which are mandatory — see [Metadata Introspection](#metadata-introspection) below.

## Metadata Introspection

After calling `ln.fetch()`, the `LightningAddress` instance exposes metadata from the LNURL-pay endpoint. Always check these before requesting an invoice to avoid errors.

### Min / Max Sendable Amounts

```ts
await ln.fetch();

if (ln.lnurlpData) {
  console.log("Min sendable:", ln.lnurlpData.min, "sats");
  console.log("Max sendable:", ln.lnurlpData.max, "sats");
  console.log("Fixed amount only:", ln.lnurlpData.fixed); // true if min === max
  console.log("Description:", ln.lnurlpData.description);
}
```

### Validate Amount Before Requesting

```ts
function validateAmount(ln: LightningAddress, satoshi: number): void {
  if (!ln.lnurlpData) {
    throw new Error("Call ln.fetch() first");
  }
  if (satoshi < ln.lnurlpData.min) {
    throw new Error(`Amount too low. Minimum: ${ln.lnurlpData.min} sats`);
  }
  if (satoshi > ln.lnurlpData.max) {
    throw new Error(`Amount too high. Maximum: ${ln.lnurlpData.max} sats`);
  }
}
```

### Check Comment Support

```ts
if (ln.lnurlpData?.commentAllowed) {
  console.log("Comments supported, max length:", ln.lnurlpData.commentAllowed);
} else {
  console.log("Comments not supported by this lightning address.");
}
```

### Check Payer Data Requirements

```ts
if (ln.lnurlpData?.payerData) {
  const pd = ln.lnurlpData.payerData;
  if (pd.name) console.log("Name:", pd.name.mandatory ? "required" : "optional");
  if (pd.email) console.log("Email:", pd.email.mandatory ? "required" : "optional");
  if (pd.pubkey) console.log("Pubkey:", pd.pubkey.mandatory ? "required" : "optional");
} else {
  console.log("Payer data not supported by this lightning address.");
}
```

### Nostr Integration

```ts
if (ln.nostrPubkey) {
  console.log("Nostr pubkey:", ln.nostrPubkey);
  console.log("Nostr relays:", ln.nostrRelays);
  console.log("Supports Nostr zaps:", ln.lnurlpData?.allowsNostr);
}
```

## Check if an invoice was paid (LNURL-Verify)

NOTE: not all lightning address providers support LNURL-Verify.

```ts
const isPaid = await invoice.isPaid();
```

## Proxy Configuration (Browser vs Node.js)

In the browser, lightning address requests are subject to CORS restrictions. By default, `LightningAddress` routes requests through a proxy (`https://api.getalby.com/lnurl`) to avoid CORS errors. This works out of the box for browser apps.

In Node.js / server-side environments, you can disable the proxy for direct requests:

```ts
const ln = new LightningAddress("hello@getalby.com", {
  proxy: false,
});
```

You can also provide a custom proxy URL:

```ts
const ln = new LightningAddress("hello@getalby.com", {
  proxy: "https://my-proxy.example.com/lnurl",
});
```

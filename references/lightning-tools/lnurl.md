# Example

IMPORTANT: read the [typings](./index.d.ts) to better understand how this works.

```ts
import { LightningAddress } from "@getalby/lightning-tools/lnurl";

const ln = new LightningAddress("hello@getalby.com");

await ln.fetch();
const invoice = await ln.requestInvoice({ satoshi: 1000 });
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

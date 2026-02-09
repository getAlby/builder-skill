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

```ts
import { NWCClient } from "@getalby/sdk/nwc";
// or from e.g. https://esm.sh/@getalby/sdk@7.0.0

const client = new NWCClient({
  nostrWalletConnectUrl,
});
```

## Referenced files

Make sure to read the [NWC Client typings](./nwc.d.ts) when using any of the below referenced files.

- [subscribe to notifications of sent or received payments](./notifications.md)
- [How to pay a BOLT-11 lightning invoice](pay-invoice.md)
- [How to create, settle and cancel HOLD invoices for conditional payments](hold-invoices.md)
- [Error handling: error types, wallet error codes, and retry patterns](./error-handling.md)

# Lightning Tools

## How to install

Install the NPM package `@getalby/lightning-tools`. The latest version is 6.1.0.

## Imports

Use subpath imports to import only what you need:

- `@getalby/lightning-tools/lnurl` — `LightningAddress` and LNURL utilities
- `@getalby/lightning-tools/fiat` — Fiat currency conversion functions
- `@getalby/lightning-tools/bolt11` — `Invoice` class and `decodeInvoice`

Do NOT import from the package root (e.g. `import { LightningAddress } from "@getalby/lightning-tools"`). Always use the subpath imports shown in the examples.

## Units

All referenced files in this folder operate in satoshis (sats).

## Referenced files

Make sure to read the [Lightning tools typings](./index.d.ts) when using any of the below referenced files.

- [Request BOLT-11 invoices from a lightning address](./lnurl.md)
- [Convert between bitcoin and fiat currency amounts](./fiat.md)
- [Decode and work with invoices](./invoice.md)
- [Nostr Zaps: send lightning payments tied to Nostr events and profiles](./zaps.md)

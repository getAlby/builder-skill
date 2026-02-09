# Examples

IMPORTANT: read the [typings](./index.d.ts) to better understand how this works.

## Decode an Invoice (Quick)

The `decodeInvoice` function returns a simple object without creating a full `Invoice` instance. Useful for quick parsing:

```ts
import { decodeInvoice } from "@getalby/lightning-tools/bolt11";

const decoded = decodeInvoice(paymentRequest);
if (decoded) {
  console.log("Payment hash:", decoded.paymentHash);
  console.log("Amount:", decoded.satoshi, "sats");
  console.log("Description:", decoded.description);
  console.log("Timestamp:", decoded.timestamp);
  console.log("Expiry (seconds):", decoded.expiry); // may be undefined
}
```

## Decode an Invoice (Full)

The `Invoice` class provides richer functionality including expiry checking and payment verification:

```ts
import { Invoice } from "@getalby/lightning-tools/bolt11";
const invoice = new Invoice({ pr: paymentRequest });

console.log("Payment hash:", invoice.paymentHash);
console.log("Amount:", invoice.satoshi, "sats");
console.log("Description:", invoice.description);
console.log("Created:", invoice.createdDate);
console.log("Expires:", invoice.expiryDate); // may be undefined
```

## Invoice Expiration

Lightning invoices expire — typically after 1 hour, but the expiry varies by wallet. Always check expiry before presenting an invoice to a user or attempting to pay it.

### Check if an invoice has expired

```ts
if (invoice.hasExpired()) {
  console.log("This invoice has expired. Create a new one.");
} else {
  console.log("Invoice is still valid.");
  if (invoice.expiryDate) {
    const remainingMs = invoice.expiryDate.getTime() - Date.now();
    console.log("Expires in:", Math.floor(remainingMs / 1000), "seconds");
  }
}
```

### Guard before paying

Always check expiry before paying an invoice to avoid failed payments:

```ts
import { Invoice } from "@getalby/lightning-tools/bolt11";

function validateInvoiceBeforePayment(paymentRequest: string): Invoice {
  const invoice = new Invoice({ pr: paymentRequest });

  if (invoice.hasExpired()) {
    throw new Error("Invoice has expired. Request a new one.");
  }

  // Optional: warn if expiring soon (e.g. less than 60 seconds)
  if (invoice.expiryDate) {
    const remainingMs = invoice.expiryDate.getTime() - Date.now();
    if (remainingMs < 60_000) {
      console.warn("Invoice expires in less than 60 seconds.");
    }
  }

  return invoice;
}
```

## Verify a Preimage for an Invoice

After a payment is made, you can verify the preimage matches the invoice's payment hash:

```ts
const isValid = invoice.validatePreimage(preimage);
console.log("Preimage valid:", isValid);
```

## Check if an Invoice Was Paid (LNURL-Verify)

If the invoice was created from a lightning address (via `LightningAddress.requestInvoice()`), it may have a verify URL that allows checking payment status without a wallet connection:

```ts
// Only works for invoices created via LightningAddress.requestInvoice()
// The invoice must have a verify URL
if (invoice.verify) {
  const isPaid = await invoice.isPaid();
  console.log("Paid:", isPaid);
}
```

NOTE: not all lightning address providers support LNURL-Verify. The `verify` property will be `null` if unsupported.
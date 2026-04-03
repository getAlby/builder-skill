# Cross-Library Recipe: NWC Client + Lightning Tools

This example combines NWC Client and Lightning Tools to build a common real-world pattern:

> Receive a payment in USD, then forward 90% to a lightning address.

## Libraries Used

- **NWC Client** (`@getalby/sdk`) — create invoices, subscribe to payment notifications, send payments
- **Lightning Tools** (`@getalby/lightning-tools`) — convert fiat to sats, request invoices from a lightning address

## ⚠️ Unit Conversion

NWC Client uses **millisats**. Lightning Tools uses **sats**. This recipe converts between them:
- NWC → Lightning Tools: `Math.floor(millisats / 1000)`
- Lightning Tools → NWC: `sats * 1000`

## Full Example

IMPORTANT: read the [NWC Client typings](./nwc-client/nwc.d.ts) and [Lightning Tools typings](./lightning-tools/index.d.ts) to better understand how this works.

```ts
import { NWCClient, Nip47WalletError } from "@getalby/sdk/nwc";
import { getSatoshiValue } from "@getalby/lightning-tools/fiat";
import { LightningAddress } from "@getalby/lightning-tools/lnurl";

const client = new NWCClient({
  nostrWalletConnectUrl: process.env.NWC_URL,
});

// Step 1: Convert $5 USD to sats using Lightning Tools
const amountSats = await getSatoshiValue({ amount: 5, currency: "USD" });
console.log(`$5 USD = ${amountSats} sats`);

// Step 2: Create an invoice using NWC Client (amount in millisats)
const amountMillisats = amountSats * 1000;
const transaction = await client.makeInvoice({
  amount: amountMillisats,
  description: "Payment for service - $5 USD",
});
console.log("Invoice created:", transaction.invoice);
console.log("Share this invoice with the payer.");

// Step 3: Wait for the payment to arrive
const unsub = await client.subscribeNotifications(async (notification) => {
  if (notification.notification_type !== "payment_received") {
    return;
  }
  if (notification.notification.payment_hash !== transaction.payment_hash) {
    return;
  }

  const receivedMillisats = notification.notification.amount;
  const receivedSats = Math.floor(receivedMillisats / 1000);
  console.log(`Payment received: ${receivedSats} sats`);

  // Step 4: Calculate 90% to forward
  const forwardSats = Math.floor(receivedSats * 0.9);
  console.log(`Forwarding 90%: ${forwardSats} sats to recipient`);

  // Step 5: Request an invoice from a lightning address using Lightning Tools
  const recipientAddress = new LightningAddress("hello@getalby.com", {
    proxy: false, // server-side, no CORS proxy needed
  });
  await recipientAddress.fetch();
  const recipientInvoice = await recipientAddress.requestInvoice({
    satoshi: forwardSats,
  });

  // Step 6: Pay the invoice using NWC Client
  try {
    const payResponse = await client.payInvoice({
      invoice: recipientInvoice.paymentRequest,
    });
    console.log("Forwarded payment! Preimage:", payResponse.preimage);
  } catch (error) {
    if (error instanceof Nip47WalletError) {
      console.error(`Payment failed [${error.code}]: ${error.message}`);
    } else {
      throw error;
    }
  }

  unsub();
  client.close();
});

// Graceful shutdown
process.on("SIGINT", () => {
  unsub();
  client.close();
  process.exit();
});
```

## Key Takeaways

1. **Fiat conversion** happens via Lightning Tools (`getSatoshiValue`) which returns sats.
2. **Invoice creation** happens via NWC Client (`makeInvoice`) which expects millisats — so multiply by 1000.
3. **Notification amounts** from NWC Client are in millisats — divide by 1000 before passing to Lightning Tools.
4. **Lightning address invoice requests** happen via Lightning Tools (`requestInvoice`) which expects sats.
5. **Paying the invoice** happens via NWC Client (`payInvoice`) which takes a BOLT-11 string directly.
6. **Error handling** uses `Nip47WalletError` for wallet-level failures.
7. **Cleanup** always unsubscribes and closes the client.
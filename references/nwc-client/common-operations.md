# Common Operations

IMPORTANT: read the [typings](./nwc.d.ts) to better understand how this works.

## Get Wallet Info

```ts
const info = await client.getInfo();
console.log("Alias:", info.alias);
console.log("Network:", info.network);
console.log("Supported methods:", info.methods);
console.log("Lightning address:", info.lud16); // may be undefined
```

## Get Balance

```ts
const { balance } = await client.getBalance();
console.log("Balance:", Math.floor(balance / 1000), "sats"); // balance is in millisats
```

## Create an Invoice (Receive a Payment)

```ts
const transaction = await client.makeInvoice({
  amount: 1000000, // 1000 sats in millisats
  description: "Payment for order #123",
});
console.log("Invoice:", transaction.invoice);
console.log("Payment hash:", transaction.payment_hash);
```

To wait for the invoice to be paid, use [notifications](./notifications.md).

## Look Up an Invoice

```ts
// Look up by payment hash
const transaction = await client.lookupInvoice({
  payment_hash: paymentHash,
});
console.log("State:", transaction.state); // "settled", "pending", "failed", or "accepted"
console.log("Amount:", Math.floor(transaction.amount / 1000), "sats");

// Or look up by BOLT-11 invoice string
const transaction2 = await client.lookupInvoice({
  invoice: bolt11Invoice,
});
```

## List Transactions

```ts
// List recent settled transactions
const { transactions } = await client.listTransactions({
  limit: 10,
});

for (const tx of transactions) {
  const amountSats = Math.floor(tx.amount / 1000);
  console.log(`${tx.type} | ${amountSats} sats | ${tx.description || "(no description)"} | ${tx.state}`);
}
```

### Filter by type and time range

```ts
// Only incoming payments in the last 24 hours
const oneDayAgo = Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000);
const { transactions } = await client.listTransactions({
  type: "incoming",
  from: oneDayAgo,
  limit: 50,
});
```

### Include pending/unpaid transactions

```ts
const { transactions } = await client.listTransactions({
  unpaid: true,
  limit: 20,
});

const pending = transactions.filter((tx) => tx.state === "pending");
```

## Get Budget

Check how much of the app connection's budget has been used:

```ts
const budget = await client.getBudget();

if ("total_budget" in budget) {
  const usedSats = Math.floor(budget.used_budget / 1000);
  const totalSats = Math.floor(budget.total_budget / 1000);
  console.log(`Budget: ${usedSats} / ${totalSats} sats used`);
  if (budget.renews_at) {
    console.log("Renews at:", new Date(budget.renews_at * 1000).toISOString());
  }
} else {
  console.log("No budget restrictions on this connection.");
}
```

## Sign a Message

```ts
const { signature, message } = await client.signMessage({
  message: "Proof of wallet ownership",
});
console.log("Signature:", signature);
```

## Pay Multiple Invoices at Once

```ts
const result = await client.multiPayInvoice({
  invoices: [
    { invoice: bolt11Invoice1, id: "payment-1" },
    { invoice: bolt11Invoice2, id: "payment-2" },
  ],
});

for (const paid of result.invoices) {
  console.log(`Paid ${paid.dTag}: preimage ${paid.preimage}`);
}
```

## Access the Lightning Address

The lightning address is available directly on the client if the NWC connection secret includes a `lud16` parameter:

```ts
if (client.lud16) {
  console.log("Lightning address:", client.lud16);
}
```

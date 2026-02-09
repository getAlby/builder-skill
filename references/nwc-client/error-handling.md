# Error Handling

IMPORTANT: read the [typings](./nwc.d.ts) to better understand how this works.

## Error Types

All errors extend `Nip47Error`, which has a `code` and `message` property.

| Error Class | When it occurs |
|---|---|
| `Nip47WalletError` | The wallet received the request but rejected it (e.g. insufficient balance, quota exceeded). Check the `.code` property for the specific reason. |
| `Nip47TimeoutError` | Base class for timeout errors (see below). |
| `Nip47PublishTimeoutError` | The request could not be published to the relay in time. |
| `Nip47ReplyTimeoutError` | The request was published but the wallet did not reply in time. |
| `Nip47NetworkError` | A network-level failure (e.g. relay unreachable, WebSocket dropped). |
| `Nip47PublishError` | The relay rejected the published event. |
| `Nip47ResponseDecodingError` | The wallet's response could not be decrypted or decoded. |
| `Nip47ResponseValidationError` | The wallet's response was decoded but failed validation. |
| `Nip47UnexpectedResponseError` | An unexpected response type was received. |
| `Nip47UnsupportedEncryptionError` | The wallet does not support a compatible encryption type. |

## Common Wallet Error Codes (`Nip47WalletError`)

These are returned by the wallet when it rejects a request:

| Code | Description |
|---|---|
| `INSUFFICIENT_BALANCE` | The wallet does not have enough funds for this payment. |
| `QUOTA_EXCEEDED` | The app connection's budget has been exceeded. |
| `NOT_FOUND` | The requested invoice or transaction was not found. |
| `RATE_LIMITED` | Too many requests — the wallet is rate limiting. |
| `NOT_IMPLEMENTED` | The wallet does not support this method. |
| `INTERNAL` | An internal wallet error occurred. |
| `OTHER` | An unspecified error. |
| `RESTRICTED` | The app connection does not have permission for this method. |
| `UNAUTHORIZED` | The app connection is not authorized. |
| `PAYMENT_FAILED` | The payment could not be completed (e.g. no route found). |

## Example: Handling Payment Errors

```ts
import { NWCClient, Nip47WalletError, Nip47TimeoutError, Nip47NetworkError } from "@getalby/sdk/nwc";

try {
  const response = await client.payInvoice({ invoice });
  console.log("Payment successful! Preimage:", response.preimage);
} catch (error) {
  if (error instanceof Nip47WalletError) {
    // The wallet received the request but rejected it
    switch (error.code) {
      case "INSUFFICIENT_BALANCE":
        console.error("Not enough funds to complete this payment.");
        break;
      case "QUOTA_EXCEEDED":
        console.error("Budget limit reached. Try again after the budget renews.");
        break;
      case "PAYMENT_FAILED":
        console.error("Payment failed (e.g. no route to destination).");
        break;
      case "RATE_LIMITED":
        console.error("Too many requests. Try again later.");
        break;
      default:
        console.error(`Wallet error [${error.code}]: ${error.message}`);
    }
  } else if (error instanceof Nip47TimeoutError) {
    // Request timed out — the relay or wallet may be slow or unreachable
    console.error("Request timed out. The wallet or relay may be temporarily unavailable.");
  } else if (error instanceof Nip47NetworkError) {
    // Network-level failure
    console.error("Network error. Check relay connectivity.");
  } else {
    throw error; // Unexpected error, re-throw
  }
}
```

## Example: Handling Invoice Creation Errors

```ts
try {
  const transaction = await client.makeInvoice({
    amount: 1000000, // 1000 sats in millisats
    description: "Order #123",
  });
  console.log("Invoice created:", transaction.invoice);
} catch (error) {
  if (error instanceof Nip47WalletError) {
    console.error(`Failed to create invoice [${error.code}]: ${error.message}`);
  } else {
    throw error;
  }
}
```

## Budget and Permission Guardrails

- `QUOTA_EXCEEDED`: surface a clear message (e.g., "Budget reached. Approve a higher budget or wait for renewal.") and prompt the user to re-authorize with a larger budget or wait until `renewal_period`. You can inspect `getBudget()` to show `used_budget`, `total_budget`, and `renews_at`.
- `RESTRICTED`: the connection lacks the required permission for the requested method. Ask the user to create a new connection with the needed methods enabled (`request_methods`) and reconnect.
- `UNAUTHORIZED`: connection is invalid/expired; request a fresh connection secret.
- `RATE_LIMITED`: back off and retry later with exponential backoff.
- Always redact the `nostrWalletConnectUrl` and secrets from logs and error messages.

## Retry Pattern for Transient Errors

Network and timeout errors are often transient. Here is a simple retry wrapper:

```ts
async function withRetry<T>(fn: () => Promise<T>, retries = 3, delayMs = 1000): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      const isTransient = error instanceof Nip47TimeoutError || error instanceof Nip47NetworkError;
      if (!isTransient || i === retries - 1) {
        throw error;
      }
      await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
    }
  }
  throw new Error("Unreachable");
}

// Usage:
const response = await withRetry(() => client.payInvoice({ invoice }));
```

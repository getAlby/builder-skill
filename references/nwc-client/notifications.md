# Notifications Guide

IMPORTANT: read the [typings](./nwc.d.ts) to better understand how this works.

## Subscribe with Filtering, Dedupe, and Cleanup

```ts
// Track processed payment_hash values to avoid double-handling
const seen = new Set<string>();

// Filter by notification type to reduce noise
const notificationTypes = ["payment_received", "payment_sent", "hold_invoice_accepted"] as const;

const onNotification = (notification: { notification_type: (typeof notificationTypes)[number]; notification: any }) => {
  const { notification_type, notification: payload } = notification;
  const { payment_hash, amount, state, type } = payload;

  // Dedupe by payment hash (idempotent handling)
  if (payment_hash && seen.has(payment_hash)) return;
  if (payment_hash) seen.add(payment_hash);

  // Ignore irrelevant states (optional)
  if (state && state === "failed") {
    console.warn("Ignoring failed notification", payment_hash);
    return;
  }

  // Convert msats → sats for display
  const sats = Math.floor((amount ?? 0) / 1000);

  switch (notification_type) {
    case "payment_received":
      console.info(`Received ${sats} sats (${payment_hash})`);
      break;
    case "payment_sent":
      console.info(`Sent ${sats} sats (${payment_hash})`);
      break;
    case "hold_invoice_accepted":
      console.info(`Hold invoice accepted (${payment_hash}) — decide to settle or cancel.`);
      break;
    default:
      console.info("Other notification", notification);
  }
};

// Subscribe (stays alive while the subscription is active)
const unsub = await client.subscribeNotifications(onNotification, notificationTypes);

// Graceful shutdown / page unload
const cleanup = () => {
  unsub?.();
  client.close();
};
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", cleanup);
} else {
  process.on("SIGINT", cleanup);
}
```

## Resilience Tips

- If the process exits or the page reloads, the subscription ends; re-subscribe on startup.
- Handle transient network issues by allowing the client to reconnect; if you detect a dropped relay/WebSocket, recreate the client and `subscribeNotifications`.
- Keep the handler idempotent (dedupe by `payment_hash`) to tolerate reconnects and wallet replays.

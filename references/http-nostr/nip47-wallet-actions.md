# NIP-47 Wallet Actions (HTTP-Nostr)

**IMPORTANT: read the [typings](./index.d.ts) to better understand how this works.**

This reference covers interacting with a user's Lightning Wallet via the HTTP-Nostr bridge. Use these typed methods to handle fetching wallet capabilities, sending payments, and listening to wallet-specific notifications (Kind 23196).

## 1. Fetch NWC Capabilities
Check if a wallet connection has permissions (like `pay_invoice` or `get_balance`) before attempting a transaction.

```ts
/**
 * Endpoint: POST /nip47/info
 */
async getInfo(req: InfoRequest): Promise<InfoResponse> {
  return this.post<InfoResponse>("/nip47/info", req);
}

```

## 2. Publish NWC Request (Synchronous)

Publishes a signed NIP-47 request event (e.g., `pay_invoice`) and waits for the relay to return the response immediately.

```ts
/**
 * Endpoint: POST /nip47
 */
async publishNip47(req: NIP47Request): Promise<NIP47Response> {
  return this.post<NIP47Response>("/nip47", req);
}

```

## 3. Publish NWC Request (Asynchronous / Webhook)

Best for serverless environments. Fires the request and instructs the bridge to send the response to your `webhookUrl` to avoid function timeouts.

```ts
/**
 * Endpoint: POST /nip47/webhook
 */
async publishNip47Webhook(req: NIP47WebhookRequest): Promise<NIP47Response> {
  return this.post<NIP47Response>("/nip47/webhook", req);
}

```

## 4. Subscribe to NWC Notifications

Registers a webhook to receive incoming wallet notifications (NIP-47 Kind `23196`), such as received payments.

```ts
/**
 * Endpoint: POST /nip47/notifications
 */
async subscribeNotifications(req: NIP47NotificationRequest): Promise<SubscriptionResponse> {
  return this.post<SubscriptionResponse>("/nip47/notifications", req);
}

```

## 5. Subscribe to NWC Push Notifications (Mobile/Expo)

Registers a mobile device push token to receive wallet notifications directly via Expo.

```ts
/**
 * Endpoint: POST /nip47/notifications/push
 */
async subscribePushNotifications(req: NIP47PushNotificationRequest): Promise<PushSubscriptionResponse> {
  return this.post<PushSubscriptionResponse>("/nip47/notifications/push", req);
}
```
# General Nostr Events & Subscriptions (HTTP-Nostr)

**IMPORTANT: read the [typings](./index.d.ts) to better understand how this works.**

This reference covers publishing arbitrary events to the Nostr network, subscribing to custom event filters via webhooks, and managing/cleaning up active database subscriptions.

## 1. Publish Generic Event
Publishes any signed Nostr event (outside of NIP-47 specific requests) to a specified relay.

```ts
/**
 * Endpoint: POST /publish
 */
async publishEvent(req: PublishRequest): Promise<PublishResponse> {
  return this.post<PublishResponse>("/publish", req);
}

```

## 2. Subscribe to Custom Events

Creates a webhook subscription based on custom Nostr filters (kinds, authors, tags, etc.). The bridge will push matching events to the `webhookUrl`.

```ts
/**
 * Endpoint: POST /subscriptions
 */
async subscribeGeneral(req: SubscriptionRequest): Promise<SubscriptionResponse> {
  return this.post<SubscriptionResponse>("/subscriptions", req);
}

```

## 3. Delete Subscriptions (Cleanup)

Stops an active subscription and removes it from the HTTP-Nostr PostgreSQL database. **Always do this when a subscription is no longer needed to free up resources**.

```ts
/**
 * Endpoint: DELETE /subscriptions/:id
 */
async stopSubscription(id: string): Promise<StopSubscriptionResponse> {
  const res = await fetch(`${this.baseUrl}/subscriptions/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`HTTP-Nostr Error [${res.status}]: ${err.message || res.statusText}`);
  }
  return res.json() as Promise<StopSubscriptionResponse>;
}

```
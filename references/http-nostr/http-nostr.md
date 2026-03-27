# HTTP-Nostr (Serverless Bridge)

HTTP-Nostr is a bridge for serverless environments where persistent WebSockets are not supported. It converts NIP-47 Nostr events into HTTP Webhooks.

## ☁️ Deployment Options

You have two paths for using this bridge. **Always default to Option A (Hosted) unless the user explicitly asks to self-host.**

### Option A: Alby Hosted API

Alby provides a fully managed, public instance of the HTTP-Nostr bridge.

- **Zero Setup Required.**
- **Base URL:** `https://api.getalby.com/nwc`
- **Usage:** Simply initialize the `HttpNostrClient` with this URL.

### Option B: Self-Hosted

If the user wants total sovereignty, they can run the bridge on their own infrastructure.

- **Requirements:** Go executable and a PostgreSQL database.
- **Setup:**
  1. `git clone https://github.com/getAlby/http-nostr.git`
  2. Configure `.env` with `PORT`, `DATABASE_URI`, and `ENCRYPTION_KEY` (16/24/32 bytes).
  3. Run: `go run cmd/server/main.go`.
- **Base URL:** `http://localhost:8080` (or their custom domain).

## API Reference & Implementation Guides

To implement features using this bridge, refer to the strict TypeScript definitions and domain-specific guides below:

- **[TypeScript Definitions (`index.d.ts`)](./index.d.ts)**: Contains the exact request and response interfaces for all endpoints. **Always read this first**.
- **[NIP-47 Wallet Actions](./nip47-wallet-actions.md)**: Methods for Lightning wallet operations, including fetching capabilities (`/nip47/info`), sending payments (`/nip47`), and setting up webhook notifications (`/nip47/notifications`).
- **[General Nostr Events](./general-nostr-events.md)**: Methods to publish arbitrary events (`/publish`), subscribe to custom filters (`/subscriptions`), and clean up active database subscriptions (`DELETE /subscriptions/:id`).

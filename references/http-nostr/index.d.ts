// Types here are gotten directly from http-nostr/internal/nostr/models.go file,
// but rewritten in TypeScript.

// --- Base Nostr Types ---
export interface NostrEvent {
	id: string;
	pubkey: string;
	created_at: number;
	kind: number;
	tags: string[][];
	content: string;
	sig: string;
}

export interface NostrFilter {
	ids?: string[];
	authors?: string[];
	kinds?: number[];
	since?: number;
	until?: number;
	limit?: number;
	search?: string;
	[key: `#${string}`]: string[] | undefined; // Supports #e, #p, etc.
}

// --- Request & Response Interfaces ---

export interface ErrorResponse {
	message: string;
	error: string;
}

export interface InfoRequest {
	relayUrl?: string;
	walletPubkey: string;
}

export interface InfoResponse {
	event: NostrEvent;
}

export interface NIP47Request {
	relayUrl?: string;
	walletPubkey: string;
	event: NostrEvent; // SignedEvent
}

export interface NIP47WebhookRequest {
	relayUrl?: string;
	walletPubkey: string;
	webhookUrl: string;
	event: NostrEvent; // SignedEvent
}

export interface NIP47NotificationRequest {
	relayUrl?: string;
	webhookUrl: string;
	walletPubkey: string;
	connectionPubkey: string;
	version?: string;
}

export interface NIP47PushNotificationRequest {
	relayUrl?: string;
	pushToken: string;
	walletPubkey: string;
	connectionPubkey: string;
	isIOS?: boolean;
	version?: string;
}

export interface NIP47Response {
	event?: NostrEvent;
	state: string; // "PUBLISHED", "ALREADY_PROCESSED", "WEBHOOK_RECEIVED"
}

export interface PublishRequest {
	relayUrl?: string;
	event: NostrEvent; // SignedEvent
}

export interface PublishResponse {
	eventId: string;
	relayUrl: string;
	state: string;
}

export interface SubscriptionRequest {
	relayUrl?: string;
	webhookUrl: string;
	filter: NostrFilter;
}

export interface SubscriptionResponse {
	subscription_id: string;
	webhookUrl: string;
}

export interface PushSubscriptionResponse {
	subscriptionId: string;
	pushToken: string;
	walletPubkey: string;
	appPubkey: string;
}

export interface StopSubscriptionResponse {
	message: string;
	state: string; // "CLOSED", "ALREADY_CLOSED"
}

import * as _webbtc_webln_types from '@webbtc/webln-types';
import { WebLNProvider, SendPaymentResponse } from '@webbtc/webln-types';

type InvoiceArgs = {
    pr: string;
    verify?: string;
    preimage?: string;
    successAction?: SuccessAction;
};
type SuccessAction = {
    tag: "message";
    message: string;
} | {
    tag: "url";
    description: string;
    url: string;
};

declare const fromHexString: (hexString: string) => Uint8Array<ArrayBuffer>;
type DecodedInvoice = {
    paymentHash: string;
    satoshi: number;
    timestamp: number;
    expiry: number | undefined;
    description: string | undefined;
};
declare const decodeInvoice: (paymentRequest: string) => DecodedInvoice | null;

declare class Invoice {
    paymentRequest: string;
    paymentHash: string;
    preimage: string | null;
    verify: string | null;
    satoshi: number;
    expiry: number | undefined;
    timestamp: number;
    createdDate: Date;
    expiryDate: Date | undefined;
    description: string | null;
    successAction: SuccessAction | null;
    constructor(args: InvoiceArgs);
    isPaid(): Promise<boolean>;
    validatePreimage(preimage: string): boolean;
    verifyPayment(): Promise<boolean>;
    hasExpired(): boolean;
}

type LnUrlRawData = {
    tag: string;
    callback: string;
    minSendable: number;
    maxSendable: number;
    metadata: string;
    payerData?: LUD18ServicePayerData;
    commentAllowed?: number;
    allowsNostr?: boolean;
};
type LnUrlPayResponse = {
    callback: string;
    fixed: boolean;
    min: number;
    max: number;
    domain?: string;
    metadata: Array<Array<string>>;
    metadataHash: string;
    identifier: string;
    email: string;
    description: string;
    image: string;
    commentAllowed?: number;
    rawData: LnUrlRawData;
    allowsNostr: boolean;
    payerData?: LUD18ServicePayerData;
};
type LUD18ServicePayerData = Partial<{
    name: {
        mandatory: boolean;
    };
    pubkey: {
        mandatory: boolean;
    };
    identifier: {
        mandatory: boolean;
    };
    email: {
        mandatory: boolean;
    };
    auth: {
        mandatory: boolean;
        k1: string;
    };
}> & Record<string, unknown>;
type LUD18PayerData = Partial<{
    name?: string;
    pubkey?: string;
    identifier?: string;
    email?: string;
    auth?: {
        key: string;
        sig: string;
    };
}> & Record<string, unknown>;
type NostrResponse = {
    names: Record<string, string>;
    relays: Record<string, string[]>;
};
type Event = {
    id?: string;
    kind: number;
    pubkey?: string;
    content: string;
    tags: string[][];
    created_at: number;
    sig?: string;
};
type ZapArgs = {
    satoshi: number;
    comment?: string;
    relays: string[];
    p?: string;
    e?: string;
};
type NostrProvider = {
    getPublicKey(): Promise<string>;
    signEvent(event: Event & {
        pubkey: string;
        id: string;
    }): Promise<Event>;
};
type ZapOptions = {
    nostr?: NostrProvider;
};
type RequestInvoiceArgs = {
    satoshi: number;
    comment?: string;
    payerdata?: LUD18PayerData;
};
type KeysendResponse = {
    customKey: string;
    customValue: string;
    destination: string;
};
type KeySendRawData = {
    tag: string;
    status: string;
    customData?: {
        customKey?: string;
        customValue?: string;
    }[];
    pubkey: string;
};

declare const parseKeysendResponse: (data: KeySendRawData) => KeysendResponse;
declare function generateZapEvent({ satoshi, comment, p, e, relays }: ZapArgs, options?: ZapOptions): Promise<Event>;
declare function validateEvent(event: Event): boolean;
declare function serializeEvent(evt: Event): string;
declare function getEventHash(event: Event): string;
declare function parseNostrResponse(nostrData: NostrResponse, username: string | undefined): readonly [NostrResponse, string | undefined, string[] | undefined];
declare const isUrl: (url: string | null) => url is string;
declare const isValidAmount: ({ amount, min, max, }: {
    amount: number;
    min: number;
    max: number;
}) => boolean;
declare const parseLnUrlPayResponse: (data: LnUrlRawData) => Promise<LnUrlPayResponse>;

type BoostOptions = {
    webln?: unknown;
};
type BoostArguments = {
    destination: string;
    customKey?: string;
    customValue?: string;
    amount?: number;
    boost: Boost;
};
type WeblnBoostParams = {
    destination: string;
    amount: number;
    customRecords: Record<string, string>;
};
type Boost = {
    action: string;
    value_msat: number;
    value_msat_total: number;
    app_name: string;
    app_version: string;
    feedId: string;
    podcast: string;
    episode: string;
    ts: number;
    name: string;
    sender_name: string;
};

declare const sendBoostagram: (args: BoostArguments, options?: BoostOptions) => Promise<_webbtc_webln_types.SendPaymentResponse>;

declare const LN_ADDRESS_REGEX: RegExp;
declare const DEFAULT_PROXY = "https://api.getalby.com/lnurl";
type LightningAddressOptions = {
    proxy?: string | false;
    webln?: WebLNProvider;
};
declare class LightningAddress {
    address: string;
    options: LightningAddressOptions;
    username: string | undefined;
    domain: string | undefined;
    pubkey: string | undefined;
    lnurlpData: LnUrlPayResponse | undefined;
    keysendData: KeysendResponse | undefined;
    nostrData: NostrResponse | undefined;
    nostrPubkey: string | undefined;
    nostrRelays: string[] | undefined;
    webln: WebLNProvider | undefined;
    constructor(address: string, options?: LightningAddressOptions);
    parse(): void;
    getWebLN(): any;
    fetch(): Promise<void>;
    fetchWithProxy(): Promise<void>;
    fetchWithoutProxy(): Promise<void>;
    fetchLnurlData(): Promise<void>;
    fetchKeysendData(): Promise<void>;
    fetchNostrData(): Promise<void>;
    lnurlpUrl(): string;
    keysendUrl(): string;
    nostrUrl(): string;
    generateInvoice(params: Record<string, string>): Promise<Invoice>;
    requestInvoice(args: RequestInvoiceArgs): Promise<Invoice>;
    boost(boost: Boost, amount?: number): Promise<SendPaymentResponse>;
    zapInvoice({ satoshi, comment, relays, e }: ZapArgs, options?: ZapOptions): Promise<Invoice>;
    zap(args: ZapArgs, options?: ZapOptions): Promise<SendPaymentResponse>;
    private parseLnUrlPayResponse;
    private parseKeysendResponse;
    private parseNostrResponse;
}

interface KVStorage {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
}
declare class MemoryStorage implements KVStorage {
    storage: any;
    constructor(initial?: Record<string, unknown>);
    getItem(key: string): any;
    setItem(key: string, value: unknown): void;
}
declare class NoStorage implements KVStorage {
    constructor(initial?: unknown);
    getItem(key: string): null;
    setItem(key: string, value: unknown): void;
}
declare const parseL402: (input: string) => Record<string, string>;
declare const makeAuthenticateHeader: (args: {
    macaroon: string;
    invoice: string;
    key?: string;
}) => string;

interface Wallet {
    sendPayment(paymentRequest: string): Promise<{
        preimage: string;
    }>;
}
declare const fetchWithL402: (url: string, fetchArgs: RequestInit, options: {
    headerKey?: string;
    wallet?: Wallet;
    store?: KVStorage;
}) => Promise<Response>;

interface FiatCurrency {
    code: string;
    name: string;
    symbol: string;
    priority: number;
}
declare const getFiatCurrencies: () => Promise<FiatCurrency[]>;
declare const getFiatBtcRate: (currency: string) => Promise<number>;
declare const getFiatValue: ({ satoshi, currency, }: {
    satoshi: number | string;
    currency: string;
}) => Promise<number>;
declare const getSatoshiValue: ({ amount, currency, }: {
    amount: number | string;
    currency: string;
}) => Promise<number>;
declare const getFormattedFiatValue: ({ satoshi, currency, locale, }: {
    satoshi: number | string;
    currency: string;
    locale: string;
}) => Promise<string>;

export { DEFAULT_PROXY, Invoice, LN_ADDRESS_REGEX, LightningAddress, MemoryStorage, NoStorage, decodeInvoice, fetchWithL402, fromHexString, generateZapEvent, getEventHash, getFiatBtcRate, getFiatCurrencies, getFiatValue, getFormattedFiatValue, getSatoshiValue, isUrl, isValidAmount, makeAuthenticateHeader, parseKeysendResponse, parseL402, parseLnUrlPayResponse, parseNostrResponse, sendBoostagram, serializeEvent, validateEvent };
export type { Boost, BoostArguments, BoostOptions, Event, FiatCurrency, InvoiceArgs, KVStorage, KeySendRawData, KeysendResponse, LUD18PayerData, LUD18ServicePayerData, LnUrlPayResponse, LnUrlRawData, NostrProvider, NostrResponse, RequestInvoiceArgs, SuccessAction, WeblnBoostParams, ZapArgs, ZapOptions };

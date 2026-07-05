import { CsApiError } from "../http/errors.js";

type MaybePromise<T> = T | Promise<T>;

export type PubSubQos = 0 | 1 | 2;
export type PubSubPayload = string | Uint8Array | ArrayBuffer;

export interface CsMessageMeta {
  topic: string;
  receivedAt: string;
  contentType?: string;
  qos?: PubSubQos;
  retain?: boolean;
  [key: string]: unknown;
}

export interface CsPubSubMessage<T> {
  topic: string;
  payload: T;
  contentType?: string;
  meta: CsMessageMeta;
}

export interface CsSubscriptionHandlers<T> {
  next?: (payload: T, message: CsPubSubMessage<T>) => MaybePromise<void>;
  message?: (message: CsPubSubMessage<T>) => MaybePromise<void>;
  error?: (error: unknown) => MaybePromise<void>;
  complete?: () => MaybePromise<void>;
}

export interface CsSubscription<T> extends AsyncIterable<CsPubSubMessage<T>> {
  readonly topic: string;
  close(): Promise<void>;
}

export interface PubSubTransportMessage {
  topic: string;
  payload: PubSubPayload;
  contentType?: string;
  meta?: Partial<CsMessageMeta>;
}

export type PubSubTransportMessageHandler = (message: PubSubTransportMessage) => MaybePromise<void>;

export interface PubSubTransportSubscription {
  close(): MaybePromise<void>;
}

export interface PubSubSubscribeOptions {
  topic?: string;
  qos?: PubSubQos;
  [key: string]: unknown;
}

export interface PubSubPublishOptions {
  topic?: string;
  contentType?: string;
  qos?: PubSubQos;
  retain?: boolean;
  [key: string]: unknown;
}

export interface PubSubTransport {
  subscribe(
    topic: string,
    handler: PubSubTransportMessageHandler,
    options?: PubSubSubscribeOptions,
  ): Promise<PubSubTransportSubscription>;
  publish(topic: string, payload: PubSubPayload, options?: PubSubPublishOptions): Promise<void>;
  close?(): MaybePromise<void>;
}

export class PubSubError extends CsApiError {
  constructor(
    message: string,
    public readonly topic?: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "PubSubError";
  }
}

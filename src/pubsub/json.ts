import type { z } from "zod";
import { ValidationError } from "../http/errors.js";
import type {
  CsPubSubMessage,
  CsSubscription,
  CsSubscriptionHandlers,
  PubSubPublishOptions,
  PubSubSubscribeOptions,
  PubSubTransport,
  PubSubTransportMessage,
  PubSubTransportSubscription,
} from "./types.js";
import { PubSubError, type PubSubPayload } from "./types.js";

interface JsonSubscriptionOptions<T> {
  transport: PubSubTransport;
  topic: string;
  schema: z.ZodType<T>;
  resourceName: string;
  contentType: string;
  handlers?: CsSubscriptionHandlers<T>;
  options?: PubSubSubscribeOptions;
  validateMessages?: boolean;
}

function payloadToString(payload: PubSubPayload): string {
  if (typeof payload === "string") return payload;
  if (payload instanceof ArrayBuffer) return new TextDecoder().decode(new Uint8Array(payload));
  return new TextDecoder().decode(payload);
}

function withoutTopic<T extends { topic?: string }>(options: T | undefined): Omit<T, "topic"> | undefined {
  if (!options) return undefined;
  const { topic: _topic, ...rest } = options;
  return rest;
}

class JsonCsSubscription<T> implements CsSubscription<T> {
  private readonly queue: CsPubSubMessage<T>[] = [];
  private readonly pending: Array<(value: IteratorResult<CsPubSubMessage<T>>) => void> = [];
  private transportSubscription?: PubSubTransportSubscription;
  private closed = false;
  private closePromise?: Promise<void>;

  constructor(
    readonly topic: string,
    private readonly schema: z.ZodType<T>,
    private readonly resourceName: string,
    private readonly contentType: string,
    private readonly handlers: CsSubscriptionHandlers<T> | undefined,
    private readonly validateMessages: boolean,
  ) {}

  attach(transportSubscription: PubSubTransportSubscription): void {
    this.transportSubscription = transportSubscription;
  }

  handleTransportMessage(message: PubSubTransportMessage): Promise<void> {
    if (this.closed) return Promise.resolve();
    return this.processTransportMessage(message);
  }

  private async processTransportMessage(raw: PubSubTransportMessage): Promise<void> {
    try {
      const message = this.decodeMessage(raw);
      this.enqueue(message);
      await this.handlers?.message?.(message);
      await this.handlers?.next?.(message.payload, message);
    } catch (error) {
      await this.notifyError(error);
    }
  }

  private decodeMessage(raw: PubSubTransportMessage): CsPubSubMessage<T> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(payloadToString(raw.payload));
    } catch (error) {
      throw new PubSubError(`Message on ${raw.topic} was not valid JSON`, raw.topic, error);
    }

    const payload = this.validateMessages ? this.parsePayload(parsed, raw.topic) : (parsed as T);
    const receivedAt = new Date().toISOString();
    const contentType = raw.contentType ?? raw.meta?.contentType ?? this.contentType;
    const meta = {
      ...raw.meta,
      topic: raw.topic,
      receivedAt,
      contentType,
    };

    return {
      topic: raw.topic,
      payload,
      contentType,
      meta,
    };
  }

  private parsePayload(parsed: unknown, topic: string): T {
    const result = this.schema.safeParse(parsed);
    if (!result.success) {
      throw new ValidationError(
        `Message on ${topic} did not match the expected schema for ${this.resourceName}`,
        result.error,
        this.resourceName,
      );
    }
    return result.data;
  }

  private enqueue(message: CsPubSubMessage<T>): void {
    const pending = this.pending.shift();
    if (pending) {
      pending({ done: false, value: message });
      return;
    }
    this.queue.push(message);
  }

  private async notifyError(error: unknown): Promise<void> {
    try {
      await this.handlers?.error?.(error);
    } catch {
      // Avoid surfacing handler failures as unhandled promise rejections.
    }
  }

  private nextMessage(): Promise<IteratorResult<CsPubSubMessage<T>>> {
    const message = this.queue.shift();
    if (message) return Promise.resolve({ done: false, value: message });
    if (this.closed) return Promise.resolve({ done: true, value: undefined });
    return new Promise((resolve) => this.pending.push(resolve));
  }

  async *[Symbol.asyncIterator](): AsyncIterator<CsPubSubMessage<T>> {
    while (true) {
      const next = await this.nextMessage();
      if (next.done) return;
      yield next.value;
    }
  }

  async close(): Promise<void> {
    if (this.closePromise) return this.closePromise;

    this.closed = true;
    for (const resolve of this.pending.splice(0)) {
      resolve({ done: true, value: undefined });
    }

    this.closePromise = Promise.resolve(this.transportSubscription?.close())
      .then(async () => {
        await this.handlers?.complete?.();
      })
      .catch(async (error) => {
        await this.notifyError(error);
        throw error;
      });

    return this.closePromise;
  }
}

export async function createJsonSubscription<T>({
  transport,
  topic,
  schema,
  resourceName,
  contentType,
  handlers,
  options,
  validateMessages = true,
}: JsonSubscriptionOptions<T>): Promise<CsSubscription<T>> {
  const subscription = new JsonCsSubscription<T>(topic, schema, resourceName, contentType, handlers, validateMessages);
  const transportSubscription = await transport.subscribe(
    topic,
    (message) => subscription.handleTransportMessage(message),
    withoutTopic(options),
  );
  subscription.attach(transportSubscription);
  return subscription;
}

export async function publishJson<T>(
  transport: PubSubTransport,
  topic: string,
  payload: T,
  schema: z.ZodType<T>,
  resourceName: string,
  contentType: string,
  options?: PubSubPublishOptions,
): Promise<void> {
  let validated: T;
  try {
    validated = schema.parse(payload);
  } catch (error) {
    throw new PubSubError(`Could not publish invalid ${resourceName} payload`, topic, error);
  }

  await transport.publish(topic, JSON.stringify(validated), {
    ...withoutTopic(options),
    contentType: options?.contentType ?? contentType,
  });
}

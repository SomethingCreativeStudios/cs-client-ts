import { describe, expect, it, vi } from "vitest";
import { toMessageObservable, toObservable } from "../../src/rxjs.js";
import type { CsPubSubMessage, CsSubscription } from "../../src/index.js";

class ManualSubscription<T> implements CsSubscription<T> {
  readonly topic = "topic";
  private readonly messages: CsPubSubMessage<T>[] = [];
  private readonly pending: Array<(value: IteratorResult<CsPubSubMessage<T>>) => void> = [];
  closed = false;

  push(payload: T) {
    const message: CsPubSubMessage<T> = {
      topic: this.topic,
      payload,
      contentType: "application/json",
      meta: { topic: this.topic, receivedAt: new Date().toISOString() },
    };
    const pending = this.pending.shift();
    if (pending) pending({ done: false, value: message });
    else this.messages.push(message);
  }

  async close() {
    this.closed = true;
    for (const resolve of this.pending.splice(0)) {
      resolve({ done: true, value: undefined });
    }
  }

  async *[Symbol.asyncIterator](): AsyncIterator<CsPubSubMessage<T>> {
    while (true) {
      const message = this.messages.shift();
      if (message) {
        yield message;
        continue;
      }
      if (this.closed) return;
      const next = await new Promise<IteratorResult<CsPubSubMessage<T>>>((resolve) => this.pending.push(resolve));
      if (next.done) return;
      yield next.value;
    }
  }
}

describe("RxJS pub/sub adapters", () => {
  it("toObservable emits payloads and closes the underlying subscription on unsubscribe", async () => {
    const source = new ManualSubscription<number>();
    const values: number[] = [];
    const observable = toObservable(async () => source);

    let subscription!: { unsubscribe(): void };
    const delivered = new Promise<void>((resolve) => {
      subscription = observable.subscribe((value) => {
        values.push(value);
        if (values.length === 2) resolve();
      });
    });
    await Promise.resolve();
    source.push(1);
    source.push(2);
    await delivered;

    subscription.unsubscribe();

    expect(values).toEqual([1, 2]);
    expect(source.closed).toBe(true);
  });

  it("toMessageObservable emits full messages and closes late-created subscriptions", async () => {
    const source = new ManualSubscription<{ ok: boolean }>();
    const values: Array<CsPubSubMessage<{ ok: boolean }>> = [];
    let resolveFactory!: (subscription: CsSubscription<{ ok: boolean }>) => void;
    const factory = vi.fn(
      () =>
        new Promise<CsSubscription<{ ok: boolean }>>((resolve) => {
          resolveFactory = resolve;
        }),
    );

    const subscription = toMessageObservable(factory).subscribe((message) => values.push(message));
    subscription.unsubscribe();
    resolveFactory(source);
    await Promise.resolve();

    expect(factory).toHaveBeenCalledTimes(1);
    expect(source.closed).toBe(true);
    expect(values).toEqual([]);
  });
});

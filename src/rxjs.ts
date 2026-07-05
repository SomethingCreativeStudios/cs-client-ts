import { Observable } from "rxjs";
import type { CsPubSubMessage, CsSubscription } from "./pubsub/types.js";

export function toMessageObservable<T>(factory: () => Promise<CsSubscription<T>>): Observable<CsPubSubMessage<T>> {
  return new Observable<CsPubSubMessage<T>>((subscriber) => {
    let subscription: CsSubscription<T> | undefined;
    let cancelled = false;

    void factory()
      .then((nextSubscription) => {
        if (cancelled) {
          void nextSubscription.close();
          return;
        }

        subscription = nextSubscription;
        void (async () => {
          try {
            for await (const message of nextSubscription) {
              if (subscriber.closed) break;
              subscriber.next(message);
            }
            if (!subscriber.closed) subscriber.complete();
          } catch (error) {
            subscriber.error(error);
          }
        })();
      })
      .catch((error) => subscriber.error(error));

    return () => {
      cancelled = true;
      void subscription?.close();
    };
  });
}

export function toObservable<T>(factory: () => Promise<CsSubscription<T>>): Observable<T> {
  return new Observable<T>((subscriber) => {
    const subscription = toMessageObservable(factory).subscribe({
      next: (message) => subscriber.next(message.payload),
      error: (error) => subscriber.error(error),
      complete: () => subscriber.complete(),
    });

    return () => subscription.unsubscribe();
  });
}

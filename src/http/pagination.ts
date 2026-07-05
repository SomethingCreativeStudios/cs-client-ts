import type { Link } from "../models/common/link.js";

export interface Page<T> {
  items: T[];
  links: Link[];
  /** Fetches the next page, following the response's `rel: "next"` link. `undefined` if there is none. */
  next?: () => Promise<Page<T>>;
}

export function findLink(links: Link[] | undefined, rel: string): Link | undefined {
  return links?.find((l) => l.rel === rel);
}

/** Drains a paginated endpoint into a single async stream, following `rel: "next"` links until exhausted. */
export async function* paginate<T>(first: Promise<Page<T>>): AsyncGenerator<T, void, unknown> {
  let page: Page<T> | undefined = await first;
  while (page) {
    for (const item of page.items) yield item;
    page = page.next ? await page.next() : undefined;
  }
}

/** Lazily transforms every item of a `Page<A>` (and any subsequent pages fetched via `next()`) into a `Page<B>`. */
export function mapPage<A, B>(page: Page<A>, fn: (a: A) => B): Page<B> {
  return {
    items: page.items.map(fn),
    links: page.links,
    next: page.next ? async () => mapPage(await page.next!(), fn) : undefined,
  };
}

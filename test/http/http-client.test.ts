import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { HttpClient } from "../../src/http/http-client.js";
import { HttpError, NotFoundError, ValidationError } from "../../src/http/errors.js";
import { paginate } from "../../src/http/pagination.js";
import { buildQueryString } from "../../src/http/query.js";

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

function decodedQuery(params: Parameters<typeof buildQueryString>[0]): string {
  return decodeURIComponent(buildQueryString(params));
}

describe("buildQueryString", () => {
  it("comma-joins array params", () => {
    expect(buildQueryString({ id: ["a", "b", "c"] })).toBe("?id=a%2Cb%2Cc");
    expect(buildQueryString({ q: ["temperature", "wind"] })).toBe("?q=temperature%2Cwind");
  });

  it("formats CS datetime examples", () => {
    expect(decodedQuery({ datetime: "2018-02-12T23:20:50Z" })).toBe("?datetime=2018-02-12T23:20:50Z");
    expect(decodedQuery({ datetime: "now" })).toBe("?datetime=now");
    expect(decodedQuery({ datetime: "latest" })).toBe("?datetime=latest");
    expect(decodedQuery({ datetime: { start: "2018-02-12T00:00:00Z", end: "2018-03-18T12:31:12Z" } })).toBe(
      "?datetime=2018-02-12T00:00:00Z/2018-03-18T12:31:12Z",
    );
    expect(decodedQuery({ datetime: { start: "2018-02-12T00:00:00Z" } })).toBe(
      "?datetime=2018-02-12T00:00:00Z/..",
    );
    expect(decodedQuery({ datetime: { start: "2018-02-12T00:00:00Z", end: "now" } })).toBe(
      "?datetime=2018-02-12T00:00:00Z/now",
    );
    expect(decodedQuery({ datetime: { start: "now", end: "2018-02-12T00:00:00Z" } })).toBe(
      "?datetime=now/2018-02-12T00:00:00Z",
    );
    expect(decodedQuery({ datetime: { end: "now" } })).toBe("?datetime=../now");
    expect(decodedQuery({ datetime: { start: "now" } })).toBe("?datetime=now/..");
    expect(decodedQuery({ datetime: { start: "2018-02-12T00:00:00Z", end: "latest" } })).toBe(
      "?datetime=2018-02-12T00:00:00Z/latest",
    );
  });

  it("formats an open time interval with ..", () => {
    expect(buildQueryString({ datetime: { start: "2020-01-01T00:00:00Z" } })).toBe(
      "?datetime=2020-01-01T00%3A00%3A00Z%2F..",
    );
  });

  it("formats a closed time interval", () => {
    expect(buildQueryString({ datetime: { start: "2020-01-01T00:00:00Z", end: "now" } })).toBe(
      "?datetime=2020-01-01T00%3A00%3A00Z%2Fnow",
    );
  });

  it("skips undefined values", () => {
    expect(buildQueryString({ q: undefined, limit: 10 })).toBe("?limit=10");
  });

  it("serializes bbox as a comma list", () => {
    expect(buildQueryString({ bbox: [1, 2, 3, 4] })).toBe("?bbox=1%2C2%2C3%2C4");
  });
});

describe("HttpClient.request", () => {
  it("sends Accept header and validates the response against the given schema", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => jsonResponse({ id: "1", name: "sys" }));
    const client = new HttpClient({ baseUrl: "https://api.example.org", fetch: fetchMock as unknown as typeof fetch });
    const schema = z.object({ id: z.string(), name: z.string() });

    const { data } = await client.request("GET", "/systems/1", { accept: "application/geo+json", schema });

    expect(data).toEqual({ id: "1", name: "sys" });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.example.org/systems/1");
    expect((init!.headers as Record<string, string>).accept).toBe("application/geo+json");
  });

  it("sends a static bearer token", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => jsonResponse({ ok: true }));
    const client = new HttpClient({
      baseUrl: "https://api.example.org",
      fetch: fetchMock as unknown as typeof fetch,
      auth: { type: "bearer", token: "abc123" },
    });

    await client.request("GET", "/systems");

    const [, init] = fetchMock.mock.calls[0]!;
    expect((init!.headers as Record<string, string>).authorization).toBe("Bearer abc123");
  });

  it("resolves a dynamic bearer token for each request", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => jsonResponse({ ok: true }));
    const token = vi.fn(async () => "fresh-token");
    const client = new HttpClient({
      baseUrl: "https://api.example.org",
      fetch: fetchMock as unknown as typeof fetch,
      auth: { type: "bearer", token },
    });

    await client.request("GET", "/systems");

    expect(token).toHaveBeenCalledOnce();
    const [, init] = fetchMock.mock.calls[0]!;
    expect((init!.headers as Record<string, string>).authorization).toBe("Bearer fresh-token");
  });

  it("sends basic auth credentials", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => jsonResponse({ ok: true }));
    const client = new HttpClient({
      baseUrl: "https://api.example.org",
      fetch: fetchMock as unknown as typeof fetch,
      auth: { type: "basic", username: "user", password: "pass" },
    });

    await client.request("GET", "/systems");

    const [, init] = fetchMock.mock.calls[0]!;
    expect((init!.headers as Record<string, string>).authorization).toBe("Basic dXNlcjpwYXNz");
  });

  it("refreshes an expired OAuth token before sending the request", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => jsonResponse({ ok: true }));
    const oldToken = { accessToken: "old", refreshToken: "refresh", expiresAt: Date.now() - 1_000 };
    const newToken = { accessToken: "new", refreshToken: "refresh2", expiresAt: Date.now() + 60_000 };
    const refresh = vi.fn(async () => newToken);
    const setToken = vi.fn(async () => undefined);
    const client = new HttpClient({
      baseUrl: "https://api.example.org",
      fetch: fetchMock as unknown as typeof fetch,
      auth: { type: "oauth2", token: oldToken, refresh, setToken },
    });

    await client.request("GET", "/systems");

    expect(refresh).toHaveBeenCalledWith(oldToken);
    expect(setToken).toHaveBeenCalledWith(newToken);
    const [, init] = fetchMock.mock.calls[0]!;
    expect((init!.headers as Record<string, string>).authorization).toBe("Bearer new");
  });

  it("refreshes OAuth and retries once after a 401", async () => {
    const statuses: number[] = [];
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => {
      if (fetchMock.mock.calls.length === 1) return new Response("", { status: 401 });
      return jsonResponse({ ok: true });
    });
    const refresh = vi.fn(async () => ({ accessToken: "new", refreshToken: "r2", expiresAt: Date.now() + 120_000 }));
    const client = new HttpClient({
      baseUrl: "https://api.example.org",
      fetch: fetchMock as unknown as typeof fetch,
      auth: {
        type: "oauth2",
        token: { accessToken: "old", refreshToken: "r1", expiresAt: Date.now() + 120_000 },
        refresh,
      },
      hooks: {
        afterResponse: ({ response }) => {
          statuses.push(response.status);
        },
      },
    });

    const { data } = await client.request("GET", "/systems");

    expect(data).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(refresh).toHaveBeenCalledOnce();
    expect(statuses).toEqual([401, 200]);
    expect((fetchMock.mock.calls[0]![1]!.headers as Record<string, string>).authorization).toBe("Bearer old");
    expect((fetchMock.mock.calls[1]![1]!.headers as Record<string, string>).authorization).toBe("Bearer new");
  });

  it("keeps the refreshed OAuth token when a token getter is stale", async () => {
    const staleToken = { accessToken: "old", refreshToken: "r1", expiresAt: Date.now() + 120_000 };
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => {
      if (fetchMock.mock.calls.length === 1) return new Response("", { status: 401 });
      return jsonResponse({ ok: true });
    });
    const client = new HttpClient({
      baseUrl: "https://api.example.org",
      fetch: fetchMock as unknown as typeof fetch,
      auth: {
        type: "oauth2",
        token: async () => staleToken,
        refresh: async () => ({ accessToken: "new", refreshToken: "r2", expiresAt: Date.now() + 180_000 }),
      },
    });

    await client.request("GET", "/systems");

    expect((fetchMock.mock.calls[1]![1]!.headers as Record<string, string>).authorization).toBe("Bearer new");
  });

  it("runs request hooks before fetch", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => jsonResponse({ ok: true }));
    const client = new HttpClient({
      baseUrl: "https://api.example.org",
      fetch: fetchMock as unknown as typeof fetch,
      hooks: {
        beforeRequest: ({ init }) => {
          (init.headers as Record<string, string>)["x-trace-id"] = "trace-1";
        },
      },
    });

    await client.request("GET", "/systems");

    const [, init] = fetchMock.mock.calls[0]!;
    expect((init!.headers as Record<string, string>)["x-trace-id"]).toBe("trace-1");
  });

  it("runs error hooks for a final 401", async () => {
    const seenStatuses: number[] = [];
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ title: "Unauthorized", status: 401 }), {
          status: 401,
          headers: { "content-type": "application/problem+json" },
        }),
    );
    const client = new HttpClient({
      baseUrl: "https://api.example.org",
      fetch: fetchMock as unknown as typeof fetch,
      hooks: {
        onError: ({ error }) => {
          if (error instanceof HttpError) seenStatuses.push(error.status);
        },
      },
    });

    await expect(client.request("GET", "/systems")).rejects.toThrow(HttpError);
    expect(seenStatuses).toEqual([401]);
  });

  it("throws ValidationError when the response doesn't match the schema", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ id: 123 }));
    const client = new HttpClient({ baseUrl: "https://api.example.org", fetch: fetchMock as unknown as typeof fetch });
    const schema = z.object({ id: z.string() });

    await expect(client.request("GET", "/systems/1", { schema })).rejects.toThrow(ValidationError);
  });

  it("throws NotFoundError on 404", async () => {
    const fetchMock = vi.fn(async () => new Response("", { status: 404 }));
    const client = new HttpClient({ baseUrl: "https://api.example.org", fetch: fetchMock as unknown as typeof fetch });

    await expect(client.request("GET", "/systems/missing")).rejects.toThrow(NotFoundError);
  });

  it("parses a problem+json error body", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ title: "Bad request", status: 400 }), {
          status: 400,
          headers: { "content-type": "application/problem+json" },
        }),
    );
    const client = new HttpClient({ baseUrl: "https://api.example.org", fetch: fetchMock as unknown as typeof fetch });

    await expect(client.request("POST", "/systems", { body: {} })).rejects.toMatchObject({
      message: "Bad request",
      status: 400,
    });
  });

  it("extracts the created id from the Location header on create()", async () => {
    const fetchMock = vi.fn(
      async () => new Response(null, { status: 201, headers: { location: "https://api.example.org/systems/abc123" } }),
    );
    const client = new HttpClient({ baseUrl: "https://api.example.org", fetch: fetchMock as unknown as typeof fetch });

    const id = await client.create("/systems", { label: "New System" });
    expect(id).toBe("abc123");
  });

  it("throws HttpError if create() gets no Location header", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 201 }));
    const client = new HttpClient({ baseUrl: "https://api.example.org", fetch: fetchMock as unknown as typeof fetch });

    await expect(client.create("/systems", {})).rejects.toThrow(HttpError);
  });
});

describe("HttpClient.fetchPage / paginate", () => {
  it("follows rel=next links across 3 pages then stops", async () => {
    const pages = [
      { items: [1, 2], links: [{ href: "https://api.example.org/systems?page=2", rel: "next" }] },
      { items: [3, 4], links: [{ href: "https://api.example.org/systems?page=3", rel: "next" }] },
      { items: [5], links: [] },
    ];
    let call = 0;
    const fetchMock = vi.fn(async () => jsonResponse(pages[call++]));
    const client = new HttpClient({ baseUrl: "https://api.example.org", fetch: fetchMock as unknown as typeof fetch });

    const collected: number[] = [];
    for await (const item of paginate(client.fetchPage<number>("/systems", "items", {}))) {
      collected.push(item);
    }

    expect(collected).toEqual([1, 2, 3, 4, 5]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

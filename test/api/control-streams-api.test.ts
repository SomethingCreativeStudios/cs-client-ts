import { describe, expect, it, vi } from "vitest";
import { CSApiClient } from "../../src/api/client.js";

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" }, ...init });
}

describe("CSApiClient.controlstreams", () => {
  it("list() maps deprecated keyword to the spec q query parameter", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => jsonResponse({ items: [], links: [] }));
    const client = new CSApiClient({ baseUrl: "https://api.example.org", fetch: fetchMock as unknown as typeof fetch });

    await client.controlstreams.list({ keyword: "ptz", datetime: "latest" });

    const [url] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.example.org/controlstreams?datetime=latest&q=ptz");
  });

  it("forSystem() lists control streams under a system", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => jsonResponse({ items: [], links: [] }));
    const client = new CSApiClient({ baseUrl: "https://api.example.org", fetch: fetchMock as unknown as typeof fetch });

    await client.controlstreams.forSystem("sys1", { q: ["ptz", "pan"], datetime: { end: "now" } });

    const [url] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.example.org/systems/sys1/controlstreams?q=ptz%2Cpan&datetime=..%2Fnow");
  });
});

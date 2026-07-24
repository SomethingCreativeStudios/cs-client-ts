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

  it("delete() forwards the Part 2 cascade query parameter", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(null, { status: 204 }));
    const client = new CSApiClient({ baseUrl: "https://api.example.org", fetch: fetchMock as unknown as typeof fetch });
    await client.controlstreams.delete("cs1", { cascade: true });
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.example.org/controlstreams/cs1?cascade=true");
  });

  it("createEncodedCommand() JSON-encodes SWE JSON records with their advertised media type", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(null, {
      status: 201,
      headers: { location: "https://api.example.org/commands/c1" },
    }));
    const client = new CSApiClient({ baseUrl: "https://api.example.org", fetch: fetchMock as unknown as typeof fetch });

    await client.controlstreams.createEncodedCommand("cs1", { pan: 10 }, "application/swe+json");

    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.example.org/controlstreams/cs1/commands");
    expect((fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string>)["content-type"]).toBe("application/swe+json");
    expect(fetchMock.mock.calls[0]?.[1]?.body).toBe('{"pan":10}');
  });
});

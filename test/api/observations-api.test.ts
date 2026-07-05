import { describe, expect, it, vi } from "vitest";
import { CSApiClient } from "../../src/api/client.js";

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" }, ...init });
}

describe("CSApiClient.observations", () => {
  it("list() maps deprecated datastream to the spec dataStream query parameter", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => jsonResponse({ items: [], links: [] }));
    const client = new CSApiClient({ baseUrl: "https://api.example.org", fetch: fetchMock as unknown as typeof fetch });

    await client.observations.list({ datastream: ["ds1"], observedProperty: ["temp"] });

    const [url] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.example.org/observations?observedProperty=temp&dataStream=ds1");
  });

  it("update() puts an observation by id", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(null, { status: 204 }));
    const client = new CSApiClient({ baseUrl: "https://api.example.org", fetch: fetchMock as unknown as typeof fetch });

    await client.observations.update("obs1", { resultTime: "2024-01-01T00:00:00Z", result: 42 });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.example.org/observations/obs1");
    expect(init?.method).toBe("PUT");
  });
});

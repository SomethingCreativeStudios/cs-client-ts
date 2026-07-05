import { describe, expect, it, vi } from "vitest";
import { CSApiClient } from "../../src/api/client.js";

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" }, ...init });
}

describe("CSApiClient.collections", () => {
  it("item() fetches a single collection item", async () => {
    const feature = { type: "Feature", id: "sys1", properties: {}, geometry: null };
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => jsonResponse(feature));
    const client = new CSApiClient({ baseUrl: "https://api.example.org", fetch: fetchMock as unknown as typeof fetch });

    const item = await client.collections.item("systems", "sys1");

    expect(item).toEqual(feature);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.example.org/collections/systems/items/sys1");
  });

  it("removeItem() removes an item association from a collection", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(null, { status: 204 }));
    const client = new CSApiClient({ baseUrl: "https://api.example.org", fetch: fetchMock as unknown as typeof fetch });

    await client.collections.removeItem("systems", "sys1");

    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.example.org/collections/systems/items/sys1");
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe("DELETE");
  });
});

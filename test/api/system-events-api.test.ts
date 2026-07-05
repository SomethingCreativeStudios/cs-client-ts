import { describe, expect, it, vi } from "vitest";
import { CSApiClient } from "../../src/api/client.js";

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" }, ...init });
}

const event = {
  id: "ev1",
  definition: "http://example.org/events/calibration",
  label: "Calibration",
  time: "2024-01-01T00:00:00Z",
};

describe("CSApiClient.systemEvents", () => {
  it("listGlobal() lists events across all systems and maps keyword to q", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => jsonResponse({ items: [], links: [] }));
    const client = new CSApiClient({ baseUrl: "https://api.example.org", fetch: fetchMock as unknown as typeof fetch });

    await client.systemEvents.listGlobal({ keyword: "calibration", system: ["sys1"] });

    const [url] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.example.org/systemEvents?system=sys1&q=calibration");
  });

  it("update() and delete() cover event item lifecycle operations", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(null, { status: 204 }));
    const client = new CSApiClient({ baseUrl: "https://api.example.org", fetch: fetchMock as unknown as typeof fetch });

    await client.systemEvents.update("sys1", "ev1", event);
    await client.systemEvents.delete("sys1", "ev1");

    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.example.org/systems/sys1/events/ev1");
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe("PUT");
    expect(fetchMock.mock.calls[1]?.[1]?.method).toBe("DELETE");
  });
});

describe("CSApiClient.systemHistory", () => {
  it("updateVersion() and deleteVersion() cover history revision lifecycle operations", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(null, { status: 204 }));
    const client = new CSApiClient({ baseUrl: "https://api.example.org", fetch: fetchMock as unknown as typeof fetch });

    await client.systemHistory.updateVersion("sys1", "rev1", {
      uniqueId: "urn:x:sys1",
      label: "System",
      featureType: "http://www.w3.org/ns/sosa/Sensor",
    });
    await client.systemHistory.deleteVersion("sys1", "rev1");

    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.example.org/systems/sys1/history/rev1");
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe("PUT");
    expect((fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string>)["content-type"]).toBe("application/sml+json");
    expect(fetchMock.mock.calls[1]?.[1]?.method).toBe("DELETE");
  });
});

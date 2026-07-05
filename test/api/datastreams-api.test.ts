import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { CSApiClient } from "../../src/api/client.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadFixture(...parts: string[]) {
  return JSON.parse(readFileSync(join(__dirname, "..", "fixtures", ...parts), "utf-8"));
}

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" }, ...init });
}

describe("CSApiClient.datastreams", () => {
  it("get() parses a datastream fixture", async () => {
    const fixture = loadFixture("resources", "datastream", "datastream.json");
    const fetchMock = vi.fn(async () => jsonResponse(fixture));
    const client = new CSApiClient({ baseUrl: "https://api.example.org", fetch: fetchMock as unknown as typeof fetch });

    const ds = await client.datastreams.get("7dogt5gs8949s");
    expect(ds.name).toContain("Wireless Link Status");
  });

  it("schema() requires obsFormat and sends it as a query param", async () => {
    const fixture = loadFixture("resources", "obsSchema", "observationSchema-scalar-json.json");
    const fetchMock = vi.fn(async (url: string) => {
      expect(url).toContain("obsFormat=application%2Fjson");
      return jsonResponse(fixture);
    });
    const client = new CSApiClient({ baseUrl: "https://api.example.org", fetch: fetchMock as unknown as typeof fetch });

    const schema = await client.datastreams.schema("958tf25kjm2f6", "application/json");
    expect(schema.obsFormat).toBe("application/json");
  });

  it("observations() paginates observation items", async () => {
    const obs = loadFixture("resources", "observation", "obs-simple.json");
    const fetchMock = vi.fn(async () => jsonResponse({ items: [obs], links: [] }));
    const client = new CSApiClient({ baseUrl: "https://api.example.org", fetch: fetchMock as unknown as typeof fetch });

    const page = await client.datastreams.observations("958tf25kjm2f6");
    expect(page.items).toHaveLength(1);
    expect(page.items[0]!.result).toBe(23.5);
  });

  it("createObservation() posts to the datastream's observations sub-resource", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      expect(url).toBe("https://api.example.org/datastreams/ds1/observations");
      return new Response(null, { status: 201, headers: { location: "https://api.example.org/observations/o1" } });
    });
    const client = new CSApiClient({ baseUrl: "https://api.example.org", fetch: fetchMock as unknown as typeof fetch });

    const id = await client.datastreams.createObservation("ds1", {
      resultTime: "2024-01-01T00:00:00Z",
      result: 42,
    });
    expect(id).toBe("o1");
  });

  it("list() maps deprecated keyword to the spec q query parameter", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => jsonResponse({ items: [], links: [] }));
    const client = new CSApiClient({ baseUrl: "https://api.example.org", fetch: fetchMock as unknown as typeof fetch });

    await client.datastreams.list({ keyword: ["temp", "gps"], datetime: "latest" });

    const [url] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.example.org/datastreams?datetime=latest&q=temp%2Cgps");
  });

  it("forSystem() lists datastreams under a system", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => jsonResponse({ items: [], links: [] }));
    const client = new CSApiClient({ baseUrl: "https://api.example.org", fetch: fetchMock as unknown as typeof fetch });

    await client.datastreams.forSystem("sys1", { q: ["live", "recent"], datetime: { start: "now" } });

    const [url] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.example.org/systems/sys1/datastreams?q=live%2Crecent&datetime=now%2F..");
  });
});

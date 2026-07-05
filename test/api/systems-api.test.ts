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

describe("CSApiClient.systems", () => {
  it("get({format:'geojson'}) sends the geo+json Accept header and returns the wire type", async () => {
    const fixture = loadFixture("geojson", "system", "thermometer-sensor-geojson.json");
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      expect((init!.headers as Record<string, string>).accept).toBe("application/geo+json");
      return jsonResponse(fixture);
    });
    const client = new CSApiClient({ baseUrl: "https://api.example.org", fetch: fetchMock as unknown as typeof fetch });

    const system = await client.systems.get("123", { format: "geojson" });
    expect(system.properties.uid).toBe("urn:x-ogc:systems:001");
  });

  it("get() sends the datetime query param when provided", async () => {
    const fixture = loadFixture("geojson", "system", "thermometer-sensor-geojson.json");
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => jsonResponse(fixture));
    const client = new CSApiClient({ baseUrl: "https://api.example.org", fetch: fetchMock as unknown as typeof fetch });

    await client.systems.get("123", { format: "geojson", datetime: "latest" });

    const [url] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.example.org/systems/123?datetime=latest");
  });

  it("get() with default format maps to the common model", async () => {
    const fixture = loadFixture("sensorml", "system", "physical_component.json");
    const fetchMock = vi.fn(async () => jsonResponse(fixture));
    const client = new CSApiClient({ baseUrl: "https://api.example.org", fetch: fetchMock as unknown as typeof fetch });

    const system = await client.systems.get("abc");
    expect(system.sourceEncoding).toBe("sml");
    expect(system.uniqueId).toBeTruthy();
  });

  it("list() paginates via rel=next and maps every item to the common model", async () => {
    const page1 = {
      items: [loadFixture("sensorml", "system", "physical_component.json")],
      links: [{ href: "https://api.example.org/systems?page=2", rel: "next" }],
    };
    const page2 = { items: [loadFixture("sensorml", "system", "weather_station_system.json")], links: [] };
    let call = 0;
    const fetchMock = vi.fn(async () => jsonResponse(call++ === 0 ? page1 : page2));
    const client = new CSApiClient({ baseUrl: "https://api.example.org", fetch: fetchMock as unknown as typeof fetch });

    const all: string[] = [];
    for await (const system of client.systems.listAll()) {
      all.push(system.uniqueId);
    }
    expect(all).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("delete() sends the cascade query param", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(null, { status: 204 }));
    const client = new CSApiClient({ baseUrl: "https://api.example.org", fetch: fetchMock as unknown as typeof fetch });

    await client.systems.delete("123", { cascade: true });

    const [url] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.example.org/systems/123?cascade=true");
  });

  it("create() extracts the id from the Location header and posts sml+json by default", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      expect((init!.headers as Record<string, string>)["content-type"]).toBe("application/sml+json");
      return new Response(null, { status: 201, headers: { location: "https://api.example.org/systems/new1" } });
    });
    const client = new CSApiClient({ baseUrl: "https://api.example.org", fetch: fetchMock as unknown as typeof fetch });

    const id = await client.systems.create({ uniqueId: "urn:x:1", label: "Test System", featureType: "http://www.w3.org/ns/sosa/Sensor" });
    expect(id).toBe("new1");
  });

  it("createMany() extracts ids from a batch response body", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse([
        { id: "client-1", status: 201, location: "https://api.example.org/systems/server-1" },
        { id: "client-2", status: 201, location: "https://api.example.org/systems/server-2" },
      ], { status: 201 }),
    );
    const client = new CSApiClient({ baseUrl: "https://api.example.org", fetch: fetchMock as unknown as typeof fetch });

    const ids = await client.systems.createMany([
      { uniqueId: "urn:x:1", label: "One", featureType: "http://www.w3.org/ns/sosa/Sensor" },
      { uniqueId: "urn:x:2", label: "Two", featureType: "http://www.w3.org/ns/sosa/Sensor" },
    ]);

    expect(ids).toEqual(["server-1", "server-2"]);
  });

  it("removeSubsystem() deletes only the parent association", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(null, { status: 204 }));
    const client = new CSApiClient({ baseUrl: "https://api.example.org", fetch: fetchMock as unknown as typeof fetch });

    await client.systems.removeSubsystem("parent1", "child1");

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.example.org/systems/parent1/subsystems/child1");
    expect(init?.method).toBe("DELETE");
  });
});

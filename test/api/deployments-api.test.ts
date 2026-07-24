import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { CSApiClient } from "../../src/api/client.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(readFileSync(join(__dirname, "..", "fixtures", "sensorml", "deployment", "deployment.json"), "utf-8"));

describe("CSApiClient.deployments", () => {
  it("list() serializes every Part 1 deployment filter", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify({ items: [fixture], links: [] }), { status: 200 }));
    const client = new CSApiClient({ baseUrl: "https://api.example.org", fetch: fetchMock as unknown as typeof fetch });

    await client.deployments.list({
      id: ["d1", "d2"], bbox: [-180, -90, 0, 180, 90, 1000], datetime: { start: "2026-01-01T00:00:00Z" },
      geom: "POINT(1 2)", q: ["river", "monitor"], parent: ["p1"], system: ["s1"], foi: ["f1"],
      observedProperty: ["temperature"], controlledProperty: ["heading"], recursive: true, limit: 100,
    });

    const url = new URL(fetchMock.mock.calls[0]![0]);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      id: "d1,d2", bbox: "-180,-90,0,180,90,1000", datetime: "2026-01-01T00:00:00Z/..",
      geom: "POINT(1 2)", q: "river,monitor", parent: "p1", system: "s1", foi: "f1",
      observedProperty: "temperature", controlledProperty: "heading", recursive: "true", limit: "100",
    });
  });

  it("createSubdeployment() posts SensorML at the parent subcollection", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      expect((init?.headers as Record<string, string>)["content-type"]).toBe("application/sml+json");
      return new Response(null, { status: 201, headers: { location: "/deployments/child" } });
    });
    const client = new CSApiClient({ baseUrl: "https://api.example.org", fetch: fetchMock as unknown as typeof fetch });

    await client.deployments.createSubdeployment("parent", { uniqueId: "urn:child", label: "Child", featureType: "deployment", validTime: ["2026-01-01T00:00:00Z", ".."] });

    expect(fetchMock.mock.calls[0]![0]).toBe("https://api.example.org/deployments/parent/subdeployments");
    expect(fetchMock.mock.calls[0]![1]?.method).toBe("POST");
  });
});

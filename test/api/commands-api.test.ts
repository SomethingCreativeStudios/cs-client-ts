import { describe, expect, it, vi } from "vitest";
import { CSApiClient } from "../../src/api/client.js";

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" }, ...init });
}

describe("CSApiClient.commands", () => {
  it("update() and delete() cover command-by-id lifecycle operations", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(null, { status: 204 }));
    const client = new CSApiClient({ baseUrl: "https://api.example.org", fetch: fetchMock as unknown as typeof fetch });

    await client.commands.update("cmd1", { parameters: { pan: 10 } });
    await client.commands.delete("cmd1");

    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.example.org/commands/cmd1");
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe("PUT");
    expect(fetchMock.mock.calls[1]?.[0]).toBe("https://api.example.org/commands/cmd1");
    expect(fetchMock.mock.calls[1]?.[1]?.method).toBe("DELETE");
  });

  it("covers status report item operations", async () => {
    const status = { id: "s1", "command@id": "cmd1", statusCode: "ACCEPTED" as const, reportTime: "2024-01-01T00:00:00Z" };
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/status?")) return jsonResponse({ items: [status], links: [] });
      if (init?.method === "GET" || init?.method === undefined) return jsonResponse(status);
      return new Response(null, { status: 204 });
    });
    const client = new CSApiClient({ baseUrl: "https://api.example.org", fetch: fetchMock as unknown as typeof fetch });

    await client.commands.status("cmd1", { reportTime: { start: "2024-01-01T00:00:00Z" } });
    await client.commands.getStatus("cmd1", "s1");
    await client.commands.updateStatus("cmd1", "s1", status);
    await client.commands.deleteStatus("cmd1", "s1");

    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.example.org/commands/cmd1/status?reportTime=2024-01-01T00%3A00%3A00Z%2F..");
    expect(fetchMock.mock.calls[1]?.[0]).toBe("https://api.example.org/commands/cmd1/status/s1");
    expect(fetchMock.mock.calls[2]?.[1]?.method).toBe("PUT");
    expect(fetchMock.mock.calls[3]?.[1]?.method).toBe("DELETE");
  });

  it("covers command result collection and item operations", async () => {
    const result = { id: "r1", "command@id": "cmd1", data: { accepted: true } };
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === "POST") return new Response(null, { status: 201, headers: { location: "https://api.example.org/commands/cmd1/result/r1" } });
      if (init?.method === "GET" || init?.method === undefined) return jsonResponse(result);
      return new Response(null, { status: 204 });
    });
    const client = new CSApiClient({ baseUrl: "https://api.example.org", fetch: fetchMock as unknown as typeof fetch });

    const id = await client.commands.addResult("cmd1", result);
    await client.commands.getResult("cmd1", "r1");
    await client.commands.updateResult("cmd1", "r1", result);
    await client.commands.deleteResult("cmd1", "r1");

    expect(id).toBe("r1");
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.example.org/commands/cmd1/result");
    expect(fetchMock.mock.calls[1]?.[0]).toBe("https://api.example.org/commands/cmd1/result/r1");
    expect(fetchMock.mock.calls[2]?.[1]?.method).toBe("PUT");
    expect(fetchMock.mock.calls[3]?.[1]?.method).toBe("DELETE");
  });
});

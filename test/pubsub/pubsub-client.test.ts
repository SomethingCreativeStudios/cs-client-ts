import { describe, expect, it, vi } from "vitest";
import { CSApiClient, CSPubSubClient, ValidationError, type PubSubTransport, type PubSubTransportMessageHandler } from "../../src/index.js";

class FakeTransport implements PubSubTransport {
  readonly subscriptions: Array<{ topic: string; handler: PubSubTransportMessageHandler; options: unknown; closed: boolean }> = [];
  readonly publishes: Array<{ topic: string; payload: string; options: unknown }> = [];
  closed = false;

  async subscribe(topic: string, handler: PubSubTransportMessageHandler, options?: unknown) {
    const entry = { topic, handler, options, closed: false };
    this.subscriptions.push(entry);
    return {
      close: async () => {
        entry.closed = true;
      },
    };
  }

  async publish(topic: string, payload: string, options?: unknown) {
    this.publishes.push({ topic, payload, options });
  }

  async close() {
    this.closed = true;
  }

  async emit(topic: string, payload: unknown) {
    for (const subscription of this.subscriptions.filter((entry) => entry.topic === topic && !entry.closed)) {
      await subscription.handler({ topic, payload: JSON.stringify(payload) });
    }
  }
}

const systemEvent = {
  id: "ev1",
  label: "Calibration",
  definition: "http://example.org/events/calibration",
  time: "2024-01-01T00:00:00Z",
};

const observation = {
  id: "obs1",
  "datastream@id": "ds1",
  resultTime: "2024-01-01T00:00:00Z",
  result: 23.5,
};

const command = {
  id: "cmd1",
  "controlstream@id": "cs1",
  issueTime: "2024-01-01T00:00:00Z",
  parameters: { pan: 10 },
};

const commandStatus = {
  id: "st1",
  "command@id": "cmd1",
  reportTime: "2024-01-01T00:00:00Z",
  statusCode: "ACCEPTED" as const,
};

describe("CSPubSubClient", () => {
  it("attaches to CSApiClient when configured", async () => {
    const transport = new FakeTransport();
    const client = new CSApiClient({
      baseUrl: "https://api.example.org",
      fetch: vi.fn() as unknown as typeof fetch,
      pubsub: { transport },
    });

    await client.pubsub?.close();

    expect(client.pubsub).toBeInstanceOf(CSPubSubClient);
    expect(transport.closed).toBe(true);
  });

  it("uses AsyncAPI channel topics for resource subscriptions", async () => {
    const transport = new FakeTransport();
    const client = new CSPubSubClient({ transport });

    await client.systemEvents.subscribe("sys1");
    await client.systemEvents.subscribeAll();
    await client.observations.subscribe("ds1");
    await client.commands.subscribe("cs1");
    await client.commandStatus.subscribe("cs1", "cmd1");

    expect(transport.subscriptions.map((subscription) => subscription.topic)).toEqual([
      "systems/sys1/events",
      "systems/events",
      "datastreams/ds1/observations",
      "controls/cs1/commands",
      "controls/cs1/commands/cmd1/status",
    ]);
  });

  it("allows topic factory and per-call topic overrides", async () => {
    const transport = new FakeTransport();
    const client = new CSPubSubClient({
      transport,
      topicFactory: {
        allSystemEvents: () => "systems/+/events",
        observations: (id) => `tenant/a/datastreams/${id}/observations`,
      },
    });

    await client.systemEvents.subscribeAll();
    await client.observations.subscribe("ds1", undefined, { topic: "custom/observations" });

    expect(transport.subscriptions.map((subscription) => subscription.topic)).toEqual(["systems/+/events", "custom/observations"]);
  });

  it("publishes JSON payloads with channel content types", async () => {
    const transport = new FakeTransport();
    const client = new CSPubSubClient({ transport });

    await client.systemEvents.publish("sys1", systemEvent, { qos: 1 });
    await client.observations.publish("ds1", { resultTime: "2024-01-01T00:00:00Z", result: 24 });
    await client.commands.publish("cs1", { parameters: { pan: 12 } });
    await client.commandStatus.publish("cs1", "cmd1", commandStatus);

    expect(transport.publishes.map((publish) => publish.topic)).toEqual([
      "systems/sys1/events",
      "datastreams/ds1/observations",
      "controls/cs1/commands",
      "controls/cs1/commands/cmd1/status",
    ]);
    expect(JSON.parse(transport.publishes[0]!.payload)).toEqual(systemEvent);
    expect(transport.publishes.map((publish) => (publish.options as { contentType?: string }).contentType)).toEqual([
      "application/sml+json",
      "application/om+json",
      "application/cmd+json",
      "application/cmd+json",
    ]);
  });

  it("delivers validated payloads to handlers and async iterators", async () => {
    const transport = new FakeTransport();
    const client = new CSPubSubClient({ transport });
    const next = vi.fn();
    const messages = vi.fn();

    const sub = await client.observations.subscribe("ds1", { next, message: messages });
    const iterator = sub[Symbol.asyncIterator]();

    await transport.emit("datastreams/ds1/observations", observation);

    expect(next).toHaveBeenCalledWith(observation, expect.objectContaining({ payload: observation }));
    expect(messages).toHaveBeenCalledWith(expect.objectContaining({ topic: "datastreams/ds1/observations", payload: observation }));
    await expect(iterator.next()).resolves.toEqual({
      done: false,
      value: expect.objectContaining({ payload: observation }),
    });
  });

  it("closes subscriptions and completes pending iterators", async () => {
    const transport = new FakeTransport();
    const client = new CSPubSubClient({ transport });
    const complete = vi.fn();
    const sub = await client.commands.subscribe("cs1", { complete });
    const iterator = sub[Symbol.asyncIterator]();
    const pending = iterator.next();

    await sub.close();
    await transport.emit("controls/cs1/commands", command);

    await expect(pending).resolves.toEqual({ done: true, value: undefined });
    expect(transport.subscriptions[0]!.closed).toBe(true);
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it("reports invalid messages without interrupting other subscriptions", async () => {
    const transport = new FakeTransport();
    const client = new CSPubSubClient({ transport });
    const errors = vi.fn();
    const valid = vi.fn();

    await client.observations.subscribe("ds1", { error: errors });
    await client.commands.subscribe("cs1", { next: valid });

    await transport.emit("datastreams/ds1/observations", { id: "obs1", resultTime: "2024-01-01T00:00:00Z", result: 5 });
    await transport.emit("controls/cs1/commands", command);

    expect(errors).toHaveBeenCalledWith(expect.any(ValidationError));
    expect(valid).toHaveBeenCalledWith(command, expect.objectContaining({ payload: command }));
  });
});

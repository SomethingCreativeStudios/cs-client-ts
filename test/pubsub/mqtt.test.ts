import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { createMqttTransport } from "../../src/mqtt.js";

class MockMqttClient extends EventEmitter {
  connected = false;

  subscribe = vi.fn((_topic: string, _options: unknown, callback: (error?: Error) => void) => {
    callback();
    return this;
  });

  publish = vi.fn((_topic: string, _payload: string, _options: unknown, callback: (error?: Error) => void) => {
    callback();
    return this;
  });

  unsubscribe = vi.fn((_topic: string, callback: (error?: Error) => void) => {
    callback();
    return this;
  });

  end = vi.fn((_force: boolean, callback: () => void) => {
    callback();
    return this;
  });

  connectNow() {
    this.connected = true;
    this.emit("connect");
  }

  emitMessage(topic: string, payload: string, packet: unknown = {}) {
    this.emit("message", topic, Buffer.from(payload), packet);
  }
}

describe("createMqttTransport", () => {
  it("lazy-connects, subscribes with topic prefixes, filters wildcard topics, and unsubscribes", async () => {
    const mqttClient = new MockMqttClient();
    const connectMock = vi.fn(() => mqttClient as never);
    const transport = createMqttTransport({
      url: "wss://broker.example.org/mqtt",
      topicPrefix: "tenant/a",
      connect: connectMock,
    });
    const handler = vi.fn();

    const subscriptionPromise = transport.subscribe("systems/+/events", handler, { qos: 1 });
    expect(connectMock).toHaveBeenCalledWith("wss://broker.example.org/mqtt", undefined);

    mqttClient.connectNow();
    const subscription = await subscriptionPromise;

    expect(mqttClient.subscribe).toHaveBeenCalledWith("tenant/a/systems/+/events", { qos: 1 }, expect.any(Function));

    mqttClient.emitMessage("tenant/a/systems/sys1/events", JSON.stringify({ ok: true }), {
      qos: 1,
      retain: false,
      properties: { contentType: "application/json" },
    });
    mqttClient.emitMessage("tenant/a/datastreams/ds1/observations", JSON.stringify({ ignored: true }));

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: "systems/sys1/events",
        contentType: "application/json",
        meta: expect.objectContaining({ qos: 1, retain: false, transportTopic: "tenant/a/systems/sys1/events" }),
      }),
    );

    await subscription.close();

    expect(mqttClient.unsubscribe).toHaveBeenCalledWith("tenant/a/systems/+/events", expect.any(Function));
  });

  it("reuses one connection, publishes content type properties, and closes the shared connection", async () => {
    const mqttClient = new MockMqttClient();
    const connectMock = vi.fn(() => mqttClient as never);
    const transport = createMqttTransport({ url: "wss://broker.example.org/mqtt", connect: connectMock });

    const publishPromise = transport.publish("datastreams/ds1/observations", JSON.stringify({ result: 1 }), {
      qos: 1,
      retain: true,
      contentType: "application/om+json",
    });
    mqttClient.connectNow();
    await publishPromise;
    await transport.publish("controls/cs1/commands", JSON.stringify({ parameters: {} }), { contentType: "application/cmd+json" });
    await transport.close?.();

    expect(connectMock).toHaveBeenCalledTimes(1);
    expect(mqttClient.publish).toHaveBeenNthCalledWith(
      1,
      "datastreams/ds1/observations",
      JSON.stringify({ result: 1 }),
      expect.objectContaining({
        qos: 1,
        retain: true,
        properties: { contentType: "application/om+json" },
      }),
      expect.any(Function),
    );
    expect(mqttClient.publish).toHaveBeenNthCalledWith(
      2,
      "controls/cs1/commands",
      JSON.stringify({ parameters: {} }),
      expect.objectContaining({ properties: { contentType: "application/cmd+json" } }),
      expect.any(Function),
    );
    expect(mqttClient.end).toHaveBeenCalledWith(false, expect.any(Function));
  });

  it("keeps shared MQTT topic subscriptions until the last local subscription closes", async () => {
    const mqttClient = new MockMqttClient();
    const transport = createMqttTransport({ url: "wss://broker.example.org/mqtt", connect: vi.fn(() => mqttClient as never) });

    const firstPromise = transport.subscribe("systems/events", vi.fn());
    mqttClient.connectNow();
    const first = await firstPromise;
    const second = await transport.subscribe("systems/events", vi.fn());

    await first.close();
    expect(mqttClient.unsubscribe).not.toHaveBeenCalled();

    await second.close();
    expect(mqttClient.unsubscribe).toHaveBeenCalledWith("systems/events", expect.any(Function));
  });
});

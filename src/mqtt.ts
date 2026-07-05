import { connect, type IClientOptions, type IClientPublishOptions, type IClientSubscribeOptions, type MqttClient } from "mqtt";
import { PubSubError } from "./pubsub/types.js";
import type {
  PubSubPayload,
  PubSubPublishOptions,
  PubSubSubscribeOptions,
  PubSubTransport,
  PubSubTransportMessage,
  PubSubTransportMessageHandler,
  PubSubTransportSubscription,
} from "./pubsub/types.js";

type MqttConnect = (url: string, options?: IClientOptions) => MqttClient;

export interface MqttTransportOptions {
  url: string;
  clientOptions?: IClientOptions;
  topicPrefix?: string;
  connect?: MqttConnect;
}

function normalizeTopicPrefix(prefix: string | undefined): string | undefined {
  const normalized = prefix?.replace(/^\/+|\/+$/g, "");
  return normalized ? normalized : undefined;
}

function applyTopicPrefix(topic: string, prefix: string | undefined): string {
  return prefix ? `${prefix}/${topic}` : topic;
}

function stripTopicPrefix(topic: string, prefix: string | undefined): string {
  if (!prefix) return topic;
  return topic === prefix ? "" : topic.startsWith(`${prefix}/`) ? topic.slice(prefix.length + 1) : topic;
}

function mqttTopicMatches(filter: string, topic: string): boolean {
  const filterParts = filter.split("/");
  const topicParts = topic.split("/");

  for (let i = 0; i < filterParts.length; i += 1) {
    const filterPart = filterParts[i];
    const topicPart = topicParts[i];

    if (filterPart === "#") return i === filterParts.length - 1;
    if (topicPart === undefined) return false;
    if (filterPart === "+") continue;
    if (filterPart !== topicPart) return false;
  }

  return filterParts.length === topicParts.length;
}

function payloadForMqtt(payload: PubSubPayload): string {
  if (typeof payload === "string") return payload;
  if (payload instanceof ArrayBuffer) return new TextDecoder().decode(new Uint8Array(payload));
  return new TextDecoder().decode(payload);
}

function mqttSubscribeOptions(options: PubSubSubscribeOptions | undefined): IClientSubscribeOptions {
  const { topic: _topic, qos = 0, ...rest } = options ?? {};
  return { ...rest, qos } as IClientSubscribeOptions;
}

function mqttPublishOptions(options: PubSubPublishOptions | undefined): IClientPublishOptions {
  const { topic: _topic, contentType, properties, ...rest } = (options ?? {}) as PubSubPublishOptions & {
    properties?: Record<string, unknown>;
  };
  const nextProperties = contentType ? { ...properties, contentType } : properties;
  return {
    ...rest,
    ...(nextProperties ? { properties: nextProperties } : {}),
  } as IClientPublishOptions;
}

export function createMqttTransport(options: MqttTransportOptions): PubSubTransport {
  const topicPrefix = normalizeTopicPrefix(options.topicPrefix);
  const connectMqtt = options.connect ?? connect;
  let client: MqttClient | undefined;
  let connectPromise: Promise<MqttClient> | undefined;
  const topicRefs = new Map<string, number>();

  async function ensureClient(): Promise<MqttClient> {
    if (client?.connected) return client;
    if (connectPromise) return connectPromise;

    const mqttClient = connectMqtt(options.url, options.clientOptions);
    client = mqttClient;

    connectPromise = new Promise<MqttClient>((resolve, reject) => {
      const cleanup = () => {
        mqttClient.off("connect", handleConnect);
        mqttClient.off("error", handleError);
      };
      const handleConnect = () => {
        cleanup();
        resolve(mqttClient);
      };
      const handleError = (error: Error) => {
        cleanup();
        reject(new PubSubError(`MQTT connection to ${options.url} failed`, undefined, error));
      };

      mqttClient.once("connect", handleConnect);
      mqttClient.once("error", handleError);
    });

    try {
      return await connectPromise;
    } catch (error) {
      if (client === mqttClient) client = undefined;
      throw error;
    } finally {
      connectPromise = undefined;
    }
  }

  async function subscribe(
    topic: string,
    handler: PubSubTransportMessageHandler,
    subscribeOptions?: PubSubSubscribeOptions,
  ): Promise<PubSubTransportSubscription> {
    const mqttClient = await ensureClient();
    const fullTopic = applyTopicPrefix(topic, topicPrefix);

    await new Promise<void>((resolve, reject) => {
      mqttClient.subscribe(fullTopic, mqttSubscribeOptions(subscribeOptions), (error) => {
        if (error) {
          reject(new PubSubError(`MQTT subscribe to ${fullTopic} failed`, topic, error));
          return;
        }
        topicRefs.set(fullTopic, (topicRefs.get(fullTopic) ?? 0) + 1);
        resolve();
      });
    });

    const onMessage = (incomingTopic: string, payload: Buffer, packet: { qos?: 0 | 1 | 2; retain?: boolean; properties?: { contentType?: string } }) => {
      if (!mqttTopicMatches(fullTopic, incomingTopic)) return;
      const message: PubSubTransportMessage = {
        topic: stripTopicPrefix(incomingTopic, topicPrefix),
        payload,
        contentType: packet.properties?.contentType,
        meta: {
          qos: packet.qos,
          retain: packet.retain,
          transportTopic: incomingTopic,
        },
      };
      void handler(message);
    };

    mqttClient.on("message", onMessage);

    return {
      close: async () => {
        mqttClient.off("message", onMessage);
        const nextCount = (topicRefs.get(fullTopic) ?? 1) - 1;
        if (nextCount > 0) {
          topicRefs.set(fullTopic, nextCount);
          return;
        }
        topicRefs.delete(fullTopic);
        await new Promise<void>((resolve, reject) => {
          mqttClient.unsubscribe(fullTopic, (error) => {
            if (error) {
              reject(new PubSubError(`MQTT unsubscribe from ${fullTopic} failed`, topic, error));
              return;
            }
            resolve();
          });
        });
      },
    };
  }

  async function publish(topic: string, payload: PubSubPayload, publishOptions?: PubSubPublishOptions): Promise<void> {
    const mqttClient = await ensureClient();
    const fullTopic = applyTopicPrefix(topic, topicPrefix);
    await new Promise<void>((resolve, reject) => {
      mqttClient.publish(fullTopic, payloadForMqtt(payload), mqttPublishOptions(publishOptions), (error) => {
        if (error) {
          reject(new PubSubError(`MQTT publish to ${fullTopic} failed`, topic, error));
          return;
        }
        resolve();
      });
    });
  }

  async function close(): Promise<void> {
    if (!client) return;
    const mqttClient = client;
    client = undefined;
    connectPromise = undefined;
    topicRefs.clear();
    await new Promise<void>((resolve) => {
      mqttClient.end(false, () => resolve());
    });
  }

  return { subscribe, publish, close };
}

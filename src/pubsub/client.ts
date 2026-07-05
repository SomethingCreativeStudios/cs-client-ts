import type { z } from "zod";
import { MediaTypes } from "../http/media-types.js";
import { CommandCreateSchema, CommandSchema, CommandStatusCreateSchema, CommandStatusSchema } from "../models/resources/command.js";
import type { Command, CommandCreate, CommandStatus, CommandStatusCreate } from "../models/resources/command.js";
import { ObservationCreateSchema, ObservationSchema } from "../models/resources/observation.js";
import type { Observation, ObservationCreate } from "../models/resources/observation.js";
import { SystemEventSchema, type SystemEvent } from "../models/resources/system-event.js";
import { createJsonSubscription, publishJson } from "./json.js";
import { createTopicFactory, type CSPubSubTopicFactory } from "./topics.js";
import type { CsSubscription, CsSubscriptionHandlers, PubSubPublishOptions, PubSubSubscribeOptions, PubSubTransport } from "./types.js";

export interface CSPubSubClientOptions {
  transport: PubSubTransport;
  topicFactory?: Partial<CSPubSubTopicFactory>;
  validateMessages?: boolean;
}

class BasePubSubApi {
  constructor(protected readonly client: CSPubSubClient) {}

  protected subscribeJson<T>(
    topic: string,
    schema: z.ZodType<T>,
    resourceName: string,
    contentType: string,
    handlers?: CsSubscriptionHandlers<T>,
    options?: PubSubSubscribeOptions,
  ): Promise<CsSubscription<T>> {
    return createJsonSubscription({
      transport: this.client.transport,
      topic: options?.topic ?? topic,
      schema,
      resourceName,
      contentType,
      handlers,
      options,
      validateMessages: this.client.validateMessages,
    });
  }

  protected publishJson<T>(
    topic: string,
    payload: T,
    schema: z.ZodType<T>,
    resourceName: string,
    contentType: string,
    options?: PubSubPublishOptions,
  ): Promise<void> {
    return publishJson(this.client.transport, options?.topic ?? topic, payload, schema, resourceName, contentType, options);
  }
}

export class SystemEventsPubSubApi extends BasePubSubApi {
  subscribe(
    systemId: string,
    handlers?: CsSubscriptionHandlers<SystemEvent>,
    options?: PubSubSubscribeOptions,
  ): Promise<CsSubscription<SystemEvent>> {
    return this.subscribeJson(
      this.client.topicFactory.systemEvents(systemId),
      SystemEventSchema,
      "SystemEvent",
      MediaTypes.smlJson,
      handlers,
      options,
    );
  }

  subscribeAll(
    handlers?: CsSubscriptionHandlers<SystemEvent>,
    options?: PubSubSubscribeOptions,
  ): Promise<CsSubscription<SystemEvent>> {
    return this.subscribeJson(
      this.client.topicFactory.allSystemEvents(),
      SystemEventSchema,
      "SystemEvent",
      MediaTypes.smlJson,
      handlers,
      options,
    );
  }

  publish(systemId: string, event: SystemEvent, options?: PubSubPublishOptions): Promise<void> {
    return this.publishJson(
      this.client.topicFactory.systemEvents(systemId),
      event,
      SystemEventSchema,
      "SystemEvent",
      MediaTypes.smlJson,
      options,
    );
  }
}

export class ObservationsPubSubApi extends BasePubSubApi {
  subscribe(
    dataStreamId: string,
    handlers?: CsSubscriptionHandlers<Observation>,
    options?: PubSubSubscribeOptions,
  ): Promise<CsSubscription<Observation>> {
    return this.subscribeJson(
      this.client.topicFactory.observations(dataStreamId),
      ObservationSchema,
      "Observation",
      MediaTypes.omJson,
      handlers,
      options,
    );
  }

  publish(dataStreamId: string, observation: ObservationCreate, options?: PubSubPublishOptions): Promise<void> {
    return this.publishJson(
      this.client.topicFactory.observations(dataStreamId),
      observation,
      ObservationCreateSchema,
      "Observation",
      MediaTypes.omJson,
      options,
    );
  }
}

export class CommandsPubSubApi extends BasePubSubApi {
  subscribe(
    controlStreamId: string,
    handlers?: CsSubscriptionHandlers<Command>,
    options?: PubSubSubscribeOptions,
  ): Promise<CsSubscription<Command>> {
    return this.subscribeJson(
      this.client.topicFactory.commands(controlStreamId),
      CommandSchema,
      "Command",
      MediaTypes.cmdJson,
      handlers,
      options,
    );
  }

  publish(controlStreamId: string, command: CommandCreate, options?: PubSubPublishOptions): Promise<void> {
    return this.publishJson(
      this.client.topicFactory.commands(controlStreamId),
      command,
      CommandCreateSchema,
      "Command",
      MediaTypes.cmdJson,
      options,
    );
  }
}

export class CommandStatusPubSubApi extends BasePubSubApi {
  subscribe(
    controlStreamId: string,
    commandId: string,
    handlers?: CsSubscriptionHandlers<CommandStatus>,
    options?: PubSubSubscribeOptions,
  ): Promise<CsSubscription<CommandStatus>> {
    return this.subscribeJson(
      this.client.topicFactory.commandStatus(controlStreamId, commandId),
      CommandStatusSchema,
      "CommandStatus",
      MediaTypes.cmdJson,
      handlers,
      options,
    );
  }

  publish(
    controlStreamId: string,
    commandId: string,
    status: CommandStatusCreate,
    options?: PubSubPublishOptions,
  ): Promise<void> {
    return this.publishJson(
      this.client.topicFactory.commandStatus(controlStreamId, commandId),
      status,
      CommandStatusCreateSchema,
      "CommandStatus",
      MediaTypes.cmdJson,
      options,
    );
  }
}

export class CSPubSubClient {
  readonly transport: PubSubTransport;
  readonly topicFactory: CSPubSubTopicFactory;
  readonly validateMessages: boolean;

  readonly systemEvents: SystemEventsPubSubApi;
  readonly observations: ObservationsPubSubApi;
  readonly commands: CommandsPubSubApi;
  readonly commandStatus: CommandStatusPubSubApi;

  constructor(options: CSPubSubClientOptions) {
    this.transport = options.transport;
    this.topicFactory = createTopicFactory(options.topicFactory);
    this.validateMessages = options.validateMessages ?? true;

    this.systemEvents = new SystemEventsPubSubApi(this);
    this.observations = new ObservationsPubSubApi(this);
    this.commands = new CommandsPubSubApi(this);
    this.commandStatus = new CommandStatusPubSubApi(this);
  }

  async close(): Promise<void> {
    await this.transport.close?.();
  }
}

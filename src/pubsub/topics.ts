export interface CSPubSubTopicFactory {
  systemEvents(systemId: string): string;
  allSystemEvents(): string;
  observations(dataStreamId: string): string;
  commands(controlStreamId: string): string;
  commandStatus(controlStreamId: string, commandId: string): string;
}

export const defaultTopicFactory: CSPubSubTopicFactory = {
  systemEvents: (systemId) => `systems/${systemId}/events`,
  allSystemEvents: () => "systems/events",
  observations: (dataStreamId) => `datastreams/${dataStreamId}/observations`,
  commands: (controlStreamId) => `controls/${controlStreamId}/commands`,
  commandStatus: (controlStreamId, commandId) => `controls/${controlStreamId}/commands/${commandId}/status`,
};

export function createTopicFactory(overrides: Partial<CSPubSubTopicFactory> | undefined): CSPubSubTopicFactory {
  return { ...defaultTopicFactory, ...overrides };
}

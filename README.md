# cs-api-client

A TypeScript client for [OGC API — Connected Systems](https://ogcapi.ogc.org/connectedsystems/) Part 1 (systems, procedures, deployments, sampling features, properties, collections) and Part 2 (datastreams, observations, control streams, commands, system events/history).

- Fully typed models for every resource, in every encoding it supports (GeoJSON, SensorML-JSON, and Part 2 JSON), validated at runtime with [Zod](https://zod.dev).
- A **common model** per resource (`System`, `Procedure`, `Deployment`, ...) that is encoding-independent: fetch a System as SensorML or GeoJSON and get the same TypeScript shape back, with fields absent from the source encoding simply left `undefined`.
- One client, grouped by resource: `client.systems`, `client.datastreams.observations(id)`, etc. — plain data in, plain data out, no smart/stateful resource objects.

## Install

```sh
npm install cs-api-client
```

Requires Node 18+ (uses the global `fetch`).

MQTT and RxJS integrations are optional peers. Install them only if you use the async pub/sub adapters:

```sh
npm install mqtt rxjs
```

## Quick start

```ts
import { CSApiClient } from "cs-api-client";

const client = new CSApiClient({ baseUrl: "https://data.example.org/api" });

// Default format ("common") fetches the richest encoding (SensorML for System/Procedure/
// Deployment/Property, GeoJSON for SamplingFeature) and maps it to the shared model.
const system = await client.systems.get("abc123");
console.log(system.uniqueId, system.label, system.inputs);

// Ask for a specific wire encoding instead — return type narrows accordingly.
const geo = await client.systems.get("abc123", { format: "geojson" });
console.log(geo.geometry, geo.properties.assetType);

const sml = await client.systems.get("abc123", { format: "sml" });
console.log(sml.characteristics);
```

## Listing & pagination

```ts
const page = await client.systems.list({ bbox: [-10, 40, 10, 60], limit: 50 });
console.log(page.items, page.links);

// Or drain every page automatically:
for await (const system of client.systems.listAll({ q: "weather" })) {
  console.log(system.label);
}
```

## Creating & updating

```ts
const id = await client.systems.create({
  uniqueId: "urn:x-example:systems:001",
  label: "Outdoor Thermometer",
  featureType: "http://www.w3.org/ns/sosa/Sensor",
  assetType: "Equipment",
}, { format: "geojson" });

await client.systems.update(id, { ...updatedFields }, { format: "geojson" });
await client.systems.delete(id, { cascade: true });
```

Common-model fields with no representation in the target encoding are dropped on write (documented lossy behavior) — write with the same format a resource was read in to avoid surprises.

## Sub-resources

```ts
const subsystems = await client.systems.subsystems(systemId);
const deployments = await client.systems.deployments(systemId);
const samplingFeatures = await client.systems.samplingFeatures(systemId);

const datastreams = await client.datastreams.list({ system: [systemId] });
const observations = await client.datastreams.observations(dsId, { phenomenonTime: { start: "2024-01-01T00:00:00Z" } });

const controlStreams = await client.controlstreams.list({ system: [systemId] });
const commands = await client.controlstreams.commands(csId);
const status = await client.commands.status(commandId);
```

## Part 2: datastreams & observations

Observation `result` shape is defined by the datastream's schema, fetched separately:

```ts
const schema = await client.datastreams.schema(dsId, "application/json"); // obsFormat is required
console.log(schema.resultSchema); // SWE Common AnyComponent describing the result

const obsId = await client.datastreams.createObservation(dsId, {
  resultTime: new Date().toISOString(),
  result: 21.4,
});
```

Only `application/json` (OM-JSON) and `application/swe+json` result/command payloads are decoded today; SWE-Text/CSV/Binary and Protobuf schemas parse structurally but their result bodies are treated as opaque (`unknown`).

## Part 2: async pub/sub

The async client follows the Part 2 AsyncAPI channel topics and starts with MQTT over WebSocket for frontend apps:

```ts
import { CSApiClient } from "cs-api-client";
import { createMqttTransport } from "cs-api-client/mqtt";

const client = new CSApiClient({
  baseUrl: "https://data.example.org/api",
  pubsub: {
    transport: createMqttTransport({
      url: "wss://broker.example.org/mqtt",
      clientOptions: { username: "user", password: "token" },
    }),
  },
});

const sub = await client.pubsub!.observations.subscribe("ds1", {
  next: (obs) => console.log(obs.resultTime, obs.result),
  error: console.error,
});

await client.pubsub!.commands.publish("control1", {
  parameters: { pan: 10, tilt: 5 },
});

await sub.close();
await client.pubsub!.close();
```

Available channels:

```ts
client.pubsub!.systemEvents.subscribe(systemId);
client.pubsub!.systemEvents.subscribeAll();
client.pubsub!.systemEvents.publish(systemId, event);
client.pubsub!.observations.subscribe(dataStreamId);
client.pubsub!.observations.publish(dataStreamId, observation);
client.pubsub!.commands.subscribe(controlStreamId);
client.pubsub!.commands.publish(controlStreamId, command);
client.pubsub!.commandStatus.subscribe(controlStreamId, commandId);
client.pubsub!.commandStatus.publish(controlStreamId, commandId, status);
```

Topic defaults match the AsyncAPI file exactly (`systems/{systemId}/events`, `systems/events`, `datastreams/{dataStreamId}/observations`, `controls/{controlStreamId}/commands`, and `controls/{controlStreamId}/commands/{cmdId}/status`). Override `topicFactory` or pass `{ topic }` per call for broker-specific layouts, including MQTT wildcards:

```ts
const client = new CSApiClient({
  baseUrl,
  pubsub: {
    transport: createMqttTransport({ url: "wss://broker.example.org/mqtt" }),
    topicFactory: {
      allSystemEvents: () => "systems/+/events",
    },
  },
});
```

RxJS stays optional:

```ts
import { toObservable } from "cs-api-client/rxjs";

const observations$ = toObservable(() => client.pubsub!.observations.subscribe("ds1"));
const rxSub = observations$.subscribe((obs) => console.log(obs.result));
rxSub.unsubscribe(); // closes the underlying CS subscription
```

## Error handling

```ts
import { HttpError, NotFoundError, PubSubError, ValidationError } from "cs-api-client";

try {
  await client.systems.get("missing");
} catch (err) {
  if (err instanceof NotFoundError) { /* 404 */ }
  else if (err instanceof HttpError) { /* other non-2xx, err.problem has the problem+json body if any */ }
  else if (err instanceof ValidationError) { /* response didn't match the expected schema, err.zodError has details */ }
  else if (err instanceof PubSubError) { /* pub/sub connection, parse, subscribe, or publish failure */ }
}
```

## Auth, hooks & custom fetch

```ts
const client = new CSApiClient({
  baseUrl: "https://data.example.org/api",
  auth: { type: "bearer", token: async () => getToken() },
  fetch: myFetchImplementation, // for testing, polyfills, proxies, etc.
});
```

Built-in auth helpers:

```ts
// Reuse an app-managed token
new CSApiClient({
  baseUrl,
  auth: { type: "bearer", token: () => authStore.accessToken },
});

// Basic auth
new CSApiClient({
  baseUrl,
  auth: { type: "basic", username: "user", password: "pass" },
});

// OAuth token refresh. `expiresAt` is epoch milliseconds.
new CSApiClient({
  baseUrl,
  auth: {
    type: "oauth2",
    token: () => authStore.token,
    refresh: (token) => refreshOAuthToken(token?.refreshToken),
    setToken: (token) => authStore.save(token),
    refreshBeforeExpiresIn: 60,
  },
});
```

Hooks are async-capable and run for every request:

```ts
new CSApiClient({
  baseUrl,
  hooks: {
    beforeRequest: ({ init }) => {
      (init.headers as Record<string, string>)["x-trace-id"] = traceId();
    },
    afterResponse: ({ response }) => {
      if (response.status === 401) notifyAuthLayer();
    },
    onError: ({ error }) => {
      reportClientError(error);
    },
  },
});
```

`afterResponse` receives a cloned `Response`, so it can inspect the body without consuming the client parser. For OAuth, the client refreshes before expiry and retries once after a 401 unless `retryOnUnauthorized: false`.

## Project layout

```
src/
├── models/
│   ├── common/    # Link, TimePeriod, Geometry, well-known URIs
│   ├── swe/       # SWE Common data components (the AnyComponent recursion knot)
│   ├── sensorml/  # SensorML wire encodings and shared SensorML building blocks
│   ├── geojson/   # GeoJSON wire encodings
│   └── resources/ # CS API resources: System, DataStream, Command, Observation, ...
├── codec/         # @link/@id ↔ camelCase key mapping, wire ↔ common model mappers
├── http/          # fetch wrapper, errors, query serialization, pagination
├── pubsub/        # transport-neutral Part 2 async subscriptions and publishers
└── api/           # Per-resource endpoint classes + CSApiClient
```

## Development

```sh
npm test        # vitest, includes fixture-parsing tests against real spec examples
npm run typecheck
npm run build
```

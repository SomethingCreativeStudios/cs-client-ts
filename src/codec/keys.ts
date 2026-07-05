/**
 * The CS API spec uses `@link`/`@id` suffixed property names (`system@link`,
 * `datastream@id`) to mark association references — not valid, ergonomic
 * TypeScript identifiers. This module renames them to camelCase on the way in
 * (`toCamelKeys`) and back to wire form on the way out (`toWireKeys`).
 *
 * The rename table is a closed, spec-derived set (grepped from every model file),
 * not a blind regex transform — so it never touches user-defined field names that
 * happen to contain "@" inside SWE Common data structures (DataRecord field names,
 * `parameters`, `result`, `schema`, etc). Callers apply these functions only at the
 * known association-bearing levels (resource root, GeoJSON `properties`), never
 * recursively into arbitrary component trees.
 */

export const WIRE_TO_CAMEL: Readonly<Record<string, string>> = {
  "system@link": "systemLink",
  "systemKind@link": "systemKindLink",
  "procedure@link": "procedureLink",
  "deployment@link": "deploymentLink",
  "featureOfInterest@link": "featureOfInterestLink",
  "samplingFeature@link": "samplingFeatureLink",
  "sampledFeature@link": "sampledFeatureLink",
  "platform@link": "platformLink",
  "deployedSystems@link": "deployedSystemsLink",
  "result@link": "resultLink",
  "datastream@link": "datastreamLink",
  "observation@link": "observationLink",
  "observationSet@link": "observationSetLink",
  "external@link": "externalLink",
  "datastream@id": "datastreamId",
  "controlstream@id": "controlstreamId",
  "samplingFeature@id": "samplingFeatureId",
  "command@id": "commandId",
};

export const CAMEL_TO_WIRE: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(WIRE_TO_CAMEL).map(([wire, camel]) => [camel, wire]),
);

function renameKeys(obj: unknown, table: Readonly<Record<string, string>>): unknown {
  if (obj === null || typeof obj !== "object" || Array.isArray(obj)) return obj;
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const targetKey = table[key] ?? key;
    if (targetKey in result) {
      throw new Error(`Key mapping collision: both "${key}" and another key map to "${targetKey}"`);
    }
    result[targetKey] = value;
  }
  return result;
}

/** Rename known `@link`/`@id` wire keys to camelCase, at a single object level (shallow). */
export function toCamelKeys<T = unknown>(obj: unknown): T {
  return renameKeys(obj, WIRE_TO_CAMEL) as T;
}

/** Rename known camelCase keys back to their `@link`/`@id` wire form, at a single object level (shallow). */
export function toWireKeys<T = unknown>(obj: unknown): T {
  return renameKeys(obj, CAMEL_TO_WIRE) as T;
}

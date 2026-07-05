/**
 * Well-known definition URIs from the spec's controlled vocabularies.
 * These are documented values, not exhaustive enums — servers may use other
 * resolvable concept URIs, so schemas type `definition` as `z.string()` and
 * use these constants for convenience/autocomplete rather than validation.
 */
export const SystemTypeUris = {
  Sensor: "http://www.w3.org/ns/sosa/Sensor",
  Actuator: "http://www.w3.org/ns/sosa/Actuator",
  Platform: "http://www.w3.org/ns/sosa/Platform",
  Sampler: "http://www.w3.org/ns/sosa/Sampler",
  System: "http://www.w3.org/ns/sosa/System",
} as const;

export const ProcedureTypeUris = {
  Procedure: "http://www.w3.org/ns/sosa/Procedure",
  ObservingProcedure: "http://www.w3.org/ns/sosa/ObservingProcedure",
  SamplingProcedure: "http://www.w3.org/ns/sosa/SamplingProcedure",
  ActuatingProcedure: "http://www.w3.org/ns/sosa/ActuatingProcedure",
  System: "http://www.w3.org/ns/sosa/System",
  Sensor: "http://www.w3.org/ns/sosa/Sensor",
  Actuator: "http://www.w3.org/ns/sosa/Actuator",
  Sampler: "http://www.w3.org/ns/sosa/Sampler",
  Platform: "http://www.w3.org/ns/sosa/Platform",
} as const;

export const DeploymentTypeUris = {
  Deployment: "http://www.w3.org/ns/sosa/Deployment",
} as const;

export const AssetTypes = [
  "Equipment",
  "Human",
  "LivingThing",
  "Simulation",
  "Process",
  "Group",
  "Other",
] as const;
export type AssetType = (typeof AssetTypes)[number];

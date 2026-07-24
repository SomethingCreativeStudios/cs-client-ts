import type { Settings } from "../models/sensorml/described-object.js";
import type { PathRefPrefix } from "./strings.js";

/** The Settings arrays a path ref can appear in. */
export type SettingsKind = keyof {
  [K in keyof Settings as K extends `set${string}` ? K : never]: Settings[K];
};

export const settingsKinds: readonly SettingsKind[] = [
  "setValues",
  "setArrayValues",
  "setModes",
  "setConstraints",
  "setStatus",
];

/** Minimal candidate shape (matches enIto's PathRefCandidate). */
export interface PathRefCandidate {
  ref: string;
  label: string;
  prefix: PathRefPrefix;
}

/** A candidate enriched with structure and applicability metadata for autosuggest. */
export interface PathRefPart extends PathRefCandidate {
  /** Raw name segments after the prefix; ref === composePathRef(prefix, segments.join("/")). */
  segments: string[];
  /** The node's `type` discriminator ("Quantity", "DataRecord", "Mode", ...); undefined for href-only slots. */
  componentType?: string;
  /** Which Settings kinds this ref suits. */
  targets: SettingsKind[];
  /** Whether every raw segment matches SEGMENT_PATTERN (i.e. the ref satisfies PATH_REF_PATTERN). */
  valid: boolean;
}

const SCALAR_TYPES = new Set(["Count", "Quantity", "Time", "Category", "Text"]);
const RANGE_TYPES = new Set(["CountRange", "QuantityRange", "TimeRange", "CategoryRange"]);
const ARRAY_TYPES = new Set(["DataArray", "Matrix"]);

/**
 * Which Settings kinds a component can be targeted by, from its `type`
 * discriminator. Anything can be enabled/disabled (setStatus); scalars take
 * setValues; ranges and encoded arrays take setArrayValues; components with a
 * `constraint` field take setConstraints. Unknown or href-only slots get the
 * setStatus baseline.
 */
export function settingsTargetsFor(component: unknown): SettingsKind[] {
  const type =
    component !== null && typeof component === "object" && "type" in component
      ? (component as { type?: unknown }).type
      : undefined;
  if (typeof type !== "string") return ["setStatus"];
  if (type === "Boolean") return ["setValues", "setStatus"];
  if (SCALAR_TYPES.has(type)) return ["setValues", "setConstraints", "setStatus"];
  if (RANGE_TYPES.has(type)) return ["setArrayValues", "setConstraints", "setStatus"];
  if (ARRAY_TYPES.has(type)) return ["setArrayValues", "setStatus"];
  return ["setStatus"];
}

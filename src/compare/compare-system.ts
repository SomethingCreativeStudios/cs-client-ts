import type { Procedure } from "../models/resources/procedure.js";
import type { System } from "../models/resources/system.js";
import {
  buildResult,
  createContext,
  diffValues,
  type CompareOptions,
  type CompareResult,
} from "./diff.js";

/** Wire/debug artifacts and per-resource API identity: never compared. `typeOf` is the inheritance pointer itself. */
export const ALWAYS_EXCLUDED_FIELDS = ["raw", "sourceEncoding", "id", "links", "typeOf"] as const;

/** Differ by definition between an instance and its datasheet; compared only with `includeIdentity`. */
export const IDENTITY_FIELDS = ["uniqueId", "featureType", "validTime"] as const;

/** System-only physical-instance fields a Procedure can never carry; reported as "added" only with `includeInstanceFields`. */
export const SYSTEM_INSTANCE_FIELDS = [
  "assetType",
  "position",
  "bbox",
  "localReferenceFrames",
  "localTimeFrames",
] as const;

/** Fields whose absence is equivalent to an empty list, diffed element-by-element. */
const IO_LIST_FIELDS = new Set(["inputs", "outputs", "parameters"]);

/**
 * Report what a System overrides from the Procedure it inherits from via `typeOf`
 * (procedure = parent class, system = instance). Entries are system-relative:
 * "overridden" = restated with a different value, "added" = only on the system,
 * "removed" = only on the procedure (usually inherited without restating).
 *
 * Both resources should come from an SML/common-format fetch — GeoJSON-sourced
 * models carry no inputs/outputs/parameters to compare.
 */
export function compareSystemToProcedure(
  procedure: Procedure,
  system: System,
  options?: CompareOptions,
): CompareResult {
  const excluded = new Set<string>(ALWAYS_EXCLUDED_FIELDS);
  if (!options?.includeIdentity) for (const f of IDENTITY_FIELDS) excluded.add(f);
  if (!options?.includeInstanceFields) for (const f of SYSTEM_INSTANCE_FIELDS) excluded.add(f);

  const proc = procedure as unknown as Record<string, unknown>;
  const sys = system as unknown as Record<string, unknown>;
  const ctx = createContext(options);
  const fields = new Set([...Object.keys(proc), ...Object.keys(sys)]);
  for (const field of fields) {
    if (excluded.has(field)) continue;
    if (IO_LIST_FIELDS.has(field)) {
      diffValues(proc[field] ?? [], sys[field] ?? [], field, ctx);
    } else {
      diffValues(proc[field], sys[field], field, ctx);
    }
  }
  return buildResult(ctx.entries);
}

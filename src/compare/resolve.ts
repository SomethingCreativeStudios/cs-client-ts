import type { XLink } from "../models/common/link.js";
import type { Procedure } from "../models/resources/procedure.js";
import type { System } from "../models/resources/system.js";
import { compareSystemToProcedure } from "./compare-system.js";
import type { CompareOptions, CompareResult } from "./diff.js";

/**
 * The slice of CSApiClient needed to fetch a procedure by id. Structural so the
 * compare module carries no runtime dependency on the api module.
 */
export interface ProcedureResolver {
  procedures: { get(id: string): Promise<Procedure> };
}

/**
 * Extract a procedure id from a `typeOf` link's href: the segment after
 * "procedures" when present, otherwise the last path segment.
 * Returns undefined when the href has no usable path (e.g. a bare origin).
 */
export function procedureIdFromTypeOf(typeOf: XLink): string | undefined {
  const [path = ""] = typeOf.href.split(/[?#]/);
  const segments = path.split("/").filter(Boolean);
  const proceduresIdx = segments.lastIndexOf("procedures");
  if (proceduresIdx !== -1 && proceduresIdx + 1 < segments.length) {
    return segments[proceduresIdx + 1];
  }
  // "https://host/id" splits to ["https:", "host", "id"]: anything at or before
  // the host position is not an id.
  const minSegments = path.includes("://") ? 3 : 1;
  return segments.length >= minSegments ? segments[segments.length - 1] : undefined;
}

/**
 * Resolve a System's `typeOf` link to its parent Procedure via the client, then
 * report what the system overrides from it. Throws when the system has no
 * `typeOf` or no procedure id can be extracted from its href.
 */
export async function compareSystemToInheritedProcedure(
  client: ProcedureResolver,
  system: System,
  options?: CompareOptions,
): Promise<CompareResult & { procedure: Procedure }> {
  const typeOf = system.typeOf;
  if (!typeOf) {
    throw new Error(`System "${system.uniqueId}" has no typeOf link to a parent procedure`);
  }
  const id = procedureIdFromTypeOf(typeOf);
  if (!id) {
    const uidHint = typeOf.uid ? ` The link's uid is "${typeOf.uid}"; try searching procedures by uid instead.` : "";
    throw new Error(`Could not extract a procedure id from typeOf href "${typeOf.href}".${uidHint}`);
  }
  const procedure = await client.procedures.get(id);
  return { ...compareSystemToProcedure(procedure, system, options), procedure };
}

import type { System } from "../models/resources/system.js";
import type { Mode } from "../models/sensorml/described-object.js";
import type { ComponentListEntry } from "../models/sensorml/processes.js";
import { composePathRef, SEGMENT_PATTERN, type PathRefPrefix } from "./strings.js";
import type { PathRefPart, SettingsKind } from "./parts.js";
import { walkComponentPathRefs } from "./walk-component.js";

/**
 * Anything path refs can address: satisfied by System, Procedure, their Input
 * types, and inline sub-process objects. Building from a Procedure is a
 * first-class use — a System's configuration overrides address the tree of the
 * parent procedure it inherits from via `typeOf`.
 */
export type PathRefSource = Pick<System, "inputs" | "outputs" | "parameters" | "modes" | "components">;

export interface BuildPathRefOptions {
  /** Maximum total segments per ref. Default 10. */
  maxDepth?: number;
  /** Only return parts targeting at least one of these Settings kinds. */
  kinds?: SettingsKind[];
  /** Keep parts whose raw names break PATH_REF_PATTERN (`valid: false`). Default true. */
  includeInvalid?: boolean;
}

const DEFAULT_MAX_DEPTH = 10;
const IO_KINDS = ["inputs", "outputs", "parameters"] as const;

/**
 * Enumerate every addressable path ref in a process description, deeply:
 * components (recursing into inline sub-processes), inputs/outputs/parameters
 * (recursing through the SWE component tree), and modes. Refs use raw names —
 * see walkComponentPathRefs. Duplicated refs keep the first occurrence.
 */
export function buildPathRefParts(
  source: PathRefSource | undefined,
  options?: BuildPathRefOptions,
): PathRefPart[] {
  if (!source) return [];
  const maxDepth = options?.maxDepth ?? DEFAULT_MAX_DEPTH;
  const parts: PathRefPart[] = [];

  addComponents(source.components, [], undefined, parts, maxDepth);
  for (const kind of IO_KINDS) {
    source[kind]?.forEach((slot) => parts.push(...walkComponentPathRefs(kind, slot, { maxDepth })));
  }
  addModes(source.modes, "modes", [], undefined, parts);

  const seen = new Set<string>();
  return parts.filter((part) => {
    if (seen.has(part.ref)) return false;
    seen.add(part.ref);
    if (options?.includeInvalid === false && !part.valid) return false;
    if (options?.kinds && !part.targets.some((t) => options.kinds!.includes(t))) return false;
    return true;
  });
}

function addComponents(
  entries: ComponentListEntry[] | undefined,
  baseSegments: string[],
  baseLabel: string | undefined,
  parts: PathRefPart[],
  maxDepth: number,
): void {
  entries?.forEach((entry) => {
    if (typeof entry.name !== "string" || entry.name.length === 0) return;
    const segments = [...baseSegments, entry.name];
    if (segments.length > maxDepth) return;
    const entryLabel = typeof entry.label === "string" && entry.label.trim().length > 0 ? entry.label.trim() : entry.name;
    const label = baseLabel ? `${baseLabel} / ${entryLabel}` : entryLabel;
    parts.push(makePart("components", segments, label, entry.type, ["setStatus"]));

    // A Link entry points at a process hosted elsewhere; descending would need a fetch.
    if (segments.length >= maxDepth || "href" in entry || entry.type === "Link") return;
    for (const kind of IO_KINDS) {
      const slots = entry[kind];
      if (!Array.isArray(slots)) continue;
      for (const slot of slots) {
        parts.push(
          ...walkComponentPathRefs("components", slot as never, {
            baseSegments: [...segments, kind],
            baseLabel: label,
            maxDepth,
          }),
        );
      }
    }
    addModes(entry.modes as Mode[] | undefined, "components", [...segments, "modes"], label, parts);
    addComponents(entry.components as ComponentListEntry[] | undefined, [...segments, "components"], label, parts, maxDepth);
  });
}

function addModes(
  modes: Mode[] | undefined,
  prefix: PathRefPrefix,
  baseSegments: string[],
  baseLabel: string | undefined,
  parts: PathRefPart[],
): void {
  if (!Array.isArray(modes)) return;
  modes.forEach((mode) => {
    const id = typeof mode.id === "string" && mode.id.length > 0 ? mode.id : mode.label;
    if (typeof id !== "string" || id.length === 0) return;
    const segments = [...baseSegments, id];
    const label = baseLabel ? `${baseLabel} / ${mode.label}` : mode.label;
    parts.push(makePart(prefix, segments, label, "Mode", ["setModes"]));
  });
}

function makePart(
  prefix: PathRefPrefix,
  segments: string[],
  label: string,
  componentType: unknown,
  targets: SettingsKind[],
): PathRefPart {
  return {
    ref: composePathRef(prefix, segments.join("/")),
    label,
    prefix,
    segments,
    componentType: typeof componentType === "string" ? componentType : undefined,
    targets,
    valid: segments.every((s) => SEGMENT_PATTERN.test(s)),
  };
}

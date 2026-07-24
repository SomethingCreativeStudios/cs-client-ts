import type { IOComponent } from "../models/sensorml/abstract-process.js";
import type { NamedComponentSlot } from "../models/swe/any-component.js";
import { composePathRef, SEGMENT_PATTERN, type PathRefPrefix } from "./strings.js";
import { settingsTargetsFor, type PathRefPart } from "./parts.js";

export interface WalkPathRefOptions {
  /** Segments to prepend before the slot's own name (e.g. ["detector", "parameters"]). */
  baseSegments?: string[];
  /** Label chain to prepend before the slot's own label. */
  baseLabel?: string;
  /** Maximum total segments per ref (base included). Default 10. */
  maxDepth?: number;
}

const DEFAULT_MAX_DEPTH = 10;

/**
 * Walk a named component slot and its SWE tree, emitting one PathRefPart per
 * addressable node — the slot itself first, then descendants depth-first in
 * document order. Refs use the raw component names; a name that breaks
 * SEGMENT_PATTERN marks the part (and its descendants) `valid: false` rather
 * than being renamed, since a sanitized ref would resolve to nothing.
 */
export function walkComponentPathRefs(
  prefix: PathRefPrefix,
  slot: IOComponent | NamedComponentSlot,
  options?: WalkPathRefOptions,
): PathRefPart[] {
  const parts: PathRefPart[] = [];
  walkSlot(slot, {
    prefix,
    parts,
    maxDepth: options?.maxDepth ?? DEFAULT_MAX_DEPTH,
    ancestors: new Set(),
  }, options?.baseSegments ?? [], options?.baseLabel);
  return parts;
}

interface WalkContext {
  prefix: PathRefPrefix;
  parts: PathRefPart[];
  maxDepth: number;
  ancestors: Set<object>;
}

function walkSlot(slot: unknown, ctx: WalkContext, baseSegments: string[], baseLabel: string | undefined): void {
  if (slot === null || typeof slot !== "object") return;
  const node = slot as Record<string, unknown>;
  if (typeof node.name !== "string" || node.name.length === 0) return;

  const segments = [...baseSegments, node.name];
  if (segments.length > ctx.maxDepth) return;
  const nodeLabel = typeof node.label === "string" && node.label.trim().length > 0 ? node.label.trim() : node.name;
  const label = baseLabel ? `${baseLabel} / ${nodeLabel}` : nodeLabel;
  const type = typeof node.type === "string" ? node.type : undefined;

  ctx.parts.push({
    ref: composePathRef(ctx.prefix, segments.join("/")),
    label,
    prefix: ctx.prefix,
    segments,
    componentType: type,
    targets: settingsTargetsFor(node),
    valid: segments.every((s) => SEGMENT_PATTERN.test(s)),
  });

  if (segments.length >= ctx.maxDepth || ctx.ancestors.has(node)) return;
  ctx.ancestors.add(node);
  for (const child of childSlots(node, type)) {
    walkSlot(child, ctx, segments, label);
  }
  ctx.ancestors.delete(node);
}

/** The named child slots a component kind recurses into; leaves return []. */
function childSlots(node: Record<string, unknown>, type: string | undefined): unknown[] {
  switch (type) {
    case "DataRecord":
      return asArray(node.fields);
    case "Vector":
      return asArray(node.coordinates);
    case "DataChoice":
      return asArray(node.items);
    case "DataArray":
    case "Matrix":
      return node.elementType !== undefined ? [node.elementType] : [];
    default:
      return [];
  }
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

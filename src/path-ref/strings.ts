import { PATH_REF_PATTERN } from "../models/sensorml/path-ref.js";

/** The five addressable scopes a path ref can start with. */
export type PathRefPrefix = "components" | "inputs" | "outputs" | "parameters" | "modes";

export const pathRefPrefixes: readonly PathRefPrefix[] = [
  "components",
  "inputs",
  "outputs",
  "parameters",
  "modes",
];

/** Select-friendly options, one per prefix. */
export const pathRefPrefixOptions = pathRefPrefixes.map((value) => ({ label: value, value }));

/** A single path segment: letter first, then letters/digits/underscore/hyphen. */
export const SEGMENT_PATTERN = /^[A-Za-z][A-Za-z0-9_-]*$/;

export interface ParsedPathRef {
  prefix: PathRefPrefix;
  path: string;
}

export function isPathRef(ref: string): boolean {
  return PATH_REF_PATTERN.test(ref.trim());
}

/**
 * Split a ref into prefix and remaining path. A ref without a recognized prefix
 * is treated as a bare path under "parameters" (the most common scope).
 */
export function parsePathRef(ref: string): ParsedPathRef {
  const trimmed = ref.trim();
  const slashIndex = trimmed.indexOf("/");
  const prefix = slashIndex >= 0 ? trimmed.slice(0, slashIndex) : "";
  const path = slashIndex >= 0 ? trimmed.slice(slashIndex + 1) : trimmed;

  if (isPathRefPrefix(prefix)) return { prefix, path };
  return { prefix: "parameters", path: trimmed };
}

export function composePathRef(prefix: PathRefPrefix, path: string): string {
  return `${prefix}/${path.trim().replace(/^\/+|\/+$/g, "")}`;
}

/**
 * Authoring helper: coerce arbitrary text into a valid path segment for naming a
 * NEW component. Never use it on refs built from existing trees — a sanitized
 * name no longer resolves against the real component names.
 */
export function sanitizePathRefSegment(value: string): string {
  const normalized = value
    .trim()
    .replace(/[^A-Za-z0-9_-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (!normalized) return "item";
  return /^[A-Za-z]/.test(normalized) ? normalized : `item_${normalized}`;
}

function isPathRefPrefix(value: string): value is PathRefPrefix {
  return (pathRefPrefixes as readonly string[]).includes(value);
}

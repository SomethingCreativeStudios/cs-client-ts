/**
 * Generic deep-diff engine underpinning the compare/ utilities.
 *
 * Semantics are system-relative (a System inherits from a Procedure via `typeOf`):
 * - "overridden": present on both sides with different values
 * - "added": present only on the system side
 * - "removed": present only on the procedure side — under `typeOf` inheritance this
 *   usually means "inherited without restating", not deleted
 */

export type DiffStatus = "overridden" | "added" | "removed" | "unchanged";

export interface DiffEntry {
  /** Dotted path, e.g. "outputs.temp.uom.code". Segments containing "." or "[" are bracket-quoted. */
  path: string;
  status: DiffStatus;
  procedureValue?: unknown;
  systemValue?: unknown;
}

export interface CompareOptions {
  /** Emit "unchanged" entries for matched-equal leaves. Default false. */
  includeUnchanged?: boolean;
  /** Also compare identity fields (uniqueId, featureType, validTime). Default false. */
  includeIdentity?: boolean;
  /**
   * Also report System-only instance fields (assetType, position, bbox,
   * localReferenceFrames, localTimeFrames) as "added". Default false.
   */
  includeInstanceFields?: boolean;
  /** Extra field names or path prefixes to skip, e.g. ["contacts", "outputs.temp"]. */
  ignorePaths?: string[];
}

export interface CompareResult {
  /** All entries, in traversal order. */
  entries: DiffEntry[];
  overridden: DiffEntry[];
  added: DiffEntry[];
  removed: DiffEntry[];
  /** Empty unless `includeUnchanged` was set. */
  unchanged: DiffEntry[];
}

export interface DiffContext {
  entries: DiffEntry[];
  includeUnchanged: boolean;
  ignore: (path: string) => boolean;
}

export function createContext(options?: CompareOptions): DiffContext {
  const prefixes = options?.ignorePaths ?? [];
  return {
    entries: [],
    includeUnchanged: options?.includeUnchanged ?? false,
    ignore: (path) =>
      prefixes.some((p) => path === p || path.startsWith(p + ".") || path.startsWith(p + "[")),
  };
}

export function buildResult(entries: DiffEntry[]): CompareResult {
  return {
    entries,
    overridden: entries.filter((e) => e.status === "overridden"),
    added: entries.filter((e) => e.status === "added"),
    removed: entries.filter((e) => e.status === "removed"),
    unchanged: entries.filter((e) => e.status === "unchanged"),
  };
}

/** Append `segment` to a dotted path, bracket-quoting segments that contain "." or "[". */
export function joinPath(base: string, segment: string): string {
  const needsQuoting = segment.includes(".") || segment.includes("[") || segment.includes('"');
  const part = needsQuoting ? `["${segment.replaceAll('"', '\\"')}"]` : segment;
  if (base === "") return part;
  return needsQuoting ? base + part : base + "." + part;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Structural equality: key-order-insensitive, `undefined`-valued keys treated as absent.
 * Hand-rolled (no node:util) so it works in browsers.
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => deepEqual(v, b[i]));
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) {
      if (!deepEqual(a[k], b[k])) return false;
    }
    return true;
  }
  return false;
}

/** Key candidates for matching elements of two arrays, in priority order. */
const KEY_CANDIDATES = ["name", "definition", "label", "href", "role"] as const;

function hasUniqueStringKey(arr: unknown[], key: string): boolean {
  const seen = new Set<string>();
  for (const el of arr) {
    if (!isPlainObject(el)) return false;
    const v = el[key];
    if (typeof v !== "string" || seen.has(v)) return false;
    seen.add(v);
  }
  return true;
}

/**
 * First candidate key present (as a unique string) on every element of both arrays,
 * or undefined when the arrays must be compared positionally as a whole.
 */
export function sharedUniqueKey(a: unknown[], b: unknown[]): string | undefined {
  return KEY_CANDIDATES.find((k) => hasUniqueStringKey(a, k) && hasUniqueStringKey(b, k));
}

function emit(ctx: DiffContext, entry: DiffEntry): void {
  if (entry.status === "unchanged" && !ctx.includeUnchanged) return;
  ctx.entries.push(entry);
}

/**
 * Diff two values, appending entries to `ctx`. `undefined` is treated as absent;
 * `null` is a real value. `skipKeys` omits the given top-level keys of a matched
 * object pair from the diff (used for array match keys like an IOComponent's `name`).
 */
export function diffValues(
  procedureValue: unknown,
  systemValue: unknown,
  path: string,
  ctx: DiffContext,
  skipKeys?: readonly string[],
): void {
  if (ctx.ignore(path)) return;
  const procAbsent = procedureValue === undefined;
  const sysAbsent = systemValue === undefined;
  if (procAbsent && sysAbsent) return;
  if (procAbsent) {
    emit(ctx, { path, status: "added", systemValue });
    return;
  }
  if (sysAbsent) {
    emit(ctx, { path, status: "removed", procedureValue });
    return;
  }

  if (isPlainObject(procedureValue) && isPlainObject(systemValue)) {
    // Different discriminators (SWE component kinds, ObservableProperty vs inline
    // component, ...) mean the shapes aren't comparable field-by-field.
    const procType = procedureValue.type;
    const sysType = systemValue.type;
    if (typeof procType === "string" && typeof sysType === "string" && procType !== sysType) {
      emit(ctx, { path, status: "overridden", procedureValue, systemValue });
      return;
    }
    const keys = new Set([...Object.keys(procedureValue), ...Object.keys(systemValue)]);
    for (const key of keys) {
      if (skipKeys?.includes(key)) continue;
      diffValues(procedureValue[key], systemValue[key], joinPath(path, key), ctx);
    }
    return;
  }

  if (Array.isArray(procedureValue) && Array.isArray(systemValue)) {
    diffArrays(procedureValue, systemValue, path, ctx);
    return;
  }

  // Primitives (incl. null) of matching or differing kinds, or a kind mismatch
  // (primitive vs object vs array): a single leaf entry either way.
  if (procedureValue === systemValue) {
    emit(ctx, { path, status: "unchanged", procedureValue, systemValue });
  } else {
    emit(ctx, { path, status: "overridden", procedureValue, systemValue });
  }
}

function diffArrays(procedureArr: unknown[], systemArr: unknown[], path: string, ctx: DiffContext): void {
  const key = sharedUniqueKey(procedureArr, systemArr);
  if (key === undefined) {
    // Positional/scalar array (numeric tuples, keywords, intervals, or lists whose
    // elements can't be keyed uniquely): compare as a whole, no index paths.
    if (deepEqual(procedureArr, systemArr)) {
      emit(ctx, { path, status: "unchanged", procedureValue: procedureArr, systemValue: systemArr });
    } else {
      emit(ctx, { path, status: "overridden", procedureValue: procedureArr, systemValue: systemArr });
    }
    return;
  }

  const systemByKey = new Map(systemArr.map((el) => [(el as Record<string, unknown>)[key] as string, el]));
  const procedureKeys = new Set<string>();
  for (const procEl of procedureArr) {
    const k = (procEl as Record<string, unknown>)[key] as string;
    procedureKeys.add(k);
    const childPath = joinPath(path, k);
    if (systemByKey.has(k)) {
      diffValues(procEl, systemByKey.get(k), childPath, ctx, [key]);
    } else if (!ctx.ignore(childPath)) {
      emit(ctx, { path: childPath, status: "removed", procedureValue: procEl });
    }
  }
  for (const [k, sysEl] of systemByKey) {
    if (procedureKeys.has(k)) continue;
    const childPath = joinPath(path, k);
    if (!ctx.ignore(childPath)) {
      emit(ctx, { path: childPath, status: "added", systemValue: sysEl });
    }
  }
}

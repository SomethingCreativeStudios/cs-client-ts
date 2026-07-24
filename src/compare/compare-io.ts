import type { IOComponent } from "../models/sensorml/abstract-process.js";
import {
  buildResult,
  createContext,
  diffValues,
  type CompareOptions,
  type CompareResult,
} from "./diff.js";

/**
 * Deep-compare a single pair of IO components (input/output/parameter slots).
 * `name` is the slot identity, not content, so it is excluded from the diff.
 * A different `type` discriminator (e.g. ObservableProperty in the procedure vs an
 * inline Quantity in the system) yields a single "overridden" entry without recursing.
 */
export function compareIOComponents(
  procedureComponent: IOComponent,
  systemComponent: IOComponent,
  options?: CompareOptions & { basePath?: string },
): CompareResult {
  const basePath = options?.basePath ?? systemComponent.name;
  const ctx = createContext(options);
  diffValues(procedureComponent, systemComponent, basePath, ctx, ["name"]);
  return buildResult(ctx.entries);
}

/**
 * Compare two IO component lists (e.g. a procedure's `outputs` vs a system's),
 * matching components by `name` and recursing into matched pairs. An absent list
 * is treated as empty, so every component of the other side is reported
 * individually. Entry paths are rooted at `basePath` (e.g. "outputs.temp.uom.code").
 */
export function compareIOComponentLists(
  procedureList: IOComponent[] | undefined,
  systemList: IOComponent[] | undefined,
  basePath: string,
  options?: CompareOptions,
): CompareResult {
  const ctx = createContext(options);
  diffValues(procedureList ?? [], systemList ?? [], basePath, ctx);
  return buildResult(ctx.entries);
}

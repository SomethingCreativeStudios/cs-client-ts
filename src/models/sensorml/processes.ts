import { z } from "zod";
import { abstractProcessShape, ProcessMethodSchema } from "./abstract-process.js";
import { physicalProcessShape } from "./physical-process.js";
import { SoftNamedPropertyShape } from "../swe/basic-types.js";
import { XLinkSchema } from "../common/link.js";

/** Path reference into a process's own inputs/outputs/parameters/modes/components tree. */
export const PathRefSchema = z
  .string()
  .regex(/^(components|inputs|outputs|parameters|modes)\/([A-Za-z][A-Za-z0-9_-]*\/)*[A-Za-z][A-Za-z0-9_-]*$/);
export type PathRef = z.infer<typeof PathRefSchema>;

export const ConnectionListSchema = z
  .array(z.object({ source: PathRefSchema, destination: PathRefSchema }))
  .min(1);
export type ConnectionList = z.infer<typeof ConnectionListSchema>;

/**
 * The four concrete SensorML process kinds. This is the recursion knot shared
 * verbatim by System and Procedure resources (sml-system.ts, sml-procedure.ts) —
 * they differ only in the `definition` URI space and whether `position` is allowed.
 *
 * Object schemas are kept as plain `ZodObject`s (shapes spread, not `.extend()`-ed,
 * and never cast to `z.ZodType<Interface>`) so `.omit()` and `z.discriminatedUnion`
 * keep working on them; only the recursive `components` field and the top-level
 * union need an explicit `z.lazy` + interface annotation.
 */

export const SimpleProcessSchema = z.looseObject({
  ...abstractProcessShape,
  type: z.literal("SimpleProcess"),
  method: ProcessMethodSchema.optional(),
});
export type SimpleProcess = z.infer<typeof SimpleProcessSchema>;

export const PhysicalComponentSchema = z.looseObject({
  ...physicalProcessShape,
  type: z.literal("PhysicalComponent"),
  method: ProcessMethodSchema.optional(),
});
export type PhysicalComponent = z.infer<typeof PhysicalComponentSchema>;

/** A named sub-process, or a link to one hosted elsewhere (`type: "Link"`). */
export interface ComponentListEntry {
  name: string;
  type?: string;
  [key: string]: unknown;
}

const ComponentLinkSchema = z.looseObject({
  ...SoftNamedPropertyShape,
  ...XLinkSchema.shape,
  type: z.literal("Link").optional(),
});

const ComponentListEntrySchema: z.ZodType<ComponentListEntry> = z.lazy(() =>
  z.union([ComponentLinkSchema, z.looseObject({ ...SoftNamedPropertyShape }).and(AnyProcessSchema)]),
) as z.ZodType<ComponentListEntry>;

export const ComponentListSchema = z.array(ComponentListEntrySchema).min(1);

export interface AggregateProcess {
  type: "AggregateProcess";
  components?: ComponentListEntry[];
  connections?: ConnectionList;
  [key: string]: unknown;
}

export const AggregateProcessSchema: z.ZodType<AggregateProcess> = z.lazy(() =>
  z.looseObject({
    ...abstractProcessShape,
    type: z.literal("AggregateProcess"),
    components: ComponentListSchema.optional(),
    connections: ConnectionListSchema.optional(),
  }),
) as z.ZodType<AggregateProcess>;

export interface PhysicalSystem {
  type: "PhysicalSystem";
  components?: ComponentListEntry[];
  connections?: ConnectionList;
  [key: string]: unknown;
}

export const PhysicalSystemSchema: z.ZodType<PhysicalSystem> = z.lazy(() =>
  z.looseObject({
    ...physicalProcessShape,
    type: z.literal("PhysicalSystem"),
    components: ComponentListSchema.optional(),
    connections: ConnectionListSchema.optional(),
  }),
) as z.ZodType<PhysicalSystem>;

export type AnyProcess = SimpleProcess | AggregateProcess | PhysicalComponent | PhysicalSystem;

/** The shared process union underlying both SML System and SML Procedure resources. */
export const AnyProcessSchema: z.ZodType<AnyProcess> = z.lazy(() =>
  z.union([SimpleProcessSchema, AggregateProcessSchema, PhysicalComponentSchema, PhysicalSystemSchema]),
) as z.ZodType<AnyProcess>;

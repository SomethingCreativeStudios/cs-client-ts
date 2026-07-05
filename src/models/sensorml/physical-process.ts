import { z } from "zod";
import { abstractProcessShape } from "./abstract-process.js";
import { PoseSchema } from "./pose.js";
import { XLinkSchema } from "../common/link.js";
import { TextComponentSchema, VectorComponentSchema, DataRecordComponentSchema, DataArrayComponentSchema } from "../swe/any-component.js";

const spatialFrameShape = {
  id: z.string().optional(),
  label: z.string().optional(),
  description: z.string().optional(),
  origin: z.string(),
  axes: z.array(z.object({ name: z.string(), description: z.string() })),
};
export const SpatialFrameSchema = z.looseObject(spatialFrameShape);
export type SpatialFrame = z.infer<typeof SpatialFrameSchema>;

const temporalFrameShape = {
  id: z.string().optional(),
  label: z.string().optional(),
  description: z.string().optional(),
  origin: z.string(),
};
export const TemporalFrameSchema = z.looseObject(temporalFrameShape);
export type TemporalFrame = z.infer<typeof TemporalFrameSchema>;

/** GeoJSON Point, used as one of the Position variants (positional shorthand). */
const GeoJsonPointSchema = z.looseObject({
  type: z.literal("Point"),
  coordinates: z.array(z.number()).min(2),
});

/**
 * Where a physical component/system is located. `AbstractProcess` (used for the
 * "by Process" variant) is referenced lazily to avoid a circular import with system.ts.
 */
export type Position =
  | z.infer<typeof TextComponentSchema>
  | z.infer<typeof GeoJsonPointSchema>
  | z.infer<typeof PoseSchema>
  | z.infer<typeof XLinkSchema>
  | z.infer<typeof VectorComponentSchema>
  | z.infer<typeof DataRecordComponentSchema>
  | z.infer<typeof DataArrayComponentSchema>
  | { type: string; [key: string]: unknown }; // by-Process variant (AbstractProcess), kept loose to avoid a cycle

export const PositionSchema: z.ZodType<Position> = z.union([
  TextComponentSchema,
  GeoJsonPointSchema,
  PoseSchema,
  VectorComponentSchema,
  DataRecordComponentSchema,
  DataArrayComponentSchema,
  XLinkSchema,
  z.looseObject({ type: z.string() }),
]) as z.ZodType<Position>;

export const physicalProcessShape = {
  ...abstractProcessShape,
  attachedTo: XLinkSchema.optional(),
  localReferenceFrames: z.array(SpatialFrameSchema).optional(),
  localTimeFrames: z.array(TemporalFrameSchema).optional(),
  position: PositionSchema.optional(),
};

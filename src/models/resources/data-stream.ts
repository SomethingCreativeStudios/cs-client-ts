import { z } from "zod";
import { baseStreamInputShape, baseStreamShape, ObservedOrControlledPropertySchema, StreamLinksShape } from "./base-stream.js";
import { ObservationSchemaDescriptorSchema } from "./observation-schema.js";
import { LinkSchema } from "../common/link.js";
import { TimePeriodSchema } from "../common/time.js";

const RESULT_TYPES = ["measure", "vector", "record", "coverage", "complex"] as const;

export const DataStreamSchema = z.looseObject({
  ...baseStreamShape,
  "system@link": LinkSchema,
  outputName: z.string().optional(),
  "procedure@link": LinkSchema.optional(),
  "deployment@link": LinkSchema.optional(),
  "featureOfInterest@link": LinkSchema.optional(),
  "samplingFeature@link": LinkSchema.optional(),
  observedProperties: z.array(ObservedOrControlledPropertySchema).min(1).nullable(),
  phenomenonTime: TimePeriodSchema.nullable(),
  phenomenonTimeInterval: z.string().optional(),
  resultTime: TimePeriodSchema.nullable(),
  resultTimeInterval: z.string().optional(),
  type: z.enum(["status", "observation"]).optional(),
  resultType: z.enum(RESULT_TYPES).nullable(),
  live: z.boolean().nullable(),
  /** Write-only on create/update; describes the shape of observation results for this datastream. */
  schema: ObservationSchemaDescriptorSchema.optional(),
  ...StreamLinksShape,
});
export type DataStream = z.infer<typeof DataStreamSchema>;

/** Payload for creating a datastream: same shape, but `schema` is required. */
export const DataStreamCreateSchema = z.looseObject({
  ...baseStreamInputShape,
  "system@link": LinkSchema.optional(),
  outputName: z.string().optional(),
  "procedure@link": LinkSchema.optional(),
  "deployment@link": LinkSchema.optional(),
  "featureOfInterest@link": LinkSchema.optional(),
  "samplingFeature@link": LinkSchema.optional(),
  observedProperties: z.array(ObservedOrControlledPropertySchema).min(1).nullable().optional(),
  phenomenonTime: TimePeriodSchema.nullable().optional(),
  phenomenonTimeInterval: z.string().optional(),
  resultTime: TimePeriodSchema.nullable().optional(),
  resultTimeInterval: z.string().optional(),
  type: z.enum(["status", "observation"]).optional(),
  resultType: z.enum(RESULT_TYPES).nullable().optional(),
  live: z.boolean().nullable().optional(),
  schema: ObservationSchemaDescriptorSchema,
  ...StreamLinksShape,
});
export type DataStreamCreate = z.infer<typeof DataStreamCreateSchema>;

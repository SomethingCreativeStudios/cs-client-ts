import { z } from "zod";
import {
  baseStreamInputShape,
  baseStreamShape,
  normalizeStreamResponse,
  ObservedOrControlledPropertySchema,
  StreamLinksShape,
} from "./base-stream.js";
import { CommandSchemaDescriptorSchema } from "./command-schema.js";
import { LinkSchema } from "../common/link.js";
import { TimePeriodSchema } from "../common/time.js";

const ControlStreamResponseSchema = z.looseObject({
  ...baseStreamShape,
  "system@link": LinkSchema,
  inputName: z.string().optional(),
  "procedure@link": LinkSchema.optional(),
  "deployment@link": LinkSchema.optional(),
  "featureOfInterest@link": LinkSchema.optional(),
  "samplingFeature@link": LinkSchema.optional(),
  controlledProperties: z.array(ObservedOrControlledPropertySchema).min(1).nullable(),
  issueTime: TimePeriodSchema.nullable(),
  executionTime: TimePeriodSchema.nullable(),
  live: z.boolean().nullable(),
  async: z.boolean(),
  /** Write-only on create/update; describes the shape of command parameters/results for this control stream. */
  schema: CommandSchemaDescriptorSchema.optional(),
  ...StreamLinksShape,
});

export const ControlStreamSchema = z.preprocess(
  (value) => normalizeStreamResponse(
    value,
    "commandFormat",
    ["controlledProperties", "issueTime", "executionTime", "live"],
    (schema) => CommandSchemaDescriptorSchema.safeParse(schema).success,
    { async: false },
  ),
  ControlStreamResponseSchema,
);
export type ControlStream = z.infer<typeof ControlStreamSchema>;

/** Payload for creating a control stream: same shape, but `schema` is required. */
export const ControlStreamCreateSchema = z.looseObject({
  ...baseStreamInputShape,
  "system@link": LinkSchema.optional(),
  inputName: z.string().optional(),
  "procedure@link": LinkSchema.optional(),
  "deployment@link": LinkSchema.optional(),
  "featureOfInterest@link": LinkSchema.optional(),
  "samplingFeature@link": LinkSchema.optional(),
  controlledProperties: z.array(ObservedOrControlledPropertySchema).min(1).nullable().optional(),
  issueTime: TimePeriodSchema.nullable().optional(),
  executionTime: TimePeriodSchema.nullable().optional(),
  live: z.boolean().nullable().optional(),
  async: z.boolean().optional(),
  schema: CommandSchemaDescriptorSchema,
  ...StreamLinksShape,
});
export type ControlStreamCreate = z.infer<typeof ControlStreamCreateSchema>;

import { z } from "zod";
import { LinkSchema } from "../common/link.js";
import { TimePeriodSchema } from "../common/time.js";

export const CommandStatusCodeSchema = z.enum([
  "PENDING",
  "ACCEPTED",
  "REJECTED",
  "SCHEDULED",
  "UPDATED",
  "CANCELED",
  "EXECUTING",
  "FAILED",
  "COMPLETED",
]);
export type CommandStatusCode = z.infer<typeof CommandStatusCodeSchema>;

export const CommandSchema = z.looseObject({
  id: z.string().min(1),
  "controlstream@id": z.string().min(1),
  "samplingFeature@id": z.string().min(1).optional(),
  "procedure@link": LinkSchema.optional(),
  issueTime: z.string(),
  executionTime: TimePeriodSchema.optional(),
  sender: z.string().min(1).optional(),
  currentStatus: CommandStatusCodeSchema.optional(),
  parameters: z.unknown(),
  links: z.array(LinkSchema).optional(),
});
export type Command = z.infer<typeof CommandSchema>;

export const CommandCreateSchema = z.looseObject({
  id: z.string().min(1).optional(),
  "controlstream@id": z.string().min(1).optional(),
  "samplingFeature@id": z.string().min(1).optional(),
  "procedure@link": LinkSchema.optional(),
  issueTime: z.string().optional(),
  executionTime: TimePeriodSchema.optional(),
  sender: z.string().min(1).optional(),
  currentStatus: CommandStatusCodeSchema.optional(),
  parameters: z.unknown(),
});
export type CommandCreate = z.infer<typeof CommandCreateSchema>;

const DatastreamResultLinkSchema = z.looseObject({
  ...LinkSchema.shape,
  resultTime: TimePeriodSchema.optional(),
});

const COMMAND_RESULT_KEYS = ["data", "observation@link", "observationSet@link", "datastream@link", "external@link"] as const;

function exactlyOneCommandResult(ctx: z.core.ParsePayload<Record<string, unknown>>) {
  const count = COMMAND_RESULT_KEYS.filter((key) => ctx.value[key] !== undefined).length;
  if (count !== 1) {
    ctx.issues.push({
      code: "custom",
      message: "Exactly one command result variant must be provided",
      input: ctx.value,
      path: ["data"],
    });
  }
}

const commandResultResponseShape = {
  id: z.string().min(1),
  "command@id": z.string().min(1),
  links: z.array(LinkSchema).optional(),
};

const commandResultCreateShape = {
  id: z.string().min(1).optional(),
  "command@id": z.string().min(1).optional(),
};

/**
 * A CommandResult: inline `data`, or a link to an observation, an observation
 * set, a datastream, or an external dataset. Modeled as a plain union (rather
 * than `z.discriminatedUnion`) since the five variants are distinguished by
 * which optional key is present, not a shared literal field.
 */
export const CommandResultSchema = z.union([
  z.looseObject({ ...commandResultResponseShape, data: z.unknown() }),
  z.looseObject({ ...commandResultResponseShape, "observation@link": LinkSchema }),
  z.looseObject({ ...commandResultResponseShape, "observationSet@link": LinkSchema }),
  z.looseObject({ ...commandResultResponseShape, "datastream@link": DatastreamResultLinkSchema }),
  z.looseObject({ ...commandResultResponseShape, "external@link": LinkSchema }),
]).check(exactlyOneCommandResult);
export type CommandResult = z.infer<typeof CommandResultSchema>;

export const CommandResultCreateSchema = z.union([
  z.looseObject({ ...commandResultCreateShape, data: z.unknown() }),
  z.looseObject({ ...commandResultCreateShape, "observation@link": LinkSchema }),
  z.looseObject({ ...commandResultCreateShape, "observationSet@link": LinkSchema }),
  z.looseObject({ ...commandResultCreateShape, "datastream@link": DatastreamResultLinkSchema }),
  z.looseObject({ ...commandResultCreateShape, "external@link": LinkSchema }),
]).check(exactlyOneCommandResult);
export type CommandResultCreate = z.infer<typeof CommandResultCreateSchema>;

export const CommandStatusSchema = z.looseObject({
  id: z.string().min(1),
  "command@id": z.string().min(1),
  reportTime: z.string(),
  statusCode: CommandStatusCodeSchema,
  percentCompletion: z.number().min(0).max(100).optional(),
  executionTime: TimePeriodSchema.optional(),
  message: z.string().min(1).optional(),
  results: z.array(CommandResultSchema).optional(),
  links: z.array(LinkSchema).optional(),
});
export type CommandStatus = z.infer<typeof CommandStatusSchema>;

export const CommandStatusCreateSchema = z.looseObject({
  id: z.string().min(1).optional(),
  "command@id": z.string().min(1).optional(),
  reportTime: z.string().optional(),
  statusCode: CommandStatusCodeSchema,
  percentCompletion: z.number().min(0).max(100).optional(),
  executionTime: TimePeriodSchema.optional(),
  message: z.string().min(1).optional(),
  results: z.array(CommandResultCreateSchema).optional(),
});
export type CommandStatusCreate = z.infer<typeof CommandStatusCreateSchema>;

import { z } from "zod";
import { LinkSchema } from "../common/link.js";

/**
 * An Observation. `result` is `unknown` at the schema level — its shape is
 * dictated by the owning datastream's result schema (`GET .../schema?obsFormat=`),
 * decoded separately once that schema is known. Exactly one of `result`/`result@link`
 * must be present, enforced with `superRefine` since Zod unions can't discriminate
 * on "which of these two optional keys is set".
 */
const observationShape = {
  "samplingFeature@id": z.string().min(1).optional(),
  "procedure@link": LinkSchema.optional(),
  phenomenonTime: z.string().optional(),
  parameters: z.record(z.string(), z.unknown()).optional(),
  result: z.unknown().optional(),
  "result@link": LinkSchema.optional(),
};

function exactlyOneObservationResult(ctx: z.core.ParsePayload<{ result?: unknown; "result@link"?: unknown }>) {
  const hasResult = ctx.value.result !== undefined;
  const hasResultLink = ctx.value["result@link"] !== undefined;
  if (hasResult === hasResultLink) {
    ctx.issues.push({
      code: "custom",
      message: "Exactly one of `result` or `result@link` must be provided",
      input: ctx.value,
      path: ["result"],
    });
  }
}

export const ObservationSchema = z
  .looseObject({
    id: z.string().min(1),
    "datastream@id": z.string().min(1),
    resultTime: z.string(),
    ...observationShape,
  })
  .check(exactlyOneObservationResult);
export type Observation = z.infer<typeof ObservationSchema>;

export const ObservationCreateSchema = z
  .looseObject({
    id: z.string().min(1).optional(),
    "datastream@id": z.string().min(1).optional(),
    "samplingFeature@id": z.string().min(1).optional(),
    "procedure@link": LinkSchema.optional(),
    phenomenonTime: z.string().optional(),
    resultTime: z.string().optional(),
    parameters: z.record(z.string(), z.unknown()).optional(),
    result: z.unknown().optional(),
    "result@link": LinkSchema.optional(),
  })
  .check(exactlyOneObservationResult);
export type ObservationCreate = z.infer<typeof ObservationCreateSchema>;

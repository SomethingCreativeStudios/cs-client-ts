import { z } from "zod";
import { TimePeriodSchema } from "../common/time.js";
import { LinkSchema } from "../common/link.js";

/** Shared response shape between DataStream and ControlStream. */
export const baseStreamShape = {
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1).optional(),
  validTime: TimePeriodSchema.optional(),
  formats: z.array(z.string()).min(1),
};

/** Shared write payload shape; read-only response fields stay optional here. */
export const baseStreamInputShape = {
  id: z.string().min(1).optional(),
  name: z.string().min(1),
  description: z.string().min(1).optional(),
  validTime: TimePeriodSchema.optional(),
  formats: z.array(z.string()).min(1).optional(),
};

export const ObservedOrControlledPropertySchema = z.looseObject({
  definition: z.string(),
  label: z.string().optional(),
  description: z.string().optional(),
});
export type ObservedOrControlledProperty = z.infer<typeof ObservedOrControlledPropertySchema>;

export const StreamLinksShape = {
  links: z.array(LinkSchema).optional(),
};

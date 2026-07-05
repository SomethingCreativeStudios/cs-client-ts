import { z } from "zod";
import { EventSchema } from "../sensorml/described-object.js";
import { LinkSchema } from "../common/link.js";

/** A SystemEvent is a SensorML Event plus a resource id and links. */
export const SystemEventSchema = z.looseObject({
  ...EventSchema.shape,
  id: z.string().min(1).optional(),
  definition: z.string(),
  links: z.array(LinkSchema).optional(),
});
export type SystemEvent = z.infer<typeof SystemEventSchema>;

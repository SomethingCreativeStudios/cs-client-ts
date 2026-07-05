import { z } from "zod";
import { SimpleProcessSchema, AggregateProcessSchema, PhysicalComponentSchema, PhysicalSystemSchema } from "./processes.js";
import { LinkSchema } from "../common/link.js";

/**
 * A System encoded as SensorML-JSON: any of the four process kinds.
 * Plain `z.union` rather than `z.discriminatedUnion` — AggregateProcess/PhysicalSystem
 * are recursive (`z.lazy`-wrapped) and Zod can't precompute discriminant metadata for them.
 */
export const AnySmlSystemSchema = z.union([
  SimpleProcessSchema,
  AggregateProcessSchema,
  PhysicalComponentSchema,
  PhysicalSystemSchema,
]);
export type AnySmlSystem = z.infer<typeof AnySmlSystemSchema>;

export type SmlSystem = AnySmlSystem & {
  definition: string;
  uniqueId: string;
  links?: z.infer<typeof LinkSchema>[];
};

export const SmlSystemSchema: z.ZodType<SmlSystem> = AnySmlSystemSchema.and(
  z.looseObject({
    definition: z.string(),
    uniqueId: z.string(),
    links: z.array(LinkSchema).optional(),
  }),
) as z.ZodType<SmlSystem>;

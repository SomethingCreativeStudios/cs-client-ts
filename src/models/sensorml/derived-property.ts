import { z } from "zod";
import { AnySimpleComponentSchema } from "../swe/any-component.js";
import { LinkSchema } from "../common/link.js";

/**
 * A Property resource (SensorML-JSON only — no GeoJSON encoding exists for Property).
 * `uniqueId` is optional on the bare DerivedProperty document per the SensorML schema,
 * but always present once served as an API resource (enforced by `SmlPropertySchema`).
 */
export const DerivedPropertySchema = z.looseObject({
  id: z.string().optional(),
  description: z.string().min(1).optional(),
  uniqueId: z.string().optional(),
  label: z.string().min(1),
  baseProperty: z.string(),
  objectType: z.string().optional(),
  statistic: z.string().optional(),
  qualifiers: z.array(AnySimpleComponentSchema).min(1).optional(),
});
export type DerivedProperty = z.infer<typeof DerivedPropertySchema>;

export const SmlPropertySchema = z.looseObject({
  ...DerivedPropertySchema.shape,
  uniqueId: z.string(),
  links: z.array(LinkSchema).optional(),
});
export type SmlProperty = z.infer<typeof SmlPropertySchema>;

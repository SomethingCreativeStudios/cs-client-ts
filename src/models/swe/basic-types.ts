import { z } from "zod";

/** A number, or a special IEEE value expressed as a string token. */
export const NumberOrSpecialSchema = z.union([
  z.number(),
  z.enum(["NaN", "Infinity", "+Infinity", "-Infinity"]),
]);
export type NumberOrSpecial = z.infer<typeof NumberOrSpecialSchema>;

/** A date-time string, a number, or a special IEEE value. */
export const DateTimeNumberOrSpecialSchema = z.union([z.string(), NumberOrSpecialSchema]);
export type DateTimeNumberOrSpecial = z.infer<typeof DateTimeNumberOrSpecialSchema>;

export const UnitReferenceSchema = z.looseObject({
  label: z.string().optional(),
  symbol: z.string().optional(),
  code: z.string().optional(),
  href: z.string().optional(),
});
export type UnitReference = z.infer<typeof UnitReferenceSchema>;

export const AllowedValuesSchema = z.looseObject({
  type: z.literal("AllowedValues").optional(),
  values: z.array(NumberOrSpecialSchema).min(1).optional(),
  intervals: z.array(z.tuple([NumberOrSpecialSchema, NumberOrSpecialSchema])).min(1).optional(),
  significantFigures: z.number().int().min(1).max(40).optional(),
});
export type AllowedValues = z.infer<typeof AllowedValuesSchema>;

export const AllowedTokensSchema = z.looseObject({
  type: z.literal("AllowedTokens").optional(),
  values: z.array(z.string().min(1)).min(1).optional(),
  pattern: z.string().min(1).optional(),
});
export type AllowedTokens = z.infer<typeof AllowedTokensSchema>;

export const AllowedTimesSchema = z.looseObject({
  type: z.literal("AllowedTimes").optional(),
  values: z.array(DateTimeNumberOrSpecialSchema).min(1).optional(),
  intervals: z.array(z.tuple([DateTimeNumberOrSpecialSchema, DateTimeNumberOrSpecialSchema])).optional(),
  significantFigures: z.number().int().min(1).max(40).optional(),
});
export type AllowedTimes = z.infer<typeof AllowedTimesSchema>;

function nilValuesSchema<V extends z.ZodType>(valueSchema: V) {
  return z
    .array(
      z.object({
        reason: z.string(),
        value: valueSchema,
      }),
    )
    .min(1);
}
export const NilValuesTextSchema = nilValuesSchema(z.string());
export const NilValuesIntegerSchema = nilValuesSchema(z.number().int());
export const NilValuesNumberSchema = nilValuesSchema(NumberOrSpecialSchema);
export const NilValuesTimeSchema = nilValuesSchema(DateTimeNumberOrSpecialSchema);

export const NameTokenSchema = z.string().min(1).regex(/^[A-Za-z][A-Za-z0-9_-]*$/);
export type NameToken = z.infer<typeof NameTokenSchema>;

/** Mixin shape: gives a component a soft (semantic, non-unique) local name. */
export const SoftNamedPropertyShape = { name: NameTokenSchema };

export const AssociationAttributeGroupSchema = z.looseObject({
  href: z.string(),
  role: z.string().optional(),
  arcrole: z.string().optional(),
  title: z.string().min(1).optional(),
});
export type AssociationAttributeGroup = z.infer<typeof AssociationAttributeGroupSchema>;

export const ElementCountSchema = z.looseObject({
  id: z.string().optional(),
  label: z.string().optional(),
  description: z.string().optional(),
  type: z.string().optional(),
  updatable: z.boolean().optional(),
  optional: z.boolean().optional(),
  definition: z.string().optional(),
  referenceFrame: z.string().optional(),
  axisID: z.string().optional(),
  constraint: AllowedValuesSchema.optional(),
  value: z.number().int().optional(),
});
export type ElementCount = z.infer<typeof ElementCountSchema>;

/** Either an inline encoded value block, or a link to one hosted elsewhere. */
export const EncodedValuesSchema = z.union([z.array(z.unknown()), AssociationAttributeGroupSchema]);
export type EncodedValues = z.infer<typeof EncodedValuesSchema>;

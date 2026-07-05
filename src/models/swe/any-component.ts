import { z } from "zod";
import {
  AllowedTimesSchema,
  AllowedTokensSchema,
  AllowedValuesSchema,
  AssociationAttributeGroupSchema,
  DateTimeNumberOrSpecialSchema,
  ElementCountSchema,
  EncodedValuesSchema,
  NilValuesIntegerSchema,
  NilValuesNumberSchema,
  NilValuesTextSchema,
  NilValuesTimeSchema,
  NumberOrSpecialSchema,
  SoftNamedPropertyShape,
  UnitReferenceSchema,
  type AssociationAttributeGroup,
  type ElementCount,
  type EncodedValues,
} from "./basic-types.js";
import { AnyEncodingSchema, type AnyEncoding } from "./encodings.js";
import { GeometrySchema } from "../common/geometry.js";

/**
 * SWE Common `AnyComponent` is the recursion knot shared by SensorML process
 * inputs/outputs/parameters, characteristics/capabilities, Property qualifiers,
 * and Part 2 datastream/controlstream result & record schemas.
 *
 * allOf-based inheritance is modeled with plain shared *shapes* (spread with `...`)
 * rather than `.extend()` chains, so every concrete component stays a `ZodObject`
 * (a requirement for `z.discriminatedUnion`).
 */

const sweIdentifiableShape = {
  id: z.string().min(1).optional(),
  label: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
};

const dataComponentShape = {
  ...sweIdentifiableShape,
  updatable: z.boolean().default(false).optional(),
  optional: z.boolean().default(false).optional(),
  definition: z.string(),
};

const simpleComponentShape = {
  ...dataComponentShape,
  referenceFrame: z.string().optional(),
  axisID: z.string().min(1).optional(),
};

// ---- Scalars ----

export const BooleanComponentSchema = z.looseObject({
  ...simpleComponentShape,
  type: z.literal("Boolean"),
  value: z.boolean().optional(),
});
export type BooleanComponent = z.infer<typeof BooleanComponentSchema>;

export const CountComponentSchema = z.looseObject({
  ...simpleComponentShape,
  type: z.literal("Count"),
  constraint: AllowedValuesSchema.optional(),
  nilValues: NilValuesIntegerSchema.optional(),
  value: z.number().int().optional(),
});
export type CountComponent = z.infer<typeof CountComponentSchema>;

export const QuantityComponentSchema = z.looseObject({
  ...simpleComponentShape,
  type: z.literal("Quantity"),
  uom: UnitReferenceSchema,
  constraint: AllowedValuesSchema.optional(),
  nilValues: NilValuesNumberSchema.optional(),
  value: NumberOrSpecialSchema.optional(),
});
export type QuantityComponent = z.infer<typeof QuantityComponentSchema>;

export const TimeComponentSchema = z.looseObject({
  ...simpleComponentShape,
  type: z.literal("Time"),
  referenceTime: z.string().optional(),
  localFrame: z.string().optional(),
  uom: UnitReferenceSchema,
  constraint: AllowedTimesSchema.optional(),
  nilValues: NilValuesTimeSchema.optional(),
  value: DateTimeNumberOrSpecialSchema.optional(),
});
export type TimeComponent = z.infer<typeof TimeComponentSchema>;

export const CategoryComponentSchema = z.looseObject({
  ...simpleComponentShape,
  type: z.literal("Category"),
  codeSpace: z.string().optional(),
  constraint: AllowedTokensSchema.optional(),
  nilValues: NilValuesTextSchema.optional(),
  value: z.string().optional(),
});
export type CategoryComponent = z.infer<typeof CategoryComponentSchema>;

export const TextComponentSchema = z.looseObject({
  ...simpleComponentShape,
  type: z.literal("Text"),
  constraint: AllowedTokensSchema.optional(),
  nilValues: NilValuesTextSchema.optional(),
  value: z.string().optional(),
});
export type TextComponent = z.infer<typeof TextComponentSchema>;

// ---- Ranges ----

export const CountRangeComponentSchema = z.looseObject({
  ...simpleComponentShape,
  type: z.literal("CountRange"),
  constraint: AllowedValuesSchema.optional(),
  nilValues: NilValuesTextSchema.optional(),
  value: z.tuple([z.number().int(), z.number().int()]).optional(),
});
export type CountRangeComponent = z.infer<typeof CountRangeComponentSchema>;

export const QuantityRangeComponentSchema = z.looseObject({
  ...simpleComponentShape,
  type: z.literal("QuantityRange"),
  uom: UnitReferenceSchema,
  constraint: AllowedValuesSchema.optional(),
  nilValues: NilValuesNumberSchema.optional(),
  value: z.tuple([NumberOrSpecialSchema, NumberOrSpecialSchema]).optional(),
});
export type QuantityRangeComponent = z.infer<typeof QuantityRangeComponentSchema>;

export const TimeRangeComponentSchema = z.looseObject({
  ...simpleComponentShape,
  type: z.literal("TimeRange"),
  referenceTime: z.string().optional(),
  localFrame: z.string().optional(),
  uom: UnitReferenceSchema,
  constraint: AllowedTimesSchema.optional(),
  nilValues: NilValuesTimeSchema.optional(),
  value: z.tuple([DateTimeNumberOrSpecialSchema, DateTimeNumberOrSpecialSchema]).optional(),
});
export type TimeRangeComponent = z.infer<typeof TimeRangeComponentSchema>;

export const CategoryRangeComponentSchema = z.looseObject({
  ...simpleComponentShape,
  type: z.literal("CategoryRange"),
  codeSpace: z.string().optional(),
  constraint: AllowedTokensSchema.optional(),
  nilValues: NilValuesTextSchema.optional(),
  value: z.tuple([z.string(), z.string()]).optional(),
});
export type CategoryRangeComponent = z.infer<typeof CategoryRangeComponentSchema>;

// ---- Aggregates (recursive) ----

/** A named slot holding either an inline component or a link to one (`AssociationAttributeGroup`). */
export type NamedComponentSlot = { name: string } & (AnyComponent | z.infer<typeof AssociationAttributeGroupSchema>);

const NamedComponentOrLinkSchema: z.ZodType<NamedComponentSlot> = z.lazy(() =>
  z.union([
    z.looseObject({ ...SoftNamedPropertyShape, ...AssociationAttributeGroupSchema.shape }),
    z.looseObject({ ...SoftNamedPropertyShape }).and(AnyComponentSchema),
  ]),
) as z.ZodType<NamedComponentSlot>;

export interface DataRecordComponent {
  id?: string;
  label?: string;
  description?: string;
  updatable?: boolean;
  optional?: boolean;
  definition?: string;
  type: "DataRecord";
  fields: NamedComponentSlot[];
  [key: string]: unknown;
}

export const DataRecordComponentSchema: z.ZodType<DataRecordComponent> = z.lazy(() =>
  z.looseObject({
    ...dataComponentShape,
    definition: z.string().optional(),
    type: z.literal("DataRecord"),
    fields: z.array(NamedComponentOrLinkSchema).min(1),
  }),
) as z.ZodType<DataRecordComponent>;

export interface VectorComponent {
  id?: string;
  label?: string;
  description?: string;
  updatable?: boolean;
  optional?: boolean;
  definition: string;
  type: "Vector";
  referenceFrame: string;
  localFrame?: string;
  coordinates: Array<
    { name: string } & (CountComponent | QuantityComponent | TimeComponent)
  >;
  [key: string]: unknown;
}

export const VectorComponentSchema: z.ZodType<VectorComponent> = z.looseObject({
  ...dataComponentShape,
  type: z.literal("Vector"),
  referenceFrame: z.string(),
  localFrame: z.string().optional(),
  coordinates: z.array(
    z.looseObject({ ...SoftNamedPropertyShape }).and(
      z.union([CountComponentSchema, QuantityComponentSchema, TimeComponentSchema]),
    ),
  ),
}) as z.ZodType<VectorComponent>;

export interface DataArrayComponent {
  id?: string;
  label?: string;
  description?: string;
  updatable?: boolean;
  optional?: boolean;
  definition?: string;
  type: "DataArray";
  elementCount?: ElementCount | AssociationAttributeGroup;
  elementType: NamedComponentSlot;
  encoding?: AnyEncoding;
  values?: EncodedValues;
  [key: string]: unknown;
}

export const DataArrayComponentSchema: z.ZodType<DataArrayComponent> = z.lazy(() =>
  z.looseObject({
    ...dataComponentShape,
    definition: z.string().optional(),
    type: z.literal("DataArray"),
    elementCount: z.union([AssociationAttributeGroupSchema, ElementCountSchema]).optional(),
    elementType: NamedComponentOrLinkSchema,
    encoding: AnyEncodingSchema.optional(),
    values: EncodedValuesSchema.optional(),
  }),
) as z.ZodType<DataArrayComponent>;

export interface MatrixComponent extends Omit<DataArrayComponent, "type"> {
  type: "Matrix";
  referenceFrame?: string;
  localFrame?: string;
}

export const MatrixComponentSchema: z.ZodType<MatrixComponent> = z.lazy(() =>
  z.looseObject({
    ...dataComponentShape,
    definition: z.string().optional(),
    type: z.literal("Matrix"),
    referenceFrame: z.string().optional(),
    localFrame: z.string().optional(),
    elementCount: z.union([AssociationAttributeGroupSchema, ElementCountSchema]).optional(),
    elementType: NamedComponentOrLinkSchema,
    encoding: AnyEncodingSchema.optional(),
    values: EncodedValuesSchema.optional(),
  }),
) as z.ZodType<MatrixComponent>;

export interface DataChoiceComponent {
  id?: string;
  label?: string;
  description?: string;
  updatable?: boolean;
  optional?: boolean;
  definition?: string;
  type: "DataChoice";
  choiceValue?: CategoryComponent;
  items: NamedComponentSlot[];
  [key: string]: unknown;
}

export const DataChoiceComponentSchema: z.ZodType<DataChoiceComponent> = z.lazy(() =>
  z.looseObject({
    ...dataComponentShape,
    definition: z.string().optional(),
    type: z.literal("DataChoice"),
    choiceValue: CategoryComponentSchema.optional(),
    items: z.array(NamedComponentOrLinkSchema),
  }),
) as z.ZodType<DataChoiceComponent>;

export const SweGeometryConstraintSchema = z.object({
  geomTypes: z
    .array(z.enum(["Point", "MultiPoint", "LineString", "MultiLineString", "Polygon", "MultiPolygon"]))
    .optional(),
});

export const SweGeometryComponentSchema = z.looseObject({
  ...dataComponentShape,
  type: z.literal("Geometry"),
  constraint: SweGeometryConstraintSchema.optional(),
  nilValues: NilValuesTextSchema.optional(),
  srs: z.string(),
  value: GeometrySchema.optional(),
});
export type SweGeometryComponent = z.infer<typeof SweGeometryComponentSchema>;

// ---- The union ----

export type AnyScalarComponent =
  | BooleanComponent
  | CountComponent
  | QuantityComponent
  | TimeComponent
  | CategoryComponent
  | TextComponent;

export type AnySimpleComponent =
  | AnyScalarComponent
  | CountRangeComponent
  | QuantityRangeComponent
  | TimeRangeComponent
  | CategoryRangeComponent;

export type AnyComponent =
  | AnySimpleComponent
  | DataRecordComponent
  | VectorComponent
  | DataArrayComponent
  | MatrixComponent
  | DataChoiceComponent
  | SweGeometryComponent;

const AnyScalarComponentSchema = z.discriminatedUnion("type", [
  BooleanComponentSchema,
  CountComponentSchema,
  QuantityComponentSchema,
  TimeComponentSchema,
  CategoryComponentSchema,
  TextComponentSchema,
]);

const AnySimpleComponentSchema = z.discriminatedUnion("type", [
  BooleanComponentSchema,
  CountComponentSchema,
  QuantityComponentSchema,
  TimeComponentSchema,
  CategoryComponentSchema,
  TextComponentSchema,
  CountRangeComponentSchema,
  QuantityRangeComponentSchema,
  TimeRangeComponentSchema,
  CategoryRangeComponentSchema,
]);

/** The full recursive SWE Common component union. See module docs for the recursion knot rationale. */
export const AnyComponentSchema: z.ZodType<AnyComponent> = z.lazy(() =>
  z.union([
    AnySimpleComponentSchema,
    DataRecordComponentSchema,
    VectorComponentSchema,
    DataArrayComponentSchema,
    MatrixComponentSchema,
    DataChoiceComponentSchema,
    SweGeometryComponentSchema,
  ]),
);

export { AnyScalarComponentSchema, AnySimpleComponentSchema };

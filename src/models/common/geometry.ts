import { z } from "zod";

/** Standard GeoJSON geometry union used as the `geometry` member of CS Feature resources. */
const PositionSchema = z.array(z.number()).min(2);

const PointSchema = z.looseObject({
  type: z.literal("Point"),
  coordinates: PositionSchema,
});
const MultiPointSchema = z.looseObject({
  type: z.literal("MultiPoint"),
  coordinates: z.array(PositionSchema),
});
const LineStringSchema = z.looseObject({
  type: z.literal("LineString"),
  coordinates: z.array(PositionSchema).min(2),
});
const MultiLineStringSchema = z.looseObject({
  type: z.literal("MultiLineString"),
  coordinates: z.array(z.array(PositionSchema).min(2)),
});
const PolygonSchema = z.looseObject({
  type: z.literal("Polygon"),
  coordinates: z.array(z.array(PositionSchema).min(4)),
});
const MultiPolygonSchema = z.looseObject({
  type: z.literal("MultiPolygon"),
  coordinates: z.array(z.array(z.array(PositionSchema).min(4))),
});

export type Geometry =
  | z.infer<typeof PointSchema>
  | z.infer<typeof MultiPointSchema>
  | z.infer<typeof LineStringSchema>
  | z.infer<typeof MultiLineStringSchema>
  | z.infer<typeof PolygonSchema>
  | z.infer<typeof MultiPolygonSchema>
  | GeometryCollection;

export interface GeometryCollection {
  type: "GeometryCollection";
  geometries: Geometry[];
  [key: string]: unknown;
}

const GeometryCollectionSchema: z.ZodType<GeometryCollection> = z.looseObject({
  type: z.literal("GeometryCollection"),
  geometries: z.array(z.lazy(() => GeometrySchema)),
});

const SimpleGeometrySchema = z.discriminatedUnion("type", [
  PointSchema,
  MultiPointSchema,
  LineStringSchema,
  MultiLineStringSchema,
  PolygonSchema,
  MultiPolygonSchema,
]);

export const GeometrySchema: z.ZodType<Geometry> = z.lazy(() =>
  z.union([SimpleGeometrySchema, GeometryCollectionSchema]),
);

/** GeoJSON `geometry` member: a Geometry object, or null for feature-less resources (e.g. Procedure). */
export const NullableGeometrySchema = z.union([GeometrySchema, z.null()]);

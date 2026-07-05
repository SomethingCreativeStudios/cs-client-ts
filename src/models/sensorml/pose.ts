import { z } from "zod";

const anglesYPRShape = {
  yaw: z.number(),
  pitch: z.number(),
  roll: z.number(),
};
const quaternionShape = { x: z.number(), y: z.number(), z: z.number(), w: z.number() };
const positionGeoShape = { lat: z.number(), lon: z.number(), h: z.number() };
const positionXYZShape = { x: z.number(), y: z.number(), z: z.number() };

const GeoPoseYPRSchema = z.looseObject({
  type: z.literal("GeoPose"),
  ltpReferenceFrame: z.string().optional(),
  position: z.looseObject(positionGeoShape),
  angles: z.looseObject(anglesYPRShape),
});
const GeoPoseQuaternionSchema = z.looseObject({
  type: z.literal("GeoPose"),
  ltpReferenceFrame: z.string().optional(),
  position: z.looseObject(positionGeoShape),
  quaternion: z.looseObject(quaternionShape),
});
const RelativePoseYPRSchema = z.looseObject({
  type: z.literal("RelativePose"),
  referenceFrame: z.string(),
  position: z.looseObject(positionXYZShape),
  angles: z.looseObject(anglesYPRShape),
});
const RelativePoseQuaternionSchema = z.looseObject({
  type: z.literal("RelativePose"),
  referenceFrame: z.string(),
  position: z.looseObject(positionXYZShape),
  quaternion: z.looseObject(quaternionShape),
});

/** A GeoPose (basic YPR/quaternion) or a RelativePose (YPR/quaternion) — distinguished by which orientation field is present. */
export const PoseSchema = z.union([
  GeoPoseYPRSchema,
  GeoPoseQuaternionSchema,
  RelativePoseYPRSchema,
  RelativePoseQuaternionSchema,
]);
export type Pose = z.infer<typeof PoseSchema>;

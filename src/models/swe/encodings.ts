import { z } from "zod";

export const JSONEncodingSchema = z.looseObject({
  id: z.string().optional(),
  type: z.literal("JSONEncoding"),
  recordsAsArrays: z.boolean().default(false).optional(),
  vectorsAsArrays: z.boolean().default(false).optional(),
});
export type JSONEncoding = z.infer<typeof JSONEncodingSchema>;

export const TextEncodingSchema = z.looseObject({
  id: z.string().optional(),
  type: z.literal("TextEncoding"),
  collapseWhiteSpaces: z.boolean().optional(),
  decimalSeparator: z.string().min(1).optional(),
  tokenSeparator: z.string().min(1),
  blockSeparator: z.string().min(1),
});
export type TextEncoding = z.infer<typeof TextEncodingSchema>;

export const XMLEncodingSchema = z.looseObject({
  id: z.string().optional(),
  type: z.literal("XMLEncoding"),
  namespace: z.string().optional(),
});
export type XMLEncoding = z.infer<typeof XMLEncodingSchema>;

const BinaryComponentSchema = z.looseObject({
  type: z.literal("Component"),
  encryption: z.string().optional(),
  significantBits: z.number().int().optional(),
  bitLength: z.number().int().optional(),
  byteLength: z.number().int().optional(),
  dataType: z.string(),
  ref: z.string(),
});
const BinaryBlockSchema = z.looseObject({
  type: z.literal("Block"),
  compression: z.string().optional(),
  encryption: z.string().optional(),
  "paddingBytes-after": z.number().int().optional(),
  "paddingBytes-before": z.number().int().optional(),
  byteLength: z.number().int().optional(),
  ref: z.string(),
});

export const BinaryEncodingSchema = z.looseObject({
  id: z.string().optional(),
  type: z.literal("BinaryEncoding"),
  byteOrder: z.enum(["bigEndian", "littleEndian"]),
  byteEncoding: z.enum(["base64", "raw"]),
  byteLength: z.number().int().optional(),
  members: z.array(z.union([BinaryComponentSchema, BinaryBlockSchema])).min(1),
});
export type BinaryEncoding = z.infer<typeof BinaryEncodingSchema>;

/** Encoding methods usable for array/stream values. This client only decodes JSON payloads;
 * Text/XML/Binary encodings are modeled for schema completeness (see project README). */
export const AnyEncodingSchema = z.union([
  JSONEncodingSchema,
  TextEncodingSchema,
  XMLEncodingSchema,
  BinaryEncodingSchema,
]);
export type AnyEncoding = z.infer<typeof AnyEncodingSchema>;

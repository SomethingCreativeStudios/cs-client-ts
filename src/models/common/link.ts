import { z } from "zod";

/** Web Linking style link object (RFC5988 / RFC6690). */
export const LinkSchema = z.looseObject({
  href: z.string(),
  rel: z.string().optional(),
  type: z.string().optional(),
  hreflang: z.string().optional(),
  title: z.string().optional(),
  uid: z.string().optional(),
  rt: z.string().optional(),
  if: z.string().optional(),
});
export type Link = z.infer<typeof LinkSchema>;

/** Lightweight cross-reference link used within SensorML/SWE documents. */
export const XLinkSchema = z.looseObject({
  href: z.string(),
  arcrole: z.string().optional(),
  type: z.string().optional(),
  title: z.string().optional(),
  uid: z.string().optional(),
});
export type XLink = z.infer<typeof XLinkSchema>;

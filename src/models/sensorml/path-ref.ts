import { z } from "zod";

/** Path reference into a process's own inputs/outputs/parameters/modes/components tree. */
export const PATH_REF_PATTERN =
  /^(components|inputs|outputs|parameters|modes)\/([A-Za-z][A-Za-z0-9_-]*\/)*[A-Za-z][A-Za-z0-9_-]*$/;

export const PathRefSchema = z.string().regex(PATH_REF_PATTERN);
export type PathRef = z.infer<typeof PathRefSchema>;

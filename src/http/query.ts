/** A CS datetime query instant: RFC 3339 date/time, Date, or a special value such as "now" or "latest". */
export type DateTimeInstantQuery = string | Date;

/** An open or closed time interval; either bound may be omitted for an open range. */
export interface TimeInterval {
  start?: DateTimeInstantQuery;
  end?: DateTimeInstantQuery;
}

export type DateTimeQuery = DateTimeInstantQuery | TimeInterval;
export type KeywordQuery = string | string[];
export type QueryParamValue = string | number | boolean | Date | string[] | number[] | TimeInterval | undefined;
export type QueryParams = Record<string, QueryParamValue>;

function formatInstant(v: DateTimeInstantQuery): string {
  return v instanceof Date ? v.toISOString() : v;
}

function formatValue(value: QueryParamValue): string | undefined {
  if (value === undefined) return undefined;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.length ? value.join(",") : undefined;
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  // TimeInterval
  const start = value.start !== undefined ? formatInstant(value.start) : "..";
  const end = value.end !== undefined ? formatInstant(value.end) : "..";
  return `${start}/${end}`;
}

/** Serialize CS API query parameters (comma-separated lists, bbox, RFC 3339 intervals with ".." for open ends). */
export function buildQueryString(params: QueryParams | undefined): string {
  if (!params) return "";
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const formatted = formatValue(value);
    if (formatted !== undefined) search.set(key, formatted);
  }
  const str = search.toString();
  return str ? `?${str}` : "";
}

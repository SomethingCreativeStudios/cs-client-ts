import { z } from "zod";
import { HttpClient } from "../http/http-client.js";
import type { Page } from "../http/pagination.js";
import type { QueryParams } from "../http/query.js";
import { MediaTypes } from "../http/media-types.js";

/** Shared plumbing for GeoJSON/SensorML dual-encoded Part 1 endpoints. */
export abstract class DualEncodingEndpoint {
  constructor(protected readonly http: HttpClient) {}

  protected acceptFor(format: "geojson" | "sml"): string {
    return format === "geojson" ? MediaTypes.geoJson : MediaTypes.smlJson;
  }

  protected async getRaw<T>(
    path: string,
    format: "geojson" | "sml",
    schema: z.ZodType<T>,
    resourceName: string,
    query?: QueryParams,
  ): Promise<T> {
    const { data } = await this.http.request("GET", path, {
      query,
      accept: this.acceptFor(format),
      schema,
      resourceName,
    });
    return data;
  }

  protected async listRaw<T>(
    path: string,
    format: "geojson" | "sml",
    itemSchema: z.ZodType<T>,
    query: QueryParams | undefined,
    itemsKey: string,
  ): Promise<Page<T>> {
    const pageSchema = z.looseObject({ [itemsKey]: z.array(itemSchema) }) as z.ZodType<Record<string, unknown>>;
    return this.http.fetchPage<T>(path, itemsKey, { query, accept: this.acceptFor(format), schema: pageSchema });
  }

  protected async createRaw(path: string, body: unknown, format: "geojson" | "sml"): Promise<string> {
    return this.http.create(path, body, { contentType: this.acceptFor(format) });
  }

  protected async createManyRaw(path: string, bodies: unknown[], format: "geojson" | "sml"): Promise<string[]> {
    const { data, response } = await this.http.request<unknown>("POST", path, { body: bodies, contentType: this.acceptFor(format) });
    const location = response.headers.get("location");
    if (location) return [location.split("/").filter(Boolean).pop()!];
    const entries = Array.isArray(data)
      ? data
      : data !== null && typeof data === "object" && Array.isArray((data as { items?: unknown }).items)
        ? (data as { items: unknown[] }).items
        : [];
    return entries.flatMap((entry) => {
      if (typeof entry === "string") return [entry];
      if (entry === null || typeof entry !== "object") return [];
      const { id, location } = entry as { id?: unknown; location?: unknown };
      if (typeof location === "string") return [location.split("/").filter(Boolean).pop() ?? location];
      return typeof id === "string" ? [id] : [];
    });
  }

  protected async updateRaw(path: string, body: unknown, format: "geojson" | "sml"): Promise<void> {
    await this.http.request("PUT", path, { body, contentType: this.acceptFor(format) });
  }

  protected async deleteRaw(path: string, query?: QueryParams): Promise<void> {
    await this.http.request("DELETE", path, { query });
  }
}

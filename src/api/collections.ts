import { z } from "zod";
import { HttpClient } from "../http/http-client.js";
import type { Page } from "../http/pagination.js";
import type { DateTimeQuery, KeywordQuery, QueryParams } from "../http/query.js";
import { LinkSchema, type Link } from "../models/common/link.js";

const CollectionSchema = z.looseObject({
  id: z.string(),
  title: z.string().optional(),
  description: z.string().optional(),
  itemType: z.string().optional(),
  links: z.array(LinkSchema).optional(),
});
export type Collection = z.infer<typeof CollectionSchema>;

export interface CollectionQueryParams extends QueryParams {
  bbox?: [number, number, number, number];
  datetime?: DateTimeQuery;
  geom?: string;
  q?: KeywordQuery;
  limit?: number;
}

/**
 * Collections aggregate heterogeneous resources (systems, deployments, procedures,
 * sampling features, properties). Item bodies are returned as loosely-typed JSON —
 * decode them with the relevant resource codec (e.g. `systemFromGeoJson`) based on
 * `itemType`/`featureType` if you need the common model.
 */
export class CollectionsApi {
  constructor(private readonly http: HttpClient) {}

  async list(params?: CollectionQueryParams): Promise<Page<Collection>> {
    const { data } = await this.http.request<{ collections: Collection[]; links?: Link[] }>("GET", "/collections", {
      query: params,
      schema: z.looseObject({ collections: z.array(CollectionSchema), links: z.array(LinkSchema).optional() }),
      resourceName: "Collection",
    });
    return { items: data.collections, links: data.links ?? [] };
  }

  async get(id: string): Promise<Collection> {
    const { data } = await this.http.request(`GET`, `/collections/${id}`, { schema: CollectionSchema, resourceName: "Collection" });
    return data;
  }

  async items<T = unknown>(id: string, params?: CollectionQueryParams): Promise<Page<T>> {
    return this.http.fetchPage<T>(`/collections/${id}/items`, "features", { query: params });
  }

  async item<T = unknown>(id: string, resourceId: string): Promise<T> {
    const { data } = await this.http.request<T>("GET", `/collections/${id}/items/${resourceId}`);
    return data;
  }

  async addItem(id: string, item: unknown, contentType: string): Promise<string> {
    return this.http.create(`/collections/${id}/items`, item, { contentType });
  }

  async removeItem(id: string, resourceId: string): Promise<void> {
    await this.http.request("DELETE", `/collections/${id}/items/${resourceId}`);
  }
}

import { z } from "zod";
import { HttpClient } from "../http/http-client.js";
import type { Page } from "../http/pagination.js";
import type { DateTimeQuery, QueryParams } from "../http/query.js";
import { MediaTypes } from "../http/media-types.js";
import { ObservationCreateSchema, ObservationSchema, type Observation, type ObservationCreate } from "../models/resources/observation.js";

export interface ObservationQueryParams extends QueryParams {
  id?: string[];
  dataStream?: string[];
  /** @deprecated Use `dataStream`; the wire query parameter uses this casing. */
  datastream?: string[];
  phenomenonTime?: DateTimeQuery;
  resultTime?: DateTimeQuery;
  system?: string[];
  foi?: string[];
  observedProperty?: string[];
  limit?: number;
}

function normalizeObservationQuery(params: ObservationQueryParams | undefined): QueryParams | undefined {
  if (!params) return undefined;
  const { datastream, ...query } = params;
  return datastream !== undefined && query.dataStream === undefined ? { ...query, dataStream: datastream } : query;
}

export class ObservationsApi {
  constructor(private readonly http: HttpClient) {}

  async get(id: string): Promise<Observation> {
    const { data } = await this.http.request(`GET`, `/observations/${id}`, {
      accept: MediaTypes.json,
      schema: ObservationSchema,
      resourceName: "Observation",
    });
    return data;
  }

  async list(params?: ObservationQueryParams): Promise<Page<Observation>> {
    return this.http.fetchPage<Observation>("/observations", "items", {
      query: normalizeObservationQuery(params),
      accept: MediaTypes.json,
      schema: z.looseObject({ items: z.array(ObservationSchema) }) as never,
    });
  }

  async *listAll(params?: ObservationQueryParams): AsyncGenerator<Observation> {
    let page = await this.list(params);
    while (true) {
      yield* page.items;
      if (!page.next) return;
      page = await page.next();
    }
  }

  async delete(id: string): Promise<void> {
    await this.http.request("DELETE", `/observations/${id}`);
  }

  async update(id: string, observation: ObservationCreate): Promise<void> {
    const validated = ObservationCreateSchema.parse(observation);
    await this.http.request("PUT", `/observations/${id}`, { body: validated, contentType: MediaTypes.json });
  }
}

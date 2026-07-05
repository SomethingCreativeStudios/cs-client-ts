import { z } from "zod";
import { HttpClient } from "../http/http-client.js";
import type { Page } from "../http/pagination.js";
import type { DateTimeQuery, KeywordQuery, QueryParams } from "../http/query.js";
import { MediaTypes } from "../http/media-types.js";
import { DataStreamSchema, DataStreamCreateSchema, type DataStream, type DataStreamCreate } from "../models/resources/data-stream.js";
import { ObservationSchemaDescriptorSchema, type ObservationSchemaDescriptor } from "../models/resources/observation-schema.js";
import { ObservationCreateSchema, ObservationSchema as ObservationWireSchema, type Observation, type ObservationCreate } from "../models/resources/observation.js";

export interface DataStreamQueryParams extends QueryParams {
  id?: string[];
  datetime?: DateTimeQuery;
  q?: KeywordQuery;
  /** @deprecated Use `q`; the wire query parameter is named `q` in the CS API spec. */
  keyword?: KeywordQuery;
  phenomenonTime?: DateTimeQuery;
  resultTime?: DateTimeQuery;
  system?: string[];
  foi?: string[];
  observedProperty?: string[];
  limit?: number;
}

export interface DataStreamForSystemQueryParams extends QueryParams {
  datetime?: DateTimeQuery;
  q?: KeywordQuery;
  /** @deprecated Use `q`; the wire query parameter is named `q` in the CS API spec. */
  keyword?: KeywordQuery;
  phenomenonTime?: DateTimeQuery;
  resultTime?: DateTimeQuery;
  limit?: number;
}

export interface DataStreamObservationQueryParams extends QueryParams {
  id?: string[];
  phenomenonTime?: DateTimeQuery;
  resultTime?: DateTimeQuery;
  foi?: string[];
  observedProperty?: string[];
  limit?: number;
}

const PageEnvelopeSchema = <T extends z.ZodType>(itemSchema: T) => z.looseObject({ items: z.array(itemSchema) });

function normalizeKeywordQuery(params: (DataStreamQueryParams | DataStreamForSystemQueryParams) | undefined): QueryParams | undefined {
  if (!params) return undefined;
  const { keyword, ...query } = params;
  return keyword !== undefined && query.q === undefined ? { ...query, q: keyword } : query;
}

export class DataStreamsApi {
  constructor(private readonly http: HttpClient) {}

  async get(id: string): Promise<DataStream> {
    const { data } = await this.http.request(`GET`, `/datastreams/${id}`, {
      accept: MediaTypes.json,
      schema: DataStreamSchema,
      resourceName: "DataStream",
    });
    return data;
  }

  async list(params?: DataStreamQueryParams): Promise<Page<DataStream>> {
    return this.http.fetchPage<DataStream>("/datastreams", "items", {
      query: normalizeKeywordQuery(params),
      accept: MediaTypes.json,
      schema: PageEnvelopeSchema(DataStreamSchema) as never,
    });
  }

  async forSystem(systemId: string, params?: DataStreamForSystemQueryParams): Promise<Page<DataStream>> {
    return this.http.fetchPage<DataStream>(`/systems/${systemId}/datastreams`, "items", {
      query: normalizeKeywordQuery(params),
      accept: MediaTypes.json,
      schema: PageEnvelopeSchema(DataStreamSchema) as never,
    });
  }

  async *listAll(params?: DataStreamQueryParams): AsyncGenerator<DataStream> {
    let page = await this.list(params);
    while (true) {
      yield* page.items;
      if (!page.next) return;
      page = await page.next();
    }
  }

  async create(systemId: string, dataStream: DataStreamCreate): Promise<string> {
    const validated = DataStreamCreateSchema.parse(dataStream);
    return this.http.create(`/systems/${systemId}/datastreams`, validated, { contentType: MediaTypes.json });
  }

  async update(id: string, dataStream: DataStream): Promise<void> {
    await this.http.request("PUT", `/datastreams/${id}`, { body: dataStream, contentType: MediaTypes.json });
  }

  async delete(id: string): Promise<void> {
    await this.http.request("DELETE", `/datastreams/${id}`);
  }

  /** `obsFormat` is required by the spec — the schema shape returned depends on it. */
  async schema(id: string, obsFormat: string): Promise<ObservationSchemaDescriptor> {
    const { data } = await this.http.request(`GET`, `/datastreams/${id}/schema`, {
      query: { obsFormat },
      schema: ObservationSchemaDescriptorSchema,
      resourceName: "ObservationSchema",
    });
    return data;
  }

  async putSchema(id: string, schema: ObservationSchemaDescriptor): Promise<void> {
    await this.http.request("PUT", `/datastreams/${id}/schema`, { body: schema, contentType: MediaTypes.json });
  }

  async observations(id: string, params?: DataStreamObservationQueryParams): Promise<Page<Observation>> {
    return this.http.fetchPage<Observation>(`/datastreams/${id}/observations`, "items", {
      query: params,
      accept: MediaTypes.json,
      schema: PageEnvelopeSchema(ObservationWireSchema) as never,
    });
  }

  async createObservation(id: string, observation: ObservationCreate): Promise<string> {
    const validated = ObservationCreateSchema.parse(observation);
    return this.http.create(`/datastreams/${id}/observations`, validated, { contentType: MediaTypes.json });
  }
}

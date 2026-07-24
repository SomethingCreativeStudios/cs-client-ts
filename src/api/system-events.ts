import { z } from "zod";
import { HttpClient } from "../http/http-client.js";
import { mapPage, type Page } from "../http/pagination.js";
import type { DateTimeQuery, KeywordQuery, QueryParams } from "../http/query.js";
import { MediaTypes } from "../http/media-types.js";
import { SystemEventSchema, type SystemEvent } from "../models/resources/system-event.js";
import { SmlSystemSchema, type SmlSystem } from "../models/sensorml/sml-system.js";
import { systemFromSml, systemToGeoJson, systemToSml } from "../codec/system-codec.js";
import type { System, SystemInput } from "../models/resources/system.js";

export interface SystemEventQueryParams extends QueryParams {
  id?: string[];
  eventTime?: DateTimeQuery;
  /** @deprecated Use `eventTime`; the Part 2 wire query parameter is named `eventTime`. */
  datetime?: DateTimeQuery;
  eventType?: string[];
  q?: KeywordQuery;
  /** @deprecated Use `q`; the wire query parameter is named `q` in the CS API spec. */
  keyword?: KeywordQuery;
  system?: string[];
  limit?: number;
}

function normalizeKeywordQuery(params: SystemEventQueryParams | SystemHistoryQueryParams | undefined): QueryParams | undefined {
  if (!params) return undefined;
  const { keyword, ...query } = params;
  const normalized = keyword !== undefined && query.q === undefined ? { ...query, q: keyword } : query;
  if ('datetime' in normalized && normalized.datetime !== undefined && normalized.eventTime === undefined) {
    const { datetime, ...rest } = normalized;
    return { ...rest, eventTime: datetime };
  }
  return normalized;
}

export class SystemEventsApi {
  constructor(private readonly http: HttpClient) {}

  async list(systemId: string, params?: SystemEventQueryParams): Promise<Page<SystemEvent>> {
    return this.http.fetchPage<SystemEvent>(`/systems/${systemId}/events`, "items", {
      query: normalizeKeywordQuery(params),
      accept: MediaTypes.json,
      schema: z.looseObject({ items: z.array(SystemEventSchema) }) as never,
    });
  }

  async listGlobal(params?: SystemEventQueryParams): Promise<Page<SystemEvent>> {
    return this.http.fetchPage<SystemEvent>("/systemEvents", "items", {
      query: normalizeKeywordQuery(params),
      accept: MediaTypes.json,
      schema: z.looseObject({ items: z.array(SystemEventSchema) }) as never,
    });
  }

  async get(systemId: string, eventId: string): Promise<SystemEvent> {
    const { data } = await this.http.request(`GET`, `/systems/${systemId}/events/${eventId}`, {
      accept: MediaTypes.json,
      schema: SystemEventSchema,
      resourceName: "SystemEvent",
    });
    return data;
  }

  async getGlobal(eventId: string): Promise<SystemEvent> {
    const { data } = await this.http.request(`GET`, `/systemEvents/${eventId}`, {
      accept: MediaTypes.json,
      schema: SystemEventSchema,
      resourceName: "SystemEvent",
    });
    return data;
  }

  async create(systemId: string, event: SystemEvent): Promise<string> {
    return this.http.create(`/systems/${systemId}/events`, event, { contentType: MediaTypes.json });
  }

  async update(systemId: string, eventId: string, event: SystemEvent): Promise<void> {
    await this.http.request("PUT", `/systems/${systemId}/events/${eventId}`, { body: event, contentType: MediaTypes.json });
  }

  async updateGlobal(eventId: string, event: SystemEvent): Promise<void> {
    await this.http.request("PUT", `/systemEvents/${eventId}`, { body: event, contentType: MediaTypes.json });
  }

  async delete(systemId: string, eventId: string): Promise<void> {
    await this.http.request("DELETE", `/systems/${systemId}/events/${eventId}`);
  }

  async deleteGlobal(eventId: string): Promise<void> {
    await this.http.request("DELETE", `/systemEvents/${eventId}`);
  }
}

export interface SystemHistoryQueryParams extends QueryParams {
  validTime?: DateTimeQuery;
  q?: KeywordQuery;
  /** @deprecated Use `q`; the wire query parameter is named `q` in the CS API spec. */
  keyword?: KeywordQuery;
  limit?: number;
}

export type SystemHistoryFormat = "geojson" | "sml";

/** System descriptions are versioned over time; history items are Part 1 SensorML Systems. */
export class SystemHistoryApi {
  constructor(private readonly http: HttpClient) {}

  async list(systemId: string, params?: SystemHistoryQueryParams): Promise<Page<System>> {
    const page = await this.http.fetchPage<SmlSystem>(`/systems/${systemId}/history`, "items", {
      query: normalizeKeywordQuery(params),
      accept: MediaTypes.smlJson,
      schema: z.looseObject({ items: z.array(SmlSystemSchema) }) as never,
    });
    return mapPage(page, systemFromSml);
  }

  async getVersion(systemId: string, revId: string): Promise<System> {
    const { data } = await this.http.request(`GET`, `/systems/${systemId}/history/${revId}`, {
      accept: MediaTypes.smlJson,
      schema: SmlSystemSchema,
      resourceName: "System",
    });
    return systemFromSml(data);
  }

  async updateVersion(
    systemId: string,
    revId: string,
    system: SystemInput,
    opts: { format?: SystemHistoryFormat } = {},
  ): Promise<void> {
    const format = opts.format ?? "sml";
    const body = format === "geojson" ? systemToGeoJson(system) : systemToSml(system);
    await this.http.request("PUT", `/systems/${systemId}/history/${revId}`, {
      body,
      contentType: format === "geojson" ? MediaTypes.geoJson : MediaTypes.smlJson,
    });
  }

  async deleteVersion(systemId: string, revId: string): Promise<void> {
    await this.http.request("DELETE", `/systems/${systemId}/history/${revId}`);
  }
}

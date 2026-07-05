import { HttpClient } from "../http/http-client.js";
import { mapPage, type Page } from "../http/pagination.js";
import type { DateTimeQuery, KeywordQuery, QueryParams } from "../http/query.js";
import { DualEncodingEndpoint } from "./base-endpoint.js";
import { ProcedureFeatureSchema, type ProcedureFeature } from "../models/geojson/procedure-feature.js";
import { SmlProcedureSchema, type SmlProcedure } from "../models/sensorml/sml-procedure.js";
import { procedureFromGeoJson, procedureFromSml, procedureToGeoJson, procedureToSml } from "../codec/procedure-codec.js";
import type { Procedure, ProcedureInput } from "../models/resources/procedure.js";

export type ProcedureFormat = "geojson" | "sml" | "common";
const DEFAULT_FORMAT = "sml" as const;

export interface ProcedureQueryParams extends QueryParams {
  id?: string[];
  datetime?: DateTimeQuery;
  q?: KeywordQuery;
  observedProperty?: string[];
  controlledProperty?: string[];
  limit?: number;
}

export class ProceduresApi extends DualEncodingEndpoint {
  constructor(http: HttpClient) {
    super(http);
  }

  get(id: string, opts: { format: "sml" }): Promise<SmlProcedure>;
  get(id: string, opts: { format: "geojson" }): Promise<ProcedureFeature>;
  get(id: string, opts?: { format?: "common" }): Promise<Procedure>;
  async get(id: string, opts: { format?: ProcedureFormat } = {}): Promise<SmlProcedure | ProcedureFeature | Procedure> {
    const format = opts.format ?? "common";
    if (format === "sml") return this.getRaw(`/procedures/${id}`, "sml", SmlProcedureSchema, "Procedure");
    if (format === "geojson") return this.getRaw(`/procedures/${id}`, "geojson", ProcedureFeatureSchema, "Procedure");
    const doc = await this.getRaw(`/procedures/${id}`, DEFAULT_FORMAT, SmlProcedureSchema, "Procedure");
    return procedureFromSml(doc);
  }

  async list(params?: ProcedureQueryParams & { format?: ProcedureFormat }): Promise<Page<Procedure>> {
    const { format = "common", ...query } = params ?? {};
    if (format === "geojson") {
      const page = await this.listRaw("/procedures", "geojson", ProcedureFeatureSchema, query, "features");
      return mapPage(page, procedureFromGeoJson);
    }
    const page = await this.listRaw("/procedures", "sml", SmlProcedureSchema, query, "items");
    return mapPage(page, procedureFromSml);
  }

  async *listAll(params?: ProcedureQueryParams & { format?: ProcedureFormat }): AsyncGenerator<Procedure> {
    let page = await this.list(params);
    while (true) {
      yield* page.items;
      if (!page.next) return;
      page = await page.next();
    }
  }

  async create(procedure: ProcedureInput, opts: { format?: "geojson" | "sml" } = {}): Promise<string> {
    const format = opts.format ?? DEFAULT_FORMAT;
    const body = format === "geojson" ? procedureToGeoJson(procedure) : procedureToSml(procedure);
    return this.createRaw("/procedures", body, format);
  }

  async update(id: string, procedure: ProcedureInput, opts: { format?: "geojson" | "sml" } = {}): Promise<void> {
    const format = opts.format ?? DEFAULT_FORMAT;
    const body = format === "geojson" ? procedureToGeoJson(procedure) : procedureToSml(procedure);
    return this.updateRaw(`/procedures/${id}`, body, format);
  }

  async delete(id: string): Promise<void> {
    return this.deleteRaw(`/procedures/${id}`);
  }
}

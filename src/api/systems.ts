import { HttpClient } from "../http/http-client.js";
import { mapPage, type Page } from "../http/pagination.js";
import type { DateTimeQuery, KeywordQuery, QueryParams } from "../http/query.js";
import { DualEncodingEndpoint } from "./base-endpoint.js";
import { SystemFeatureSchema, type SystemFeature } from "../models/geojson/system-feature.js";
import { SmlSystemSchema, type SmlSystem } from "../models/sensorml/sml-system.js";
import { systemFromGeoJson, systemFromSml, systemToGeoJson, systemToSml } from "../codec/system-codec.js";
import type { System, SystemInput } from "../models/resources/system.js";
import type { Deployment } from "../models/resources/deployment.js";
import { deploymentFromGeoJson } from "../codec/deployment-codec.js";
import { DeploymentFeatureSchema } from "../models/geojson/deployment-feature.js";
import type { SamplingFeature, SamplingFeatureInput } from "../models/resources/sampling-feature.js";
import { samplingFeatureFromGeoJson, samplingFeatureToGeoJson } from "../codec/sampling-feature-codec.js";
import { SamplingFeatureGeoJsonSchema } from "../models/geojson/sampling-feature.js";
import type { SamplingFeatureQueryParams } from "./sampling-features.js";

export type SystemFormat = "geojson" | "sml" | "common";

export interface SystemQueryParams extends QueryParams {
  id?: string[];
  bbox?: [number, number, number, number];
  datetime?: DateTimeQuery;
  geom?: string;
  q?: KeywordQuery;
  parent?: string[];
  procedure?: string[];
  foi?: string[];
  observedProperty?: string[];
  controlledProperty?: string[];
  recursive?: boolean;
  limit?: number;
}

export interface SystemGetOptions {
  datetime?: DateTimeQuery;
}

export interface SystemDeploymentQueryParams extends QueryParams {
  id?: string[];
  bbox?: [number, number, number, number];
  datetime?: DateTimeQuery;
  geom?: string;
  q?: KeywordQuery;
  foi?: string[];
  limit?: number;
}

/** The richest encoding available for a resource, used as the default for `format: 'common'`. */
const DEFAULT_FORMAT = "sml" as const;

export class SystemsApi extends DualEncodingEndpoint {
  constructor(http: HttpClient) {
    super(http);
  }

  get(id: string, opts: { format: "sml" } & SystemGetOptions): Promise<SmlSystem>;
  get(id: string, opts: { format: "geojson" } & SystemGetOptions): Promise<SystemFeature>;
  get(id: string, opts?: { format?: "common" } & SystemGetOptions): Promise<System>;
  async get(id: string, opts: ({ format?: SystemFormat } & SystemGetOptions) = {}): Promise<SmlSystem | SystemFeature | System> {
    const format = opts.format ?? "common";
    const query = opts.datetime !== undefined ? { datetime: opts.datetime } : undefined;
    if (format === "sml") return this.getRaw(`/systems/${id}`, "sml", SmlSystemSchema, "System", query);
    if (format === "geojson") return this.getRaw(`/systems/${id}`, "geojson", SystemFeatureSchema, "System", query);
    const doc = await this.getRaw(`/systems/${id}`, DEFAULT_FORMAT, SmlSystemSchema, "System", query);
    return systemFromSml(doc);
  }

  async list(params?: SystemQueryParams & { format?: SystemFormat }): Promise<Page<System>> {
    const { format = "common", ...query } = params ?? {};
    if (format === "geojson") {
      const page = await this.listRaw("/systems", "geojson", SystemFeatureSchema, query, "features");
      return mapPage(page, systemFromGeoJson);
    }
    const page = await this.listRaw("/systems", "sml", SmlSystemSchema, query, "items");
    return mapPage(page, systemFromSml);
  }

  async *listAll(params?: SystemQueryParams & { format?: SystemFormat }): AsyncGenerator<System> {
    let page = await this.list(params);
    while (true) {
      yield* page.items;
      if (!page.next) return;
      page = await page.next();
    }
  }

  async create(system: SystemInput, opts: { format?: "geojson" | "sml" } = {}): Promise<string> {
    const format = opts.format ?? DEFAULT_FORMAT;
    const body = format === "geojson" ? systemToGeoJson(system) : systemToSml(system);
    return this.createRaw("/systems", body, format);
  }

  async createMany(systems: SystemInput[], opts: { format?: "geojson" | "sml" } = {}): Promise<string[]> {
    const format = opts.format ?? DEFAULT_FORMAT;
    const bodies = systems.map((s) => (format === "geojson" ? systemToGeoJson(s) : systemToSml(s)));
    return this.createManyRaw("/systems", bodies, format);
  }

  async update(id: string, system: SystemInput, opts: { format?: "geojson" | "sml" } = {}): Promise<void> {
    const format = opts.format ?? DEFAULT_FORMAT;
    const body = format === "geojson" ? systemToGeoJson(system) : systemToSml(system);
    return this.updateRaw(`/systems/${id}`, body, format);
  }

  async delete(id: string, opts: { cascade?: boolean } = {}): Promise<void> {
    return this.deleteRaw(`/systems/${id}`, { cascade: opts.cascade });
  }

  async subsystems(id: string, params?: SystemQueryParams): Promise<Page<System>> {
    const page = await this.listRaw(`/systems/${id}/subsystems`, DEFAULT_FORMAT, SmlSystemSchema, params, "items");
    return mapPage(page, systemFromSml);
  }

  async createSubsystem(id: string, system: SystemInput, opts: { format?: "geojson" | "sml" } = {}): Promise<string> {
    const format = opts.format ?? DEFAULT_FORMAT;
    const body = format === "geojson" ? systemToGeoJson(system) : systemToSml(system);
    return this.createRaw(`/systems/${id}/subsystems`, body, format);
  }

  async removeSubsystem(id: string, subsystemId: string): Promise<void> {
    return this.deleteRaw(`/systems/${id}/subsystems/${subsystemId}`);
  }

  async deployments(id: string, params?: SystemDeploymentQueryParams): Promise<Page<Deployment>> {
    const page = await this.listRaw(`/systems/${id}/deployments`, "geojson", DeploymentFeatureSchema, params, "features");
    return mapPage(page, deploymentFromGeoJson);
  }

  async samplingFeatures(id: string, params?: SamplingFeatureQueryParams): Promise<Page<SamplingFeature>> {
    const page = await this.listRaw(`/systems/${id}/samplingFeatures`, "geojson", SamplingFeatureGeoJsonSchema, params, "features");
    return mapPage(page, samplingFeatureFromGeoJson);
  }

  async createSamplingFeature(id: string, sf: SamplingFeatureInput): Promise<string> {
    return this.createRaw(`/systems/${id}/samplingFeatures`, samplingFeatureToGeoJson(sf), "geojson");
  }
}

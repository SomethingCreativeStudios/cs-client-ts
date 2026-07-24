import { HttpClient } from "../http/http-client.js";
import { mapPage, type Page } from "../http/pagination.js";
import type { BboxQuery, DateTimeQuery, KeywordQuery, QueryParams } from "../http/query.js";
import { DualEncodingEndpoint } from "./base-endpoint.js";
import { SamplingFeatureGeoJsonSchema } from "../models/geojson/sampling-feature.js";
import { samplingFeatureFromGeoJson, samplingFeatureToGeoJson } from "../codec/sampling-feature-codec.js";
import type { SamplingFeature, SamplingFeatureInput } from "../models/resources/sampling-feature.js";

export interface SamplingFeatureQueryParams extends QueryParams {
  id?: string[];
  bbox?: BboxQuery;
  datetime?: DateTimeQuery;
  geom?: string;
  q?: KeywordQuery;
  foi?: string[];
  observedProperty?: string[];
  controlledProperty?: string[];
  limit?: number;
}

/** Sampling Features are GeoJSON-only — read-only at the collection root, created only under a system. */
export class SamplingFeaturesApi extends DualEncodingEndpoint {
  constructor(http: HttpClient) {
    super(http);
  }

  async get(id: string): Promise<SamplingFeature> {
    const feature = await this.getRaw(`/samplingFeatures/${id}`, "geojson", SamplingFeatureGeoJsonSchema, "SamplingFeature");
    return samplingFeatureFromGeoJson(feature);
  }

  async list(params?: SamplingFeatureQueryParams): Promise<Page<SamplingFeature>> {
    const page = await this.listRaw("/samplingFeatures", "geojson", SamplingFeatureGeoJsonSchema, params, "features");
    return mapPage(page, samplingFeatureFromGeoJson);
  }

  async *listAll(params?: SamplingFeatureQueryParams): AsyncGenerator<SamplingFeature> {
    let page = await this.list(params);
    while (true) {
      yield* page.items;
      if (!page.next) return;
      page = await page.next();
    }
  }

  async update(id: string, sf: SamplingFeatureInput): Promise<void> {
    return this.updateRaw(`/samplingFeatures/${id}`, samplingFeatureToGeoJson(sf), "geojson");
  }

  async delete(id: string): Promise<void> {
    return this.deleteRaw(`/samplingFeatures/${id}`);
  }
}

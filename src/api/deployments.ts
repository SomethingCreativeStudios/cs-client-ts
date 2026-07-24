import { HttpClient } from "../http/http-client.js";
import { mapPage, type Page } from "../http/pagination.js";
import type { BboxQuery, DateTimeQuery, KeywordQuery, QueryParams } from "../http/query.js";
import { DualEncodingEndpoint } from "./base-endpoint.js";
import { DeploymentFeatureSchema, type DeploymentFeature } from "../models/geojson/deployment-feature.js";
import { SmlDeploymentSchema, type SmlDeployment } from "../models/sensorml/sml-deployment.js";
import { deploymentFromGeoJson, deploymentFromSml, deploymentToGeoJson, deploymentToSml } from "../codec/deployment-codec.js";
import type { Deployment, DeploymentInput } from "../models/resources/deployment.js";

export type DeploymentFormat = "geojson" | "sml" | "common";
const DEFAULT_FORMAT = "sml" as const;

export interface DeploymentQueryParams extends QueryParams {
  id?: string[];
  bbox?: BboxQuery;
  datetime?: DateTimeQuery;
  geom?: string;
  q?: KeywordQuery;
  parent?: string[];
  system?: string[];
  foi?: string[];
  observedProperty?: string[];
  controlledProperty?: string[];
  recursive?: boolean;
  limit?: number;
}

export class DeploymentsApi extends DualEncodingEndpoint {
  constructor(http: HttpClient) {
    super(http);
  }

  get(id: string, opts: { format: "sml" }): Promise<SmlDeployment>;
  get(id: string, opts: { format: "geojson" }): Promise<DeploymentFeature>;
  get(id: string, opts?: { format?: "common" }): Promise<Deployment>;
  async get(id: string, opts: { format?: DeploymentFormat } = {}): Promise<SmlDeployment | DeploymentFeature | Deployment> {
    const format = opts.format ?? "common";
    if (format === "sml") return this.getRaw(`/deployments/${id}`, "sml", SmlDeploymentSchema, "Deployment");
    if (format === "geojson") return this.getRaw(`/deployments/${id}`, "geojson", DeploymentFeatureSchema, "Deployment");
    const doc = await this.getRaw(`/deployments/${id}`, DEFAULT_FORMAT, SmlDeploymentSchema, "Deployment");
    return deploymentFromSml(doc);
  }

  async list(params?: DeploymentQueryParams & { format?: DeploymentFormat }): Promise<Page<Deployment>> {
    const { format = "common", ...query } = params ?? {};
    if (format === "geojson") {
      const page = await this.listRaw("/deployments", "geojson", DeploymentFeatureSchema, query, "features");
      return mapPage(page, deploymentFromGeoJson);
    }
    const page = await this.listRaw("/deployments", "sml", SmlDeploymentSchema, query, "items");
    return mapPage(page, deploymentFromSml);
  }

  async *listAll(params?: DeploymentQueryParams & { format?: DeploymentFormat }): AsyncGenerator<Deployment> {
    let page = await this.list(params);
    while (true) {
      yield* page.items;
      if (!page.next) return;
      page = await page.next();
    }
  }

  async create(deployment: DeploymentInput, opts: { format?: "geojson" | "sml" } = {}): Promise<string> {
    const format = opts.format ?? DEFAULT_FORMAT;
    const body = format === "geojson" ? deploymentToGeoJson(deployment) : deploymentToSml(deployment);
    return this.createRaw("/deployments", body, format);
  }

  async update(id: string, deployment: DeploymentInput, opts: { format?: "geojson" | "sml" } = {}): Promise<void> {
    const format = opts.format ?? DEFAULT_FORMAT;
    const body = format === "geojson" ? deploymentToGeoJson(deployment) : deploymentToSml(deployment);
    return this.updateRaw(`/deployments/${id}`, body, format);
  }

  async delete(id: string): Promise<void> {
    return this.deleteRaw(`/deployments/${id}`);
  }

  async subdeployments(id: string, params?: DeploymentQueryParams): Promise<Page<Deployment>> {
    const page = await this.listRaw(`/deployments/${id}/subdeployments`, DEFAULT_FORMAT, SmlDeploymentSchema, params, "items");
    return mapPage(page, deploymentFromSml);
  }

  async createSubdeployment(id: string, deployment: DeploymentInput, opts: { format?: "geojson" | "sml" } = {}): Promise<string> {
    const format = opts.format ?? DEFAULT_FORMAT;
    const body = format === "geojson" ? deploymentToGeoJson(deployment) : deploymentToSml(deployment);
    return this.createRaw(`/deployments/${id}/subdeployments`, body, format);
  }
}

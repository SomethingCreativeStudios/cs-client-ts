import { HttpClient } from "../http/http-client.js";
import { mapPage, type Page } from "../http/pagination.js";
import type { KeywordQuery, QueryParams } from "../http/query.js";
import { DualEncodingEndpoint } from "./base-endpoint.js";
import { SmlPropertySchema } from "../models/sensorml/derived-property.js";
import { propertyFromSml, propertyToSml } from "../codec/property-codec.js";
import type { Property, PropertyInput } from "../models/resources/property.js";

export interface PropertyQueryParams extends QueryParams {
  id?: string[];
  q?: KeywordQuery;
  baseProperty?: string[];
  objectType?: string[];
  limit?: number;
}

/** Properties are SensorML-only — there is no GeoJSON encoding for this resource. */
export class PropertiesApi extends DualEncodingEndpoint {
  constructor(http: HttpClient) {
    super(http);
  }

  async get(id: string): Promise<Property> {
    const doc = await this.getRaw(`/properties/${id}`, "sml", SmlPropertySchema, "Property");
    return propertyFromSml(doc);
  }

  async list(params?: PropertyQueryParams): Promise<Page<Property>> {
    const page = await this.listRaw("/properties", "sml", SmlPropertySchema, params, "items");
    return mapPage(page, propertyFromSml);
  }

  async *listAll(params?: PropertyQueryParams): AsyncGenerator<Property> {
    let page = await this.list(params);
    while (true) {
      yield* page.items;
      if (!page.next) return;
      page = await page.next();
    }
  }

  async create(property: PropertyInput): Promise<string> {
    return this.createRaw("/properties", propertyToSml(property), "sml");
  }

  async update(id: string, property: PropertyInput): Promise<void> {
    return this.updateRaw(`/properties/${id}`, propertyToSml(property), "sml");
  }

  async delete(id: string): Promise<void> {
    return this.deleteRaw(`/properties/${id}`);
  }
}

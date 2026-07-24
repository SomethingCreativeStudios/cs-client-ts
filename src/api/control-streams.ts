import { z } from "zod";
import { HttpClient } from "../http/http-client.js";
import type { Page } from "../http/pagination.js";
import type { DateTimeQuery, KeywordQuery, QueryParams } from "../http/query.js";
import { MediaTypes } from "../http/media-types.js";
import { ControlStreamSchema, ControlStreamCreateSchema, type ControlStream, type ControlStreamCreate } from "../models/resources/control-stream.js";
import { CommandSchemaDescriptorSchema, type CommandSchemaDescriptor } from "../models/resources/command-schema.js";
import { CommandCreateSchema, CommandSchema as CommandWireSchema, type Command, type CommandCreate } from "../models/resources/command.js";

export interface ControlStreamQueryParams extends QueryParams {
  id?: string[];
  datetime?: DateTimeQuery;
  q?: KeywordQuery;
  /** @deprecated Use `q`; the wire query parameter is named `q` in the CS API spec. */
  keyword?: KeywordQuery;
  issueTime?: DateTimeQuery;
  executionTime?: DateTimeQuery;
  system?: string[];
  foi?: string[];
  controlledProperty?: string[];
  limit?: number;
}

export interface ControlStreamForSystemQueryParams extends QueryParams {
  datetime?: DateTimeQuery;
  q?: KeywordQuery;
  /** @deprecated Use `q`; the wire query parameter is named `q` in the CS API spec. */
  keyword?: KeywordQuery;
  issueTime?: DateTimeQuery;
  executionTime?: DateTimeQuery;
  limit?: number;
}

export interface ControlStreamCommandQueryParams extends QueryParams {
  id?: string[];
  issueTime?: DateTimeQuery;
  executionTime?: DateTimeQuery;
  statusCode?: string[];
  sender?: string[];
  foi?: string[];
  controlledProperty?: string[];
  limit?: number;
}

const PageEnvelopeSchema = <T extends z.ZodType>(itemSchema: T) => z.looseObject({ items: z.array(itemSchema) });

function normalizeKeywordQuery(params: (ControlStreamQueryParams | ControlStreamForSystemQueryParams) | undefined): QueryParams | undefined {
  if (!params) return undefined;
  const { keyword, ...query } = params;
  return keyword !== undefined && query.q === undefined ? { ...query, q: keyword } : query;
}

export class ControlStreamsApi {
  constructor(private readonly http: HttpClient) {}

  async get(id: string): Promise<ControlStream> {
    const { data } = await this.http.request(`GET`, `/controlstreams/${id}`, {
      accept: MediaTypes.json,
      schema: ControlStreamSchema,
      resourceName: "ControlStream",
    });
    return data;
  }

  async list(params?: ControlStreamQueryParams): Promise<Page<ControlStream>> {
    return this.http.fetchPage<ControlStream>("/controlstreams", "items", {
      query: normalizeKeywordQuery(params),
      accept: MediaTypes.json,
      schema: PageEnvelopeSchema(ControlStreamSchema) as never,
    });
  }

  async forSystem(systemId: string, params?: ControlStreamForSystemQueryParams): Promise<Page<ControlStream>> {
    return this.http.fetchPage<ControlStream>(`/systems/${systemId}/controlstreams`, "items", {
      query: normalizeKeywordQuery(params),
      accept: MediaTypes.json,
      schema: PageEnvelopeSchema(ControlStreamSchema) as never,
    });
  }

  async *listAll(params?: ControlStreamQueryParams): AsyncGenerator<ControlStream> {
    let page = await this.list(params);
    while (true) {
      yield* page.items;
      if (!page.next) return;
      page = await page.next();
    }
  }

  async create(systemId: string, controlStream: ControlStreamCreate): Promise<string> {
    const validated = ControlStreamCreateSchema.parse(controlStream);
    return this.http.create(`/systems/${systemId}/controlstreams`, validated, { contentType: MediaTypes.json });
  }

  async update(id: string, controlStream: ControlStream): Promise<void> {
    await this.http.request("PUT", `/controlstreams/${id}`, { body: controlStream, contentType: MediaTypes.json });
  }

  async delete(id: string, opts: { cascade?: boolean } = {}): Promise<void> {
    await this.http.request("DELETE", `/controlstreams/${id}`, { query: opts.cascade === undefined ? undefined : { cascade: opts.cascade } });
  }

  /** `cmdFormat` is optional per the spec (unlike datastream `obsFormat`, which is required). */
  async schema(id: string, cmdFormat?: string): Promise<CommandSchemaDescriptor> {
    const { data } = await this.http.request(`GET`, `/controlstreams/${id}/schema`, {
      query: { cmdFormat },
      schema: CommandSchemaDescriptorSchema,
      resourceName: "CommandSchema",
    });
    return data;
  }

  async putSchema(id: string, schema: CommandSchemaDescriptor): Promise<void> {
    await this.http.request("PUT", `/controlstreams/${id}/schema`, { body: schema, contentType: MediaTypes.json });
  }

  async commands(id: string, params?: ControlStreamCommandQueryParams): Promise<Page<Command>> {
    return this.http.fetchPage<Command>(`/controlstreams/${id}/commands`, "items", {
      query: params,
      accept: MediaTypes.json,
      schema: PageEnvelopeSchema(CommandWireSchema) as never,
    });
  }

  async createCommand(id: string, command: CommandCreate): Promise<string> {
    const validated = CommandCreateSchema.parse(command);
    return this.http.create(`/controlstreams/${id}/commands`, validated, { contentType: MediaTypes.json });
  }

  /** Post a command already encoded according to the selected control-stream format. */
  async createEncodedCommand(id: string, payload: unknown, commandFormat: string): Promise<string> {
    return this.http.create(`/controlstreams/${id}/commands`, payload, {
      contentType: commandFormat,
      serializeBody: commandFormat.includes("json"),
    });
  }
}

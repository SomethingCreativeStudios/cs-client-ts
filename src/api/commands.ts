import { z } from "zod";
import { HttpClient } from "../http/http-client.js";
import type { Page } from "../http/pagination.js";
import type { DateTimeQuery, QueryParams } from "../http/query.js";
import { MediaTypes } from "../http/media-types.js";
import {
  CommandResultCreateSchema,
  CommandResultSchema,
  CommandCreateSchema,
  CommandSchema,
  CommandStatusCreateSchema,
  CommandStatusSchema,
  type Command,
  type CommandCreate,
  type CommandResult,
  type CommandResultCreate,
  type CommandStatus,
  type CommandStatusCreate,
} from "../models/resources/command.js";

export interface CommandQueryParams extends QueryParams {
  id?: string[];
  issueTime?: DateTimeQuery;
  executionTime?: DateTimeQuery;
  statusCode?: string[];
  sender?: string[];
  controlStream?: string[];
  system?: string[];
  foi?: string[];
  controlledProperty?: string[];
  limit?: number;
}

export interface CommandStatusQueryParams extends QueryParams {
  id?: string[];
  reportTime?: DateTimeQuery;
  statusCode?: string[];
  limit?: number;
}

export interface CommandResultQueryParams extends QueryParams {
  id?: string[];
  limit?: number;
}

export class CommandsApi {
  constructor(private readonly http: HttpClient) {}

  async get(id: string): Promise<Command> {
    const { data } = await this.http.request(`GET`, `/commands/${id}`, {
      accept: MediaTypes.json,
      schema: CommandSchema,
      resourceName: "Command",
    });
    return data;
  }

  async list(params?: CommandQueryParams): Promise<Page<Command>> {
    return this.http.fetchPage<Command>("/commands", "items", {
      query: params,
      accept: MediaTypes.json,
      schema: z.looseObject({ items: z.array(CommandSchema) }) as never,
    });
  }

  async *listAll(params?: CommandQueryParams): AsyncGenerator<Command> {
    let page = await this.list(params);
    while (true) {
      yield* page.items;
      if (!page.next) return;
      page = await page.next();
    }
  }

  async update(id: string, command: CommandCreate): Promise<void> {
    const validated = CommandCreateSchema.parse(command);
    await this.http.request("PUT", `/commands/${id}`, { body: validated, contentType: MediaTypes.json });
  }

  async delete(id: string): Promise<void> {
    await this.http.request("DELETE", `/commands/${id}`);
  }

  async status(id: string, params?: CommandStatusQueryParams): Promise<Page<CommandStatus>> {
    return this.http.fetchPage<CommandStatus>(`/commands/${id}/status`, "items", {
      query: params,
      accept: MediaTypes.json,
      schema: z.looseObject({ items: z.array(CommandStatusSchema) }) as never,
    });
  }

  async addStatus(id: string, status: CommandStatusCreate): Promise<string> {
    const validated = CommandStatusCreateSchema.parse(status);
    return this.http.create(`/commands/${id}/status`, validated, { contentType: MediaTypes.json });
  }

  async getStatus(id: string, statusId: string): Promise<CommandStatus> {
    const { data } = await this.http.request(`GET`, `/commands/${id}/status/${statusId}`, {
      accept: MediaTypes.json,
      schema: CommandStatusSchema,
      resourceName: "CommandStatus",
    });
    return data;
  }

  async updateStatus(id: string, statusId: string, status: CommandStatusCreate): Promise<void> {
    const validated = CommandStatusCreateSchema.parse(status);
    await this.http.request("PUT", `/commands/${id}/status/${statusId}`, { body: validated, contentType: MediaTypes.json });
  }

  async deleteStatus(id: string, statusId: string): Promise<void> {
    await this.http.request("DELETE", `/commands/${id}/status/${statusId}`);
  }

  async result(id: string, params?: CommandResultQueryParams): Promise<Page<CommandResult>> {
    return this.http.fetchPage<CommandResult>(`/commands/${id}/result`, "items", {
      query: params,
      accept: MediaTypes.json,
      schema: z.looseObject({ items: z.array(CommandResultSchema) }) as never,
    });
  }

  async addResult(id: string, result: CommandResultCreate): Promise<string> {
    const validated = CommandResultCreateSchema.parse(result);
    return this.http.create(`/commands/${id}/result`, validated, { contentType: MediaTypes.json });
  }

  async getResult(id: string, resultId: string): Promise<CommandResult> {
    const { data } = await this.http.request(`GET`, `/commands/${id}/result/${resultId}`, {
      accept: MediaTypes.json,
      schema: CommandResultSchema,
      resourceName: "CommandResult",
    });
    return data;
  }

  async updateResult(id: string, resultId: string, result: CommandResultCreate): Promise<void> {
    const validated = CommandResultCreateSchema.parse(result);
    await this.http.request("PUT", `/commands/${id}/result/${resultId}`, { body: validated, contentType: MediaTypes.json });
  }

  async deleteResult(id: string, resultId: string): Promise<void> {
    await this.http.request("DELETE", `/commands/${id}/result/${resultId}`);
  }
}

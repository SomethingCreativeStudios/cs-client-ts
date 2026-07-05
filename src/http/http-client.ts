import type { z } from "zod";
import { HttpError, NotFoundError, ValidationError, type ProblemDetails } from "./errors.js";
import { buildQueryString, type QueryParams } from "./query.js";
import { findLink, type Page } from "./pagination.js";
import type { Link } from "../models/common/link.js";
import type { CSPubSubClientOptions } from "../pubsub/client.js";

type MaybePromise<T> = T | Promise<T>;

export interface BasicAuthConfig {
  type: "basic";
  username: string;
  password: string;
}

export interface BearerAuthConfig {
  type: "bearer";
  /** Access token value, or a callback that returns the current token for each request. */
  token: string | (() => MaybePromise<string | undefined>);
}

export interface OAuthToken {
  accessToken: string;
  refreshToken?: string;
  /** Epoch milliseconds. If set, the client refreshes shortly before this time. */
  expiresAt?: number;
  /** Authorization scheme. Defaults to `Bearer`. */
  tokenType?: string;
  [key: string]: unknown;
}

export interface OAuthAuthConfig {
  type: "oauth2";
  /** Current token value, or a callback that returns the latest app-managed token. */
  token?: OAuthToken | (() => MaybePromise<OAuthToken | undefined>);
  /** Called when the token is expired/nearly expired, or after a 401 response. */
  refresh: (token: OAuthToken | undefined) => MaybePromise<OAuthToken>;
  /** Called after a successful refresh so the host app can persist the new token. */
  setToken?: (token: OAuthToken) => MaybePromise<void>;
  /** Refresh this many seconds before `expiresAt`. Default: 60. */
  refreshBeforeExpiresIn?: number;
  /** Retry one failed request after refreshing on 401. Default: true. */
  retryOnUnauthorized?: boolean;
}

export type AuthConfig = BasicAuthConfig | BearerAuthConfig | OAuthAuthConfig;

export interface RequestHookContext<T = unknown> {
  url: string;
  init: RequestInit;
  method: string;
  path: string;
  options: RequestOptions<T>;
  attempt: number;
}

export interface RequestHookResult {
  url?: string;
  init?: RequestInit;
}

export interface ResponseHookContext<T = unknown> {
  url: string;
  init: RequestInit;
  method: string;
  path: string;
  options: RequestOptions<T>;
  /** A clone of the fetch response, so hooks can safely read the body. */
  response: Response;
  attempt: number;
}

export interface ErrorHookContext<T = unknown> {
  url: string;
  init?: RequestInit;
  method: string;
  path: string;
  options: RequestOptions<T>;
  error: unknown;
  /** A clone of the response when the error came from a non-2xx HTTP response. */
  response?: Response;
  attempt: number;
}

export type RequestHook = (context: RequestHookContext) => MaybePromise<void | RequestHookResult>;
export type ResponseHook = (context: ResponseHookContext) => MaybePromise<void | Response>;
export type ErrorHook = (context: ErrorHookContext) => MaybePromise<void>;

export interface HttpHooks {
  beforeRequest?: RequestHook | RequestHook[];
  afterResponse?: ResponseHook | ResponseHook[];
  onError?: ErrorHook | ErrorHook[];
}

export interface CsApiClientOptions {
  /** Base URL of the API landing page, e.g. `https://data.example.org/api`. No trailing slash. */
  baseUrl: string;
  /** Injectable fetch implementation (defaults to the global `fetch`). Useful for tests and non-browser runtimes. */
  fetch?: typeof fetch;
  /** Static headers, or a function returning them (called on every request, so tokens can be refreshed). */
  headers?: Record<string, string> | (() => Record<string, string> | Promise<Record<string, string>>);
  /** Built-in auth helpers. You can still pass your own Authorization header via `headers` or hooks. */
  auth?: AuthConfig;
  /** Axios-style lifecycle hooks for request mutation, response observation/replacement, and errors. */
  hooks?: HttpHooks;
  /** If false, skip Zod validation of response bodies and cast directly. Default true. */
  validateResponses?: boolean;
  /** Optional async Part 2 pub/sub client configuration. Ignored by the HTTP client. */
  pubsub?: CSPubSubClientOptions;
}

export interface RequestOptions<T> {
  query?: QueryParams;
  /** Accept header override; defaults to the schema-appropriate media type chosen by the caller. */
  accept?: string;
  contentType?: string;
  body?: unknown;
  /** Zod schema used to validate (and produce) the response body, when one is expected. */
  schema?: z.ZodType<T>;
  /** Human-readable resource name, used in ValidationError messages. */
  resourceName?: string;
}

export interface RawResponse<T> {
  data: T;
  response: Response;
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function setHeader(headers: Record<string, string>, name: string, value: string): void {
  const existingKey = Object.keys(headers).find((key) => key.toLowerCase() === name.toLowerCase());
  headers[existingKey ?? name] = value;
}

function encodeBasicAuth(username: string, password: string): string {
  const value = `${username}:${password}`;
  if (typeof btoa === "function") return btoa(value);
  return Buffer.from(value, "utf-8").toString("base64");
}

export class HttpClient {
  private oauthToken?: OAuthToken;
  private oauthRefresh?: Promise<OAuthToken>;

  constructor(private readonly options: CsApiClientOptions) {}

  private async resolveHeaders(): Promise<Record<string, string>> {
    const { headers } = this.options;
    if (!headers) return {};
    return typeof headers === "function" ? await headers() : headers;
  }

  private async resolveAuthHeader(): Promise<string | undefined> {
    const { auth } = this.options;
    if (!auth) return undefined;

    if (auth.type === "basic") {
      return `Basic ${encodeBasicAuth(auth.username, auth.password)}`;
    }

    if (auth.type === "bearer") {
      const token = typeof auth.token === "function" ? await auth.token() : auth.token;
      return token ? `Bearer ${token}` : undefined;
    }

    const token = await this.getOAuthToken(auth);
    if (!token) return undefined;
    return `${token.tokenType ?? "Bearer"} ${token.accessToken}`;
  }

  private async getOAuthToken(auth: OAuthAuthConfig): Promise<OAuthToken | undefined> {
    if (typeof auth.token === "function") {
      const tokenFromProvider = await auth.token();
      if (tokenFromProvider && this.shouldUseProviderOAuthToken(auth, tokenFromProvider)) {
        this.oauthToken = tokenFromProvider;
      }
    } else if (!this.oauthToken && auth.token) {
      this.oauthToken = auth.token;
    }

    const token = this.oauthToken;
    if (!token || this.shouldRefreshOAuthToken(auth, token)) {
      return this.refreshOAuthToken(auth, token);
    }
    return token;
  }

  private shouldUseProviderOAuthToken(auth: OAuthAuthConfig, tokenFromProvider: OAuthToken): boolean {
    if (!this.oauthToken) return true;
    if (tokenFromProvider.accessToken === this.oauthToken.accessToken) return true;
    if (this.shouldRefreshOAuthToken(auth, this.oauthToken)) return true;
    return (tokenFromProvider.expiresAt ?? 0) > (this.oauthToken.expiresAt ?? 0);
  }

  private shouldRefreshOAuthToken(auth: OAuthAuthConfig, token: OAuthToken): boolean {
    if (token.expiresAt === undefined) return false;
    const refreshBeforeMs = (auth.refreshBeforeExpiresIn ?? 60) * 1000;
    return Date.now() + refreshBeforeMs >= token.expiresAt;
  }

  private async refreshOAuthToken(auth: OAuthAuthConfig, token: OAuthToken | undefined): Promise<OAuthToken> {
    if (!this.oauthRefresh) {
      this.oauthRefresh = Promise.resolve(auth.refresh(token)).then(async (nextToken) => {
        this.oauthToken = nextToken;
        await auth.setToken?.(nextToken);
        return nextToken;
      });
    }

    try {
      return await this.oauthRefresh;
    } finally {
      this.oauthRefresh = undefined;
    }
  }

  resolveUrl(path: string, query?: QueryParams): string {
    const base = path.startsWith("http") ? path : `${this.options.baseUrl}${path}`;
    return `${base}${buildQueryString(query)}`;
  }

  private async buildRequest<T>(
    method: string,
    path: string,
    opts: RequestOptions<T>,
    attempt: number,
  ): Promise<RequestHookContext<T>> {
    const url = this.resolveUrl(path, opts.query);
    const headers: Record<string, string> = { ...(await this.resolveHeaders()) };
    if (opts.accept) setHeader(headers, "accept", opts.accept);
    if (opts.body !== undefined) setHeader(headers, "content-type", opts.contentType ?? "application/json");

    const authHeader = await this.resolveAuthHeader();
    if (authHeader) setHeader(headers, "authorization", authHeader);

    const context: RequestHookContext<T> = {
      url,
      method,
      path,
      options: opts,
      attempt,
      init: {
        method,
        headers,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      },
    };

    for (const hook of asArray(this.options.hooks?.beforeRequest)) {
      const result = await hook(context as RequestHookContext);
      if (result?.url) context.url = result.url;
      if (result?.init) context.init = result.init;
    }

    return context;
  }

  private async fetchWithHooks<T>(context: RequestHookContext<T>): Promise<Response> {
    let response = await (this.options.fetch ?? fetch)(context.url, context.init);
    for (const hook of asArray(this.options.hooks?.afterResponse)) {
      const replacement = await hook({ ...context, response: response.clone() } as ResponseHookContext);
      if (replacement instanceof Response) response = replacement;
    }
    return response;
  }

  private async maybeRefreshAfterUnauthorized(response: Response): Promise<boolean> {
    const { auth } = this.options;
    if (response.status !== 401 || auth?.type !== "oauth2" || auth.retryOnUnauthorized === false) return false;
    const latestToken = typeof auth.token === "function" ? await auth.token() : (this.oauthToken ?? auth.token);
    if (latestToken) this.oauthToken = latestToken;
    await this.refreshOAuthToken(auth, this.oauthToken);
    return true;
  }

  private async buildHttpError(response: Response, url: string): Promise<HttpError> {
    let problem: ProblemDetails | undefined;
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/problem+json")) {
      problem = (await response.json().catch(() => undefined)) as ProblemDetails | undefined;
    }
    const message = problem?.title ?? `Request to ${url} failed with status ${response.status}`;
    if (response.status === 404) return new NotFoundError(url, problem);
    return new HttpError(message, response.status, url, problem);
  }

  private async runErrorHooks<T>(context: ErrorHookContext<T>): Promise<void> {
    for (const hook of asArray(this.options.hooks?.onError)) {
      await hook(context as ErrorHookContext);
    }
  }

  async request<T = undefined>(method: string, path: string, opts: RequestOptions<T> = {}): Promise<RawResponse<T>> {
    let context = await this.buildRequest(method, path, opts, 0);
    let response: Response;
    try {
      response = await this.fetchWithHooks(context);
      if (await this.maybeRefreshAfterUnauthorized(response.clone())) {
        context = await this.buildRequest(method, path, opts, 1);
        response = await this.fetchWithHooks(context);
      }
    } catch (error) {
      await this.runErrorHooks({ ...context, error });
      throw error;
    }

    if (!response.ok) {
      const responseForHooks = response.clone();
      const error = await this.buildHttpError(response, context.url);
      await this.runErrorHooks({ ...context, error, response: responseForHooks });
      throw error;
    }

    try {
      const bodyText = await response.text();
      if (response.status === 204 || bodyText.length === 0) {
        return { data: undefined as T, response };
      }

      const json = JSON.parse(bodyText);
      if (opts.schema === undefined || this.options.validateResponses === false) {
        return { data: json as T, response };
      }
      const result = opts.schema.safeParse(json);
      if (!result.success) {
        throw new ValidationError(
          `Response from ${context.url} did not match the expected schema${opts.resourceName ? ` for ${opts.resourceName}` : ""}`,
          result.error,
          opts.resourceName ?? path,
        );
      }
      return { data: result.data, response };
    } catch (error) {
      await this.runErrorHooks({ ...context, error });
      throw error;
    }
  }

  /**
   * Fetches a list endpoint returning `{ <itemsKey>: T[], links: Link[] }` and wraps it
   * as a `Page<T>` whose `next()` follows the response's `rel: "next"` link verbatim
   * (as an absolute/relative URL, not re-serialized query params).
   */
  async fetchPage<T>(
    path: string,
    itemsKey: string,
    opts: RequestOptions<Record<string, unknown>>,
  ): Promise<Page<T>> {
    const { data } = await this.request<Record<string, unknown>>("GET", path, opts);
    const items = (data[itemsKey] as T[] | undefined) ?? [];
    const links = (data.links as Link[] | undefined) ?? [];
    const nextLink = findLink(links, "next");
    return {
      items,
      links,
      next: nextLink ? () => this.fetchPage<T>(nextLink.href, itemsKey, { ...opts, query: undefined }) : undefined,
    };
  }

  /** POST helper that returns the created resource's id, extracted from the `Location` response header. */
  async create(path: string, body: unknown, opts: { contentType?: string } = {}): Promise<string> {
    const { response } = await this.request("POST", path, { body, contentType: opts.contentType });
    const location = response.headers.get("location");
    if (!location) {
      throw new HttpError(`POST to ${path} did not return a Location header`, response.status, this.resolveUrl(path));
    }
    const id = location.split("/").filter(Boolean).pop();
    if (!id) {
      throw new HttpError(`Could not extract resource id from Location header "${location}"`, response.status, this.resolveUrl(path));
    }
    return id;
  }
}

import { z } from "zod";

/** Base class for all errors raised by this client. */
export class CsApiError extends Error {}

/** An RFC 7807 `application/problem+json` body, when the server provides one. */
export interface ProblemDetails {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;
  [key: string]: unknown;
}

/** A non-2xx HTTP response. Carries the parsed problem+json body when available. */
export class HttpError extends CsApiError {
  constructor(
    message: string,
    public readonly status: number,
    public readonly url: string,
    public readonly problem?: ProblemDetails,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export class NotFoundError extends HttpError {
  constructor(url: string, problem?: ProblemDetails) {
    super(`Not found: ${url}`, 404, url, problem);
    this.name = "NotFoundError";
  }
}

/** A response body that failed validation against the expected wire schema. */
export class ValidationError extends CsApiError {
  constructor(
    message: string,
    public readonly zodError: z.ZodError,
    public readonly resource: string,
  ) {
    super(`${message}:\n${z.prettifyError(zodError)}`);
    this.name = "ValidationError";
  }
}

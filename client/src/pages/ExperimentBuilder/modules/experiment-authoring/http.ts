export type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export type JsonTransport = {
  request<T>(path: string, init?: RequestInit): Promise<T>;
};

export class AuthoringRequestError extends Error {
  readonly method: string;
  readonly path: string;
  readonly status: number;
  readonly responseBody: unknown;

  constructor(options: {
    method: string;
    path: string;
    status: number;
    responseBody: unknown;
  }) {
    const { method, path, status, responseBody } = options;
    const detail =
      responseBody && typeof responseBody === "object" && "error" in responseBody
        ? String(responseBody.error)
        : `HTTP ${status}`;
    super(`${method} ${path} failed: ${detail}`);
    this.name = "AuthoringRequestError";
    this.method = method;
    this.path = path;
    this.status = status;
    this.responseBody = responseBody;
  }
}

export function isRevisionConflict(
  error: unknown,
): error is AuthoringRequestError {
  if (!(error instanceof AuthoringRequestError)) return false;
  const body = error.responseBody;
  return (
    error.status === 409 &&
    typeof body === "object" &&
    body !== null &&
    "code" in body &&
    body.code === "REVISION_CONFLICT"
  );
}

function joinUrl(baseUrl: string, path: string) {
  return `${baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}

async function readBody(response: Response): Promise<unknown> {
  if (typeof response.text === "function") {
    const text = await response.text();
    if (!text) return null;
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return text;
    }
  }
  if (typeof response.json === "function") return response.json() as Promise<unknown>;
  return null;
}

export function createJsonTransport(options: {
  baseUrl?: string;
  fetchImpl?: FetchLike;
}): JsonTransport {
  const baseUrl = options.baseUrl ?? "";
  const fetchImpl: FetchLike =
    options.fetchImpl ?? ((input, init) => fetch(input, init));

  return {
    async request<T>(path: string, init: RequestInit = {}): Promise<T> {
      const method = init.method ?? "GET";
      const response = await fetchImpl(joinUrl(baseUrl, path), init);
      const body = await readBody(response);
      if (!response.ok) {
        throw new AuthoringRequestError({
          method,
          path,
          status: response.status,
          responseBody: body,
        });
      }
      return body as T;
    },
  };
}

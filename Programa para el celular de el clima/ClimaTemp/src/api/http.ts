export type ApiErrorKind = 'network' | 'timeout' | 'http' | 'unknown';

export class ApiError extends Error {
  kind: ApiErrorKind;
  status?: number;

  constructor(kind: ApiErrorKind, status?: number) {
    super(kind);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = status;
  }
}

const DEFAULT_TIMEOUT_MS = 12000;

export async function fetchJson<T>(
  url: string,
  headers?: Record<string, string>,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { headers, signal: controller.signal });
    if (!response.ok) {
      throw new ApiError('http', response.status);
    }
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    if (error instanceof Error && (error.name === 'AbortError' || /abort/i.test(error.message))) {
      throw new ApiError('timeout');
    }
    throw new ApiError('network');
  } finally {
    clearTimeout(timer);
  }
}

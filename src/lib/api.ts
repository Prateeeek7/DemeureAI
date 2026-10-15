// Thin fetch wrapper: same-origin cookies, JSON bodies, readable errors.

export const UNAUTHORIZED_EVENT = 'demeure:unauthorized';

export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const init: RequestInit = { method, credentials: 'same-origin', headers: {} };
  if (body instanceof FormData) {
    init.body = body;
  } else if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers = { 'Content-Type': 'application/json' };
  }

  let res: Response;
  try {
    res = await fetch(path, init);
  } catch {
    throw new ApiError(0, 'Cannot reach the Demeure server. Check your connection.');
  }

  const data = res.headers.get('content-type')?.includes('application/json') ? await res.json() : null;
  if (!res.ok) {
    // A 401 on anything but the login call means the session expired.
    if (res.status === 401 && !path.startsWith('/api/auth/')) {
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    }
    const detail = typeof data?.detail === 'string' ? data.detail : `Request failed (${res.status})`;
    throw new ApiError(res.status, detail);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  del: <T>(path: string) => request<T>('DELETE', path),
  upload: <T>(path: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return request<T>('POST', path, form);
  },
};

export const errorMessage = (err: unknown) =>
  err instanceof Error ? err.message : 'Something went wrong';

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const ACCEPTED_UPLOADS = '.pdf,.png,.jpg,.jpeg';

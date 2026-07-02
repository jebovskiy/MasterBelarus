const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

type ApiResult<T> = { data: T; error?: never } | { data?: never; error: string; detail?: string };

function authHeaders(): Record<string, string> {
  const initData = typeof window !== 'undefined' && window.Telegram?.WebApp?.initData
    ? window.Telegram.WebApp.initData
    : '';
  return initData ? { 'x-telegram-init-data': initData } : {};
}

async function handle<T>(res: Response): Promise<ApiResult<T>> {
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    return { error: (json.error as string) ?? res.statusText, detail: json.detail as string | undefined };
  }
  return { data: json as unknown as T };
}

export async function apiPost<T>(path: string, body?: Record<string, unknown>): Promise<ApiResult<T>> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return handle<T>(res);
}

export async function apiGet<T>(path: string, query?: Record<string, string | number>): Promise<ApiResult<T>> {
  const qs = query
    ? '?' + new URLSearchParams(Object.fromEntries(Object.entries(query).map(([k, v]) => [k, String(v)]))).toString()
    : '';
  const res = await fetch(`${API_BASE}${path}${qs}`, {
    headers: { ...authHeaders() },
  });
  return handle<T>(res);
}

export async function apiPatch<T>(path: string, body?: Record<string, unknown>): Promise<ApiResult<T>> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return handle<T>(res);
}

export async function apiUpload<T>(path: string, file: File): Promise<ApiResult<T>> {
  const form = new FormData();
  form.append('avatar', file);
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { ...authHeaders() },
    body: form,
  });
  return handle<T>(res);
}

import { getTelegramInitData } from './telegram.js';
import { useAuthStore } from '@/stores/auth';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export type ApiResult<T> = { data: T; error?: never } | { data?: never; error: string; detail?: string };

export function isErrorResult<T>(r: ApiResult<T>): r is { data?: never; error: string; detail?: string } {
  return 'error' in r && r.error !== undefined;
}

function authHeaders(): Record<string, string> {
  const jwt = useAuthStore.getState().jwt;
  if (jwt) return { Authorization: `Bearer ${jwt}` };

  const initData = getTelegramInitData();
  return initData ? { 'x-telegram-init-data': initData } : {};
}

async function handle<T>(res: Response): Promise<ApiResult<T>> {
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    if (res.status === 401) {
      useAuthStore.getState().clear();
    }
    return { error: (json.error as string) ?? res.statusText, detail: json.detail as string | undefined };
  }
  return { data: json as unknown as T };
}

type ApiOptions = { signal?: AbortSignal };

export async function apiPost<T>(path: string, body?: Record<string, unknown>, opts?: ApiOptions): Promise<ApiResult<T>> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: opts?.signal,
  });
  return handle<T>(res);
}

export async function apiGet<T>(path: string, query?: Record<string, string | number>, opts?: ApiOptions): Promise<ApiResult<T>> {
  const qs = query
    ? '?' + new URLSearchParams(Object.fromEntries(Object.entries(query).map(([k, v]) => [k, String(v)]))).toString()
    : '';
  const res = await fetch(`${API_BASE}${path}${qs}`, {
    headers: { ...authHeaders() },
    signal: opts?.signal,
  });
  return handle<T>(res);
}

export async function apiPatch<T>(path: string, body?: Record<string, unknown>, opts?: ApiOptions): Promise<ApiResult<T>> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: opts?.signal,
  });
  return handle<T>(res);
}

export async function apiUpload<T>(path: string, file: File, opts?: ApiOptions): Promise<ApiResult<T>> {
  const form = new FormData();
  form.append('avatar', file);
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { ...authHeaders() },
    body: form,
    signal: opts?.signal,
  });
  return handle<T>(res);
}

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

type ApiResult<T> = { data: T; error?: never } | { data?: never; error: string; detail?: string };

export async function apiPost<T>(path: string, body?: Record<string, unknown>): Promise<ApiResult<T>> {
  const initData = typeof window !== 'undefined' && window.Telegram?.WebApp?.initData
    ? window.Telegram.WebApp.initData
    : '';

  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(initData ? { 'x-telegram-init-data': initData } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await res.json() as Record<string, unknown>;

  if (!res.ok) {
    return { error: (json.error as string) ?? res.statusText, detail: json.detail as string | undefined };
  }

  return { data: json as unknown as T };
}

'use client';

// Shared hostel API fetch helper (client views). Mirrors the pattern used by
// other features (hr, events): credentials included, JSON in/out, errors shaped.
type ApiErrorShape = { code?: string; message?: string };

export async function api<T>(url: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data?: T; error?: ApiErrorShape }> {
  try {
    const res = await fetch(url, {
      ...init,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    const json = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, ...json };
  } catch {
    return { ok: false, status: 0, error: { code: 'NETWORK_ERROR', message: 'Impossible de joindre le serveur.' } };
  }
}

export function errMessage(res: { error?: ApiErrorShape }): string {
  return res.error?.message ?? 'Une erreur est survenue.';
}

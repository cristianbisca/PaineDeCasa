import type { Bread } from "./types";

export type ApiConfig = {
  restUrl: string;
  storageUrl: string;
  anonKey: string;
};

let cached: ApiConfig | null = null;

export async function apiConfig(): Promise<ApiConfig | null> {
  if (cached) return cached;
  if (typeof window === "undefined") return null;
  try {
    const res = await fetch("/api/config", { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as ApiConfig;
    if (data.restUrl && data.storageUrl && data.anonKey) {
      cached = data;
      return cached;
    }
  } catch {
    return null;
  }
  return null;
}

function authHeaders(cfg: ApiConfig, extra?: Record<string, string>) {
  return {
    apikey: cfg.anonKey,
    Authorization: `Bearer ${cfg.anonKey}`,
    ...extra,
  };
}

export type RpcResult<T> = { data: T | null; error: string | null };

export async function rpc<T>(
  fn: string,
  params: Record<string, unknown> = {}
): Promise<RpcResult<T>> {
  const cfg = await apiConfig();
  if (!cfg) return { data: null, error: "Aplicația nu este configurată." };
  try {
    const res = await fetch(`${cfg.restUrl}/rpc/${fn}`, {
      method: "POST",
      headers: authHeaders(cfg, {
        "Content-Type": "application/json",
        Prefer: "return=representation",
      }),
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try {
        const j = (await res.json()) as { message?: string; details?: string };
        if (j.message) msg = j.message;
        if (j.details) msg = `${msg} (${j.details})`;
      } catch {
        // fara corp JSON
      }
      return { data: null, error: msg };
    }
    if (res.status === 204) return { data: null, error: null };
    return { data: (await res.json()) as T, error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function fetchBreads(): Promise<RpcResult<Bread[]>> {
  const cfg = await apiConfig();
  if (!cfg) return { data: null, error: "Aplicația nu este configurată." };
  try {
    const res = await fetch(`${cfg.restUrl}/breads?select=*&order=created_at.asc`, {
      headers: authHeaders(cfg),
    });
    if (!res.ok) return { data: null, error: `HTTP ${res.status}` };
    return { data: (await res.json()) as Bread[], error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function uploadPhoto(
  file: File
): Promise<{ url: string | null; error: string | null }> {
  const cfg = await apiConfig();
  if (!cfg) return { url: null, error: "Aplicația nu este configurată." };
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${Date.now()}-${safe}`;
  try {
    const res = await fetch(`${cfg.storageUrl}/object/photos/${path}`, {
      method: "POST",
      headers: authHeaders(cfg, {
        "Content-Type": file.type || "application/octet-stream",
      }),
      body: file,
    });
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try {
        const j = (await res.json()) as { message?: string };
        if (j.message) msg = j.message;
      } catch {
        // fara corp JSON
      }
      return { url: null, error: msg };
    }
    const url = `${cfg.storageUrl}/object/public/photos/${path}`;
    const check = await fetch(url, { method: "HEAD" });
    if (!check.ok) {
      return { url: null, error: "Fișierul a fost urcat, dar nu poate fi citit." };
    }
    return { url, error: null };
  } catch (e) {
    return { url: null, error: e instanceof Error ? e.message : String(e) };
  }
}

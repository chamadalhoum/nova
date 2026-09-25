import type {
  NovaApiErrorBody,
  NovaCapability,
  NovaProvider,
  NovaServiceDiscoveryResponse,
  NovaServiceRequest,
  NovaTask,
  NovaTokenPair,
} from "@nova/contracts";

export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export type TokenPair = NovaTokenPair;
export type Task = NovaTask;
export type Provider = NovaProvider;
export type Capability = NovaCapability;
export type ServiceDiscoveryResponse = NovaServiceDiscoveryResponse;
export type ServiceRequest = NovaServiceRequest;

export function getAccessToken() {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem("nova_access_token");
}

export function saveTokens(tokens: TokenPair) {
  sessionStorage.setItem("nova_access_token", tokens.access_token);
  sessionStorage.setItem("nova_refresh_token", tokens.refresh_token);
}

export function clearTokens() {
  sessionStorage.removeItem("nova_access_token");
  sessionStorage.removeItem("nova_refresh_token");
}

let refreshPromise: Promise<boolean> | null = null;

function getRefreshToken() {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem("nova_refresh_token");
}

function canRefresh(path: string) {
  return !["/api/v1/auth/login", "/api/v1/auth/register", "/api/v1/auth/refresh"].includes(path);
}

async function performRefresh() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;
  const response = await fetch(`${API_URL}/api/v1/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!response.ok) {
    if (getRefreshToken() === refreshToken) clearTokens();
    return false;
  }
  saveTokens(await response.json() as TokenPair);
  return true;
}

async function refreshAccessToken() {
  refreshPromise ??= performRefresh().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

function messageFromErrorBody(body: Partial<NovaApiErrorBody> & { detail?: unknown }, fallback: string) {
  if (body.error?.message) return body.error.message;
  if (typeof body.detail === "string") return body.detail;
  if (typeof body.detail === "object" && body.detail !== null) {
    const detail = body.detail as { message?: unknown };
    if (typeof detail.message === "string") return detail.message;
  }
  return fallback;
}

export async function apiFetch<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  const token = getAccessToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (response.status === 401 && retry && canRefresh(path) && await refreshAccessToken()) {
    return apiFetch<T>(path, init, false);
  }
  if (!response.ok) {
    let message = "NOVA could not complete this request. Please try again.";
    try {
      message = messageFromErrorBody(await response.json() as Partial<NovaApiErrorBody> & { detail?: unknown }, message);
    } catch {}
    throw new Error(message);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

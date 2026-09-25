import * as SecureStore from "expo-secure-store";
import type {
  NovaApiErrorBody,
  NovaCapability,
  NovaProvider,
  NovaServiceDiscoveryResponse,
  NovaServiceRequest,
  NovaTask,
  NovaTokenPair,
} from "@nova/contracts";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000";

export type Task = NovaTask;
export type Capability = NovaCapability;
export type Provider = NovaProvider;
export type ServiceDiscoveryResponse = NovaServiceDiscoveryResponse;
export type ServiceRequest = NovaServiceRequest;

export async function saveTokens(tokens: NovaTokenPair) {
  await SecureStore.setItemAsync("nova_access_token", tokens.access_token);
  await SecureStore.setItemAsync("nova_refresh_token", tokens.refresh_token);
}

export async function clearTokens() {
  await SecureStore.deleteItemAsync("nova_access_token");
  await SecureStore.deleteItemAsync("nova_refresh_token");
}

let refreshPromise: Promise<boolean> | null = null;

function canRefresh(path: string) {
  return !["/api/v1/auth/login", "/api/v1/auth/register", "/api/v1/auth/refresh"].includes(path);
}

async function performRefresh() {
  const refreshToken = await SecureStore.getItemAsync("nova_refresh_token");
  if (!refreshToken) return false;
  const response = await fetch(`${API_URL}/api/v1/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!response.ok) {
    return false;
  }
  await saveTokens(await response.json() as NovaTokenPair);
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
  const token = await SecureStore.getItemAsync("nova_access_token");
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (response.status === 401 && retry && canRefresh(path) && await refreshAccessToken()) {
    return apiFetch<T>(path, init, false);
  }
  if (!response.ok) {
    let message = "NOVA could not complete this request.";
    try {
      message = messageFromErrorBody(await response.json() as Partial<NovaApiErrorBody> & { detail?: unknown }, message);
    } catch {}
    throw new Error(message);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

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

export class ApiError extends Error {
  constructor(message: string, public status: number, public requestId: string | null) {
    super(message);
    this.name = "ApiError";
  }
}

export async function saveTokens(tokens: NovaTokenPair) {
  changeSession();
  await writeTokens(tokens);
}

export async function clearTokens() {
  changeSession();
  await storageOperation(async () => {
    await SecureStore.deleteItemAsync("nova_access_token");
    await SecureStore.deleteItemAsync("nova_refresh_token");
  });
}

let refreshPromise: Promise<boolean> | null = null;
let sessionVersion = 0;
let storageQueue: Promise<void> = Promise.resolve();
const listeners = new Set<() => void>();
export const getSessionVersion = () => sessionVersion;
export const subscribeSession = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
function changeSession() {
  sessionVersion += 1;
  refreshPromise = null;
  listeners.forEach((listener) => listener());
}
function assertSession(version: number) {
  if (version !== sessionVersion) throw new Error("Session changed. Please try again.");
}
function storageOperation(operation: () => Promise<void>) {
  const result = storageQueue.then(operation);
  storageQueue = result.catch(() => {});
  return result;
}
function writeTokens(tokens: NovaTokenPair) {
  return storageOperation(async () => {
    await SecureStore.setItemAsync("nova_access_token", tokens.access_token);
    await SecureStore.setItemAsync("nova_refresh_token", tokens.refresh_token);
  });
}

function canRefresh(path: string) {
  return !["/api/v1/auth/login", "/api/v1/auth/register", "/api/v1/auth/refresh"].includes(path);
}

async function performRefresh() {
  const version = sessionVersion;
  await storageQueue;
  const refreshToken = await SecureStore.getItemAsync("nova_refresh_token");
  assertSession(version);
  if (!refreshToken) return false;
  const response = await fetch(`${API_URL}/api/v1/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  assertSession(version);
  if (!response.ok) {
    if (response.status !== 401) throw new ApiError("Session renewal is temporarily unavailable. Please try again.", response.status, response.headers.get("X-Request-ID"));
    await clearTokens();
    return false;
  }
  const tokens = await response.json() as NovaTokenPair;
  assertSession(version);
  await writeTokens(tokens);
  assertSession(version);
  return true;
}

async function refreshAccessToken() {
  if (!refreshPromise) {
    const promise = performRefresh().finally(() => {
      if (refreshPromise === promise) refreshPromise = null;
    });
    refreshPromise = promise;
  }
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
  const version = sessionVersion;
  await storageQueue;
  const token = await SecureStore.getItemAsync("nova_access_token");
  assertSession(version);
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${API_URL}${path}`, { ...init, headers });
  assertSession(version);
  if (response.status === 401 && retry && canRefresh(path) && await refreshAccessToken()) {
    assertSession(version);
    return apiFetch<T>(path, init, false);
  }
  if (!response.ok) {
    let message = "NOVA could not complete this request.";
    let requestId = response.headers.get("X-Request-ID");
    try {
      const body = await response.json() as Partial<NovaApiErrorBody> & { detail?: unknown };
      requestId = body.error?.request_id || requestId;
      message = messageFromErrorBody(body, message);
    } catch {}
    throw new ApiError(requestId ? `${message} (Request ID: ${requestId})` : message, response.status, requestId);
  }
  if (response.status === 204) return undefined as T;
  const result = await response.json() as T;
  assertSession(version);
  return result;
}

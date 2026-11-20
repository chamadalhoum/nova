import type {
  NovaApiErrorBody,
  NovaAdminAuditLog,
  NovaAdminDashboard,
  NovaAdminPage,
  NovaAdminProvider,
  NovaAdminServiceRequest,
  NovaAdminTask,
  NovaAdminUser,
  NovaAttachment,
  NovaAttachmentCreate,
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
export type AdminPage<T> = NovaAdminPage<T>;
export type AdminDashboard = NovaAdminDashboard;
export type AdminUser = NovaAdminUser;
export type AdminTask = NovaAdminTask;
export type AdminServiceRequest = NovaAdminServiceRequest;
export type AdminProvider = NovaAdminProvider;
export type AdminAuditLog = NovaAdminAuditLog;
export type Attachment = NovaAttachment;

export class ApiError extends Error {
  constructor(message: string, public status: number, public requestId: string | null) {
    super(message);
    this.name = "ApiError";
  }
}

export function getAccessToken() {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem("nova_access_token");
}

export function saveTokens(tokens: TokenPair) {
  changeSession();
  writeTokens(tokens);
}

function writeTokens(tokens: TokenPair) {
  sessionStorage.setItem("nova_access_token", tokens.access_token);
  sessionStorage.setItem("nova_refresh_token", tokens.refresh_token);
}

export function clearTokens() {
  changeSession();
  sessionStorage.removeItem("nova_access_token");
  sessionStorage.removeItem("nova_refresh_token");
}

let refreshPromise: Promise<boolean> | null = null;
let sessionVersion = 0;
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

function getRefreshToken() {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem("nova_refresh_token");
}

export async function logout() {
  const refreshToken = getRefreshToken();
  try {
    if (refreshToken) await apiFetch("/api/v1/auth/logout", { method: "POST", body: JSON.stringify({ refresh_token: refreshToken }) });
  } catch {
    // Clearing the local session remains safe when the server session is already expired.
  } finally {
    clearTokens();
  }
}

function canRefresh(path: string) {
  return !["/api/v1/auth/login", "/api/v1/auth/register", "/api/v1/auth/refresh"].includes(path);
}

async function performRefresh() {
  const version = sessionVersion;
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;
  const response = await fetch(`${API_URL}/api/v1/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  assertSession(version);
  if (!response.ok) {
    if (response.status !== 401) throw new ApiError("Session renewal is temporarily unavailable. Please try again.", response.status, response.headers.get("X-Request-ID"));
    if (getRefreshToken() === refreshToken) clearTokens();
    return false;
  }
  const tokens = await response.json() as TokenPair;
  assertSession(version);
  writeTokens(tokens);
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
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  const token = getAccessToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${API_URL}${path}`, { ...init, headers });
  assertSession(version);
  if (response.status === 401 && retry && canRefresh(path) && await refreshAccessToken()) {
    assertSession(version);
    return apiFetch<T>(path, init, false);
  }
  if (!response.ok) {
    let message = "NOVA could not complete this request. Please try again.";
    let requestId = response.headers.get("X-Request-ID");
    try {
      const body = await response.json() as Partial<NovaApiErrorBody> & { detail?: unknown };
      requestId = body.error?.request_id || requestId;
      message = messageFromErrorBody(body, message);
    } catch {}
    throw new ApiError(message, response.status, requestId);
  }
  if (response.status === 204) return undefined as T;
  const result = await response.json() as T;
  assertSession(version);
  return result;
}

export async function uploadMessageAttachment(messageId: string, payload: NovaAttachmentCreate) {
  return apiFetch<Attachment>(`/api/v1/messages/${messageId}/attachments`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

const STORAGE_KEY_TOKEN = "smart_inventory_auth_token";
const STORAGE_KEY_ORG_ID = "smart_inventory_active_org_id";

// Configurable API base URL from Vite environment variables (falls back to relative path for Vite dev proxy)
export const API_BASE_URL: string =
  (import.meta as any).env?.VITE_API_URL?.replace(/\/+$/, "") || "";

export function getStoredToken(): string | null {
  return localStorage.getItem(STORAGE_KEY_TOKEN);
}

export function setStoredToken(token: string | null): void {
  if (token) {
    localStorage.setItem(STORAGE_KEY_TOKEN, token);
  } else {
    localStorage.removeItem(STORAGE_KEY_TOKEN);
  }
}

export function getStoredOrgId(): string | null {
  return localStorage.getItem(STORAGE_KEY_ORG_ID);
}

export function setStoredOrgId(orgId: string | null): void {
  if (orgId) {
    localStorage.setItem(STORAGE_KEY_ORG_ID, orgId);
  } else {
    localStorage.removeItem(STORAGE_KEY_ORG_ID);
  }
}

export interface ApiErrorDetail {
  field?: string;
  message: string;
  code?: string;
  [key: string]: unknown;
}

export interface StandardApiErrorPayload {
  code: string;
  message: string;
  details?: ApiErrorDetail[] | unknown;
}

export interface ApiErrorResponse {
  success?: boolean;
  error?: string | StandardApiErrorPayload;
  message?: string;
  statusCode?: number;
  [key: string]: unknown;
}

export class ApiError extends Error {
  statusCode: number;
  code: string;
  data: ApiErrorResponse;
  details?: unknown;

  constructor(
    message: string,
    statusCode: number,
    code: string,
    data: ApiErrorResponse,
    details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.code = code;
    this.data = data;
    this.details = details;
  }
}

export async function apiRequest<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getStoredToken();
  const activeOrgId = getStoredOrgId();

  const headers = new Headers(options.headers || {});
  headers.set("Accept", "application/json");

  if (options.body && typeof options.body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (activeOrgId && !headers.has("x-organization-id")) {
    headers.set("x-organization-id", activeOrgId);
  }

  // Construct final URL
  const targetUrl = path.startsWith("http://") || path.startsWith("https://")
    ? path
    : `${API_BASE_URL}${path.startsWith("/") ? "" : "/"}${path}`;

  const response = await fetch(targetUrl, {
    ...options,
    headers,
  });

  const contentType = response.headers.get("content-type");
  const isJson = contentType && contentType.includes("application/json");
  const data = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const errorData: ApiErrorResponse = isJson
      ? (data as ApiErrorResponse)
      : { error: response.statusText, message: String(data) };

    // Parse message and code from either standard Phase 2 or legacy format
    let errorMessage = "An error occurred";
    let errorCode = "UNKNOWN_ERROR";
    let errorDetails: unknown = undefined;

    if (errorData.error && typeof errorData.error === "object") {
      errorMessage = errorData.error.message || errorData.message || errorMessage;
      errorCode = errorData.error.code || errorCode;
      errorDetails = errorData.error.details;
    } else if (typeof errorData.error === "string") {
      errorMessage = errorData.message || errorData.error;
      errorCode = errorData.error;
    } else if (errorData.message) {
      errorMessage = errorData.message;
    }

    // Handle session expiration on 401 Unauthorized
    if (response.status === 401) {
      setStoredToken(null);
      setStoredOrgId(null);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("auth:unauthorized"));
      }
    }

    throw new ApiError(
      errorMessage,
      response.status,
      errorCode,
      errorData,
      errorDetails
    );
  }

  return data as T;
}

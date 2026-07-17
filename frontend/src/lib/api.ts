import { getAuthToken } from "./authToken";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api";
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken(); const response = await fetch(`${API_URL}${path}`, { ...options, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers } });
  const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.message ?? "Request failed"); return body;
}

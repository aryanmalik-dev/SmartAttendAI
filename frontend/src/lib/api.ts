import axios from "axios";
import type {
  ApiResponse,
  AttendanceRecord,
  AttendanceSession,
  DashboardMetrics,
  LiveAttendanceFrame,
  LiveAttendanceState,
  LiveAttendanceStats,
  NotificationItem,
  Page,
  SearchResult,
  User
} from "./types";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000/api/v1"
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("smartattend.token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export async function login(email: string, password: string) {
  const { data } = await api.post<ApiResponse<{ access_token: string; user: User }>>("/auth/login", { email, password });
  return data.data;
}

export async function me() {
  const { data } = await api.get<ApiResponse<User>>("/auth/me");
  return data.data;
}

export async function dashboard() {
  const { data } = await api.get<ApiResponse<DashboardMetrics>>("/analytics/dashboard");
  return data.data;
}

export async function listResource<T>(
  path: string,
  params: Record<string, string | number | boolean | null | undefined> = {},
) {
  const size = Math.min(Math.max(Number(params.size ?? 10), 1), 100);
  const page = Math.max(Number(params.p ?? 1), 1);
  const nextParams = { ...params, p: page, size };
  const { data } = await api.get<ApiResponse<Page<T>>>(path, {
    params: nextParams
  });
  return data.data;
}

export function downloadFromResponse(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
    anchor.remove();
  }, 0);
}

export async function exportResource(path: string, params: Record<string, string | number | boolean | null | undefined> = {}) {
  const response = await api.get(path, { params, responseType: "blob" });
  return response.data as Blob;
}

export async function getAttendanceSessions(params: Record<string, string | number | boolean | null | undefined> = {}) {
  const { data } = await api.get<ApiResponse<Page<AttendanceSession>>>("/attendance/sessions", { params });
  return data.data;
}

export async function getAttendanceRecords(params: Record<string, string | number | boolean | null | undefined> = {}) {
  const { data } = await api.get<ApiResponse<Page<AttendanceRecord>>>("/attendance/records", { params });
  return data.data;
}

export async function startLiveAttendance(sessionId: number) {
  const { data } = await api.post<ApiResponse<AttendanceSession>>(`/live-attendance/sessions/${sessionId}/start`);
  return data.data;
}

export async function stopLiveAttendance(sessionId: number) {
  const { data } = await api.post<ApiResponse<AttendanceSession>>(`/live-attendance/sessions/${sessionId}/stop`);
  return data.data;
}

export async function getLiveAttendanceState(sessionId: number) {
  const { data } = await api.get<ApiResponse<LiveAttendanceState>>(`/live-attendance/sessions/${sessionId}/state`);
  return data.data;
}

export async function getLiveAttendanceStats(sessionId: number) {
  const { data } = await api.get<ApiResponse<LiveAttendanceStats>>(`/live-attendance/sessions/${sessionId}/stats`);
  return data.data;
}

export async function submitLiveAttendanceFrame(sessionId: number, imageBase64: string) {
  const { data } = await api.post<ApiResponse<LiveAttendanceFrame>>(`/live-attendance/sessions/${sessionId}/frame`, { image_base64: imageBase64 });
  return data.data;
}

export async function listNotifications(params: Record<string, string | number | boolean | null | undefined> = {}) {
  const { data } = await api.get<ApiResponse<Page<NotificationItem>>>("/notifications", { params });
  return data.data;
}

export async function searchGlobal(q: string, limit = 20) {
  const { data } = await api.get<ApiResponse<SearchResult[]>>("/search", { params: { q, limit } });
  return data.data;
}

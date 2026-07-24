import axios from "axios";
import type { ApiResponse, DashboardMetrics, Page, User } from "./types";

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

export async function listResource<T>(path: string, search = "", page = 1) {
  const { data } = await api.get<ApiResponse<Page<T>>>(path, { params: { search, p: page, size: 10 } });
  return data.data;
}

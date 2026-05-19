import axios from "axios";

const baseURL = import.meta.env.VITE_API_BASE_URL || "/api";

export const api = axios.create({ baseURL });

let currentToken = null;

export function setAuthToken(token) {
  currentToken = token;
}

api.interceptors.request.use((config) => {
  if (currentToken) {
    config.headers.Authorization = `Bearer ${currentToken}`;
  }
  return config;
});

export async function loginWithGoogle(idToken) {
  const { data } = await api.post("/auth/google", { token: idToken });
  return data;
}

export async function fetchAssets() {
  const { data } = await api.get("/assets");
  return data;
}

export async function fetchAsset(id) {
  const { data } = await api.get(`/assets/${id}`);
  return data;
}

export async function createAsset(payload) {
  const { data } = await api.post("/assets", payload);
  return data;
}

export async function updateAsset(id, payload) {
  const { data } = await api.put(`/assets/${id}`, payload);
  return data;
}

export async function deleteAsset(id) {
  await api.delete(`/assets/${id}`);
}

export async function fetchBorrowRecords() {
  const { data } = await api.get("/borrow");
  return data;
}

export async function createBorrow(payload) {
  const { data } = await api.post("/borrow", payload);
  return data;
}

export async function markReturned(id) {
  const { data } = await api.put(`/borrow/${id}/return`);
  return data;
}

export async function fetchAuthorizedUsers() {
  const { data } = await api.get("/admin/authorized-users");
  return data;
}

export async function addAuthorizedUser(email) {
  const { data } = await api.post("/admin/authorized-users", { email });
  return data;
}

export async function removeAuthorizedUser(id) {
  await api.delete(`/admin/authorized-users/${id}`);
}

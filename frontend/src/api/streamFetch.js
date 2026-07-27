import { getAccessToken, setAccessToken } from "./axiosInstance";
import { authService } from "./authService";

const API_BASE = import.meta.env.VITE_API_BASE_URL;

export async function authFetch(path, options = {}, _retried = false) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      ...options.headers,
      Authorization: `Bearer ${getAccessToken()}`,
    },
  });

  if (res.status === 401 && !_retried) {
    const { data } = await authService.refreshToken();
    setAccessToken(data.accessToken);
    return authFetch(path, options, true);
  }

  return res;
}

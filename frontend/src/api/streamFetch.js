import {
  getAccessToken,
  setAccessToken,
  refreshAccessToken,
} from "./axiosInstance";

export async function authFetch(path, options = {}, _retried = false) {
  const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      ...options.headers,
      Authorization: `Bearer ${getAccessToken()}`,
    },
  });

  if (res.status === 401 && !_retried) {
    try {
      await refreshAccessToken();
    } catch {
      setAccessToken(null);
      window.location.href = "/signin";
      throw new Error("Session expired");
    }
    return authFetch(path, options, true);
  }
  return res;
}

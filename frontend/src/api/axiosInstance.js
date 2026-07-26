import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  withCredentials: true,
});

let accessToken = null;
export const setAccessToken = (token) => {
  accessToken = token;
};
export const getAccessToken = () => accessToken;

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

let refreshPromise = null;

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const isRefreshCall = original?.url?.includes("/auth/refresh-token");

    // If the refresh-token call itself 401s, there's nothing to refresh —
    // just let it fail so AuthContext's try/catch handles it quietly.
    if (error.response?.status === 401 && !original._retry && !isRefreshCall) {
      original._retry = true;
      try {
        refreshPromise ??= api
          .get("/auth/refresh-token")
          .then((res) => {
            setAccessToken(res.data.accessToken);
            return res.data.accessToken;
          })
          .finally(() => {
            refreshPromise = null;
          });

        const newToken = await refreshPromise;
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      } catch {
        setAccessToken(null);
        window.location.href = "/signin";
      }
    }
    return Promise.reject(error);
  },
);

export default api;

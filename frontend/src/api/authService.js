import api from "./axiosInstance";

export const authService = {
  register: (data) => api.post("/auth/register", data),       // { username, email, password }
  verifyEmail: (data) => api.post("/auth/verify-email", data), // { email, otp }
  resendOtp: (email) => api.post("/auth/resend-otp", { email }),
  login: (data) => api.post("/auth/login", data),              // { email, password } -> { user, accessToken }
  refreshToken: () => api.get("/auth/refresh-token"),          // -> { accessToken }
  getMe: () => api.get("/auth/get-me"),
  logout: () => api.get("/auth/logout"),
};
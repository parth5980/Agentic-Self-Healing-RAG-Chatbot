import api from "./axiosInstance";

export const authService = {
  register: (data) => api.post("/auth/register", data),       // { username, email, password }
  verifyEmail: (data) => api.post("/auth/verify-email", data), // { email, otp }
  resendOtp: (email) => api.post("/auth/resend-otp", { email }),
  login: (data) => api.post("/auth/login", data),              // { email, password } -> { user, accessToken }
  refreshToken: () => api.get("/auth/refresh-token"),          // -> { accessToken }
  getMe: () => api.get("/auth/get-me"),
  logout: () => api.get("/auth/logout"),
  forgotPassword: (email) => api.post("/auth/forgot-password", { email }),
  updatePassword: (payload) => api.post("/auth/update-password", payload), // {currentPassword,newPassword} or {email,otp,newPassword}
  updateProfile: (payload) => api.post("/auth/update-profile", payload), // {username}
};
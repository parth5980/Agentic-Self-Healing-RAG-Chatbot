import { createContext, useState, useEffect } from "react";
import { authService } from "../api/authService";
import { setAccessToken } from "../api/axiosInstance";

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await authService.refreshToken();
        setAccessToken(data.accessToken);
        const me = await authService.getMe();
        setUser(me.data.user);
      } catch {
        setAccessToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = async (credentials) => {
    const { data } = await authService.login(credentials);
    setAccessToken(data.accessToken);
    setUser(data.user);
    return data;
  };

  const register = (payload) => authService.register(payload); // -> { user } (unverified, no token yet)

  // verify-email returns no session, so we log in immediately after —
  // password only ever lives in memory in the SignUp form state.
  const verifyEmailAndLogin = async ({ email, otp, password }) => {
    await authService.verifyEmail({ email, otp });
    return login({ email, password });
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch {}
    setAccessToken(null);
    setUser(null);
  };

  const updateUser = (patch) =>
    setUser((prev) => (prev ? { ...prev, ...patch } : prev));

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        verifyEmailAndLogin,
        logout,
        isAuthenticated: !!user,
        updateUser,
      }}>
      {children}
    </AuthContext.Provider>
  );
}

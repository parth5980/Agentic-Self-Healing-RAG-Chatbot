import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authService } from "../../api/authService";
import AuthLayout from "../../components/auth/AuthLayout";
import PasswordInput from "../../components/auth/PasswordInput";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState("request"); // "request" | "reset"
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRequestCode = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await authService.forgotPassword(email);
      setNotice(data.message);
      setStep("reset");
    } catch (err) {
      setError(err.response?.data?.message || "Could not send reset code");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      await authService.updatePassword({ email, otp, newPassword });
      navigate("/signin", { state: { resetSuccess: true } });
    } catch (err) {
      setError(err.response?.data?.message || "Could not reset password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      heading="Forgot Password?"
      subtext="Enter your email and we'll send you a code to reset your password.">
      {step === "request" ? (
        <>
          <h2 className="text-2xl font-bold text-white text-center mb-8">
            Reset Password
          </h2>
          <form onSubmit={handleRequestCode} className="space-y-5">
            <div>
              <label className="block text-sm text-gray-300 mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="researcher@university.edu"
                required
                className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-600"
              />
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-60 py-2.5 font-semibold text-white shadow-lg shadow-purple-900/50 transition-colors">
              {loading ? "Sending..." : "Send Reset Code"}
            </button>

            <p className="text-center text-sm text-gray-500">
              Remembered your password?{" "}
              <Link
                to="/signin"
                className="text-purple-400 font-medium hover:text-purple-300">
                Sign In
              </Link>
            </p>
          </form>
        </>
      ) : (
        <>
          <h2 className="text-2xl font-bold text-white text-center mb-2">
            Check Your Email
          </h2>
          {notice && (
            <p className="text-center text-sm text-gray-500 mb-8">{notice}</p>
          )}

          <form onSubmit={handleResetPassword} className="space-y-5">
            <div>
              <label className="block text-sm text-gray-300 mb-1.5">
                Reset Code
              </label>
              <input
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                maxLength={6}
                placeholder="6-digit code"
                required
                className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-600 tracking-widest text-center"
              />
            </div>

            <PasswordInput
              label="New Password"
              name="newPassword"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={8}
              required
              helperText="Must be at least 8 characters."
            />
            <PasswordInput
              label="Confirm New Password"
              name="confirmPassword"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />

            {error && <p className="text-sm text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-60 py-2.5 font-semibold text-white shadow-lg shadow-purple-900/50 transition-colors">
              {loading ? "Resetting..." : "Reset Password"}
            </button>

            <button
              type="button"
              onClick={() => setStep("request")}
              className="w-full text-center text-xs text-gray-600 hover:text-gray-400">
              Use a different email
            </button>
          </form>
        </>
      )}
    </AuthLayout>
  );
}

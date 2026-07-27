import { useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authService } from "../../api/authService";
import { useAuth } from "../../hooks/useAuth";
import AuthLayout from "../../components/auth/AuthLayout";
import PasswordInput from "../../components/auth/PasswordInput";
import StepIndicator from "../../components/auth/StepIndicator";

export default function SignUp() {
  const { verifyEmailAndLogin } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const otpRefs = useRef([]);

  const handleFormChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSendCode = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await authService.register(form);
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.message || "Could not create account");
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index, value) => {
    if (!/^[0-9]?$/.test(value)) return;
    const next = [...otp];
    next[index] = value;
    setOtp(next);
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await verifyEmailAndLogin({
        email: form.email,
        otp: otp.join(""),
        password: form.password,
      });
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.message || "Invalid or expired code");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      await authService.resendOtp(form.email);
    } catch (err) {
      setError(err.response?.data?.message || "Could not resend code");
    }
  };

  return (
    <AuthLayout
      heading="Get Started with Us"
      subtext="Complete these easy steps to register your account."
      sideExtra={<StepIndicator step={step} />}>
      {step === 1 ? (
        <>
          <h2 className="text-2xl font-bold text-white text-center mb-8">
            Sign Up Account
          </h2>
          <form onSubmit={handleSendCode} className="space-y-5">
            <div>
              <label className="block text-sm text-gray-300 mb-1.5">
                Username
              </label>
              <input
                name="username"
                placeholder="John"
                value={form.username}
                onChange={handleFormChange}
                required
                className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-600"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1.5">
                Email
              </label>
              <input
                type="email"
                name="email"
                placeholder="you@gmail.com"
                value={form.email}
                onChange={handleFormChange}
                required
                className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-600"
              />
            </div>
            <PasswordInput
              label="Password"
              name="password"
              value={form.password}
              onChange={handleFormChange}
              minLength={8}
              required
              helperText="Must be at least 8 characters."
            />

            {error && <p className="text-sm text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-60 py-2.5 font-semibold text-white shadow-lg shadow-purple-900/50 transition-colors">
              {loading ? "Sending..." : "Send Code"}
            </button>

            <p className="text-center text-sm text-gray-500">
              Already have an account?{" "}
              <Link
                to="/signin"
                className="text-purple-400 font-semibold hover:text-purple-300">
                Log in
              </Link>
            </p>
          </form>
        </>
      ) : (
        <>
          <h2 className="text-2xl font-bold text-white text-center">
            Verify Your Email
          </h2>
          <p className="text-center text-sm text-gray-500 mt-2 mb-8">
            Enter the 6-digit code sent to{" "}
            <span className="text-gray-300">{form.email}</span>.
          </p>

          <form onSubmit={handleVerify} className="space-y-6">
            <div className="flex justify-center gap-3">
              {otp.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => (otpRefs.current[i] = el)}
                  value={digit}
                  maxLength={1}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(i, e)}
                  className="w-12 h-12 text-center text-lg font-semibold rounded-lg bg-zinc-900 border border-zinc-800 text-white focus:outline-none focus:ring-2 focus:ring-purple-600"
                />
              ))}
            </div>

            {error && (
              <p className="text-sm text-red-400 text-center">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-60 py-2.5 font-semibold text-white shadow-lg shadow-purple-900/50 transition-colors">
              {loading ? "Verifying..." : "Verify & Create Account"}
            </button>

            <div className="text-center space-y-2">
              <p className="text-sm text-gray-500">
                Didn't receive the code?{" "}
                <button
                  type="button"
                  onClick={handleResend}
                  className="text-purple-400 font-medium hover:text-purple-300">
                  Resend Code
                </button>
              </p>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-xs text-gray-600 hover:text-gray-400">
                Change email address
              </button>
            </div>
          </form>
        </>
      )}
    </AuthLayout>
  );
}

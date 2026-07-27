import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import AuthLayout from "../../components/auth/AuthLayout";
import PasswordInput from "../../components/auth/PasswordInput";

export default function SignIn() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(form);
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.message || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      heading="Welcome Back"
      subtext="Access your academic assistant to continue synthesizing research, organizing notes, and drafting papers.">
      <h2 className="text-2xl font-bold text-white text-center mb-8">
        Sign In
      </h2>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm text-gray-300 mb-1.5">Email</label>
          <input
            type="email"
            name="email"
            placeholder="researcher@university.edu"
            value={form.email}
            onChange={handleChange}
            required
            className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-600"
          />
        </div>

        <div>
          <PasswordInput
            label="Password"
            name="password"
            value={form.password}
            onChange={handleChange}
            required
          />
          <div className="flex justify-end mt-1.5">
            <Link
              to="/forgot-password"
              className="text-xs text-purple-400 hover:text-purple-300">
              Forgot password?
            </Link>
          </div>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-60 py-2.5 font-semibold text-white shadow-lg shadow-purple-900/50 transition-colors">
          {loading ? "Signing in..." : "Login"}
        </button>

        <p className="text-center text-sm text-gray-500">
          Don't have an account?{" "}
          <Link
            to="/signup"
            className="text-purple-400 font-medium hover:text-purple-300">
            Sign Up
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}

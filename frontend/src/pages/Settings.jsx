import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Menu } from "lucide-react";
import Sidebar from "../components/dashboard/Sidebar";
import { useThreads } from "../hooks/useThreads";
import { useAuth } from "../hooks/useAuth";
import { authService } from "../api/authService";
import { chatService } from "../api/chatService";
import PasswordInput from "../components/auth/PasswordInput";

export default function Settings() {
  const { user, updateUser } = useAuth();
  const { threads, removeThread } = useThreads();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const [username, setUsername] = useState(user?.username || "");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");

  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString(undefined, {
        month: "short",
        year: "numeric",
      })
    : null;

  const handleDeleteThread = async (threadId) => {
    if (!window.confirm("Delete this chat? This can't be undone.")) return;
    try {
      await chatService.deleteThread(threadId);
      removeThread(threadId);
    } catch (err) {
      console.error("Failed to delete thread", err);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setProfileError("");
    setProfileSuccess("");
    if (!username.trim() || username === user?.username) return;

    setProfileSaving(true);
    try {
      const { data } = await authService.updateProfile({
        username: username.trim(),
      });
      updateUser({ username: data.user.username });
      setProfileSuccess("Profile updated successfully.");
    } catch (err) {
      setProfileError(
        err.response?.data?.message || "Could not update profile",
      );
    } finally {
      setProfileSaving(false);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match");
      return;
    }

    setPasswordSaving(true);
    try {
      await authService.updatePassword({ currentPassword, newPassword });
      setPasswordSuccess("Password updated successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPasswordError(
        err.response?.data?.message || "Could not update password",
      );
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <div className="flex h-[100dvh] w-full bg-black overflow-hidden">
      <Sidebar
        threads={threads}
        activeThreadId={null}
        onSelectThread={(threadId) => navigate(`/chat/${threadId}`)}
        onNewChat={() => navigate(`/chat/${crypto.randomUUID()}`)}
        onDeleteThread={handleDeleteThread}
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
      />

      <div className="flex-1 h-[dvh] overflow-y-auto bg-black">
        <header className="flex items-center gap-3 px-6 md:px-10 py-6 border-b border-white/5">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="md:hidden p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 border border-white/5">
            <Menu size={20} />
          </button>
          <div>
            <h1 className="text-white font-bold text-xl">Settings</h1>
            <p className="text-sm text-zinc-500 mt-1">
              Manage your profile and security
            </p>
          </div>
        </header>

        <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
          <div className="rounded-2xl bg-zinc-900/60 border border-white/5 px-6 py-5 flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center text-white text-xl font-bold shrink-0">
              {user?.username?.[0]?.toUpperCase() || "?"}
            </div>
            <div>
              <p className="text-white font-semibold">{user?.username}</p>
              {memberSince && (
                <p className="text-xs text-zinc-500">
                  Member since {memberSince}
                </p>
              )}
            </div>
          </div>

          <form
            onSubmit={handleSaveProfile}
            className="rounded-2xl bg-zinc-900/60 border border-white/5 px-6 py-5 space-y-4">
            <h2 className="text-white font-semibold">Account Information</h2>

            <div>
              <label className="block text-xs text-zinc-500 mb-1.5">
                Username
              </label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-purple-600"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs text-zinc-500">Email Address</label>
                <span className="text-[10px] text-zinc-600 uppercase tracking-wide">
                  Locked
                </span>
              </div>
              <input
                value={user?.email || ""}
                disabled
                className="w-full rounded-lg bg-zinc-950/50 border border-zinc-800 px-4 py-2.5 text-zinc-500 cursor-not-allowed"
              />
              <p className="text-xs text-zinc-600 mt-1">
                Your email is tied to your account and can't be changed here.
              </p>
            </div>

            {profileError && (
              <p className="text-sm text-red-400">{profileError}</p>
            )}
            {profileSuccess && (
              <p className="text-sm text-emerald-400">{profileSuccess}</p>
            )}

            <button
              type="submit"
              disabled={
                profileSaving || !username.trim() || username === user?.username
              }
              className="rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 px-5 py-2.5 text-sm font-semibold text-white transition-colors">
              {profileSaving ? "Saving..." : "Save Changes"}
            </button>
          </form>

          <form
            onSubmit={handleUpdatePassword}
            className="rounded-2xl bg-zinc-900/60 border border-white/5 px-6 py-5 space-y-4">
            <h2 className="text-white font-semibold">Change Password</h2>

            <PasswordInput
              label="Current Password"
              name="currentPassword"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
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

            {passwordError && (
              <p className="text-sm text-red-400">{passwordError}</p>
            )}
            {passwordSuccess && (
              <p className="text-sm text-emerald-400">{passwordSuccess}</p>
            )}

            <button
              type="submit"
              disabled={passwordSaving}
              className="rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 px-5 py-2.5 text-sm font-semibold text-white transition-colors">
              {passwordSaving ? "Updating..." : "Update Password"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

import { useState } from "react";

import { useClientPortal } from "../../context/ClientPortalContext";
import { changeMyPassword } from "../../services/clientApi";
import { showError, showSuccess } from "../../utils/toaster";
import { t } from "../../i18n";

export default function ClientSettingsPage() {
  const { profile, loading: loadingProfile } = useClientPortal();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleChangePassword(event) {
    event.preventDefault();

    if (!currentPassword) {
      showError(t("Please enter your current password."));
      return;
    }
    if (newPassword.length < 6) {
      showError(t("New password must be at least 6 characters."));
      return;
    }
    if (newPassword !== confirmPassword) {
      showError(t("New password and confirmation do not match."));
      return;
    }
    if (newPassword === currentPassword) {
      showError(t("New password must be different from your current password."));
      return;
    }

    setSaving(true);
    try {
      await changeMyPassword(currentPassword, newPassword);
      showSuccess(t("Password updated successfully. Other active sessions have been signed out."));
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      showError(error?.message || t("Could not update your password."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-maroon">{t("Settings")}</h1>
        <p className="text-sm text-slate-500">{t("Manage your account.")}</p>
      </div>

      <div className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm">
        <h2 className="font-serif text-lg font-semibold text-maroon">{t("Account Info")}</h2>
        {loadingProfile ? (
          <p className="mt-3 text-sm text-slate-400">{t("Loading...")}</p>
        ) : profile ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs text-slate-400">{t("Full Name")}</p>
              <p className="font-medium text-slate-700">{profile.full_name || "-"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">{t("Email")}</p>
              <p className="font-medium text-slate-700">{profile.email || "-"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">{t("Phone")}</p>
              <p className="font-medium text-slate-700">{profile.phone || "-"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">{t("Member Since")}</p>
              <p className="font-medium text-slate-700">
                {profile.created_at ? new Date(profile.created_at).toLocaleDateString() : "-"}
              </p>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-400">{t("Could not load your profile.")}</p>
        )}
      </div>

      <div className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm">
        <h2 className="font-serif text-lg font-semibold text-maroon">{t("Change Password")}</h2>
        <p className="mt-1 text-sm text-slate-500">
          {t("Changing your password signs you out of every other active session.")}
        </p>

        <form onSubmit={handleChangePassword} className="mt-4 grid gap-4">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">{t("Current Password")}</span>
            <input
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              autoComplete="current-password"
              disabled={saving}
              className="w-full rounded-xl border border-amber-200 px-3 py-2 text-sm outline-none focus:border-maroon focus:ring-2 focus:ring-amber-100 disabled:opacity-60"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">{t("New Password")}</span>
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
              disabled={saving}
              className="w-full rounded-xl border border-amber-200 px-3 py-2 text-sm outline-none focus:border-maroon focus:ring-2 focus:ring-amber-100 disabled:opacity-60"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">{t("Confirm New Password")}</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              disabled={saving}
              className="w-full rounded-xl border border-amber-200 px-3 py-2 text-sm outline-none focus:border-maroon focus:ring-2 focus:ring-amber-100 disabled:opacity-60"
            />
          </label>

          <button
            type="submit"
            disabled={saving}
            className="interactive-button w-fit rounded-full bg-maroon px-6 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? t("Updating...") : t("Update Password")}
          </button>
        </form>
      </div>
    </div>
  );
}

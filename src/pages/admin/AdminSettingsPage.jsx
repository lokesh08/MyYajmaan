import { useEffect, useMemo, useState } from "react";

import { get } from "../../api";
import {
  changeAdminPassword,
  getAdminProfile,
  getBookingLeadTimeSettings,
  getInvoiceSettings,
  getPanditRegistrationSettings,
  getPricingSettings,
  getSocialLinksSettings,
  updateBookingLeadTimeSettings,
  updateInvoiceSettings,
  updatePanditRegistrationSettings,
  updatePricingSettings,
  updateSocialLinksSettings,
} from "../../services/adminApi";
import { showError, showSuccess } from "../../utils/toaster";
import { formatRoleLabel } from "../../utils/roleLabels";

export default function AdminSettingsPage() {
  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [skipAadhar, setSkipAadhar] = useState(false);
  const [loadingSkipAadhar, setLoadingSkipAadhar] = useState(true);
  const [savingSkipAadhar, setSavingSkipAadhar] = useState(false);

  const [leadHoursInput, setLeadHoursInput] = useState("6");
  const [loadingLeadHours, setLoadingLeadHours] = useState(true);
  const [savingLeadHours, setSavingLeadHours] = useState(false);

  const [premiumFeeInput, setPremiumFeeInput] = useState("500");
  const [gstInput, setGstInput] = useState("0");
  const [platformFeeInput, setPlatformFeeInput] = useState("200");
  const [loadingPricing, setLoadingPricing] = useState(true);
  const [savingPricing, setSavingPricing] = useState(false);

  const [cities, setCities] = useState([]);
  const [companyNameInput, setCompanyNameInput] = useState("");
  const [companyGstinInput, setCompanyGstinInput] = useState("");
  const [companyAddressInput, setCompanyAddressInput] = useState("");
  const [companyStateInput, setCompanyStateInput] = useState("");
  const [sacCodeInput, setSacCodeInput] = useState("998599");
  const [loadingInvoice, setLoadingInvoice] = useState(true);
  const [savingInvoice, setSavingInvoice] = useState(false);

  const [instagramInput, setInstagramInput] = useState("");
  const [facebookInput, setFacebookInput] = useState("");
  const [whatsappInput, setWhatsappInput] = useState("");
  const [xTwitterInput, setXTwitterInput] = useState("");
  const [linkedinInput, setLinkedinInput] = useState("");
  const [youtubeInput, setYoutubeInput] = useState("");
  const [threadsInput, setThreadsInput] = useState("");
  const [loadingSocialLinks, setLoadingSocialLinks] = useState(true);
  const [savingSocialLinks, setSavingSocialLinks] = useState(false);

  const states = useMemo(() => [...new Set(cities.map((c) => c.state))].filter(Boolean).sort(), [cities]);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getAdminProfile()
      .then((data) => setProfile(data?.profile || null))
      .catch(() => setProfile(null))
      .finally(() => setLoadingProfile(false));
  }, []);

  useEffect(() => {
    getPanditRegistrationSettings()
      .then((data) => setSkipAadhar(Boolean(data?.skip_aadhar_verification)))
      .catch(() => showError("Could not load Pandit Ji registration settings."))
      .finally(() => setLoadingSkipAadhar(false));
  }, []);

  useEffect(() => {
    getBookingLeadTimeSettings()
      .then((data) => {
        const hours = Number.isFinite(data?.min_lead_hours) ? data.min_lead_hours : 6;
        setLeadHoursInput(String(hours));
      })
      .catch(() => showError("Could not load the booking lead-time setting."))
      .finally(() => setLoadingLeadHours(false));
  }, []);

  useEffect(() => {
    getPricingSettings()
      .then((data) => {
        setPremiumFeeInput(String(Number.isFinite(data?.premium_package_fee) ? data.premium_package_fee : 500));
        setGstInput(String(Number.isFinite(data?.gst_percentage) ? data.gst_percentage : 0));
        setPlatformFeeInput(String(Number.isFinite(data?.platform_fee) ? data.platform_fee : 200));
      })
      .catch(() => showError("Could not load the pricing settings."))
      .finally(() => setLoadingPricing(false));
  }, []);

  useEffect(() => {
    get("/cities")
      .then((data) => setCities(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    getInvoiceSettings()
      .then((data) => {
        setCompanyNameInput(data?.company_name || "");
        setCompanyGstinInput(data?.company_gstin || "");
        setCompanyAddressInput(data?.company_address || "");
        setCompanyStateInput(data?.company_state || "");
        setSacCodeInput(data?.sac_code || "998599");
      })
      .catch(() => showError("Could not load the invoice/GST settings."))
      .finally(() => setLoadingInvoice(false));
  }, []);

  useEffect(() => {
    getSocialLinksSettings()
      .then((data) => {
        setInstagramInput(data?.instagram || "");
        setFacebookInput(data?.facebook || "");
        setWhatsappInput(data?.whatsapp || "");
        setXTwitterInput(data?.x_twitter || "");
        setLinkedinInput(data?.linkedin || "");
        setYoutubeInput(data?.youtube || "");
        setThreadsInput(data?.threads || "");
      })
      .catch(() => showError("Could not load the social media links."))
      .finally(() => setLoadingSocialLinks(false));
  }, []);

  async function handleToggleSkipAadhar(nextValue) {
    setSavingSkipAadhar(true);
    try {
      await updatePanditRegistrationSettings(nextValue);
      setSkipAadhar(nextValue);
      showSuccess(
        nextValue
          ? "New Pandit Ji registrations will now skip Aadhaar OTP and fall back to manual card-image review."
          : "New Pandit Ji registrations will now go through Aadhaar OTP verification again."
      );
    } catch (error) {
      showError(error?.data?.detail?.message || error?.message || "Could not update this setting.");
    } finally {
      setSavingSkipAadhar(false);
    }
  }

  async function handleSaveLeadHours(event) {
    event.preventDefault();
    const hours = Number(leadHoursInput);
    if (!Number.isFinite(hours) || hours < 0 || hours > 168) {
      showError("Please enter a number of hours between 0 and 168.");
      return;
    }

    setSavingLeadHours(true);
    try {
      await updateBookingLeadTimeSettings(hours);
      setLeadHoursInput(String(hours));
      showSuccess(`Bookings now need at least ${hours} hour${hours === 1 ? "" : "s"}' notice.`);
    } catch (error) {
      showError(error?.data?.detail?.message || error?.message || "Could not update this setting.");
    } finally {
      setSavingLeadHours(false);
    }
  }

  async function handleSavePricing(event) {
    event.preventDefault();
    const premiumFee = Number(premiumFeeInput);
    const gstPercentage = Number(gstInput);
    const platformFee = Number(platformFeeInput);

    if (!Number.isFinite(premiumFee) || premiumFee < 0 || premiumFee > 100000) {
      showError("Premium package fee must be a number between 0 and 100000.");
      return;
    }
    if (!Number.isFinite(gstPercentage) || gstPercentage < 0 || gstPercentage > 100) {
      showError("GST must be a number between 0 and 100.");
      return;
    }
    if (!Number.isFinite(platformFee) || platformFee < 0 || platformFee > 100000) {
      showError("Platform fee must be a number between 0 and 100000.");
      return;
    }

    setSavingPricing(true);
    try {
      await updatePricingSettings({ premiumPackageFee: premiumFee, gstPercentage, platformFee });
      setPremiumFeeInput(String(premiumFee));
      setGstInput(String(gstPercentage));
      setPlatformFeeInput(String(platformFee));
      showSuccess("Pricing settings updated.");
    } catch (error) {
      showError(error?.data?.detail?.message || error?.data?.detail?.[0]?.msg || error?.message || "Could not update pricing settings.");
    } finally {
      setSavingPricing(false);
    }
  }

  async function handleSaveInvoiceSettings(event) {
    event.preventDefault();

    setSavingInvoice(true);
    try {
      await updateInvoiceSettings({
        companyName: companyNameInput.trim(),
        companyGstin: companyGstinInput.trim(),
        companyAddress: companyAddressInput.trim(),
        companyState: companyStateInput,
        sacCode: sacCodeInput.trim() || "998599",
      });
      showSuccess("Invoice / GST settings updated. Already-issued invoices keep showing what was configured when they were generated.");
    } catch (error) {
      showError(error?.data?.detail?.message || error?.message || "Could not update invoice settings.");
    } finally {
      setSavingInvoice(false);
    }
  }

  async function handleSaveSocialLinks(event) {
    event.preventDefault();

    setSavingSocialLinks(true);
    try {
      const result = await updateSocialLinksSettings({
        instagram: instagramInput.trim(),
        facebook: facebookInput.trim(),
        whatsapp: whatsappInput.trim(),
        xTwitter: xTwitterInput.trim(),
        linkedin: linkedinInput.trim(),
        youtube: youtubeInput.trim(),
        threads: threadsInput.trim(),
      });
      setInstagramInput(result?.instagram || "");
      setFacebookInput(result?.facebook || "");
      setWhatsappInput(result?.whatsapp || "");
      setXTwitterInput(result?.x_twitter || "");
      setLinkedinInput(result?.linkedin || "");
      setYoutubeInput(result?.youtube || "");
      setThreadsInput(result?.threads || "");
      showSuccess("Social media links updated. The footer will pick these up on next page load.");
    } catch (error) {
      showError(error?.data?.detail?.message || error?.data?.detail?.[0]?.msg || error?.message || "Could not update social media links.");
    } finally {
      setSavingSocialLinks(false);
    }
  }

  async function handleChangePassword(event) {
    event.preventDefault();

    if (!currentPassword) {
      showError("Please enter your current password.");
      return;
    }
    if (newPassword.length < 6) {
      showError("New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      showError("New password and confirmation do not match.");
      return;
    }
    if (newPassword === currentPassword) {
      showError("New password must be different from your current password.");
      return;
    }

    setSaving(true);
    try {
      await changeAdminPassword(currentPassword, newPassword);
      showSuccess("Password updated successfully. Other active sessions have been signed out.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      showError(error?.data?.detail?.message || error?.data?.detail || error?.message || "Could not update your password.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-serif text-xl font-semibold text-maroon">Settings</h1>
        <p className="text-sm text-slate-500">Manage your admin account.</p>
      </div>

      <div className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm">
        <h2 className="font-serif text-lg font-semibold text-maroon">Profile</h2>
        {loadingProfile ? (
          <p className="mt-3 text-sm text-slate-400">Loading...</p>
        ) : profile ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs text-slate-400">Full Name</p>
              <p className="font-medium text-slate-700">{profile.full_name || "-"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Email</p>
              <p className="font-medium text-slate-700">{profile.email || "-"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Phone</p>
              <p className="font-medium text-slate-700">{profile.phone || "-"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Role</p>
              <p className="font-medium text-slate-700">{profile.role ? formatRoleLabel(profile.role) : "-"}</p>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-400">Could not load your profile.</p>
        )}
      </div>

      <div className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm">
        <h2 className="font-serif text-lg font-semibold text-maroon">Pandit Ji Registration</h2>
        <p className="mt-1 text-sm text-slate-500">
          Controls how new Pandit Ji accounts verify their Aadhaar during registration.
        </p>

        {loadingSkipAadhar ? (
          <p className="mt-3 text-sm text-slate-400">Loading...</p>
        ) : (
          <div className="mt-4 flex items-start justify-between gap-4 rounded-xl border border-amber-100 bg-cream px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-slate-700">Skip Aadhaar OTP for new registrations</p>
              <p className="mt-1 text-xs text-slate-500">
                {skipAadhar
                  ? "On: new Pandit Ji accounts skip OTP entirely and upload their Aadhaar card images for you to review manually instead."
                  : "Off: new Pandit Ji accounts verify Aadhaar via OTP as usual. You can still skip it for one specific Pandit Ji from the Pandits list."}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={skipAadhar}
              disabled={savingSkipAadhar}
              onClick={() => handleToggleSkipAadhar(!skipAadhar)}
              title={skipAadhar ? "Turn off: require Aadhaar OTP again" : "Turn on: skip Aadhaar OTP for new registrations"}
              className={`interactive-button relative h-7 w-12 shrink-0 rounded-full transition disabled:cursor-not-allowed disabled:opacity-60 ${
                skipAadhar ? "bg-maroon" : "bg-slate-300"
              }`}
            >
              <span
                className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${
                  skipAadhar ? "left-5" : "left-0.5"
                }`}
              />
            </button>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm">
        <h2 className="font-serif text-lg font-semibold text-maroon">Booking Lead Time</h2>
        <p className="mt-1 text-sm text-slate-500">
          Minimum hours before a puja that a booking can be made, so there's time to arrange a Pandit Ji.
        </p>

        {loadingLeadHours ? (
          <p className="mt-3 text-sm text-slate-400">Loading...</p>
        ) : (
          <form
            onSubmit={handleSaveLeadHours}
            className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-amber-100 bg-cream px-4 py-3"
          >
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Hours' notice required</span>
              <input
                type="number"
                min={0}
                max={168}
                value={leadHoursInput}
                onChange={(event) => setLeadHoursInput(event.target.value)}
                disabled={savingLeadHours}
                className="w-28 rounded-xl border border-amber-200 px-3 py-2 text-sm outline-none focus:border-maroon focus:ring-2 focus:ring-amber-100 disabled:opacity-60"
              />
            </label>
            <button
              type="submit"
              disabled={savingLeadHours}
              className="interactive-button rounded-full bg-maroon px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingLeadHours ? "Saving..." : "Save"}
            </button>
          </form>
        )}
      </div>

      <div className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm">
        <h2 className="font-serif text-lg font-semibold text-maroon">Pricing</h2>
        <p className="mt-1 text-sm text-slate-500">
          Add-ons applied at checkout on top of the Pandit Ji's own per-puja price.
        </p>

        {loadingPricing ? (
          <p className="mt-3 text-sm text-slate-400">Loading...</p>
        ) : (
          <form onSubmit={handleSavePricing} className="mt-4 grid gap-4 rounded-xl border border-amber-100 bg-cream px-4 py-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Premium Package Fee (Rs.)</span>
                <input
                  type="number"
                  min={0}
                  max={100000}
                  step="1"
                  value={premiumFeeInput}
                  onChange={(event) => setPremiumFeeInput(event.target.value)}
                  disabled={savingPricing}
                  className="w-full rounded-xl border border-amber-200 px-3 py-2 text-sm outline-none focus:border-maroon focus:ring-2 focus:ring-amber-100 disabled:opacity-60"
                />
                <span className="mt-1 block text-xs text-slate-400">Added when a customer picks the Premium package.</span>
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">GST (%)</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.1"
                  value={gstInput}
                  onChange={(event) => setGstInput(event.target.value)}
                  disabled={savingPricing}
                  className="w-full rounded-xl border border-amber-200 px-3 py-2 text-sm outline-none focus:border-maroon focus:ring-2 focus:ring-amber-100 disabled:opacity-60"
                />
                <span className="mt-1 block text-xs text-slate-400">Charged on the Platform Fee only, not on the puja price.</span>
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Platform Fee (Rs.)</span>
                <input
                  type="number"
                  min={0}
                  max={100000}
                  step="1"
                  value={platformFeeInput}
                  onChange={(event) => setPlatformFeeInput(event.target.value)}
                  disabled={savingPricing}
                  className="w-full rounded-xl border border-amber-200 px-3 py-2 text-sm outline-none focus:border-maroon focus:ring-2 focus:ring-amber-100 disabled:opacity-60"
                />
                <span className="mt-1 block text-xs text-slate-400">A flat, untaxed charge added to every booking.</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={savingPricing}
              className="interactive-button w-fit rounded-full bg-maroon px-6 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingPricing ? "Saving..." : "Save Pricing"}
            </button>
          </form>
        )}
      </div>

      <div className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm">
        <h2 className="font-serif text-lg font-semibold text-maroon">Invoice / GST Details</h2>
        <p className="mt-1 text-sm text-slate-500">
          Shown on the header of every generated Tax Invoice. Leave blank for now if you're not ready --
          invoices still generate, just show "GSTIN not configured" until this is filled in. Confirm the SAC
          code with your tax advisor before relying on these for GST filing.
        </p>

        {loadingInvoice ? (
          <p className="mt-3 text-sm text-slate-400">Loading...</p>
        ) : (
          <form onSubmit={handleSaveInvoiceSettings} className="mt-4 grid gap-4 rounded-xl border border-amber-100 bg-cream px-4 py-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Company Legal Name</span>
                <input
                  value={companyNameInput}
                  onChange={(event) => setCompanyNameInput(event.target.value)}
                  disabled={savingInvoice}
                  placeholder="e.g. MyYajmaan Services Pvt. Ltd."
                  className="w-full rounded-xl border border-amber-200 px-3 py-2 text-sm outline-none focus:border-maroon focus:ring-2 focus:ring-amber-100 disabled:opacity-60"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">GSTIN</span>
                <input
                  value={companyGstinInput}
                  onChange={(event) => setCompanyGstinInput(event.target.value.toUpperCase())}
                  disabled={savingInvoice}
                  placeholder="e.g. 07ABCDE1234F1Z5"
                  className="w-full rounded-xl border border-amber-200 px-3 py-2 text-sm uppercase outline-none focus:border-maroon focus:ring-2 focus:ring-amber-100 disabled:opacity-60"
                />
              </label>

              <label className="block sm:col-span-2">
                <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Registered Address</span>
                <input
                  value={companyAddressInput}
                  onChange={(event) => setCompanyAddressInput(event.target.value)}
                  disabled={savingInvoice}
                  className="w-full rounded-xl border border-amber-200 px-3 py-2 text-sm outline-none focus:border-maroon focus:ring-2 focus:ring-amber-100 disabled:opacity-60"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Registered State</span>
                <select
                  value={companyStateInput}
                  onChange={(event) => setCompanyStateInput(event.target.value)}
                  disabled={savingInvoice}
                  className="w-full rounded-xl border border-amber-200 px-3 py-2 text-sm outline-none focus:border-maroon focus:ring-2 focus:ring-amber-100 disabled:opacity-60"
                >
                  <option value="">Select state...</option>
                  {states.map((state) => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                </select>
                <span className="mt-1 block text-xs text-slate-400">Decides CGST+SGST vs. IGST on customer invoices.</span>
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">SAC Code (platform fee)</span>
                <input
                  value={sacCodeInput}
                  onChange={(event) => setSacCodeInput(event.target.value)}
                  disabled={savingInvoice}
                  className="w-full rounded-xl border border-amber-200 px-3 py-2 text-sm outline-none focus:border-maroon focus:ring-2 focus:ring-amber-100 disabled:opacity-60"
                />
                <span className="mt-1 block text-xs text-slate-400">Defaults to 998599; confirm the right code with your CA.</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={savingInvoice}
              className="interactive-button w-fit rounded-full bg-maroon px-6 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingInvoice ? "Saving..." : "Save Invoice Settings"}
            </button>
          </form>
        )}
      </div>

      <div className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm">
        <h2 className="font-serif text-lg font-semibold text-maroon">Social Media Links</h2>
        <p className="mt-1 text-sm text-slate-500">
          Destination URL for each social icon shown in the site footer. Leave any field blank to keep that
          icon disabled until you have a real profile link for it.
        </p>

        {loadingSocialLinks ? (
          <p className="mt-3 text-sm text-slate-400">Loading...</p>
        ) : (
          <form onSubmit={handleSaveSocialLinks} className="mt-4 grid gap-4 rounded-xl border border-amber-100 bg-cream px-4 py-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Instagram</span>
                <input
                  value={instagramInput}
                  onChange={(event) => setInstagramInput(event.target.value)}
                  disabled={savingSocialLinks}
                  placeholder="https://instagram.com/myyajmaan"
                  className="w-full rounded-xl border border-amber-200 px-3 py-2 text-sm outline-none focus:border-maroon focus:ring-2 focus:ring-amber-100 disabled:opacity-60"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Facebook</span>
                <input
                  value={facebookInput}
                  onChange={(event) => setFacebookInput(event.target.value)}
                  disabled={savingSocialLinks}
                  placeholder="https://facebook.com/myyajmaan"
                  className="w-full rounded-xl border border-amber-200 px-3 py-2 text-sm outline-none focus:border-maroon focus:ring-2 focus:ring-amber-100 disabled:opacity-60"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">WhatsApp</span>
                <input
                  value={whatsappInput}
                  onChange={(event) => setWhatsappInput(event.target.value)}
                  disabled={savingSocialLinks}
                  placeholder="https://wa.me/91XXXXXXXXXX"
                  className="w-full rounded-xl border border-amber-200 px-3 py-2 text-sm outline-none focus:border-maroon focus:ring-2 focus:ring-amber-100 disabled:opacity-60"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">X (Twitter)</span>
                <input
                  value={xTwitterInput}
                  onChange={(event) => setXTwitterInput(event.target.value)}
                  disabled={savingSocialLinks}
                  placeholder="https://x.com/myyajmaan"
                  className="w-full rounded-xl border border-amber-200 px-3 py-2 text-sm outline-none focus:border-maroon focus:ring-2 focus:ring-amber-100 disabled:opacity-60"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">LinkedIn</span>
                <input
                  value={linkedinInput}
                  onChange={(event) => setLinkedinInput(event.target.value)}
                  disabled={savingSocialLinks}
                  placeholder="https://linkedin.com/company/myyajmaan"
                  className="w-full rounded-xl border border-amber-200 px-3 py-2 text-sm outline-none focus:border-maroon focus:ring-2 focus:ring-amber-100 disabled:opacity-60"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">YouTube</span>
                <input
                  value={youtubeInput}
                  onChange={(event) => setYoutubeInput(event.target.value)}
                  disabled={savingSocialLinks}
                  placeholder="https://youtube.com/@myyajmaan"
                  className="w-full rounded-xl border border-amber-200 px-3 py-2 text-sm outline-none focus:border-maroon focus:ring-2 focus:ring-amber-100 disabled:opacity-60"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Threads</span>
                <input
                  value={threadsInput}
                  onChange={(event) => setThreadsInput(event.target.value)}
                  disabled={savingSocialLinks}
                  placeholder="https://threads.net/@myyajmaan"
                  className="w-full rounded-xl border border-amber-200 px-3 py-2 text-sm outline-none focus:border-maroon focus:ring-2 focus:ring-amber-100 disabled:opacity-60"
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={savingSocialLinks}
              className="interactive-button w-fit rounded-full bg-maroon px-6 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingSocialLinks ? "Saving..." : "Save Social Links"}
            </button>
          </form>
        )}
      </div>

      <div className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm">
        <h2 className="font-serif text-lg font-semibold text-maroon">Change Password</h2>
        <p className="mt-1 text-sm text-slate-500">
          Changing your password signs you out of every other active session.
        </p>

        <form onSubmit={handleChangePassword} className="mt-4 grid gap-4">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Current Password</span>
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
            <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">New Password</span>
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
            <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Confirm New Password</span>
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
            {saving ? "Updating..." : "Update Password"}
          </button>
        </form>
      </div>
    </div>
  );
}

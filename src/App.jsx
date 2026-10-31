import { Suspense, lazy, useEffect } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";

import RouteSeo from "./seo/RouteSeo";

import HomePage from "./pages/HomePage";
import Layout from "./components/Layout";
import RoleRoute from "./components/RoleRoute";
import GuestOnlyRoute from "./components/GuestOnlyRoute";
import BlockRoleRoute from "./components/BlockRoleRoute";
import Unauthorized from "./components/common/Unauthorized";
import NotFound from "./components/common/NotFound";
import { ADMIN_BASE_PATH } from "./constants/adminRoutes";

import { ToastContainer } from "react-toastify";
import { t } from "./i18n";
import "react-toastify/dist/ReactToastify.css";
import "./styles/toaster.css";

// Every screen except the home page is loaded on demand, so a visitor
// only downloads the code for the page they open (smaller first load =
// faster LCP, which search engines use as a ranking signal).
const BookingPage = lazy(() => import("./pages/BookingPage"));
const PujaDetailPage = lazy(() => import("./pages/PujaDetailPage"));
const BookDateTime = lazy(() => import("./pages/BookDateTime"));
const SelectPandit = lazy(() => import("./pages/SelectPandit"));
const BookAddress = lazy(() => import("./pages/BookAddress"));
const BookPayment = lazy(() => import("./pages/BookPayment"));
const BookingConfirmation = lazy(() => import("./pages/BookingConfirmation"));
const BookPackageDetails = lazy(() => import("./pages/BookPackageDetails"));
const BookPackageConfirmation = lazy(() => import("./pages/BookPackageConfirmation"));
const BookPackagePayment = lazy(() => import("./pages/BookPackagePayment"));
const ClientDashboardLayout = lazy(() => import("./components/client/ClientDashboardLayout"));
const ClientDashboardPage = lazy(() => import("./pages/client/ClientDashboardPage"));
const ClientProfilePage = lazy(() => import("./pages/client/ClientProfilePage"));
const ClientBookingsPage = lazy(() => import("./pages/client/ClientBookingsPage"));
const ClientWalletPage = lazy(() => import("./pages/client/ClientWalletPage"));
const ClientReferPage = lazy(() => import("./pages/client/ClientReferPage"));
const ClientAddressesPage = lazy(() => import("./pages/client/ClientAddressesPage"));
const ClientSettingsPage = lazy(() => import("./pages/client/ClientSettingsPage"));
const PanditPage = lazy(() => import("./pages/PanditPage"));
const PanditDetailPage = lazy(() => import("./pages/PanditDetailPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const RegisterPage = lazy(() => import("./pages/RegisterPage"));
const VerifyOtpPage = lazy(() => import("./pages/VerifyOtpPage"));
const ContactUsPage = lazy(() => import("./pages/ContactUsPage"));
const HelpCenterPage = lazy(() => import("./pages/HelpCenterPage"));
const PrivacyPolicyPage = lazy(() => import("./pages/PrivacyPolicyPage"));
const TermsAndConditionsPage = lazy(() => import("./pages/TermsAndConditionsPage"));
const CancellationRefundPage = lazy(() => import("./pages/CancellationRefundPage"));
const PanditRegisterPage = lazy(() => import("./pages/PanditRegisterPage"));
const PanditLoginPage = lazy(() => import("./pages/PanditLoginPage"));
const PanditDashboardLayout = lazy(() => import("./components/pandit/PanditDashboardLayout"));
const PanditDashboardPage = lazy(() => import("./pages/pandit/PanditDashboardPage"));
const PanditProfilePage = lazy(() => import("./pages/pandit/PanditProfilePage"));
const PanditMyPujasPage = lazy(() => import("./pages/pandit/PanditMyPujasPage"));
const PanditBookingsPage = lazy(() => import("./pages/pandit/PanditBookingsPage"));
const PanditPhotosPage = lazy(() => import("./pages/pandit/PanditPhotosPage"));
const PanditFeedbackPage = lazy(() => import("./pages/pandit/PanditFeedbackPage"));
const PanditWalletPage = lazy(() => import("./pages/pandit/PanditWalletPage"));
const AdminLoginPage = lazy(() => import("./pages/admin/AdminLoginPage"));
const AdminLayout = lazy(() => import("./components/admin/AdminLayout"));
const AdminDashboardPage = lazy(() => import("./pages/admin/AdminDashboardPage"));
const AdminBookingsPage = lazy(() => import("./pages/admin/AdminBookingsPage"));
const AdminPackagePujaBookingsPage = lazy(() => import("./pages/admin/AdminPackagePujaBookingsPage"));
const AdminUsersPage = lazy(() => import("./pages/admin/AdminUsersPage"));
const AdminPanditsPage = lazy(() => import("./pages/admin/AdminPanditsPage"));
const AdminPujasPage = lazy(() => import("./pages/admin/AdminPujasPage"));
const AdminWalletPage = lazy(() => import("./pages/admin/AdminWalletPage"));
const AdminCouponsPage = lazy(() => import("./pages/admin/AdminCouponsPage"));
const AdminCmsPage = lazy(() => import("./pages/admin/AdminCmsPage"));
const AdminMuhuratPage = lazy(() => import("./pages/admin/AdminMuhuratPage"));
const AdminTestimonialsPage = lazy(() => import("./pages/admin/AdminTestimonialsPage"));
const AdminSupportPage = lazy(() => import("./pages/admin/AdminSupportPage"));
const AdminComplaintsPage = lazy(() => import("./pages/admin/AdminComplaintsPage"));
const AdminPanditFeedbackPage = lazy(() => import("./pages/admin/AdminPanditFeedbackPage"));
const MessagingCenterPage = lazy(() => import("./pages/messaging/MessagingCenterPage"));
const AdminSettingsPage = lazy(() => import("./pages/admin/AdminSettingsPage"));
const AdminReportsPage = lazy(() => import("./pages/admin/AdminReportsPage"));
const AdminAuditPage = lazy(() => import("./pages/admin/AdminAuditPage"));
const AdminComingSoon = lazy(() => import("./components/admin/AdminComingSoon"));


// Shown for the split second while a page's code downloads.
function RouteFallback() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center" role="status" aria-live="polite">
      <p className="text-sm text-slate-500">{t("Loading...")}</p>
    </div>
  );
}

function App() {
  const navigate = useNavigate();

  useEffect(() => {
    // Supabase's password-recovery email link redirects to whatever
    // Site URL is configured on the Supabase project -- which is the
    // app's bare origin here, not /reset-password specifically (and
    // isn't reliably ours to reconfigure per-environment). PASSWORD_
    // RECOVERY fires asynchronously and may already have happened
    // before this mounted (or may still be pending), so this
    // subscribes rather than checking a snapshot once.
    if (window.location.pathname === "/reset-password") {
      return undefined;
    }

    // @supabase/supabase-js is a large library whose only other use is
    // the (also code-split) reset-password page, so it's loaded here via
    // a dynamic import instead of a static one -- keeps it out of the
    // main bundle without weakening the "as early as possible" guarantee
    // above: this still runs unconditionally on every app mount, same as
    // a static import would, just as a separate request fetched in
    // parallel rather than bytes concatenated into the main chunk.
    let unsubscribe;
    let cancelled = false;
    import("./services/supabaseClient").then(({ onRecoverySession }) => {
      if (cancelled) return;
      unsubscribe = onRecoverySession(() => {
        navigate("/reset-password", { replace: true });
      });
    });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Layout>
      <RouteSeo />
      <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<HomePage />} />

        <Route
          path="/book"
          element={
            <BlockRoleRoute blockedRoles={["pandit"]} redirectTo="/pandit" message={t("Pandit Ji accounts can't book pujas.")}>
              <BookingPage />
            </BlockRoleRoute>
          }
        />
        <Route
          path="/book/:id"
          element={
            <BlockRoleRoute blockedRoles={["pandit"]} redirectTo="/pandit" message={t("Pandit Ji accounts can't book pujas.")}>
              <PujaDetailPage />
            </BlockRoleRoute>
          }
        />
        {/*
          These four steps require a real login (not just "not a Pandit
          Ji") -- RoleRoute redirects a guest to /login carrying the
          page they were on in state.from, so LoginPage can send them
          straight back once signed in instead of restarting the flow.
          Browsing (/book, /book/:id) stays guest-open above.
        */}
        <Route
          path="/book/datetime"
          element={
            <BlockRoleRoute blockedRoles={["pandit"]} redirectTo="/pandit" message={t("Pandit Ji accounts can't book pujas.")}>
              <RoleRoute allowedRoles={["user", "admin"]}>
                <BookDateTime />
              </RoleRoute>
            </BlockRoleRoute>
          }
        />
        <Route
          path="/book/select-pandit"
          element={
            <BlockRoleRoute blockedRoles={["pandit"]} redirectTo="/pandit" message={t("Pandit Ji accounts can't book pujas.")}>
              <RoleRoute allowedRoles={["user", "admin"]}>
                <SelectPandit />
              </RoleRoute>
            </BlockRoleRoute>
          }
        />
        <Route
          path="/book/address"
          element={
            <BlockRoleRoute blockedRoles={["pandit"]} redirectTo="/pandit" message={t("Pandit Ji accounts can't book pujas.")}>
              <RoleRoute allowedRoles={["user", "admin"]}>
                <BookAddress />
              </RoleRoute>
            </BlockRoleRoute>
          }
        />
        <Route
          path="/book/payment"
          element={
            <BlockRoleRoute blockedRoles={["pandit"]} redirectTo="/pandit" message={t("Pandit Ji accounts can't book pujas.")}>
              <RoleRoute allowedRoles={["user", "admin"]}>
                <BookPayment />
              </RoleRoute>
            </BlockRoleRoute>
          }
        />
        <Route
          path="/book/confirmation"
          element={
            <BlockRoleRoute blockedRoles={["pandit"]} redirectTo="/pandit" message={t("Pandit Ji accounts can't book pujas.")}>
              <BookingConfirmation />
            </BlockRoleRoute>
          }
        />
        <Route
          path="/book/package/details"
          element={
            <BlockRoleRoute blockedRoles={["pandit"]} redirectTo="/pandit" message={t("Pandit Ji accounts can't book pujas.")}>
              <RoleRoute allowedRoles={["user", "admin"]}>
                <BookPackageDetails />
              </RoleRoute>
            </BlockRoleRoute>
          }
        />
        <Route
          path="/book/package/confirmation"
          element={
            <BlockRoleRoute blockedRoles={["pandit"]} redirectTo="/pandit" message={t("Pandit Ji accounts can't book pujas.")}>
              <RoleRoute allowedRoles={["user", "admin"]}>
                <BookPackageConfirmation />
              </RoleRoute>
            </BlockRoleRoute>
          }
        />
        <Route
          path="/book/package/payment/:id"
          element={
            <BlockRoleRoute blockedRoles={["pandit"]} redirectTo="/pandit" message={t("Pandit Ji accounts can't book pujas.")}>
              <RoleRoute allowedRoles={["user", "admin"]}>
                <BookPackagePayment />
              </RoleRoute>
            </BlockRoleRoute>
          }
        />

        <Route
          path="/dashboard"
          element={
            <RoleRoute allowedRoles={["user", "admin"]}>
              <ClientDashboardLayout>
                <ClientDashboardPage />
              </ClientDashboardLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/dashboard/profile"
          element={
            <RoleRoute allowedRoles={["user", "admin"]}>
              <ClientDashboardLayout>
                <ClientProfilePage />
              </ClientDashboardLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/dashboard/bookings"
          element={
            <RoleRoute allowedRoles={["user", "admin"]}>
              <ClientDashboardLayout>
                <ClientBookingsPage />
              </ClientDashboardLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/dashboard/wallet"
          element={
            <RoleRoute allowedRoles={["user", "admin"]}>
              <ClientDashboardLayout>
                <ClientWalletPage />
              </ClientDashboardLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/dashboard/refer"
          element={
            <RoleRoute allowedRoles={["user", "admin"]}>
              <ClientDashboardLayout>
                <ClientReferPage />
              </ClientDashboardLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/dashboard/addresses"
          element={
            <RoleRoute allowedRoles={["user", "admin"]}>
              <ClientDashboardLayout>
                <ClientAddressesPage />
              </ClientDashboardLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/dashboard/settings"
          element={
            <RoleRoute allowedRoles={["user", "admin"]}>
              <ClientDashboardLayout>
                <ClientSettingsPage />
              </ClientDashboardLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/dashboard/messages"
          element={
            <RoleRoute allowedRoles={["user", "admin"]}>
              <ClientDashboardLayout>
                <MessagingCenterPage portal="user" />
              </ClientDashboardLayout>
            </RoleRoute>
          }
        />

        <Route
          path="/pandit"
          element={
            <RoleRoute allowedRoles={["pandit", "admin"]}>
              <PanditPage />
            </RoleRoute>
          }
        />

        <Route
          path="/pandit/dashboard"
          element={
            <RoleRoute allowedRoles={["pandit", "admin"]}>
              <PanditDashboardLayout>
                <PanditDashboardPage />
              </PanditDashboardLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/pandit/profile"
          element={
            <RoleRoute allowedRoles={["pandit", "admin"]}>
              <PanditDashboardLayout>
                <PanditProfilePage />
              </PanditDashboardLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/pandit/pujas"
          element={
            <RoleRoute allowedRoles={["pandit", "admin"]}>
              <PanditDashboardLayout>
                <PanditMyPujasPage />
              </PanditDashboardLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/pandit/bookings"
          element={
            <RoleRoute allowedRoles={["pandit", "admin"]}>
              <PanditDashboardLayout>
                <PanditBookingsPage />
              </PanditDashboardLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/pandit/photos"
          element={
            <RoleRoute allowedRoles={["pandit", "admin"]}>
              <PanditDashboardLayout>
                <PanditPhotosPage />
              </PanditDashboardLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/pandit/feedback"
          element={
            <RoleRoute allowedRoles={["pandit", "admin"]}>
              <PanditDashboardLayout>
                <PanditFeedbackPage />
              </PanditDashboardLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/pandit/messages"
          element={
            <RoleRoute allowedRoles={["pandit", "admin"]}>
              <PanditDashboardLayout>
                <MessagingCenterPage portal="pandit" />
              </PanditDashboardLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/pandit/wallet"
          element={
            <RoleRoute allowedRoles={["pandit", "admin"]}>
              <PanditDashboardLayout>
                <PanditWalletPage />
              </PanditDashboardLayout>
            </RoleRoute>
          }
        />

        <Route path="/pandit/:id" element={<PanditDetailPage />} />
        <Route
          path="/pandit/register"
          element={
            <GuestOnlyRoute>
              <PanditRegisterPage />
            </GuestOnlyRoute>
          }
        />
        <Route
          path="/pandit/login"
          element={
            <GuestOnlyRoute>
              <PanditLoginPage />
            </GuestOnlyRoute>
          }
        />

        {/* "Browse Pandit Ji" was removed from the app; old links and
            bookmarks go to Book Puja instead of a blank page. */}
        <Route path="/browse-pandits" element={<Navigate to="/book" replace />} />

        <Route
          path="/login"
          element={
            <GuestOnlyRoute>
              <LoginPage />
            </GuestOnlyRoute>
          }
        />
        <Route
          path="/register"
          element={
            <GuestOnlyRoute>
              <RegisterPage />
            </GuestOnlyRoute>
          }
        />
        {/* Shared by customer and Pandit Ji signups (state.portal tells
            it which login page to return to). */}
        <Route
          path="/verify-otp"
          element={
            <GuestOnlyRoute>
              <VerifyOtpPage />
            </GuestOnlyRoute>
          }
        />
        <Route
          path="/forgot-password"
          element={
            <GuestOnlyRoute>
              <ForgotPasswordPage />
            </GuestOnlyRoute>
          }
        />
        {/* Not GuestOnlyRoute: the emailed link must work regardless of
            any pre-existing session in this browser. */}
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        <Route path="/contact-us" element={<ContactUsPage />} />
        <Route path="/help-center" element={<HelpCenterPage />} />
        <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
        <Route path="/terms-and-conditions" element={<TermsAndConditionsPage />} />
        <Route path="/cancellation-refund" element={<CancellationRefundPage />} />

        <Route path="/unauthorized" element={<Unauthorized />} />

        <Route path={ADMIN_BASE_PATH} element={<AdminLoginPage />} />
        <Route path={`${ADMIN_BASE_PATH}/dashboard`} element={<AdminLayout><AdminDashboardPage /></AdminLayout>} />
        <Route path={`${ADMIN_BASE_PATH}/users`} element={<AdminLayout><AdminUsersPage /></AdminLayout>} />
        <Route path={`${ADMIN_BASE_PATH}/pandits`} element={<AdminLayout><AdminPanditsPage /></AdminLayout>} />
        <Route path={`${ADMIN_BASE_PATH}/pujas`} element={<AdminLayout><AdminPujasPage /></AdminLayout>} />
        <Route path={`${ADMIN_BASE_PATH}/bookings`} element={<AdminLayout><AdminBookingsPage /></AdminLayout>} />
        <Route path={`${ADMIN_BASE_PATH}/package-pujas`} element={<AdminLayout><AdminPackagePujaBookingsPage /></AdminLayout>} />
        <Route path={`${ADMIN_BASE_PATH}/testimonials`} element={<AdminLayout><AdminTestimonialsPage /></AdminLayout>} />
        <Route path={`${ADMIN_BASE_PATH}/muhurat`} element={<AdminLayout><AdminMuhuratPage /></AdminLayout>} />
        <Route path={`${ADMIN_BASE_PATH}/coupons`} element={<AdminLayout><AdminCouponsPage /></AdminLayout>} />
        <Route path={`${ADMIN_BASE_PATH}/cms`} element={<AdminLayout><AdminCmsPage /></AdminLayout>} />
        <Route path={`${ADMIN_BASE_PATH}/messages`} element={<AdminLayout><MessagingCenterPage portal="admin" /></AdminLayout>} />
        <Route path={`${ADMIN_BASE_PATH}/wallet`} element={<AdminLayout><AdminWalletPage /></AdminLayout>} />
        <Route path={`${ADMIN_BASE_PATH}/reports`} element={<AdminLayout><AdminReportsPage /></AdminLayout>} />
        <Route path={`${ADMIN_BASE_PATH}/audit-log`} element={<AdminLayout><AdminAuditPage /></AdminLayout>} />
        <Route path={`${ADMIN_BASE_PATH}/settings`} element={<AdminLayout><AdminSettingsPage /></AdminLayout>} />
        <Route path={`${ADMIN_BASE_PATH}/support`} element={<AdminLayout><AdminSupportPage /></AdminLayout>} />
        <Route path={`${ADMIN_BASE_PATH}/complaints`} element={<AdminLayout><AdminComplaintsPage /></AdminLayout>} />
        <Route path={`${ADMIN_BASE_PATH}/pandit-feedback`} element={<AdminLayout><AdminPanditFeedbackPage /></AdminLayout>} />

        <Route path="*" element={<NotFound />} />
      </Routes>
      </Suspense>

      <ToastContainer position="top-right" autoClose={3000} />
    </Layout>
  );
}

export default App;

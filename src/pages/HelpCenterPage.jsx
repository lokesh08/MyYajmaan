import { useState } from "react";
import { useNavigate } from "react-router-dom";
import ThemeDialog from "../components/ThemeDialog";
import Seo from "../components/Seo";
import { faqSchema } from "../seo/structuredData";
import { optimizedImage } from "../utils/image";
import { t } from "../i18n";

const topics = [
  {
    title: "How to book a puja?",
    message: "Choose Book Puja from the navigation, select your ritual, pick a date and auspicious time, choose a Pandit Ji, add your address, and complete payment.",
  },
  {
    title: "How to cancel booking?",
    message: "Open your booking details from the dashboard and review the cancellation options. Cancellation eligibility depends on how close the booking is to the scheduled time.",
  },
  {
    title: "Refund & cancellation policy",
    message: "Eligible refunds are returned to the original payment method after the cancellation is reviewed. See our complete Cancellation & Refund Policy for details.",
  },
  {
    title: "Payment issues",
    message: "If your payment is pending or failed, do not retry repeatedly. Check your bank or UPI app first, then contact our support team with your booking details.",
  },
  {
    title: "Refer & Earn guide",
    message: "Share your referral code with friends and earn rewards when eligible referrals complete the required action. Your reward balance is visible in the dashboard.",
  },
  {
    title: "Wallet & transactions",
    message: "Wallet credits and booking transactions are shown in your dashboard. Contact support if a successful payment or reward is missing from your account.",
  },
];

// The visible topics above, as FAQ data for search results.
const faqJsonLd = faqSchema(topics.map((topic) => ({ question: topic.title, answer: topic.message })));

export default function HelpCenterPage() {
  const navigate = useNavigate();
  const [activeTopic, setActiveTopic] = useState(null);

  return (
    <section className="min-h-screen bg-cream pb-14">
      <Seo jsonLd={faqJsonLd} />
      <div className="mx-auto max-w-7xl px-4 pt-5 sm:px-6 lg:px-8 lg:pt-8">
        <div className="relative isolate min-h-[220px] overflow-hidden rounded-[2rem] bg-maroon px-6 py-10 text-white shadow-divine-lg sm:min-h-[260px] sm:px-10 sm:py-14 lg:min-h-[280px] lg:px-16">
          <img src={optimizedImage("/images/banners/banner4.png")} alt={t("A glowing lotus surrounded by icons of blessings")} className="absolute inset-0 h-full w-full object-cover object-center" />
          <div className="absolute inset-0 bg-gradient-to-r from-maroon-deep via-maroon/90 to-marigold-deep/65" />
          <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-saffron/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-32 left-1/3 h-72 w-72 rounded-full bg-rose-200/10 blur-3xl" />
          <div className="relative max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-200">{t("MyYajmaan support")}</p>
            <h1 className="mt-3 font-serif text-3xl font-semibold leading-tight sm:text-5xl">{t("How can we help you?")}</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-amber-50 sm:text-base">{t("Find quick answers about puja bookings, payments, cancellations, rewards, and your account.")}</p>
            <div className="mt-6 flex max-w-xl items-center gap-3 rounded-xl border border-white/20 bg-white/10 px-4 py-3 backdrop-blur-sm">
              <span className="text-lg text-amber-200" aria-hidden="true">⌕</span>
              <span className="text-sm text-amber-50/80">{t("Search help topics from the options below")}</span>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_0.8fr]">
          <div className="rounded-[1.8rem] border border-amber-100 bg-parchment-50 p-5 shadow-card sm:p-7">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-saffron">{t("Popular topics")}</p>
            <h2 className="mt-2 font-serif text-2xl font-semibold text-maroon sm:text-3xl">{t("Quick answers for common questions")}</h2>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {topics.map((topic) => (
                <button key={topic.title} type="button" onClick={() => setActiveTopic(topic)} className="interactive-button rounded-xl border border-amber-200 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-700 hover:border-maroon hover:text-maroon">
                  {t(topic.title)}
                </button>
              ))}
            </div>
            <div className="mt-7 rounded-2xl border border-amber-100 bg-gradient-to-r from-amber-50 to-white p-5 sm:p-6">
              <h3 className="font-serif text-xl font-semibold text-maroon">{t("Still need help?")}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{t("Our team can help with a booking, payment, or account question.")}</p>
              <button type="button" onClick={() => navigate("/contact-us")} className="interactive-button mt-4 rounded-full bg-saffron px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-500">{t("Raise a Ticket")}</button>
            </div>
          </div>

          <aside className="rounded-[1.8rem] border border-amber-100 bg-white p-5 shadow-card sm:p-7">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-saffron">{t("Contact Us")}</p>
            <h2 className="mt-2 font-serif text-2xl font-semibold text-maroon">{t("We are here for you")}</h2>
            <div className="mt-6 grid gap-5 text-sm text-slate-600">
              <div className="flex gap-3"><span className="text-xl text-saffron">☎</span><div><p className="font-semibold text-slate-800">{t("Call Us")}</p><p className="mt-1">+91 91663 44113</p><p>{t("9 AM - 6 PM")}</p></div></div>
              <div className="flex gap-3"><span className="text-xl text-saffron">◌</span><div><p className="font-semibold text-slate-800">{t("WhatsApp")}</p><p className="mt-1">+91 91663 44113</p></div></div>
              <div className="flex gap-3"><span className="text-xl text-saffron">✉</span><div><p className="font-semibold text-slate-800">{t("Email Us")}</p><p className="mt-1 break-all">{t("support@myyajmaan.com")}</p></div></div>
            </div>
          </aside>
        </div>
      </div>

      <ThemeDialog open={Boolean(activeTopic)} title={activeTopic?.title} message={activeTopic?.message} onClose={() => setActiveTopic(null)} />
    </section>
  );
}

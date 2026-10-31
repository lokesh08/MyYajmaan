import { Link } from "react-router-dom";
import { formatCmsUpdatedAt, useCmsContent } from "../../hooks/use-cms-content";
import { t } from "../../i18n";

const benefits = [
  {
    title: "Assured Puja Bookings",
    description: "No need to search for devotees -- get matched with families near you looking for a trusted Pandit Ji.",
    icon: (
      <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" className="h-8 w-8">
        <circle cx="17" cy="17" r="7" stroke="currentColor" strokeWidth="2.4" />
        <circle cx="32" cy="19" r="6" stroke="currentColor" strokeWidth="2.4" />
        <path d="M6 40c0-7.2 5.9-12 13-12s13 4.8 13 12M28 40c0-6.3 4.7-11 11-11" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: "Transparent Earnings",
    description: "Track every booking and payout in your wallet -- clear pricing, no hidden deductions.",
    icon: (
      <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" className="h-8 w-8">
        <rect x="6" y="14" width="36" height="26" rx="4" stroke="currentColor" strokeWidth="2.4" />
        <path d="M6 20h36" stroke="currentColor" strokeWidth="2.4" />
        <circle cx="33" cy="29" r="3" fill="currentColor" />
      </svg>
    ),
  },
  {
    title: "Verified & Respected",
    description: "Earn a verified Pandit Ji badge through Aadhaar verification and admin approval that families can trust.",
    icon: (
      <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" className="h-8 w-8">
        <path d="M24 6 40 12v11c0 11-7 18-16 19-9-1-16-8-16-19V12L24 6Z" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
        <path d="m17 24 5 5 10-11" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: "Your Schedule, Your Rules",
    description: "Set your own availability and accept only the pujas that fit your calendar and city.",
    icon: (
      <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" className="h-8 w-8">
        <circle cx="22" cy="24" r="15" stroke="currentColor" strokeWidth="2.4" />
        <path d="M22 15v9l6 4" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: "Reach More Families",
    description: "Get discovered by Yajmaans across your city and beyond -- grow your reputation past word of mouth.",
    icon: (
      <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" className="h-8 w-8">
        <circle cx="24" cy="24" r="16" stroke="currentColor" strokeWidth="2.4" />
        <path d="M8 24h32M24 8c5 4.5 8 10.2 8 16s-3 11.5-8 16c-5-4.5-8-10.2-8-16s3-11.5 8-16Z" stroke="currentColor" strokeWidth="2.4" />
      </svg>
    ),
  },
];

/**
 * "Why join MyYajmaan" benefits grid for the Pandit Ji register/login
 * pages -- same section/card/hover pattern as BookingJourney (the
 * customer-facing "How MyYajmaan works" module), reskinned for Pandit Ji
 * and dropped the step numbers since these aren't sequential steps.
 */
export default function WhyJoinMyYajmaan({ ctaLabel = "Register as Pandit Ji →", onCtaClick }) {
  const { content, updatedAt } = useCmsContent("pandit-benefits", {
    title: "Why Join MyYajmaan as a Pandit Ji?",
    description: "Partner with MyYajmaan to serve more families and perform your seva with dignity, transparency, and ease.",
    cards: benefits.map(({ title, description }) => ({ title, description })),
  });
  const displayBenefits = benefits.map((benefit, index) => ({ ...benefit, ...(content.cards?.[index] || {}) }));

  return (
    <section className="relative overflow-hidden rounded-[1.8rem] border border-amber-200 bg-parchment-50 px-4 py-10 shadow-card sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-amber-200/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-20 h-64 w-64 rounded-full bg-rose-200/20 blur-3xl" />

      <div className="relative text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-saffron">{t("A platform built for your seva")}</p>
        <h2 className="mt-2 font-serif text-3xl font-semibold text-maroon sm:text-4xl">{t(content.title)}</h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
          {t(content.description)}
        </p>

        <div className="mx-auto mt-5 flex items-center justify-center gap-3">
          <span className="h-px w-12 bg-saffron/70 sm:w-20" />
          <span className="h-2.5 w-2.5 rounded-full bg-saffron shadow-ring-marigold" />
          <span className="h-px w-12 bg-saffron/70 sm:w-20" />
        </div>
      </div>

      <div className="relative mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {displayBenefits.map((benefit) => (
          <article
            key={benefit.title}
            className="group relative flex min-h-[245px] flex-col items-center rounded-[1.35rem] border border-amber-200 bg-white px-5 py-6 text-center shadow-card-sm transition duration-300 hover:-translate-y-2 hover:border-saffron/40 hover:shadow-card-lg"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 text-saffron ring-1 ring-amber-200/70 transition-transform duration-300 group-hover:rotate-3 group-hover:scale-110 group-hover:bg-maroon group-hover:ring-maroon/30">
              {benefit.icon}
            </div>

            <h3 className="mt-5 font-serif text-xl font-semibold text-maroon">{t(benefit.title)}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">{t(benefit.description)}</p>

            <span className="mt-auto h-1 w-8 rounded-full bg-amber-100 transition-all duration-300 group-hover:w-14 group-hover:bg-saffron" />
          </article>
        ))}
      </div>

      <div className="relative mt-8 text-center">
        {onCtaClick ? (
          <button
            type="button"
            onClick={onCtaClick}
            title={t("Register as Pandit Ji")}
            className="interactive-button inline-flex rounded-full bg-maroon px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-maroon hover:shadow-lg"
          >
            {t(ctaLabel)}
          </button>
        ) : (
          <Link
            to="/pandit/register"
            title={t("Register as Pandit Ji")}
            className="interactive-button inline-flex rounded-full bg-maroon px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-maroon hover:shadow-lg"
          >
            {t(ctaLabel)}
          </Link>
        )}
        {updatedAt && <p className="mt-3 text-xs text-slate-500">{t("Last updated:")}{' '}{formatCmsUpdatedAt(updatedAt)}</p>}
      </div>
    </section>
  );
}

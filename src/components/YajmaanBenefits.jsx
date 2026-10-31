import { Link } from "react-router-dom";
import { formatCmsUpdatedAt, useCmsContent } from "../hooks/use-cms-content";
import { t } from "../i18n";

const benefits = [
  {
    title: "Verified Pandits",
    description: "Every Pandit Ji is Aadhaar-verified and approved by our team before they can accept a booking.",
    icon: (
      <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" className="h-8 w-8">
        <path d="M24 6 40 12v11c0 11-7 18-16 19-9-1-16-8-16-19V12L24 6Z" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
        <path d="m17 24 5 5 10-11" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: "Book in Minutes",
    description: "Choose your puja, pick a shubh time, and confirm your booking in just a few simple steps.",
    icon: (
      <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" className="h-8 w-8">
        <rect x="9" y="12" width="30" height="27" rx="4" stroke="currentColor" strokeWidth="2.4" />
        <path d="M15 8v8M33 8v8M9 21h30M16 27h4M24 27h4M32 27h2M16 33h4M24 33h4" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: "Clear, Upfront Pricing",
    description: "No hidden charges -- know exactly what you're paying for before you confirm your puja.",
    icon: (
      <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" className="h-8 w-8">
        <circle cx="24" cy="24" r="16" stroke="currentColor" strokeWidth="2.4" />
        <text x="24" y="31" textAnchor="middle" fontSize="18" fontWeight="700" fill="currentColor" fontFamily="sans-serif">₹</text>
      </svg>
    ),
  },
  {
    title: "Rewards & Refer & Earn",
    description: "Earn wallet credit every time a friend you refer books their first puja with MyYajmaan.",
    icon: (
      <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" className="h-8 w-8">
        <rect x="9" y="20" width="30" height="20" rx="2" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
        <rect x="6" y="14" width="36" height="8" rx="2" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
        <path d="M24 14v26" stroke="currentColor" strokeWidth="2.4" />
        <path d="M24 14c-2-6-11-8-11-2 0 3 4 2 11 2ZM24 14c2-6 11-8 11-2 0 3-4 2-11 2Z" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: "Support When You Need It",
    description: "Our team is here to help you choose the right puja and pandit, every step of the way.",
    icon: (
      <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" className="h-8 w-8">
        <path d="M10 26v-4a14 14 0 0 1 28 0v4" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        <rect x="6" y="26" width="8" height="11" rx="3" stroke="currentColor" strokeWidth="2.4" />
        <rect x="34" y="26" width="8" height="11" rx="3" stroke="currentColor" strokeWidth="2.4" />
        <path d="M42 34v2a6 6 0 0 1-6 6h-6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    ),
  },
];

/**
 * "Why book with MyYajmaan" benefits grid for the customer register/login
 * pages -- mirrors BookingJourney's ("How MyYajmaan works") section/card/
 * hover pattern and WhyJoinMyYajmaan's (the Pandit Ji equivalent) layout,
 * reskinned with the reasons a Yajmaan should sign up and stay.
 */
export default function YajmaanBenefits({ ctaLabel = "Create Your Account →", onCtaClick }) {
  const { content, updatedAt } = useCmsContent("yajmaan-benefits", {
    title: "Why Book with MyYajmaan?",
    description: "From choosing the right puja to welcoming a verified Pandit Ji at your doorstep, we make every step easy and reliable.",
    cards: benefits.map(({ title, description }) => ({ title, description })),
  });
  const displayBenefits = benefits.map((benefit, index) => ({ ...benefit, ...(content.cards?.[index] || {}) }));

  return (
    <section className="relative overflow-hidden rounded-[1.8rem] border border-amber-200 bg-parchment-50 px-4 py-10 shadow-card sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-amber-200/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-20 h-64 w-64 rounded-full bg-rose-200/20 blur-3xl" />

      <div className="relative text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-saffron">{t("Trusted by families across India")}</p>
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
            title={t("Create your MyYajmaan account")}
            className="interactive-button inline-flex rounded-full bg-maroon px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-maroon hover:shadow-lg"
          >
            {t(ctaLabel)}
          </button>
        ) : (
          <Link
            to="/register"
            title={t("Create your MyYajmaan account")}
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

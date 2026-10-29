import { Link } from "react-router-dom";
import { formatCmsUpdatedAt, useCmsContent } from "../hooks/use-cms-content";
import { colors } from "../theme/tokens";

const steps = [
  {
    number: "01",
    title: "Choose your puja",
    description: "Explore meaningful rituals for every family occasion.",
    icon: (
      <svg
        viewBox="0 0 48 48"
        fill="none"
        aria-hidden="true"
        className="h-8 w-8"
      >
        <path
          d="M14 8h20a3 3 0 0 1 3 3v26a3 3 0 0 1-3 3H14a3 3 0 0 1-3-3V11a3 3 0 0 1 3-3Z"
          stroke="currentColor"
          strokeWidth="2.4"
        />
        <path
          d="M17 16h14M17 23h14M17 30h8"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <path
          d="m29 31 2 2 4-5"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    number: "02",
    title: "Find your pandit",
    description: "Meet verified pandits suited to your ritual and location.",
    icon: (
      <svg
        viewBox="0 0 48 48"
        fill="none"
        aria-hidden="true"
        className="h-8 w-8"
      >
        <circle
          cx="22"
          cy="21"
          r="10"
          stroke="currentColor"
          strokeWidth="2.4"
        />
        <path
          d="m29 29 9 9M18 21h8M22 17v8"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    number: "03",
    title: "Pick a shubh time",
    description: "Select a convenient date and auspicious available slot.",
    icon: (
      <svg
        viewBox="0 0 48 48"
        fill="none"
        aria-hidden="true"
        className="h-8 w-8"
      >
        <rect
          x="9"
          y="12"
          width="30"
          height="27"
          rx="4"
          stroke="currentColor"
          strokeWidth="2.4"
        />
        <path
          d="M15 8v8M33 8v8M9 21h30M16 27h4M24 27h4M32 27h2M16 33h4M24 33h4"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    number: "04",
    title: "Confirm securely",
    description: "Share your details and confirm your booking with ease.",
    icon: (
      <svg
        viewBox="0 0 48 48"
        fill="none"
        aria-hidden="true"
        className="h-8 w-8"
      >
        <path
          d="M8 17h32v22H8z"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinejoin="round"
        />
        <path
          d="M8 17h32l-4-8H12l-4 8ZM14 25h10"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="34" cy="32" r="5" fill="currentColor" />
        <path
          d="m31.5 32 1.7 1.7 3.3-3.5"
          stroke={colors.white}
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    number: "05",
    title: "Receive blessings",
    description: "Relax while your verified pandit prepares for the ceremony.",
    icon: (
      <svg
        viewBox="0 0 48 48"
        fill="none"
        aria-hidden="true"
        className="h-8 w-8"
      >
        <path
          d="M24 39s-13-7.7-13-18.2C11 15.4 14.8 12 19.2 12c2.2 0 3.8 1 4.8 2.6C25 13 26.6 12 28.8 12 33.2 12 37 15.4 37 20.8 37 31.3 24 39 24 39Z"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinejoin="round"
        />
        <path
          d="m18 23 4 4 8-9"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
];

export default function BookingJourney() {
  const { content, updatedAt } = useCmsContent("booking-journey", {
    title: "How MyYajmaan works",
    description: "From choosing a ritual to welcoming your pandit, every step is designed to feel clear, calm, and personal.",
    cards: steps.map(({ title, description }) => ({ title, description })),
  });
  const displaySteps = steps.map((step, index) => ({ ...step, ...(content.cards?.[index] || {}) }));

  return (
    <section className="relative overflow-hidden rounded-[1.8rem] border border-amber-200 bg-parchment-50 px-4 py-10 shadow-card sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-amber-200/20 blur-3xl" />

      <div className="pointer-events-none absolute -bottom-32 -left-20 h-64 w-64 rounded-full bg-rose-200/20 blur-3xl" />

      <div className="relative text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-saffron">
          A simple sacred journey
        </p>

        <h2 className="mt-2 font-serif text-3xl font-semibold text-maroon sm:text-4xl">
          {content.title}
        </h2>

        <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
          {content.description}
        </p>

        <div className="mx-auto mt-5 flex items-center justify-center gap-3">
          <span className="h-px w-12 bg-saffron/70 sm:w-20" />
          <span className="h-2.5 w-2.5 rounded-full bg-saffron shadow-ring-marigold" />
          <span className="h-px w-12 bg-saffron/70 sm:w-20" />
        </div>
      </div>

      <div className="relative mt-8 grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-5">
        {displaySteps.map((step, index) => (
          // Phones: a compact row (icon beside the text) instead of a
          // 245px-tall centred card per step -- about half the scroll.
          <article
            key={`${step.number}-${index}`}
            className="group relative flex items-start gap-4 rounded-[1.35rem] border border-amber-200 bg-white px-4 py-4 text-left shadow-card-sm transition duration-300 hover:-translate-y-2 hover:border-saffron/40 hover:shadow-card-lg sm:min-h-[245px] sm:flex-col sm:items-center sm:gap-0 sm:px-5 sm:py-6 sm:text-center"
          >
            <span className="absolute right-4 top-4 text-xs font-bold tracking-[0.18em] text-amber-300 transition group-hover:text-saffron">
              {String(index + 1).padStart(2, "0")}
            </span>

            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 text-saffron ring-1 ring-amber-200/70 transition-transform duration-300 group-hover:rotate-3 group-hover:scale-110 group-hover:bg-maroon group-hover:ring-maroon/30 sm:h-16 sm:w-16">
              {step.icon}
            </div>

            <div className="pr-6 sm:pr-0">
              <h3 className="font-serif text-lg font-semibold text-maroon sm:mt-5 sm:text-xl">
                {step.title}
              </h3>

              <p className="mt-1 text-sm leading-6 text-slate-600 sm:mt-2">
                {step.description}
              </p>
            </div>

            <span className="mt-auto hidden h-1 w-8 rounded-full bg-amber-100 transition-all duration-300 group-hover:w-14 group-hover:bg-saffron sm:block" />
          </article>
        ))}
      </div>

      <div className="relative mt-8 text-center">
        <Link
          to="/book"
          title="Start your booking"
          className="inline-flex rounded-full bg-maroon px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-maroon hover:shadow-lg"
        >
          Start your booking
        </Link>
        {updatedAt && <p className="mt-3 text-xs text-slate-500">Last updated: {formatCmsUpdatedAt(updatedAt)}</p>}
      </div>
    </section>
  );
}

import { Link } from "react-router-dom";
import { optimizedImage } from "../utils/image";

export default function PanditJoinBanner() {
  return (
    <section className="relative mt-8 overflow-hidden rounded-[1.6rem] border border-amber-200 bg-gradient-to-r from-parchment-100 via-parchment-50 to-parchment-300 shadow-card">
      <div className="pointer-events-none absolute -left-12 -top-16 h-40 w-40 rounded-full bg-saffron/15 blur-3xl" />

      <div className="pointer-events-none absolute -bottom-20 right-16 h-44 w-44 rounded-full bg-maroon/10 blur-3xl" />

      <div className="relative flex min-h-[190px] flex-col items-center gap-6 px-5 py-7 text-center sm:min-h-[170px] sm:flex-row sm:justify-between sm:px-8 sm:py-6 sm:text-left lg:px-12">
        <div className="max-w-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-saffron">
            Grow with MyYajmaan
          </p>

          <h2 className="mt-2 font-serif text-2xl font-semibold text-maroon sm:text-3xl">
            Are you a Pandit Ji?
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-600 sm:text-base">
            Join our trusted spiritual community and share your seva with more families.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-4">
          <div className="hidden h-28 w-36 items-end justify-center sm:flex">
            <img loading="lazy" decoding="async"
              src={optimizedImage("/images/panditHome.png")}
              alt="Pandit Ji ready to join MyYajmaan"
              className="h-full w-full object-contain"
            />
          </div>

          <Link
            to="/pandit/register"
            title="Register as a Pandit Ji"
            className="interactive-button rounded-full bg-maroon px-5 py-3 text-sm font-semibold text-white shadow-md hover:bg-maroon hover:shadow-xl"
          >
            Register as a Pandit Ji
          </Link>
        </div>
      </div>
    </section>
  );
}
import { optimizedImage } from "../utils/image";

export default function BookingFrame({
  title,
  description,
  accentImage,
  asideTitle,
  asideItems = [],
  children,
}) {
  return (
    <section className="mx-auto max-w-6xl px-4 py-4 sm:px-6 sm:py-10 lg:px-8">
      {/* grid-cols-1 + min-w-0: without them the grid column grows to the
          stepper's full one-line width (~830px), making the whole booking
          page wider than a phone so the browser zooms it out. */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-[0.92fr_1.08fr]">
        {/* Phones: a compact title strip with the summary as chips, so the
            step itself (date, address, pandit...) starts on the first
            screen. The logo and description return from `sm` up, and the
            summary box from `lg` (side-by-side layout). */}
        <div className="relative min-w-0 overflow-hidden rounded-[1.5rem] bg-maroon p-5 text-white shadow-divine-lg sm:rounded-[2rem] sm:p-6 lg:min-h-[620px]">
          {accentImage && <img src={accentImage} alt="booking preview" className="absolute inset-0 h-full w-full object-cover opacity-30" />}
          <div className="absolute inset-0 bg-gradient-to-br from-maroon-deep via-maroon/80 to-marigold/70" />
          <div className="relative flex h-full flex-col justify-between gap-6">
            <div>
              <div className="hidden h-12 w-12 overflow-hidden rounded-full border border-white/20 sm:block">
                <img src={optimizedImage("/images/logo-mark.png")} alt="MyYajmaan" className="h-full w-full object-cover" />
              </div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-100 sm:mt-4 sm:text-sm">Booking Journey</p>
              <h1 className="mt-2 max-w-xl font-serif text-2xl font-semibold leading-tight sm:mt-3 sm:text-[2rem]">{title}</h1>
              <p className="mt-3 hidden max-w-md text-sm leading-7 text-amber-50 sm:block">{description}</p>

              {/* Same summary as the box below (Booking ID, ritual, date...),
                  as small chips until the side-by-side layout has room. */}
              {asideItems.length > 0 && (
                <ul aria-label={asideTitle} className="mt-3 flex flex-wrap gap-2 lg:hidden">
                  {asideItems.map((item) => (
                    <li key={item.label} className="break-all rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-amber-50">
                      {item.label}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="hidden rounded-[1.5rem] border border-white/15 bg-white/12 p-4 backdrop-blur-md lg:block">
              <p className="font-semibold">{asideTitle}</p>
              <div className="mt-3 space-y-2 text-sm text-amber-50">
                {asideItems.map((item) => (
                  <div key={item.label} className="rounded-xl border border-white/10 bg-white/10 px-3 py-2">{item.label}</div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="min-w-0 rounded-[1.5rem] border border-amber-100 bg-white p-4 shadow-card sm:rounded-[2rem] sm:p-6 lg:p-8">{children}</div>
      </div>
    </section>
  );
}

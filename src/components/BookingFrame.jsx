export default function BookingFrame({
  title,
  description,
  accentImage,
  asideTitle,
  asideItems = [],
  children,
}) {
  return (
    <section className="mx-auto max-w-6xl px-6 py-10 lg:px-8">
      <div className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
        <div className="relative overflow-hidden rounded-[2rem] bg-maroon p-6 text-white shadow-[0_18px_50px_rgba(90,13,26,0.18)] lg:min-h-[620px]">
          {accentImage && <img src={accentImage} alt="booking preview" className="absolute inset-0 h-full w-full object-cover opacity-30" />}
          <div className="absolute inset-0 bg-gradient-to-br from-[#5a0d1a] via-[#7b1e2d]/80 to-[#dc9418]/70" />
          <div className="relative flex h-full flex-col justify-between gap-6">
            <div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-white/15 text-2xl backdrop-blur-sm">ॐ</div>
              <p className="mt-4 text-sm font-semibold uppercase tracking-[0.28em] text-amber-100">Booking Journey</p>
              <h1 className="mt-3 max-w-xl font-serif text-3xl font-semibold leading-tight sm:text-[2rem]">{title}</h1>
              <p className="mt-3 max-w-md text-sm leading-7 text-amber-50">{description}</p>
            </div>

            <div className="rounded-[1.5rem] border border-white/15 bg-white/12 p-4 backdrop-blur-md">
              <p className="font-semibold">{asideTitle}</p>
              <div className="mt-3 space-y-2 text-sm text-amber-50">
                {asideItems.map((item) => (
                  <div key={item.label} className="rounded-xl border border-white/10 bg-white/10 px-3 py-2">{item.label}</div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-amber-100 bg-white p-6 shadow-[0_16px_40px_rgba(122,31,45,0.07)] lg:p-8">{children}</div>
      </div>
    </section>
  );
}

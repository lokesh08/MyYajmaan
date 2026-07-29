export default function PanditPage() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-10 lg:px-8">
      <h1 className="font-serif text-3xl font-semibold text-maroon">Pandit Ji registration</h1>
      <div className="mt-6 rounded-[1.5rem] border border-amber-100 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-500">Register your profile, expertise, availability, and pricing for admin approval.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl bg-cream p-4">
            <p className="font-semibold">Profile details</p>
            <p className="mt-2 text-sm text-slate-600">Name, mobile, email, Aadhaar, photo uploads</p>
          </div>
          <div className="rounded-2xl bg-cream p-4">
            <p className="font-semibold">Availability & pricing</p>
            <p className="mt-2 text-sm text-slate-600">Set your slots, offerings, location, and service rates</p>
          </div>
        </div>
      </div>
    </section>
  );
}

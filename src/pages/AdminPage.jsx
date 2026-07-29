export default function AdminPage() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-10 lg:px-8">
      <h1 className="font-serif text-3xl font-semibold text-maroon">Admin console</h1>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {['Users', 'Puja Listings', 'Coupons & Offers'].map((item) => (
          <div key={item} className="rounded-[1.5rem] border border-amber-100 bg-white p-6 shadow-sm">
            <h2 className="font-semibold text-maroon">{item}</h2>
            <p className="mt-2 text-sm text-slate-500">Manage approvals, pricing, and promotions from one place.</p>
          </div>
        ))}
      </div>
    </section>
  );
}

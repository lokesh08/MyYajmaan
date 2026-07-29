const bookings = [
  { title: 'Griha Pravesh', status: 'Upcoming', date: '24 Jul 2026' },
  { title: 'Maha Aarti', status: 'Completed', date: '10 Jul 2026' },
];

export default function DashboardPage() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-10 lg:px-8">
      <h1 className="font-serif text-3xl font-semibold text-maroon">Your spiritual dashboard</h1>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[1.5rem] border border-amber-100 bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-maroon">My Pujas</h2>
          <div className="mt-4 space-y-3">
            {bookings.map((booking) => (
              <div key={booking.title} className="flex items-center justify-between rounded-2xl bg-cream px-4 py-3">
                <div>
                  <p className="font-semibold">{booking.title}</p>
                  <p className="text-sm text-slate-500">{booking.date}</p>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-sm text-saffron">{booking.status}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-[1.5rem] border border-amber-100 bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-maroon">Wallet & Rewards</h2>
          <div className="mt-4 space-y-3 text-sm text-slate-600">
            <p>• Signup bonus: ₹25 credited</p>
            <p>• Referral reward: ₹51 per successful referral</p>
            <p>• Shubh Muhurat discounts available this week</p>
          </div>
        </div>
      </div>
    </section>
  );
}

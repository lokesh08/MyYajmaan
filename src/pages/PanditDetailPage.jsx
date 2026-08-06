import { Link, useLocation, useNavigate } from 'react-router-dom';
import { pujaImages } from '../constants/visualAssets';

const demoPandit = {
  id: 1,
  name: 'Pandit Rajesh Sharma',
  price: '₹1,200',
  rating: 4.9,
  reviews: 124,
  image: '/images/pandit-1.jpg',
  languages: ['Hindi', 'English', 'Sanskrit'],
  experience: 12,
  specialties: ['Ganesh Puja', 'Satyanarayan', 'Griha Pravesh'],
  availability: 'Today • 6:00 PM',
};

export default function PanditDetailPage() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const pandit = state?.pandit || demoPandit;

  console.log(state?.pandit,"state")

  return (
    <section className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="overflow-hidden rounded-[2rem] border border-amber-100 bg-white shadow-[0_18px_40px_rgba(122,31,45,0.08)]">
        <div className="grid gap-0 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="bg-gradient-to-br from-maroon via-[#7d1e32] to-saffron p-6 text-white">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-2xl">ॐ</div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-100">Pandit Profile</p>
                <h1 className="mt-1 font-serif text-2xl font-semibold">{pandit.name}</h1>
              </div>
            </div>

            <img
              src={pandit.image}
              alt={pandit.name}
              className="mt-6 h-72 w-full rounded-[1.5rem] object-cover object-center shadow-lg"
            />
          </div>

          <div className="p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-saffron">{pandit.rating} ★ rated</p>
                <p className="text-sm text-slate-500">{pandit.reviews} happy families</p>
              </div>
              <div className="rounded-full bg-amber-50 px-4 py-2 text-sm font-semibold text-maroon">{pandit.price}</div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-cream p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Languages</p>
                <p className="mt-2 font-medium text-slate-800">{pandit.languages?.join(' • ')}</p>
              </div>
              <div className="rounded-2xl bg-cream p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Experience</p>
                <p className="mt-2 font-medium text-slate-800">{pandit.experience} years</p>
              </div>
              <div className="rounded-2xl bg-cream p-4 sm:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Specialties</p>
                <p className="mt-2 font-medium text-slate-800">{pandit.specialties?.join(' • ')}</p>
              </div>
              <div className="rounded-2xl bg-cream p-4 sm:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Availability</p>
                <p className="mt-2 font-medium text-slate-800">{pandit.availability}</p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                aria-label={`Select ${pandit.name} for your puja booking`}
                onClick={() =>
                  navigate('/book/datetime', {
                    state: {
                      puja: { id: 1, title: 'Ganesh Puja', image: pujaImages.ganesh },
                      selectedPandit: pandit,
                    },
                  })
                }
                className="rounded-full bg-maroon px-5 py-2.5 font-semibold text-white shadow-sm"
              >
                Select this pandit
              </button>
              <Link
                to="/"
                className="rounded-full border border-amber-200 bg-white px-5 py-2.5 font-semibold text-slate-700"
              >
                Back to Home
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

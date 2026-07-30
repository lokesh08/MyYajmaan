import { Link } from 'react-router-dom';
import { festivalImages, panditPortraits, pujaImages } from '../constants/visualAssets';

const ganeshImage = pujaImages.ganesh;
const satyanarayanImage = pujaImages.satyanarayan;
const grihaPraveshImage = pujaImages.grihaPravesh;
const navgrahaImage = pujaImages.navgraha;

const pujas = [
  { id: 1, title: 'Ganesh Puja', price: '₹1,499', duration: '1 - 2 hours', image: ganeshImage },
  { id: 2, title: 'Satyanarayan Puja', price: '₹1,799', duration: '1 - 2 hours', image: satyanarayanImage },
  { id: 3, title: 'Griha Pravesh Puja', price: '₹2,499', duration: '1.5 - 2 hours', image: grihaPraveshImage },
  { id: 4, title: 'Navgraha Shanti', price: '₹3,200', duration: '3 - 5 hours', image: navgrahaImage },
];

const pandits = [
  { id: 1, name: 'Pandit Rajesh Sharma', price: '1,200', rating: 4.9, reviews: 124, image: panditPortraits[0] },
  { id: 2, name: 'Pandit Vivek Mishra', price: '1,800', rating: 4.8, reviews: 98, image: panditPortraits[1] },
  { id: 3, name: 'Pandit Dinesh Pathak', price: '2,500', rating: 4.7, reviews: 76, image: panditPortraits[2] },
  { id: 4, name: 'Pandit Gaurav Joshi', price: '1,600', rating: 4.6, reviews: 58, image: panditPortraits[3] },
];

function PujaCard({ puja }) {
  return (
    <div className="card-puja overflow-hidden rounded-xl bg-white shadow-md">
      <div className="relative h-44">
        <img src={puja.image} alt={puja.title} className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        <div className="absolute bottom-3 left-3 text-white">
          <p className="font-semibold text-lg">{puja.title}</p>
          <p className="text-sm text-amber-100">{puja.duration}</p>
        </div>
      </div>
      <div className="flex items-center justify-between px-4 py-3">
        <div className="text-sm text-slate-600">From</div>
        <div className="font-semibold text-maroon">{puja.price}</div>
      </div>
      <div className="px-4 pb-4">
        <Link to="/book" className="block w-full rounded-full bg-maroon px-4 py-2 text-center text-white">Book</Link>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-10 lg:px-8">
      <div className="grid gap-8 lg:grid-cols-[1.45fr_0.55fr]">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-maroon via-[#8b1f2f] to-saffron p-8 text-white">
          <img src={festivalImages.ganeshChaturthi} alt="festival" className="absolute inset-0 h-full w-full object-cover opacity-20" />
          <div className="absolute inset-0 bg-gradient-to-br from-[#5f0d1a]/70 via-[#6e1328]/35 to-[#df8a11]/40" />
          <div className="relative">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl">
                <div className="flex gap-3">
                  <span className="rounded-full bg-white/10 px-3 py-1 text-sm">Book Trusted Pandit Ji</span>
                  <span className="rounded-full bg-amber-100/15 px-3 py-1 text-sm text-amber-50">Trusted by 10k+ families</span>
                </div>
                <h1 className="mt-4 font-serif text-3xl font-semibold leading-tight sm:text-4xl">Find the right priest for every sacred ritual</h1>
                <p className="mt-3 max-w-xl text-lg text-amber-50">Experienced pandits, verified profiles, and guided booking for your most meaningful ceremonies.</p>
                <div className="mt-5 flex gap-3">
                  <Link to="/book" className="rounded-full bg-white px-5 py-3 font-semibold text-maroon">Book a Puja</Link>
                  <Link to="/pandit" className="rounded-full border border-white/40 px-5 py-3 font-semibold">Become a Pandit Ji</Link>
                </div>
              </div>

              <div className="mt-6 lg:mt-0 lg:min-w-[240px]">
                <div className="rounded-xl border border-white/15 bg-white/10 p-4">
                  <p className="text-sm font-semibold uppercase tracking-wider text-amber-100">This week</p>
                  <p className="mt-2 text-sm text-amber-50">Shubh Muhurat discounts • Wallet ₹25 on signup • Refer ₹51</p>
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-white/20 bg-white/95 p-4 text-slate-800">
              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <select className="col-span-1 rounded-md border border-amber-100 px-3 py-2 text-sm">
                  <option>Choose Puja</option>
                  <option>Ganesh Puja</option>
                </select>
                <select className="col-span-1 rounded-md border border-amber-100 px-3 py-2 text-sm">
                  <option>Select City</option>
                  <option>Varanasi</option>
                </select>
                <input type="date" className="col-span-1 rounded-md border border-amber-100 px-3 py-2 text-sm" />
                <div className="col-span-3 sm:col-span-2 lg:col-span-3 flex gap-2">
                  <button className="w-full rounded-md bg-maroon px-4 py-2 text-white">Search Pandit Ji</button>
                  <button className="w-full rounded-md border border-amber-200 px-4 py-2">Browse Pujas</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-amber-100 bg-white p-6">
            <h3 className="font-serif text-lg font-semibold text-maroon">Upcoming Festivals</h3>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {Object.values(festivalImages).slice(0,4).map((img, idx) => (
                <div key={idx} className="overflow-hidden rounded-lg border border-amber-100 bg-white">
                  <div className="relative h-24">
                    <img src={img} alt={`festival-${idx}`} className="h-full w-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-amber-100 bg-white p-6">
            <h3 className="font-serif text-lg font-semibold text-maroon">Popular Pandit Ji</h3>
            <div className="mt-3 space-y-3">
              {pandits.slice(0,3).map((p) => (
                <div key={p.id} className="flex items-center gap-4 rounded-xl border border-amber-100 bg-white p-3">
                  <img src={p.image} alt={p.name} className="h-16 w-16 rounded-full object-cover" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold">{p.name}</p>
                        <p className="text-sm text-slate-500">Vedic rituals • Hindi, English</p>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">₹{p.price}</div>
                        <p className="mt-1 text-sm text-amber-500">⭐ {p.rating}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>

      <div className="mt-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-2xl font-semibold text-maroon">Trending Pujas</h2>
          <Link to="/book" className="text-sm font-semibold text-saffron">See all</Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {pujas.map((p) => (
            <PujaCard key={p.id} puja={p} />
          ))}
        </div>
      </div>
    </section>
  );
}

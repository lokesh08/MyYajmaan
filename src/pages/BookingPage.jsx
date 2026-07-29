import { useNavigate } from 'react-router-dom';
import { pujaImages } from '../constants/visualAssets';

const ganeshImage = pujaImages.ganesh;
const navgrahaImage = pujaImages.navgraha;

const pujaOptions = [
  {
    id: 1,
    title: 'Grah Shanti',
    price: '₹2,999',
    duration: '60 min',
    image: ganeshImage,
    benefits: ['Vastu harmony', 'Peaceful ambiance'],
  },
  {
    id: 2,
    title: 'Navagraha Shanti',
    price: '₹4,499',
    duration: '90 min',
    image: navgrahaImage,
    benefits: ['Planetary remedies', 'Blessings for prosperity'],
  },
];

export default function BookingPage() {
  const navigate = useNavigate();

  function openBooking(puja) {
    navigate('/book/datetime', { state: { puja } });
  }

  return (
    <section className="mx-auto max-w-7xl px-6 py-10 lg:px-8">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-saffron">Booking flow</p>
          <h1 className="font-serif text-3xl font-semibold text-maroon">Choose your sacred ritual</h1>
        </div>
        <div className="rounded-full border border-amber-200 bg-white px-4 py-2 text-sm text-slate-600">Step 1 of 6</div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {pujaOptions.map((puja) => (
          <div key={puja.title} className="overflow-hidden rounded-[1.5rem] border border-amber-100 bg-white shadow-sm">
            <div className="relative h-56 overflow-hidden">
              <img src={puja.image} alt={puja.title} className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
              <div className="absolute bottom-4 left-4 right-4 text-white">
                <h2 className="font-serif text-xl font-semibold">{puja.title}</h2>
                <p className="mt-2 text-sm text-amber-100">{puja.duration}</p>
              </div>
            </div>

            <div className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-slate-500">Puja details</p>
                </div>
                <p className="text-lg font-semibold text-saffron">{puja.price}</p>
              </div>
              <ul className="mt-4 space-y-2 text-sm text-slate-600">
                {puja.benefits.map((benefit) => (
                  <li key={benefit}>• {benefit}</li>
                ))}
              </ul>
              <button onClick={() => openBooking(puja)} className="mt-5 inline-block rounded-full bg-maroon px-5 py-3 font-semibold text-white">Select ritual</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { pujaCatalog } from '../constants/pujaCatalog';
import { clearBookingDraft } from '../utils/bookingFlowStorage';

const categories = ['All Categories', 'Festival', 'Family', 'Housewarming', 'Temple', 'Path', 'Remedy'];
const durations = ['All Durations', '1 - 2 Hours', '2 - 3 Hours', '3 - 5 Hours'];
const sortOptions = [
  { value: 'popular', label: 'Most Popular' },
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
  { value: 'rating', label: 'Top Rated' },
];

export default function BookingPage() {
  const navigate = useNavigate();
  const [category, setCategory] = useState('All Categories');
  const [duration, setDuration] = useState('All Durations');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('popular');

  const filteredPujas = useMemo(() => {
    const list = pujaCatalog.filter((puja) => {
      const matchesCategory = category === 'All Categories' || puja.category === category;
      const matchesDuration = duration === 'All Durations' || puja.duration === duration;
      const matchesSearch = !search || puja.title.toLowerCase().includes(search.toLowerCase());
      return matchesCategory && matchesDuration && matchesSearch;
    });

    const sorted = [...list];
    if (sortBy === 'price-asc') {
      sorted.sort((a, b) => Number(a.price.replace(/[^\d]/g, '')) - Number(b.price.replace(/[^\d]/g, '')));
    } else if (sortBy === 'price-desc') {
      sorted.sort((a, b) => Number(b.price.replace(/[^\d]/g, '')) - Number(a.price.replace(/[^\d]/g, '')));
    } else if (sortBy === 'rating') {
      sorted.sort((a, b) => b.rating - a.rating);
    } else {
      sorted.sort((a, b) => b.reviewCount - a.reviewCount);
    }

    return sorted;
  }, [category, duration, search, sortBy]);

  function openDetails(puja) {
    clearBookingDraft();
    navigate(`/book/${puja.id}`);
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-5 rounded-[1.4rem] bg-[#5f0d1a] p-4 text-white shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-amber-100">Browse Pujas</p>
            <h1 className="mt-1 font-serif text-3xl font-semibold">Choose your sacred ritual</h1>
          </div>
          <div className="rounded-full border border-white/25 bg-white/10 px-4 py-2 text-sm">Step 1 of 6</div>
        </div>
      </div>

      <div className="mb-5 rounded-[1rem] border border-amber-100 bg-white p-3 shadow-sm">
        <input
          type="text"
          aria-label="Search pujas"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search Pujas..."
          className="w-full rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm outline-none"
        />
      </div>

      <div className="mb-5 grid gap-3 md:grid-cols-3">
        <label className="block rounded-[0.9rem] border border-amber-100 bg-white p-3 shadow-sm">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">All Categories</span>
          <select
            aria-label="Filter by category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm"
          >
            {categories.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </label>

        <label className="block rounded-[0.9rem] border border-amber-100 bg-white p-3 shadow-sm">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">All Durations</span>
          <select
            aria-label="Filter by duration"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="w-full rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm"
          >
            {durations.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </label>

        <label className="block rounded-[0.9rem] border border-amber-100 bg-white p-3 shadow-sm">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Sort By</span>
          <select
            aria-label="Sort pujas"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="w-full rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm"
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {filteredPujas.map((puja) => (
          <div key={puja.id} className="overflow-hidden rounded-[1.3rem] border border-amber-100 bg-white shadow-[0_12px_28px_rgba(122,31,45,0.05)]">
            <div className="relative h-52 overflow-hidden">
              <img src={puja.image} alt={puja.title} className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
              <div className="absolute bottom-4 left-4 right-4 text-white">
                <h2 className="font-serif text-xl font-semibold">{puja.title}</h2>
                <p className="mt-1 text-sm text-amber-100">Duration: {puja.duration}</p>
              </div>
            </div>

            <div className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500">From {puja.price}</p>
                <p className="text-sm text-amber-500">★ {puja.rating}</p>
              </div>
              <button
                type="button"
                onClick={() => openDetails(puja)}
                aria-label={`View details for ${puja.title}`}
                className="mt-4 w-full rounded-full bg-maroon px-4 py-2.5 text-sm font-semibold text-white"
              >
                View details
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { withAbortGet } from '../api';
import { bookingFallbackImage } from '../constants/visualAssets';
import { clearBookingDraft } from '../utils/bookingFlowStorage';
import Loader from '../components/common/Loader';
import SwipeRow from '../components/common/SwipeRow';
import Seo from '../components/Seo';
import { getSiteUrl } from '../seo/seoHead';
import { itemListSchema } from '../seo/structuredData';
import { optimizedImage } from '../utils/image';

const categories = ['All Categories', 'Festival', 'Family', 'Housewarming', 'Temple', 'Path', 'Remedy'];
const durations = ['All Durations', '1 - 2 Hours', '2 - 3 Hours', '3 - 5 Hours'];
const sortOptions = [
  { value: 'popular', label: 'Most Popular' },
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
  { value: 'rating', label: 'Top Rated' },
];

// Buckets duration_minutes into the same ranges the filter dropdown
// offers, since the API stores an exact minute count, not a range.
function bucketDuration(minutes) {
  if (!minutes) return null;
  if (minutes <= 120) return '1 - 2 Hours';
  if (minutes <= 180) return '2 - 3 Hours';
  return '3 - 5 Hours';
}

const PUJA_TYPE_TABS = [
  { value: 'normal', label: 'Normal Pujas' },
  { value: 'package', label: 'Package Pujas' },
];

export default function BookingPage() {
  const navigate = useNavigate();
  const [pujaType, setPujaType] = useState('normal');
  const [category, setCategory] = useState('All Categories');
  const [duration, setDuration] = useState('All Durations');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('popular');

  const [pujas, setPujas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const { promise, controller } = withAbortGet('/pujas', { params: { limit: 100 } });

    setLoading(true);
    setError(null);

    promise
      .then((data) => setPujas(Array.isArray(data) ? data : []))
      .catch((err) => {
        if (err?.isCanceled || err?.name === 'CanceledError') return;
        setError(err?.message || 'Failed to load pujas');
      })
      .finally(() => setLoading(false));

    return () => {
      try {
        controller.abort();
      } catch (_) {
        /* ignore */
      }
    };
  }, []);

  const filteredPujas = useMemo(() => {
    const list = pujas.filter((puja) => {
      const matchesType = (puja.puja_type || 'normal') === pujaType;
      const matchesCategory = category === 'All Categories' || puja.category === category;
      const matchesDuration = duration === 'All Durations' || bucketDuration(puja.duration_minutes) === duration;
      const matchesSearch = !search || puja.title?.toLowerCase().includes(search.toLowerCase());
      return matchesType && matchesCategory && matchesDuration && matchesSearch;
    });

    const sorted = [...list];
    if (sortBy === 'price-asc') {
      sorted.sort((a, b) => (a.base_price || 0) - (b.base_price || 0));
    } else if (sortBy === 'price-desc') {
      sorted.sort((a, b) => (b.base_price || 0) - (a.base_price || 0));
    }
    // 'rating' and 'popular' sorts are no-ops for now — the API doesn't
    // carry rating/review-count data yet, so we don't fabricate an order.

    return sorted;
  }, [pujas, pujaType, category, duration, search, sortBy]);

  function openDetails(puja) {
    clearBookingDraft();
    navigate(`/book/${puja.id}`);
  }

  // The full (unfiltered) catalogue as an ItemList, so search engines can
  // see and link every bookable puja. Route-level title/description still apply.
  const itemList =
    pujas.length > 0
      ? itemListSchema(
          getSiteUrl(),
          pujas.slice(0, 50).map((puja) => ({ name: puja.title, path: `/book/${puja.id}` })),
          'Pujas you can book on MyYajmaan',
        )
      : undefined;

  return (
    <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <Seo jsonLd={itemList} />
      <div className="mb-5 rounded-[1.4rem] bg-maroon-deep p-4 text-white shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-amber-100">Browse Pujas</p>
            <h1 className="mt-1 font-serif text-3xl font-semibold">Choose your sacred ritual</h1>
          </div>
          <div className="rounded-full border border-white/25 bg-white/10 px-4 py-2 text-sm">Step 1 of 6</div>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap gap-2 rounded-full border border-amber-100 bg-white p-1 shadow-sm sm:inline-flex sm:w-auto">
        {PUJA_TYPE_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setPujaType(tab.value)}
            className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold transition sm:flex-none ${
              pujaType === tab.value ? 'bg-maroon text-white' : 'text-slate-600 hover:bg-amber-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {pujaType === 'package' && (
        <div className="mb-5 rounded-[1rem] border border-amber-200 bg-amber-50 p-4 text-sm text-slate-700">
          Package pujas are custom-priced. Submit a request with your date, address, and requirements -- no
          payment needed yet -- and our team will call you to confirm the details and share a final quote.
        </div>
      )}

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

      {loading && <Loader variant="card" count={6} />}

      {!loading && error && (
        <p className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-8 text-center text-sm text-rose-600">
          {error}
        </p>
      )}

      {!loading && !error && filteredPujas.length === 0 && (
        <p className="rounded-2xl border border-dashed border-amber-200 bg-white px-4 py-10 text-center text-sm text-slate-400">
          No pujas match your filters right now.
        </p>
      )}

      {!loading && !error && filteredPujas.length > 0 && (
        <>
          {/* Mobile: one swipeable row per category instead of one long
              column. Rows follow the current filters and sort order. */}
          <div className="space-y-6 sm:hidden">
            {groupByCategory(filteredPujas).map(([groupName, groupPujas]) => (
              <div key={groupName}>
                <h2 className="mb-3 font-serif text-xl font-semibold text-maroon">
                  {groupName} <span className="text-sm font-normal text-slate-400">({groupPujas.length})</span>
                </h2>
                <SwipeRow label={`${groupName} pujas`}>
                  {groupPujas.map((puja) => (
                    <PujaCatalogCard key={puja.id} puja={puja} onOpen={openDetails} />
                  ))}
                </SwipeRow>
              </div>
            ))}
          </div>

          <div className="hidden gap-5 sm:grid sm:grid-cols-2 xl:grid-cols-3">
            {filteredPujas.map((puja) => (
              <PujaCatalogCard key={puja.id} puja={puja} onOpen={openDetails} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

// Category rows in the same order as the category filter; anything with
// a category not in that list comes after, then uncategorized pujas.
function groupByCategory(list) {
  const groups = new Map();
  for (const puja of list) {
    const key = puja.category || 'Other Pujas';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(puja);
  }
  const rank = (name) => {
    const index = categories.indexOf(name);
    if (index > 0) return index;
    return name === 'Other Pujas' ? Infinity : categories.length;
  };
  return [...groups.entries()].sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b));
}

function PujaCatalogCard({ puja, onOpen }) {
  return (
    <div className="h-full overflow-hidden rounded-[1.3rem] border border-amber-100 bg-white shadow-card-sm">
      <div className="relative h-52 overflow-hidden">
        <img loading="lazy" decoding="async"
          src={optimizedImage(puja.thumbnail_url || puja.image_url || bookingFallbackImage)}
          alt={puja.title}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
        <div className="absolute bottom-4 left-4 right-4 text-white">
          <h2 className="font-serif text-xl font-semibold">{puja.title}</h2>
          {puja.duration_minutes ? (
            <p className="mt-1 text-sm text-amber-100">Duration: {puja.duration_minutes} mins</p>
          ) : null}
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            From {puja.base_price ? `₹${puja.base_price}` : '-'}
          </p>
          {puja.category && (
            <p className="text-xs font-semibold uppercase tracking-wide text-saffron">{puja.category}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => onOpen(puja)}
          aria-label={`View details for ${puja.title}`}
          className="mt-4 w-full rounded-full bg-maroon px-4 py-2.5 text-sm font-semibold text-white"
        >
          View details
        </button>
      </div>
    </div>
  );
}

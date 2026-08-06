import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import SelectionCard from '../components/SelectionCard';
import { pujaCatalog } from '../constants/pujaCatalog';

const tabs = [
  { id: 'about', label: 'About Puja' },
  { id: 'benefits', label: 'Benefits' },
  { id: 'samagri', label: 'Samagri' },
  { id: 'faq', label: 'FAQ' },
];

export default function PujaDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('about');
  const [selectedPackageName, setSelectedPackageName] = useState(pujaCatalog[0]?.packages?.[0]?.name || 'Basic Package');

  const puja = useMemo(() => pujaCatalog.find((item) => item.id === id) || pujaCatalog[0], [id]);

  const selectedPackage = puja.packages?.find((pkg) => pkg.name === selectedPackageName) || puja.packages?.[0];

  const handlePackageSelection = (pkg) => {
    setSelectedPackageName(pkg.name);
    navigate('/book/datetime', {
      state: {
        puja: {
          id: puja.id,
          title: puja.title,
          price: pkg.price,
          image: puja.image,
          packageName: pkg.name,
        },
        packageOption: pkg,
        selectedPuja: puja,
      },
    });
  };

  return (
    <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-slate-500">
        <Link to="/" className="hover:text-maroon">Home</Link>
        <span>›</span>
        <Link to="/book" className="hover:text-maroon">Pujas</Link>
        <span>›</span>
        <span className="text-slate-700">{puja.title}</span>
      </div>

      <div className="overflow-hidden rounded-[2rem] border border-amber-100 bg-white shadow-[0_18px_40px_rgba(122,31,45,0.08)]">
        <div className="grid gap-0 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="bg-gradient-to-br from-maroon via-[#7d1e32] to-saffron p-6 text-white">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-2xl">ॐ</div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-100">Puja Details</p>
                <h1 className="mt-1 font-serif text-2xl font-semibold">{puja.title}</h1>
              </div>
            </div>

            <img
              src={puja.image}
              alt={puja.title}
              className="mt-6 h-72 w-full rounded-[1.5rem] object-cover object-center shadow-lg"
            />
          </div>

          <div className="p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1 text-amber-500">★ ★ ★ ★ ★</div>
              <span className="text-sm font-semibold text-slate-700">{puja.rating} / 5</span>
              <span className="text-sm text-slate-500">({puja.reviewCount} reviews)</span>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-4">
              <div className="rounded-2xl bg-cream p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Duration</p>
                <p className="mt-1 text-sm font-semibold text-slate-800">{puja.duration}</p>
              </div>
              <div className="rounded-2xl bg-cream p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">People</p>
                <p className="mt-1 text-sm font-semibold text-slate-800">{puja.people}</p>
              </div>
              <div className="rounded-2xl bg-cream p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Best For</p>
                <p className="mt-1 text-sm font-semibold text-slate-800">{puja.bestFor}</p>
              </div>
              <div className="rounded-2xl bg-cream p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Category</p>
                <p className="mt-1 text-sm font-semibold text-slate-800">{puja.category}</p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2 border-b border-amber-100 pb-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold ${activeTab === tab.id ? 'bg-maroon text-white' : 'bg-amber-50 text-slate-700'}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="mt-4 rounded-2xl bg-[#fffaf2] p-4 text-sm text-slate-700">
              {activeTab === 'about' && <p>{puja.about}</p>}
              {activeTab === 'benefits' && (
                <ul className="space-y-2">
                  {puja.benefits.map((item) => (
                    <li key={item}>• {item}</li>
                  ))}
                </ul>
              )}
              {activeTab === 'samagri' && (
                <ul className="space-y-2">
                  {puja.samagri.map((item) => (
                    <li key={item}>• {item}</li>
                  ))}
                </ul>
              )}
              {activeTab === 'faq' && (
                <ul className="space-y-2">
                  {puja.faq.map((item) => (
                    <li key={item}>• {item}</li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {puja.packages.map((pkg) => (
                <SelectionCard
                  key={pkg.name}
                  ariaLabel={`Select ${pkg.name} for ${puja.title}`}
                  ariaPressed={selectedPackageName === pkg.name}
                  selected={selectedPackageName === pkg.name}
                  onClick={() => handlePackageSelection(pkg)}
                  className="p-4"
                >
                  <p className="text-lg font-semibold text-maroon">{pkg.name}</p>
                  <p className="mt-2 text-2xl font-bold text-saffron">{pkg.price}</p>
                  <ul className="mt-3 space-y-2 text-sm text-slate-600">
                    {pkg.items.map((item) => (
                      <li key={item}>✓ {item}</li>
                    ))}
                  </ul>
                  <span className={`mt-4 inline-flex w-full items-center justify-center rounded-full px-4 py-2.5 text-sm font-semibold transition ${selectedPackageName === pkg.name ? 'bg-maroon text-white' : 'bg-amber-50 text-slate-700 group-hover:bg-maroon group-hover:text-white'}`}>
                    {selectedPackageName === pkg.name ? 'Selected' : `Select ${pkg.name}`}
                  </span>
                </SelectionCard>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() =>
                  navigate('/book/datetime', {
                    state: {
                      puja: {
                        id: puja.id,
                        title: puja.title,
                        image: puja.image,
                        price: selectedPackage?.price || puja.price,
                        packageName: selectedPackage?.name || 'Basic Package',
                      },
                      packageOption: selectedPackage,
                      selectedPuja: puja,
                    },
                  })
                }
                className="rounded-full bg-saffron px-5 py-2.5 font-semibold text-white"
              >
                Continue booking
              </button>
              <Link to="/book" className="rounded-full border border-amber-200 bg-white px-5 py-2.5 font-semibold text-slate-700">
                Back to browse
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

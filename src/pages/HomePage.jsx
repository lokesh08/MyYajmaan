import { Link, useNavigate } from "react-router-dom";
import {
  festivalImages,
  panditPortraits,
  pujaImages,
  pujas,
  pandits,
  festivals
} from "../constants/visualAssets";
import { clearBookingDraft } from "../utils/bookingFlowStorage";
import HomeWithModals from "../components/HomeWithModals";
import Festivals from "../components/Festivals";
import Pujas from "../components/Pujas"; 
import Pandits from "../components/Pandits";

function PujaCard({ puja }) {
  return (
    <div className="overflow-hidden rounded-[1.25rem] border border-amber-100 bg-white shadow-[0_14px_35px_rgba(122,31,45,0.05)]">
      <div className="relative h-44 overflow-hidden">
        <img
          src={puja.image}
          alt={puja.title}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/25 to-transparent" />
        <div className="absolute bottom-3 left-3 right-3 text-white">
          <p className="font-serif text-lg font-semibold">{puja.title}</p>
          <p className="text-sm text-amber-100">{puja.duration}</p>
        </div>
      </div>
      <div className="flex items-center justify-between px-4 py-3">
        <div className="text-sm text-slate-600">From</div>
        <div className="font-semibold text-maroon">{puja.price}</div>
      </div>
      <div className="px-4 pb-4">
        <Link
          to="/book"
          className="block w-full rounded-full bg-maroon px-4 py-2 text-center text-sm font-semibold text-white"
        >
          Book
        </Link>
      </div>
    </div>
  );
}


function PanditCard({ p, onView, onSelect }) {
  return (
    <div className="rounded-[1.25rem] border border-amber-100 bg-white p-4 shadow-[0_12px_30px_rgba(122,31,45,0.05)]">
      <div className="flex items-center gap-4">
        <img
          src={p.image}
          alt={p.name}
          className="h-16 w-16 rounded-full object-cover"
        />
        <div className="flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-slate-900">{p.name}</p>
              <p className="text-sm text-slate-500">
                Vedic rituals • Hindi, English
              </p>
            </div>
            <div className="text-right">
              <div className="rounded-full bg-amber-50 px-3 py-1 text-sm font-semibold text-maroon">
                {p.price}
              </div>
              <p className="mt-1 text-sm text-amber-500">⭐ {p.rating}</p>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              aria-label={`View details for ${p.name}`}
              onClick={() => onView(p)}
              className="rounded-full border border-amber-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700"
            >
              View
            </button>
            <button
              type="button"
              aria-label={`Select ${p.name} for booking`}
              onClick={() => onSelect(p)}
              className="ml-auto rounded-full bg-saffron px-3 py-1.5 text-sm font-semibold text-white"
            >
              Select
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const navigate = useNavigate();

  const handleViewPandit = (pandit) => {
    navigate(`/pandit/${pandit.id}`, { state: { pandit } });
  };

  const handleSelectPandit = (pandit) => {
    navigate("/book/datetime", {
      state: {
        puja: { id: 1, title: "Ganesh Puja", image: pujaImages.ganesh },
        selectedPandit: pandit,
      },
    });
  };

  return (
    <section className="mx-auto max-w-[1320px] px-4 py-5 sm:px-6 lg:px-8">
      <div className="overflow-hidden rounded-[2.2rem] border border-amber-100 bg-white shadow-[0_20px_45px_rgba(71,18,29,0.12)]">
        <div className="relative min-h-[440px] overflow-hidden bg-maroon">
          <img
            src={festivalImages.ganeshChaturthi}
            alt="Pandit Ji performing a puja ritual in a devotional setting"
            className="absolute inset-0 h-full w-full object-cover object-center opacity-55"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#5a0d1a]/90 via-[#7c1e33]/60 to-[#d88d23]/45" />

          <div className="relative flex h-full flex-col justify-between gap-6 p-5 sm:p-8 lg:p-9">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-semibold text-amber-50 sm:text-sm">
                Book Trusted Pandit Ji
              </span>
              <span className="rounded-full border border-amber-100/30 bg-amber-100/15 px-3 py-1 text-xs font-semibold text-amber-50 sm:text-sm">
                Trusted by 10k+ families
              </span>
            </div>

            <div className="max-w-[40rem]">
              <h1 className="font-serif text-[2.15rem] font-semibold leading-[1.05] text-white sm:text-[2.9rem]">
                Book Trusted Pandit Ji for every auspicious occasion
              </h1>
              <p className="mt-3 max-w-lg text-sm leading-6 text-amber-50 sm:text-base">
                Experience divine blessings with verified pandits, guided
                booking, and festive puja support.
              </p>

              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  to="/book"
                  aria-label="Book a puja"
                  onClick={clearBookingDraft}
                  className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-maroon shadow-sm"
                >
                  Book a Puja
                </Link>
                <Link
                  to="/browse-pandits"
                  aria-label="Browse pandit registration"
                  className="rounded-full border border-white/35 px-5 py-3 text-sm font-semibold text-white"
                >
                  Browse Pandit Ji
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-amber-100 bg-[#fffaf2] p-4 sm:p-5 lg:p-6">
          <HomeWithModals />
        </div>
      </div>

      <div className="mt-8 rounded-[1.5rem] bg-white p-1 sm:p-2">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-[1.75rem] font-semibold text-maroon">
            Trending Pujas
          </h2>
          <Link
            to="/book"
            aria-label="See all pujas"
            className="text-sm font-semibold text-saffron"
          >
            View All
          </Link>
        </div>
         <Pujas limit={4} onView={(puja) => navigate(`/book`, { state: { puja } })} onBook={(puja) => navigate("/book", { state: { puja } })} /> 
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        <div className="rounded-[1.4rem] border border-amber-100 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-serif text-[1.6rem] font-semibold text-maroon">
              Upcoming Festivals
            </h2>
 
          </div>
          <div className="grid gap-3">
           <Festivals limit={4} />
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-amber-100 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-serif text-[1.6rem] font-semibold text-maroon">
              Popular Pandit Ji
            </h2>
            <Link
              to="/pandit"
              aria-label="View all pandits"
              className="text-sm font-semibold text-saffron"
            >
              View All
            </Link>
          </div>
          <div className="grid gap-4"> <Pandits limit={4} onView={handleViewPandit} onSelect={handleSelectPandit} /> </div>
        </div>
      </div>
    </section>
  );
}

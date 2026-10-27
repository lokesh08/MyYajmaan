import { Link, useNavigate } from "react-router-dom";
import { pujaImages, bannerImages } from "../constants/visualAssets";
import { clearBookingDraft } from "../utils/bookingFlowStorage";
import HeroBannerSlider from "../components/HeroBannerSlider";
import HomeWithModals from "../components/HomeWithModals";
import Festivals from "../components/Festivals";
import PujaSlider from "../components/PujaSlider";
import Pandits from "../components/Pandits";
import BookingJourney from "../components/BookingJourney";
import OffersBanner from "../components/OffersBanner";
import CouponsShowcase from "../components/CouponsShowcase";
import Testimonials from "../components/Testimonials";
import PanditJoinBanner from "../components/PanditJoinBanner";

export default function HomePage() {
  const navigate = useNavigate();

  const handleViewPandit = (pandit) => {
    navigate(`/pandit/${pandit.id}`);
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
      <div className="overflow-hidden rounded-[2.2rem] border border-amber-200 bg-white shadow-card-lg">
        <div className="relative min-h-[440px] overflow-hidden bg-maroon">
          <HeroBannerSlider
            images={[
              bannerImages.banner1,
              bannerImages.banner2,
              bannerImages.banner3,
              bannerImages.banner4,
            ]}
          />

          {/* Fixed contrast backing for the white text below -- the rotating
              banner photos don't all have a naturally light/plain area (unlike
              the old single banner1), so this keeps the text readable no
              matter which of the 4 images is currently showing. */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/60 via-black/25 to-transparent" />

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
              <h1 className="font-serif text-[2.15rem] font-semibold leading-[1.05] text-white sm:text-[2.9rem]">Book Trusted Pandit Ji for every auspicious occasion</h1>
              <p className="mt-3 max-w-lg text-sm leading-6 text-amber-50 sm:text-base">
                Experience divine blessings with verified pandits, guided
                booking, and festive puja support.
              </p>

              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  to="/book"
                  aria-label="Book a puja"
                  title="Book a puja"
                  onClick={clearBookingDraft}
                  className="interactive-button rounded-full bg-white px-5 py-3 text-sm font-semibold text-maroon shadow-sm"
                >
                  Book a Puja
                </Link>
                <Link
                  to="/browse-pandits"
                  aria-label="Browse pandit registration"
                  title="Browse pandits"
                  className="interactive-button rounded-full border border-white/35 px-5 py-3 text-sm font-semibold text-white hover:bg-white/15"
                >
                  Browse Pandit Ji
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-amber-100 bg-parchment-50 p-4 sm:p-5 lg:p-6">
          <HomeWithModals />
        </div>
      </div>

        <OffersBanner />
        <CouponsShowcase />

      <div className="relative mt-8 overflow-hidden rounded-[1.8rem] border border-amber-200 bg-parchment-50 px-4 py-8 shadow-card sm:px-6 lg:px-8">
        <PujaSlider
          title="Trending Pujas"
          viewAllLink="/book"
          fetchUrl="/pujas"
          fetchParams={{ listing_type: "trending" }}
          emptyMessage="No trending pujas right now."
          limit={8}
        />
      </div>

      <div className="relative mt-8 overflow-hidden rounded-[1.8rem] border border-amber-200 bg-parchment-50 px-4 py-8 shadow-card sm:px-6 lg:px-8">
        <PujaSlider
          title="Featured Pujas"
          viewAllLink="/book"
          fetchUrl="/pujas"
          fetchParams={{ listing_type: "featured" }}
          emptyMessage="No featured pujas right now."
          limit={8}
        />
      </div>

      <div className="mt-8 grid items-stretch gap-6 lg:grid-cols-2">
        <div className="flex h-full min-h-[430px] flex-col rounded-[1.8rem] border border-amber-200 bg-parchment-50 p-4 shadow-card sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-serif text-[1.6rem] font-semibold text-maroon">
              Upcoming Festivals
            </h2>
          </div>
          <div className="grid flex-1 auto-rows-fr gap-3">
            <Festivals limit={4} />
          </div>
        </div>

        <div className="flex h-full min-h-[430px] flex-col rounded-[1.8rem] border border-amber-200 bg-parchment-50 p-4 shadow-card sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-serif text-[1.6rem] font-semibold text-maroon">
              Popular Pandit Ji
            </h2>
            <Link
              to="/pandit"
              aria-label="View all pandits"
              title="View all pandits"
              className="text-sm font-semibold text-saffron"
            >
              View All
            </Link>
          </div>
          <div className="flex-1">
            {" "}
            <Pandits
              limit={4}
              onView={handleViewPandit}
              onSelect={handleSelectPandit}
            />{" "}
          </div>
        </div>
      </div>
      <PanditJoinBanner />
      <div className="mt-8">
        <BookingJourney />
      </div>
      <div className="mt-8">
        <Testimonials />
      </div>
    </section>
  );
}

import { Link, useNavigate } from "react-router-dom";
import { bannerImages } from "../constants/visualAssets";
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
import { useAuth } from "../context/AuthContext";
import { showInfo } from "../utils/toaster";
import { t } from "../i18n";

export default function HomePage() {
  const navigate = useNavigate();
  const { profile } = useAuth();

  // Pandit Ji registration is for a new, separate account: someone
  // already logged in would just be bounced back to their dashboard.
  const handleBecomePandit = (event) => {
    if (profile) {
      event.preventDefault();
      showInfo(t("Please log out first to register as a Pandit Ji with a separate account."));
    }
  };

  const handleViewPandit = (pandit) => {
    navigate(`/pandit/${pandit.id}`);
  };

  // A booking needs a real puja first: open the Pandit Ji's page, which
  // lists the pujas they perform (it used to start the wizard with a
  // made-up "Ganesh Puja", id 1, that isn't in the catalogue).
  const handleSelectPandit = (pandit) => {
    navigate(`/pandit/${pandit.id}`, { state: { scrollToPujas: true } });
  };

  return (
    <section className="mx-auto max-w-[1320px] px-4 py-5 sm:px-6 lg:px-8">
      <div className="overflow-hidden rounded-[2.2rem] border border-amber-200 bg-white shadow-card-lg">
        <div className="relative min-h-[360px] overflow-hidden bg-maroon md:min-h-[440px]">
          {/* The banner fills the hero behind the text on every screen. On
              phones HeroBannerSlider shows each wide image whole (with a
              blurred fill) instead of a zoomed-in slice. */}
          <div className="absolute inset-0">
            <HeroBannerSlider
              images={[
                bannerImages.banner1,
                bannerImages.banner2,
                bannerImages.banner3,
                bannerImages.banner4,
              ]}
            />
          </div>

          {/* Fixed contrast backing for the white text below -- the rotating
              banner photos don't all have a naturally light/plain area (unlike
              the old single banner1), so this keeps the text readable no
              matter which of the 4 images is currently showing. Only needed
              Phones get a bottom-up shade, since there the text spans the
              full width of the photo. */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/45 to-black/25 md:hidden" />
          <div className="pointer-events-none absolute inset-0 hidden bg-gradient-to-r from-black/60 via-black/25 to-transparent md:block" />

          <div className="relative flex min-h-[360px] flex-col justify-between gap-4 p-4 pb-9 sm:gap-6 sm:p-8 md:min-h-[440px] lg:p-9">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-white/25 bg-black/20 px-2.5 py-1 text-[11px] font-semibold text-amber-50 backdrop-blur-sm sm:bg-white/10 sm:px-3 sm:text-sm">
                {t("Book Trusted Pandit Ji")}
              </span>
              <span className="rounded-full border border-amber-100/30 bg-black/20 px-2.5 py-1 text-[11px] font-semibold text-amber-50 backdrop-blur-sm sm:bg-amber-100/15 sm:px-3 sm:text-sm">
                {t("Trusted by 10k+ families")}
              </span>
            </div>

            <div className="max-w-[40rem]">
              <h1 className="font-serif text-[1.7rem] font-semibold leading-[1.1] text-white drop-shadow-md sm:text-[2.9rem] sm:leading-[1.05]">{t("Book Trusted Pandit Ji for every auspicious occasion")}</h1>
              <p className="mt-2 max-w-lg text-[13px] leading-5 text-amber-50 drop-shadow sm:mt-3 sm:text-base sm:leading-6">
                {t("Experience divine blessings with verified pandits, guided booking, and festive puja support.")}
              </p>

              <div className="mt-3 flex flex-wrap gap-2 sm:mt-4 sm:gap-3">
                <Link
                  to="/book"
                  aria-label={t("Book a puja")}
                  title={t("Book a puja")}
                  onClick={clearBookingDraft}
                  className="interactive-button inline-flex min-h-[44px] items-center rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-maroon shadow-sm sm:px-5 sm:py-3"
                >
                  {t("Book a Puja")}
                </Link>
                {profile?.role !== "pandit" && (
                  <Link
                    to="/pandit/register"
                    onClick={handleBecomePandit}
                    aria-label={t("Become a Pandit Ji - register as a pandit")}
                    title={t("Register as a Pandit Ji")}
                    className="interactive-button inline-flex min-h-[44px] items-center rounded-full border border-white/50 bg-black/20 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur-sm hover:bg-white/15 sm:border-white/35 sm:bg-transparent sm:px-5 sm:py-3 sm:backdrop-blur-none"
                  >
                    {t("Become a Pandit Ji")}
                  </Link>
                )}
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
          title={t("Trending Pujas")}
          viewAllLink="/book"
          fetchUrl="/pujas"
          fetchParams={{ listing_type: "trending" }}
          emptyMessage={t("No trending pujas right now.")}
          limit={8}
        />
      </div>

      <div className="relative mt-8 overflow-hidden rounded-[1.8rem] border border-amber-200 bg-parchment-50 px-4 py-8 shadow-card sm:px-6 lg:px-8">
        <PujaSlider
          title={t("Featured Pujas")}
          viewAllLink="/book"
          fetchUrl="/pujas"
          fetchParams={{ listing_type: "featured" }}
          emptyMessage={t("No featured pujas right now.")}
          limit={8}
        />
      </div>

      {/* grid-cols-1 / min-w-0: let these columns shrink to the screen.
          Without them a grid column grows to its content's natural width,
          and the festivals swipe row's natural width is every card side
          by side, which pushed both boxes off the right edge on phones. */}
      <div className="mt-8 grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2">
        <div className="flex h-full min-w-0 flex-col rounded-[1.8rem] border border-amber-200 bg-parchment-50 p-4 shadow-card sm:min-h-[430px] sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-serif text-[1.6rem] font-semibold text-maroon">
              {t("Upcoming Festivals")}
            </h2>
          </div>
          <div className="grid flex-1 auto-rows-fr grid-cols-1 gap-3">
            <Festivals limit={4} />
          </div>
        </div>

        <div className="flex h-full min-h-[430px] min-w-0 flex-col rounded-[1.8rem] border border-amber-200 bg-parchment-50 p-4 shadow-card sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-serif text-[1.6rem] font-semibold text-maroon">
              {t("Popular Pandit Ji")}
            </h2>
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

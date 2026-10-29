import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { withAbortGet } from "../api";
import SelectionCard from "../components/SelectionCard";
import AppInfoStats from "../components/AppInfoStats";
import Loader from "../components/common/Loader";
import StickyActionBar from "../components/common/StickyActionBar";
import Seo from "../components/Seo";
import { getSiteUrl } from "../seo/seoHead";
import { toSnippet } from "../seo/siteConfig";
import { breadcrumbSchema, pujaServiceSchema } from "../seo/structuredData";
import NotFound from "../components/common/NotFound";
import { bookingFallbackImage } from "../constants/visualAssets";
import { saveBookingDraft } from "../utils/bookingFlowStorage";
import { optimizedImage } from "../utils/image";

const tabs = [
  { id: "about", label: "About Puja" },
  { id: "benefits", label: "Benefits" },
];

const TIERS = [
  {
    id: "basic",
    name: "Basic Package",
    description: "Standard puja arrangement performed by a verified pandit, following complete Vedic rituals.",
    feeNote: "No extra fee",
  },
  {
    id: "premium",
    name: "Premium Package",
    description: "Everything in Basic, plus extra samagri and priority scheduling.",
    feeNote: "Fee shown at checkout",
  },
];

export default function PujaDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [puja, setPuja] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeTab, setActiveTab] = useState("about");
  const [selectedTier, setSelectedTier] = useState(TIERS[0].id);
  const actionsRef = useRef(null);

  useEffect(() => {
    const { promise, controller } = withAbortGet(`/pujas/${id}`);

    setLoading(true);
    setNotFound(false);

    promise
      .then((data) => setPuja(data))
      .catch((err) => {
        if (err?.isCanceled || err?.name === "CanceledError") return;
        setNotFound(true);
      })
      .finally(() => setLoading(false));

    return () => {
      try {
        controller.abort();
      } catch (_) {
        /* ignore */
      }
    };
  }, [id]);

  if (loading) {
    return (
      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <Loader variant="card" count={1} />
      </section>
    );
  }

  if (notFound || !puja) {
    return (
      <NotFound
        title="Puja not found"
        message="The puja you are looking for does not exist or is no longer available."
      />
    );
  }

  const benefits = puja.metadata?.benefits || [];
  const image = puja.image_url || puja.thumbnail_url || bookingFallbackImage;
  const isPackagePuja = puja.puja_type === "package";
  // The Pandit Ji chosen later sets the final fee, so this is a "from"
  // price. Package pujas are quoted by the team instead.
  const startingPrice = !isPackagePuja && puja.base_price ? `₹${Number(puja.base_price).toLocaleString("en-IN")}` : null;

  // Search/social tags and structured data for this specific puja.
  const siteUrl = getSiteUrl();
  const pujaPath = `/book/${puja.id}`;
  const summary = toSnippet(puja.description, 120);
  const seoDescription = summary
    ? `${summary.replace(/[\s.,;:!?…-]+$/, "")}. Book a verified Pandit Ji online with MyYajmaan.`
    : `Book ${puja.title} online with a verified Pandit Ji at your home. Choose your date, time and Pandit Ji on MyYajmaan.`;

  function goToBooking() {
    const tier = TIERS.find((t) => t.id === selectedTier);
    const bookingPuja = {
      id: puja.id,
      title: puja.title,
      image,
      pujaType: puja.puja_type || "normal",
      // A package puja's price is admin-quoted later, not tiered --
      // the Basic/Premium upsell only applies to normal pujas.
      ...(isPackagePuja ? {} : { packageName: tier?.name, tier: tier?.id }),
    };

    // Persisted before navigating (not just passed as router state) so
    // the puja survives even when the very next thing that happens is
    // a redirect through /login and back for a logged-out visitor --
    // see RoleRoute's booking-flow login gate.
    saveBookingDraft({ puja: bookingPuja, selectedPuja: puja });

    navigate("/book/datetime", {
      state: {
        puja: bookingPuja,
        selectedPuja: puja,
      },
    });
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <Seo
        title={`${puja.title} Booking Online`}
        description={seoDescription}
        path={pujaPath}
        image={image}
        imageAlt={`${puja.title} puja`}
        jsonLd={[
          pujaServiceSchema(siteUrl, puja, { path: pujaPath, image }),
          breadcrumbSchema(siteUrl, [
            { name: "Home", path: "/" },
            { name: "Pujas", path: "/book" },
            { name: puja.title, path: pujaPath },
          ]),
        ]}
      />
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-slate-500">
        <Link to="/" title="Go to Home" className="hover:text-maroon">
          Home
        </Link>
        <span>›</span>
        <Link to="/book" title="Browse all pujas" className="hover:text-maroon">
          Pujas
        </Link>
        <span>›</span>
        <span className="text-slate-700">{puja.title}</span>
      </div>

      <div className="overflow-hidden rounded-[2rem] border border-amber-100 bg-white shadow-card">
        <div className="grid gap-0 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="bg-gradient-to-br from-maroon via-maroon to-saffron p-6 text-white">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 overflow-hidden rounded-full border border-white/25">
                <img src={optimizedImage("/images/logo-mark.png")} alt="MyYajmaan" className="h-full w-full object-cover" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-100">
                  Puja Details
                </p>
                <h1 className="mt-1 font-serif text-2xl font-semibold">
                  {puja.title}
                </h1>
                {isPackagePuja && (
                  <span className="mt-2 inline-flex items-center rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-100">
                    Package Puja
                  </span>
                )}
                {startingPrice && (
                  <p className="mt-2 text-sm text-amber-100">
                    Starts at <span className="text-lg font-semibold text-white">{startingPrice}</span>
                  </p>
                )}
              </div>
            </div>

            <img
              src={optimizedImage(image)}
              alt={puja.title}
              className="mt-6 h-72 w-full rounded-[1.5rem] object-cover object-center shadow-lg"
            />
          </div>

          <div className="p-6 sm:p-8">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-cream p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Duration
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-800">
                  {puja.duration_minutes ? `${puja.duration_minutes} mins` : "To be confirmed"}
                </p>
              </div>
              <div className="rounded-2xl bg-cream p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Category
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-800">
                  {puja.category || "General"}
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2 border-b border-amber-100 pb-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold ${activeTab === tab.id ? "bg-maroon text-white" : "bg-amber-50 text-slate-700"}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="mt-4 rounded-2xl bg-parchment-50 p-4 text-sm text-slate-700">
              {activeTab === "about" && (
                <p>{puja.description || "Details for this puja will be shared closer to the booking."}</p>
              )}
              {activeTab === "benefits" && (
                benefits.length > 0 ? (
                  <ul className="space-y-2">
                    {benefits.map((item) => (
                      <li key={item}>• {item}</li>
                    ))}
                  </ul>
                ) : (
                  <p>Benefits for this puja have not been added yet.</p>
                )
              )}
            </div>

            {isPackagePuja ? (
              <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-slate-700">
                This is a custom-priced package. There's no payment at this step -- pick your date, address, and
                tell us your requirements, and our team will call you to confirm the details before sharing a
                final quote.
              </div>
            ) : (
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {TIERS.map((tier) => (
                  <SelectionCard
                    key={tier.id}
                    ariaLabel={`Select ${tier.name} for ${puja.title}`}
                    ariaPressed={selectedTier === tier.id}
                    selected={selectedTier === tier.id}
                    onClick={() => setSelectedTier(tier.id)}
                    className="p-4"
                  >
                    <p className="text-lg font-semibold text-maroon">{tier.name}</p>
                    <p className="mt-2 text-sm text-slate-600">{tier.description}</p>
                    <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-saffron">
                      {tier.feeNote}
                    </p>
                    <span
                      className={`mt-4 inline-flex w-full items-center justify-center rounded-full px-4 py-2.5 text-sm font-semibold transition ${selectedTier === tier.id ? "bg-maroon text-white" : "bg-amber-50 text-slate-700 group-hover:bg-maroon group-hover:text-white"}`}
                    >
                      {selectedTier === tier.id ? "Selected" : `Select ${tier.name}`}
                    </span>
                  </SelectionCard>
                ))}
              </div>
            )}

            <div ref={actionsRef} className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={goToBooking}
                className="min-h-[44px] rounded-full bg-saffron px-5 py-2.5 font-semibold text-white"
              >
                {isPackagePuja ? "Continue request" : "Continue booking"}
              </button>
              <Link
                to="/book"
                className="rounded-full border border-amber-200 bg-white px-5 py-2.5 font-semibold text-slate-700"
              >
                Back to browse
              </Link>
            </div>
          </div>
        </div>
      </div>

      <AppInfoStats />

      <StickyActionBar targetRef={actionsRef}>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-maroon">{puja.title}</p>
          <p className="text-xs text-slate-500">
            {startingPrice ? <>Starts at <span className="font-semibold text-slate-800">{startingPrice}</span></> : isPackagePuja ? "Custom quote" : null}
          </p>
        </div>
        <button
          type="button"
          onClick={goToBooking}
          className="min-h-[44px] shrink-0 rounded-full bg-saffron px-5 text-sm font-semibold text-white"
        >
          {isPackagePuja ? "Continue request" : "Continue booking"}
        </button>
      </StickyActionBar>
    </section>
  );
}

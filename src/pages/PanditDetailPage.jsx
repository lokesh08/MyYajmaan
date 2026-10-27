import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { withAbortGet } from "../api";
import PujaSlider from "../components/PujaSlider";
import AppInfoStats from "../components/AppInfoStats";
import Loader from "../components/common/Loader";
import Seo from "../components/Seo";
import { getSiteUrl } from "../seo/seoHead";
import { toSnippet } from "../seo/siteConfig";
import { breadcrumbSchema, panditSchema } from "../seo/structuredData";
import NotFound from "../components/common/NotFound";
import { panditPlaceholderImage } from "../constants/visualAssets";
import { optimizedImage } from "../utils/image";

export default function PanditDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [pandit, setPandit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const { promise, controller } = withAbortGet(`/pandits/${id}`);

    setLoading(true);
    setNotFound(false);

    promise
      .then((data) => setPandit(data))
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
      <section className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <Loader variant="card" count={1} />
      </section>
    );
  }

  if (notFound || !pandit) {
    return (
      <NotFound
        title="Pandit not found"
        message="The pandit profile you are looking for does not exist or is no longer available."
      />
    );
  }

  const name = pandit.display_name || pandit.name || "Pandit Ji";
  const image = pandit.avatar_url || pandit.image || panditPlaceholderImage;
  const languages = pandit.languages_spoken?.length ? pandit.languages_spoken : pandit.languages;
  const specialities = pandit.specialities || [];

  // Search/social tags and structured data for this Pandit Ji's public profile.
  const siteUrl = getSiteUrl();
  const panditPath = `/pandit/${pandit.id}`;
  const experience = Number(pandit.experience_years);
  const about = toSnippet(pandit.about || pandit.bio, 130);
  // A very short bio makes a thin snippet, so it gets a helpful second sentence.
  const seoDescription = about
    ? about.length >= 70
      ? about
      : `${about.replace(/[\s.,;:!?…-]+$/, "")}. Book a puja with ${name} on MyYajmaan.`
    : `${name} is a verified Pandit Ji${pandit.city ? ` serving ${pandit.city}` : ""}${
        experience > 0 ? ` with ${experience} years of experience` : ""
      }. View services and book a puja online on MyYajmaan.`;

  return (
    <section className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <Seo
        title={`${name} – Pandit Ji${pandit.city ? ` in ${pandit.city}` : ""}`}
        description={seoDescription}
        path={panditPath}
        image={image}
        imageAlt={`${name}, Pandit Ji`}
        type="profile"
        jsonLd={[
          panditSchema(siteUrl, pandit, { path: panditPath, image }),
          breadcrumbSchema(siteUrl, [
            { name: "Home", path: "/" },
            { name, path: panditPath },
          ]),
        ]}
      />
      <div className="overflow-hidden rounded-[2rem] border border-amber-100 bg-white shadow-card">
        <div className="grid gap-0 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="bg-gradient-to-br from-maroon via-maroon to-saffron p-6 text-white">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 overflow-hidden rounded-full border border-white/25">
                <img src={optimizedImage("/images/logo-mark.png")} alt="MyYajmaan" className="h-full w-full object-cover" />
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-100">
                  Pandit Profile
                </p>

                <h1 className="mt-1 font-serif text-2xl font-semibold">
                  {name}
                </h1>
              </div>
            </div>

            <img
              src={optimizedImage(image)}
              alt={name}
              className="mt-6 h-72 w-full rounded-[1.5rem] object-cover object-center shadow-lg"
              onError={(event) => {
                event.currentTarget.onerror = null;
                event.currentTarget.src = panditPlaceholderImage;
              }}
            />
          </div>

          <div className="p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-saffron">
                  {pandit.rating_avg ? `${pandit.rating_avg} ★ rated` : "New on MyYajmaan"}
                </p>

                {pandit.city && (
                  <p className="text-sm text-slate-500">{pandit.city}</p>
                )}
              </div>

              {pandit.starting_price ? (
                <div className="rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 px-4 py-2 text-right ring-1 ring-amber-200/70">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Starts from</p>
                  <p className="font-serif text-xl font-bold text-maroon">₹{pandit.starting_price}</p>
                </div>
              ) : null}
            </div>

            {/* Quick-glance trust strip -- no personal contact/address
                is ever shown here, only what admin has verified. */}
            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { icon: "✅", label: "Admin Verified" },
                { icon: "🪪", label: pandit.aadhar_verification_status === "verified" ? "Aadhaar Checked" : "Identity On File" },
                { icon: "🕉️", label: pandit.experience_years ? `${pandit.experience_years}+ yrs Exp.` : "Vedic Rituals" },
                { icon: "⭐", label: pandit.rating_avg ? `${pandit.rating_avg} Rating` : "New Pandit Ji" },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-amber-100 bg-cream/60 px-2 py-2.5 text-center">
                  <p className="text-lg leading-none">{item.icon}</p>
                  <p className="mt-1 text-[11px] font-semibold text-slate-600">{item.label}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {languages?.length > 0 && (
                <div className="rounded-2xl bg-cream p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                    Languages
                  </p>

                  <p className="mt-2 font-medium text-slate-800">
                    {languages.join(" • ")}
                  </p>
                </div>
              )}

              <div className="rounded-2xl bg-cream p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Experience
                </p>

                <p className="mt-2 font-medium text-slate-800">
                  {pandit.experience_years ? `${pandit.experience_years} years` : "-"}
                </p>
              </div>

              {specialities.length > 0 && (
                <div className="rounded-2xl bg-cream p-4 sm:col-span-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                    Specialities
                  </p>

                  <p className="mt-2 font-medium text-slate-800">
                    {specialities.join(" • ")}
                  </p>
                </div>
              )}

              {pandit.about || pandit.bio ? (
                <div className="rounded-2xl bg-cream p-4 sm:col-span-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                    About
                  </p>

                  <p className="mt-2 font-medium text-slate-800">
                    {pandit.about || pandit.bio}
                  </p>
                </div>
              ) : null}
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                aria-label={`Select ${name} for your puja booking`}
                onClick={() =>
                  navigate("/book/datetime", {
                    state: { selectedPandit: pandit },
                  })
                }
                className="rounded-full bg-maroon px-5 py-2.5 font-semibold text-white shadow-sm"
              >
                Select this pandit
              </button>

              <Link
                to="/"
                title="Back to Home"
                className="rounded-full border border-amber-200 bg-white px-5 py-2.5 font-semibold text-slate-700"
              >
                Back to Home
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <PujaSlider
          title={`Pujas by ${name}`}
          fetchUrl={`/pandits/${id}/pujas`}
          emptyMessage="This Pandit Ji hasn't been assigned any pujas yet."
          selectedPandit={pandit}
          limit={8}
        />
      </div>

      <AppInfoStats />
    </section>
  );
}

import React, { useEffect, useState, useRef } from "react";
import PanditList from "../components/PanditList";
import PanditMap from "../components/PanditMap";
import ErrorBoundary from "../components/ErrorBoundary";
import "./BrowsePanditsMap.css";
import { withAbortGet } from "../api";
import { optimizedImage } from "../utils/image";
import { t } from "../i18n";

// Only fields a customer needs to pick a nearby Pandit Ji — no phone,
// email, bank, or other contact/personal detail is ever included, on
// the frontend or in the /pandits API response it reads from.
function normalizePandit(rec) {
  return {
    id: rec.id,
    name: rec.display_name || rec.name || "Pandit Ji",
    rating: rec.rating_avg ?? rec.rating ?? null,
    price: rec.price ?? null,
    avatar: rec.image || rec.avatar_url || optimizedImage("/images/panditPlaceholder.png"),
    address: [rec.address, rec.city].filter(Boolean).join(", "),
    lat: rec.latitude != null ? Number(rec.latitude) : null,
    lng: rec.longitude != null ? Number(rec.longitude) : null,
  };
}

export default function BrowsePanditsMap() {
  const [userLoc, setUserLoc] = useState(null); // {lat, lng}
  const [pandits, setPandits] = useState([]);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [showListMobile, setShowListMobile] = useState(true);
  const [loadingPandits, setLoadingPandits] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // keep controller ref so we can abort if needed (or on unmount)
  const panditsControllerRef = useRef(null);

  useEffect(() => {
    // User's real-time coordinates drive "based on user location" —
    // browser geolocation first, falling back to a city-center default
    // (New Delhi) only when it's denied/unavailable, purely so the map
    // has somewhere sensible to center itself.
    let geoMounted = true;
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (!geoMounted) return;
          setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        () => {
          if (!geoMounted) return;
          setUserLoc({ lat: 28.6139, lng: 77.2090 }); // fallback New Delhi
        }
      );
    } else {
      setUserLoc({ lat: 28.6139, lng: 77.2090 });
    }

    return () => {
      geoMounted = false;
    };
  }, []);

  useEffect(() => {
    // Fetch real, approved-and-active pandits via api.withAbortGet
    // (cancellable). The /pandits endpoint never returns phone/email —
    // see PanditOut in models.py — so there's nothing to strip here.
    setLoadingPandits(true);
    setLoadError(false);
    const { promise, controller } = withAbortGet("/pandits?limit=200");
    panditsControllerRef.current = controller;

    promise
      .then((data) => {
        const list = Array.isArray(data) ? data : data?.items || [];
        setPandits(list.map(normalizePandit));
        setLoadingPandits(false);
      })
      .catch((err) => {
        // If request was canceled, ignore
        if (err?.name === "CanceledError" || err?.isCanceled) {
          return;
        }

        console.error("Failed to load pandits", err);
        setPandits([]);
        setLoadError(true);
        setLoadingPandits(false);
      });

    return () => {
      try {
        panditsControllerRef.current?.abort();
      } catch (e) {
        /* ignore */
      }
      panditsControllerRef.current = null;
    };
  }, []);

  const toggleList = () => setShowListMobile((prev) => !prev);

  return (
    <div className="browse-pandits-root">
      <div className="browse-header">
        <input
          className="search"
          placeholder={t("Search by name or location")}
          aria-label={t("Search pandit by name or location")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button
          className="mobile-toggle header-toggle"
          onClick={toggleList}
          aria-expanded={showListMobile}
          aria-controls="pandit-list"
        >
          {showListMobile ? t("Hide list") : t("Show list")}
        </button>
      </div>

      {loadError && (
        <div className="load-error-banner" role="alert">
          {t("Couldn't load Pandit Ji listings right now. Please refresh the page.")}
        </div>
      )}

      <div className={`browse-body ${showListMobile ? "list-visible" : "list-hidden"}`}>
        <aside id="pandit-list" className="pane list-pane" aria-label={t("Pandit list")}>
          <PanditList
            pandits={pandits}
            userLoc={userLoc}
            query={query}
            selectedId={selectedId}
            onSelect={(id) => setSelectedId(id)}
            loading={loadingPandits}
          />
        </aside>

        <main className="pane map-pane" aria-label={t("Map showing pandits")}>
          {/* Floating toggle sits on top of the map on mobile for quick access */}
          <button
            className="floating-toggle"
            onClick={toggleList}
            aria-expanded={showListMobile}
            aria-controls="pandit-list"
          >
            {showListMobile ? t("Hide list") : t("Show list")}
          </button>

          <ErrorBoundary message={t("Couldn't display the map. Please try again.")}>
            <PanditMap
              pandits={pandits}
              userLoc={userLoc}
              selectedId={selectedId}
              onMarkerClick={(id) => setSelectedId(id)}
            />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
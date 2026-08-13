import React, { useEffect, useState, useRef } from "react";
import PanditList from "../components/PanditList";
import PanditMap from "../components/PanditMap";
import "./BrowsePanditsMap.css";
import { panditPortraits } from "../constants/visualAssets";
import { withAbortGet } from "../api";

export default function BrowsePanditsMap() {
  const [userLoc, setUserLoc] = useState(null); // {lat, lng}
  const [pandits, setPandits] = useState([]);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [showListMobile, setShowListMobile] = useState(true);
  const [loadingPandits, setLoadingPandits] = useState(true);

  // keep controller ref so we can abort if needed (or on unmount)
  const panditsControllerRef = useRef(null);

  useEffect(() => {
    // Get user location with fallback
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
    // Fetch pandits via api.withAbortGet (cancellable)
    setLoadingPandits(true);
    const { promise, controller } = withAbortGet("/pandits");
    panditsControllerRef.current = controller;

    promise
      .then((data) => {
        // Expecting data to be an array or object — preserve previous behavior
        setPandits(data);
        setLoadingPandits(false);
      })
      .catch((err) => {
        // If request was canceled, ignore
        if (err?.name === "CanceledError" || err?.isCanceled) {
          return;
        }

        console.error("Failed to load pandits, falling back to sample data", err);

        // fallback sample data
        setPandits([
          {
            id: 1,
            name: "Pandit Rajesh Sharma",
            rating: 4.8,
            lat: 28.65,
            lng: 77.2,
            avatar: panditPortraits[0],
            address: "Kashmere Gate, Delhi",
            price: "₹2,100",
          },
          {
            id: 2,
            name: "Pandit Vivek Mishra",
            rating: 4.6,
            lat: 28.62,
            lng: 77.25,
            avatar: panditPortraits[1],
            address: "Connaught Place, Delhi",
            price: "₹1,800",
          },
          {
            id: 3,
            name: "Pandit Dinesh Pathak",
            rating: 4.2,
            lat: 28.6,
            lng: 77.21,
            avatar: panditPortraits[2],
            address: "Karol Bagh, Delhi",
            price: "₹1,600",
          },
        ]);
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
          placeholder="Search by name or location"
          aria-label="Search pandit by name or location"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button
          className="mobile-toggle header-toggle"
          onClick={toggleList}
          aria-expanded={showListMobile}
          aria-controls="pandit-list"
        >
          {showListMobile ? "Hide list" : "Show list"}
        </button>
      </div>

      <div className={`browse-body ${showListMobile ? "list-visible" : "list-hidden"}`}>
        <aside id="pandit-list" className="pane list-pane" aria-label="Pandit list">
          <PanditList
            pandits={pandits}
            userLoc={userLoc}
            query={query}
            selectedId={selectedId}
            onSelect={(id) => setSelectedId(id)}
            loading={loadingPandits}
          />
        </aside>

        <main className="pane map-pane" aria-label="Map showing pandits">
          {/* Floating toggle sits on top of the map on mobile for quick access */}
          <button
            className="floating-toggle"
            onClick={toggleList}
            aria-expanded={showListMobile}
            aria-controls="pandit-list"
          >
            {showListMobile ? "Hide list" : "Show list"}
          </button>

          <PanditMap
            pandits={pandits}
            userLoc={userLoc}
            selectedId={selectedId}
            onMarkerClick={(id) => setSelectedId(id)}
          />
        </main>
      </div>
    </div>
  );
}
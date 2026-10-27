import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Import marker images (works with CRA/Vite/webpack)
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
});

function hasValidCoords(point) {
  return (
    point &&
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lng)
  );
}

function MapController({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    // A selected Pandit Ji with no lat/lng on file (onboarding hasn't
    // captured coordinates for them yet) must never reach Leaflet's
    // setView — it crashes deep inside its animated-zoom projection
    // math instead of failing gracefully. Skip the recenter for them;
    // they're still visible and selectable in the list, just not
    // pinned on the map.
    if (hasValidCoords(center)) {
      map.setView([center.lat, center.lng], zoom || 13, { animate: true });
    }
  }, [center, zoom, map]);
  return null;
}

function formatPrice(price) {
  if (price === null || price === undefined || price === '') return null;
  const num = Number(price);
  return Number.isNaN(num) ? null : `₹${num.toLocaleString('en-IN')}`;
}

export default function PanditMap({ pandits, userLoc, selectedId, onMarkerClick }) {
  const selected = pandits?.find(p => p.id === selectedId);
  const defaultCenter = userLoc || { lat: 28.6139, lng: 77.2090 };

  const visiblePandits = (pandits || []).filter(hasValidCoords);

  return (
    <MapContainer center={[defaultCenter.lat, defaultCenter.lng]} zoom={12} style={{ height: '100%', width: '100%' }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {userLoc && (
        <Marker position={[userLoc.lat, userLoc.lng]}>
          <Popup>You are here</Popup>
        </Marker>
      )}

      {visiblePandits.map(p => (
        <Marker
          key={p.id}
          position={[p.lat, p.lng]}
          eventHandlers={{ click: () => onMarkerClick(p.id) }}
        >
          <Popup>
            <div>
              <strong>{p.name}</strong><br/>
              {p.rating ? <>⭐ {Number(p.rating).toFixed(1)}<br/></> : null}
              {p.address && <>{p.address}<br/></>}
              {formatPrice(p.price)}
            </div>
          </Popup>
        </Marker>
      ))}

      {selected && <MapController center={{ lat: selected.lat, lng: selected.lng }} zoom={15} />}
    </MapContainer>
  );
}
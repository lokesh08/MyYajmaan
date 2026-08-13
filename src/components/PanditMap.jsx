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

function MapController({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView([center.lat, center.lng], zoom || 13, { animate: true });
    }
  }, [center, zoom, map]);
  return null;
}

export default function PanditMap({ pandits, userLoc, selectedId, onMarkerClick }) {
  const selected = pandits?.find(p => p.id === selectedId);
  const defaultCenter = userLoc || { lat: 28.6139, lng: 77.2090 };

  const visiblePandits = (pandits || []).filter(p => p.lat && p.lng);

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
              ⭐ {p.rating?.toFixed(1)}<br/>
              {p.address}<br/>
              {p.price}
            </div>
          </Popup>
        </Marker>
      ))}

      {selected && <MapController center={{ lat: selected.lat, lng: selected.lng }} zoom={15} />}
    </MapContainer>
  );
}
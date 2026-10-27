import React, { useMemo } from 'react';
import { haversineDistance } from '../utils/geo';
import { panditPlaceholderImage } from '../constants/visualAssets';
import { optimizedImage } from "../utils/image";

function formatPrice(price) {
  if (price === null || price === undefined || price === '') return null;
  const num = Number(price);
  return Number.isNaN(num) ? null : `Starts from ₹${num.toLocaleString('en-IN')}`;
}

export default function PanditList({ pandits, userLoc, query, selectedId, onSelect, loading }) {
  const filtered = useMemo(() => {
    if (!pandits) return [];
    return pandits
      .map(p => {
        const dist = (userLoc && p.lat && p.lng) ? haversineDistance(userLoc.lat, userLoc.lng, p.lat, p.lng) : Infinity;
        return { ...p, distanceKm: dist };
      })
      .filter(p =>
         (!query || p.name.toLowerCase().includes(query.toLowerCase()) || (p.address && p.address.toLowerCase().includes(query.toLowerCase())))
      )
      .sort((a,b) => a.distanceKm - b.distanceKm);
  }, [pandits, userLoc, query]);

  if (loading) {
    return <div className="pandit-list">Loading nearby Pandit Ji...</div>;
  }

  return (
    <div className="pandit-list" role="list">
      {filtered.length === 0 && (
        <div className="no-results">No Pandit Ji found nearby yet.</div>
      )}

      {filtered.map(p => {
        const price = formatPrice(p.starting_price);
        return (
          <div
            key={p.id}
            role="listitem"
            className={`pandit-item ${selectedId === p.id ? 'selected' : ''}`}
            onClick={() => onSelect(p.id)}
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter') onSelect(p.id); }}
          >
            <img loading="lazy" decoding="async"
              className="avatar"
              src={optimizedImage(p.avatar || panditPlaceholderImage)}
              alt={p.name}
              onError={(event) => {
                event.currentTarget.onerror = null;
                event.currentTarget.src = panditPlaceholderImage;
              }}
            />
            <div className="info">
              <div className="name">{p.name}</div>
              <div className="meta">
                <span className="rating" aria-label={`Rating ${p.rating || 'not available'}`}>⭐ {p.rating ? Number(p.rating).toFixed(1) : '-'}</span>
                <span className="distance">{p.distanceKm !== Infinity ? `${p.distanceKm.toFixed(1)} km away` : ''}</span>
              </div>
              {p.address && <div className="address">{p.address}</div>}
              {price && <div className="price">{price}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
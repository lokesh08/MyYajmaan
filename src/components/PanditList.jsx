import React, { useMemo } from 'react';
import { haversineDistance } from '../utils/geo';

export default function PanditList({ pandits, userLoc, query, selectedId, onSelect }) {
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

  if (!pandits) {
    return <div className="pandit-list">Loading...</div>;
  }

  return (
    <div className="pandit-list" role="list">
      {filtered.length === 0 && (
        <div className="no-results">No pandit found.</div>
      )}

      {filtered.map(p => (
        <div
          key={p.id}
          role="listitem"
          className={`pandit-item ${selectedId === p.id ? 'selected' : ''}`}
          onClick={() => onSelect(p.id)}
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter') onSelect(p.id); }}
        >
          <img className="avatar" src={p.avatar || '/default-avatar.png'} alt={p.name} />
          <div className="info">
            <div className="name">{p.name}</div>
            <div className="meta">
              <span className="rating" aria-label={`Rating ${p.rating || 'not available'}`}>⭐ {p.rating?.toFixed(1) || '-'}</span>
              <span className="distance">{p.distanceKm !== Infinity ? `${p.distanceKm.toFixed(1)} km` : ''}</span>
            </div>
            <div className="price">{p.price}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
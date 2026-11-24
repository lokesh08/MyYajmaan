import { useEffect, useState } from "react";

import { get } from "../api";

// Festival this puja belongs to (pujas.festival_name) plus the upcoming
// festival calendar -- what the festival date check needs. Uses the
// puja's own festival_name when the caller already has it. Failures just
// mean "no check" (booking must never be blocked by this).
export default function useFestivalDates(pujaId, knownFestivalName) {
  const [festivalName, setFestivalName] = useState(knownFestivalName || null);
  const [festivals, setFestivals] = useState([]);

  useEffect(() => {
    let active = true;
    if (!pujaId) return undefined;

    const nameRequest = knownFestivalName
      ? Promise.resolve(knownFestivalName)
      : get(`/pujas/${pujaId}`).then((puja) => puja?.festival_name || null).catch(() => null);

    nameRequest.then((name) => {
      if (!active) return;
      setFestivalName(name);
      if (!name) return;
      get("/festivals", { params: { limit: 100 } })
        .then((rows) => active && setFestivals(Array.isArray(rows) ? rows : []))
        .catch(() => {});
    });

    return () => {
      active = false;
    };
  }, [pujaId, knownFestivalName]);

  return { festivalName, festivals };
}

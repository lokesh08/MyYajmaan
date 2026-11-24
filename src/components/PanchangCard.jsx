import { useEffect, useMemo, useState } from "react";

import { get } from "../api";
import { useAuth } from "../context/AuthContext";
import { getLanguage, t } from "../i18n";
import { listMyAddresses } from "../services/clientApi";
import {
  DEFAULT_PANCHANG_CITY,
  PANCHANG_CITY_KEY,
  chooseInitialCity,
  endsNextDay,
  formatPanchangSpan,
  formatPanchangTime,
  isNowIn,
  pickChoghadiya,
} from "../utils/panchangView";

// Home page "Today's Panchang": tithi, nakshatra, yoga, sunrise/sunset
// and the day's key muhurtas for the visitor's city, calculated by our
// API (GET /panchang, see myyajmaan-api/panchang.py).

function readStoredCity() {
  try {
    return localStorage.getItem(PANCHANG_CITY_KEY);
  } catch {
    return null;
  }
}

function storeCity(city) {
  try {
    localStorage.setItem(PANCHANG_CITY_KEY, city);
  } catch {
    /* storage blocked -- choice lasts for this visit */
  }
}

function Tile({ icon, label, value, sub, highlight = false }) {
  return (
    <div className={`flex flex-col items-center justify-center rounded-2xl border px-2 py-3 text-center shadow-sm ${highlight ? "border-amber-300 bg-gradient-to-b from-amber-50 to-white" : "border-amber-100 bg-white"}`}>
      <span aria-hidden="true" className="text-2xl leading-none">{icon}</span>
      <span className="mt-1.5 text-xs font-semibold text-saffron">{label}</span>
      <span className="mt-0.5 font-serif text-base font-semibold leading-tight text-maroon sm:text-lg">{value}</span>
      {sub && <span className="mt-0.5 text-[11px] leading-tight text-slate-500">{sub}</span>}
    </div>
  );
}

function TimingTile({ icon, title, value, note, badge, tone = "good" }) {
  const ring = tone === "bad" ? "border-rose-100" : "border-amber-100";
  return (
    <div className={`flex items-center gap-3 rounded-2xl border bg-white px-4 py-3 shadow-sm ${ring}`}>
      <span aria-hidden="true" className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl ${tone === "bad" ? "bg-rose-50" : "bg-amber-50"}`}>{icon}</span>
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-maroon">
          {title}
          {badge && <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${tone === "bad" ? "bg-rose-600 text-white" : "bg-emerald-600 text-white"}`}>{badge}</span>}
        </span>
        <span className="block text-base font-semibold text-slate-800">{value}</span>
        {note && <span className="block text-xs text-slate-500">{note}</span>}
      </span>
    </div>
  );
}

export default function PanchangCard() {
  const { profile } = useAuth();
  const [cities, setCities] = useState([]);
  const [city, setCity] = useState(() => readStoredCity() || DEFAULT_PANCHANG_CITY);
  const [userChose, setUserChose] = useState(() => Boolean(readStoredCity()));
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // Clock for "now" badges; once a minute is plenty.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    get("/cities")
      .then((rows) => setCities(Array.isArray(rows) ? rows : []))
      .catch(() => setCities([]));
  }, []);

  // A logged-in customer's default address city, unless they picked one here.
  useEffect(() => {
    if (userChose || profile?.role !== "user") return;
    listMyAddresses()
      .then((resp) => {
        const items = resp?.items || [];
        const address = items.find((a) => a.is_default) || items[0];
        const names = cities.length ? cities.map((c) => c.name) : undefined;
        setCity(chooseInitialCity({ stored: null, addressCity: address?.city, known: names }));
      })
      .catch(() => {});
  }, [profile?.role, userChose, cities]);

  useEffect(() => {
    let active = true;
    setFailed(false);
    get("/panchang", { params: { city } })
      .then((result) => active && setData(result))
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [city]);

  const cityOptions = useMemo(() => {
    const names = cities.map((c) => ({ name: c.name, state: c.state }));
    if (city && !names.some((c) => c.name.toLowerCase() === city.toLowerCase())) names.unshift({ name: city, state: data?.city?.state || "" });
    return names;
  }, [cities, city, data?.city?.state]);

  function chooseCity(next) {
    setCity(next);
    setUserChose(true);
    storeCity(next);
  }

  if (failed && !data) return null; // Panchang is extra; never break the home page

  const locale = getLanguage() === "hi" ? "hi-IN" : "en-IN";
  const day = data ? new Date(`${data.date}T00:00:00`) : null;
  const until = (iso) => (iso ? t(endsNextDay(iso, data.date) ? "till {time} (next day)" : "till {time}", { time: formatPanchangTime(iso) }) : "");
  const rahu = data?.muhurta?.rahu_kaal;
  // Skip Choghadiyas that clash with Rahu Kaal / Yamaganda (e.g. Tuesday's
  // Shubh falls exactly in Rahu Kaal); after sunset, the night ones.
  const choghadiya = data
    ? pickChoghadiya([...(data.choghadiya?.day || []), ...(data.choghadiya?.night || [])], now, [rahu, data.muhurta?.yamaganda])
    : null;
  const abhijit = data?.muhurta?.abhijit;

  return (
    <section aria-labelledby="panchang-title" className="relative mt-6 overflow-hidden rounded-[1.8rem] border-2 border-amber-300 bg-gradient-to-br from-parchment-50 via-white to-amber-50 p-4 shadow-card sm:p-6">
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-saffron/10 blur-3xl" />

      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-saffron to-marigold text-2xl text-white shadow-md">
            🗓️
          </span>
          <div>
            <h2 id="panchang-title" className="flex flex-wrap items-center gap-2 font-serif text-xl font-semibold text-maroon sm:text-2xl">
              {t("Today's Panchang")}
              <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 font-sans text-[11px] font-bold uppercase text-rose-600">
                {t("Live")}
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-600" />
                </span>
              </span>
            </h2>
            <p className="text-sm text-slate-500">{t("Today's Hindu Calendar & Auspicious Timings")}</p>
          </div>
        </div>

        <label className="flex items-center gap-1.5 rounded-full border border-maroon/30 bg-white px-3 py-1.5 shadow-sm">
          <span aria-hidden="true">📍</span>
          <span className="sr-only">{t("City")}</span>
          <select
            value={city}
            onChange={(e) => chooseCity(e.target.value)}
            className="max-w-[12rem] cursor-pointer bg-transparent text-sm font-semibold text-maroon outline-none"
          >
            {cityOptions.map((c) => (
              <option key={`${c.name}-${c.state}`} value={c.name}>
                {c.state ? `${c.name}, ${c.state}` : c.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!data ? (
        <div className="relative mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6" aria-busy="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-amber-100/60" />
          ))}
        </div>
      ) : (
        <>
          <div className="relative mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Tile
              icon="📅"
              label={t(data.weekday)}
              value={day.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" })}
              highlight
            />
            <Tile icon="🌙" label={t("Tithi")} value={t(data.tithi.name)} sub={`${t(`${data.tithi.paksha} Paksha`)} · ${until(data.tithi.ends_at)}`} />
            <Tile icon="✨" label={t("Nakshatra")} value={t(data.nakshatra.name)} sub={until(data.nakshatra.ends_at)} />
            <Tile icon="🪷" label={t("Yoga")} value={t(data.yoga.name)} sub={until(data.yoga.ends_at)} />
            <Tile icon="🌅" label={t("Sunrise")} value={formatPanchangTime(data.sunrise)} />
            <Tile icon="🌇" label={t("Sunset")} value={formatPanchangTime(data.sunset)} />
          </div>

          <div className="relative my-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-gradient-to-r from-transparent to-amber-300" />
            <h3 className="text-center font-serif text-lg font-semibold text-maroon">{t("Today's Auspicious Timings (Muhurta)")}</h3>
            <span className="h-px flex-1 bg-gradient-to-l from-transparent to-amber-300" />
          </div>

          <div className="relative grid gap-3 md:grid-cols-3">
            <TimingTile
              icon="⭐"
              title={t("Abhijit Muhurta")}
              value={formatPanchangSpan(abhijit)}
              note={abhijit?.applicable === false ? t("Not observed on Wednesdays") : null}
              badge={abhijit?.applicable !== false && isNowIn(abhijit, now) ? t("Now") : null}
            />
            {choghadiya && (
              <TimingTile
                icon="🕉️"
                title={t("{name} Choghadiya", { name: t(choghadiya.name) })}
                value={formatPanchangSpan(choghadiya)}
                badge={choghadiya.isNow ? t("Now") : null}
              />
            )}
            <TimingTile
              icon="⚠️"
              title={t("Rahu Kaal")}
              value={formatPanchangSpan(rahu)}
              note={t("Avoid starting new work")}
              badge={isNowIn(rahu, now) ? t("Now") : null}
              tone="bad"
            />
          </div>

          <p className="relative mt-4 text-center text-[11px] text-slate-400">
            {t("For {city} · Lahiri ayanamsa · times in IST", { city: data.city?.name || city })}
          </p>
        </>
      )}
    </section>
  );
}

import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { PanditCard } from "../components/Pandits";
import { Loader } from "../components/common";
import { browsePandits, getMyDefaultPincode } from "../services/pandits";
import { t } from "../i18n";

const PAGE_SIZE = 12;
const SEARCH_DEBOUNCE_MS = 400;
const SORT_OPTIONS = [
  { value: "recommended", label: "Recommended" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
];

const inputClass =
  "w-full rounded-full border border-amber-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm transition focus:border-maroon focus:outline-none";

// Page numbers around the current one, with "…" gaps: 1 … 4 5 6 … 12
function pageWindow(current, total) {
  const pages = new Set([1, total, current - 1, current, current + 1]);
  const sorted = [...pages].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const out = [];
  sorted.forEach((n, i) => {
    if (i > 0 && n - sorted[i - 1] > 1) out.push(`gap-${n}`);
    out.push(n);
  });
  return out;
}

const isCanceled = (err) => err?.isCanceled || err?.name === "CanceledError";

/**
 * "Find Pandit Ji" -- every approved Pandit Ji, paged from the server,
 * filterable by name and PIN code and sortable by starting price.
 *
 * Filters live in the URL (?q=&pin=&sort=&page=) so Back from a Pandit
 * Ji's page lands on the same results. A logged-in visitor arriving
 * without a ?pin= gets their default address's PIN pre-filled; clearing
 * it leaves an empty ?pin= behind so it isn't pre-filled again.
 */
export default function PanditsListPage() {
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const name = searchParams.get("q") || "";
  const pincode = searchParams.get("pin") || "";
  const sort = searchParams.get("sort") || "recommended";
  const page = Math.max(1, Number.parseInt(searchParams.get("page"), 10) || 1);

  // Typed text, pushed to the URL after a pause.
  const [nameInput, setNameInput] = useState(name);
  const [pinInput, setPinInput] = useState(pincode);

  const [defaultPincode, setDefaultPincode] = useState(null);
  const [resolvingDefault, setResolvingDefault] = useState(!searchParams.has("pin"));

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  function updateParams(changes, { resetPage = true } = {}) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        Object.entries(changes).forEach(([key, value]) => {
          // pin is kept even when empty -- see the component comment.
          if (value || (key === "pin" && value === "")) next.set(key, value);
          else next.delete(key);
        });
        if (resetPage) next.delete("page");
        return next;
      },
      { replace: true },
    );
  }

  // Pre-fill the logged-in visitor's PIN code, once.
  useEffect(() => {
    if (!resolvingDefault || authLoading) return undefined;
    if (!isAuthenticated) {
      setResolvingDefault(false);
      return undefined;
    }
    const controller = new AbortController();
    getMyDefaultPincode({ signal: controller.signal })
      .then((data) => {
        const pin = (data?.pincode || "").trim();
        setDefaultPincode(pin || null);
        if (pin) {
          setPinInput(pin);
          updateParams({ pin });
        }
      })
      .catch((err) => {
        if (isCanceled(err)) return;
        // No default PIN is fine -- just show everyone.
        console.warn("Default PIN code lookup failed:", err);
      })
      // An aborted run (unmount, StrictMode's double effect) must leave
      // the flag alone so the run that replaces it can still apply.
      .finally(() => {
        if (!controller.signal.aborted) setResolvingDefault(false);
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvingDefault, authLoading, isAuthenticated]);

  // Debounce the text boxes into the URL.
  useEffect(() => {
    if (nameInput.trim() === name) return undefined;
    const timer = setTimeout(() => updateParams({ q: nameInput.trim() }), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nameInput]);

  useEffect(() => {
    if (resolvingDefault || pinInput === pincode) return undefined;
    const timer = setTimeout(() => updateParams({ pin: pinInput }), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinInput]);

  // Keep the boxes in step when the URL changes underneath them (Back).
  useEffect(() => setNameInput((current) => (current.trim() === name ? current : name)), [name]);
  useEffect(() => setPinInput(pincode), [pincode]);

  useEffect(() => {
    if (resolvingDefault) return undefined;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    browsePandits({ page, pageSize: PAGE_SIZE, name, pincode, sort }, { signal: controller.signal })
      .then((data) => {
        setItems(Array.isArray(data?.items) ? data.items : []);
        setTotal(Number(data?.total) || 0);
      })
      .catch((err) => {
        if (isCanceled(err)) return;
        console.error("Pandit Ji list load error:", err);
        setError(err?.message || t("Failed to load pandits"));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [page, name, pincode, sort, resolvingDefault]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // A page past the end (filters narrowed, or an old link): go to the last one.
  useEffect(() => {
    if (!loading && total > 0 && page > totalPages) {
      updateParams({ page: String(totalPages) }, { resetPage: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, total, page, totalPages]);

  function goToPage(next) {
    updateParams({ page: next > 1 ? String(next) : "" }, { resetPage: false });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function clearFilters() {
    setNameInput("");
    setPinInput("");
    updateParams({ q: "", pin: "", sort: "" });
  }

  function showAllPincodes() {
    setPinInput("");
    updateParams({ pin: "" });
  }

  const handleView = (pandit) => navigate(`/pandit/${pandit.id}`);
  // Same as the home page: booking starts from the Pandit Ji's puja list.
  const handleSelect = (pandit) => navigate(`/pandit/${pandit.id}`, { state: { scrollToPujas: true } });

  const hasFilters = Boolean(name || pincode || sort !== "recommended");
  const showingDefaultPin = Boolean(defaultPincode && pincode === defaultPincode);

  return (
    <section className="mx-auto max-w-[1320px] px-4 py-5 sm:px-6 lg:px-8">
      <div className="rounded-[1.8rem] border border-amber-200 bg-parchment-50 p-4 shadow-card sm:p-6">
        <h1 className="font-serif text-[1.8rem] font-semibold text-maroon sm:text-[2rem]">{t("Find Pandit Ji")}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {t("Browse verified Pandit Ji and book the one that's right for your puja.")}
        </p>

        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <label className="block">
            <span className="sr-only">{t("Search by name")}</span>
            <input
              type="search"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder={t("Search by name")}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="sr-only">{t("PIN code")}</span>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ""))}
              placeholder={t("PIN code")}
              disabled={resolvingDefault}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="sr-only">{t("Sort by")}</span>
            <select
              value={sort}
              onChange={(e) => updateParams({ sort: e.target.value === "recommended" ? "" : e.target.value })}
              className={inputClass}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(option.label)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
          {!loading && !error ? (
            <span className="font-semibold text-slate-700">{t("{count} Pandit Ji found", { count: total })}</span>
          ) : null}
          {showingDefaultPin ? (
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-maroon">
              {t("Near your address PIN code {pin}", { pin: defaultPincode })}
              <button type="button" onClick={showAllPincodes} className="ml-2 underline hover:text-saffron">
                {t("Show all")}
              </button>
            </span>
          ) : null}
          {hasFilters ? (
            <button type="button" onClick={clearFilters} className="ml-auto font-semibold text-saffron hover:text-maroon">
              {t("Clear filters")}
            </button>
          ) : null}
        </div>

        <div className="mt-5">
          {loading ? (
            <Loader variant="card" count={4} />
          ) : error ? (
            <div className="p-4 text-center text-sm text-red-500">
              {t("Error loading pandits:")} {error}
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-[1.25rem] border border-dashed border-amber-200 bg-white p-8 text-center">
              <p className="text-sm text-slate-500">{t("No Pandit Ji found for these filters.")}</p>
              {pincode ? (
                <button
                  type="button"
                  onClick={showAllPincodes}
                  className="interactive-button mt-3 rounded-full bg-saffron px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500"
                >
                  {t("Show Pandit Ji from all PIN codes")}
                </button>
              ) : null}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {items.map((p) => (
                <PanditCard key={p.id} p={p} onView={handleView} onSelect={handleSelect} />
              ))}
            </div>
          )}
        </div>

        {!loading && !error && totalPages > 1 ? (
          <nav aria-label={t("Pagination")} className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => goToPage(page - 1)}
              disabled={page <= 1}
              className="interactive-button rounded-full border border-amber-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:border-maroon hover:text-maroon disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t("Previous")}
            </button>
            {pageWindow(page, totalPages).map((n) =>
              typeof n === "string" ? (
                <span key={n} className="px-1 text-slate-400">…</span>
              ) : (
                <button
                  key={n}
                  type="button"
                  onClick={() => goToPage(n)}
                  aria-current={n === page ? "page" : undefined}
                  className={`h-9 min-w-9 rounded-full px-3 text-sm font-semibold ${
                    n === page
                      ? "bg-maroon text-white"
                      : "border border-amber-200 bg-white text-slate-700 hover:border-maroon hover:text-maroon"
                  }`}
                >
                  {n}
                </button>
              ),
            )}
            <button
              type="button"
              onClick={() => goToPage(page + 1)}
              disabled={page >= totalPages}
              className="interactive-button rounded-full border border-amber-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:border-maroon hover:text-maroon disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t("Next")}
            </button>
          </nav>
        ) : null}
      </div>
    </section>
  );
}

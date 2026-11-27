import { useEffect, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { get } from '../api';
import BookingStepper, { PACKAGE_STEPS } from '../components/BookingStepper';
import BookingFrame from '../components/BookingFrame';
import { getAvailability } from '../services/availability';
import { getBookingDraft, saveBookingDraft } from '../utils/bookingFlowStorage';
import { isPackagePuja, missingStepPath, nextStepLabel, nextStepPath, resolveBookingData, stepNumber } from '../utils/bookingSteps';
import { t } from "../i18n";
import FestivalDateWarning, { formatFestivalDate } from '../components/FestivalDateWarning';
import useFestivalDates from '../hooks/useFestivalDates';
import { checkFestivalDate, localToday, nextFestival } from '../utils/festivalDates';
import { PanditTimeWarning } from '../components/PreferredPanditDialogs';
import { findNextAvailableSlot, isPanditAvailable } from '../utils/panditAvailability';

const DEFAULT_MIN_LEAD_HOURS = 6;

// Slot times are free-text like "07:00 AM" -- combined with the
// selected date, this is the only place that needs to turn one into a
// real Date to compare against the admin-configured lead-time buffer.
function parseSlotDateTime(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null;
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  const [, hh, mm, ampm] = match;
  let hours = parseInt(hh, 10) % 12;
  if (ampm.toUpperCase() === 'PM') hours += 12;
  const [y, mo, d] = dateStr.split('-').map(Number);
  if (!y || !mo || !d) return null;
  return new Date(y, mo - 1, d, hours, parseInt(mm, 10), 0, 0);
}

export default function BookDateTime() {
  const { state } = useLocation();
  // Step 3: comes after the address (router state from the address
  // step, or the saved draft after a refresh / login trip).
  const draft = getBookingDraft();
  const preserved = resolveBookingData(state, draft);
  const puja = preserved.puja;
  const address = preserved.address;
  // Opened directly / old bookmark without an address yet -> send the
  // user to the earliest step still missing (see bookingSteps.js).
  const missingPath = missingStepPath('datetime', preserved);

  const [date, setDate] = useState(() => preserved?.date || new Date().toISOString().slice(0, 10));
  const [availability, setAvailability] = useState(null);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [availabilityError, setAvailabilityError] = useState(null);

  const [selectedSlot, setSelectedSlot] = useState(() => preserved?.slot || null);
  const [minLeadHours, setMinLeadHours] = useState(DEFAULT_MIN_LEAD_HOURS);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const navigate = useNavigate();

  // Booked from a Pandit Ji's page (see PujaSlider): pre-pick their next
  // free date & time, mark the slots that don't suit them, and if the
  // yajmaan picks one of those anyway, ask whether to keep this Pandit
  // Ji (back to `panditPick`) or take that time and choose another
  // Pandit Ji on the next step. Without their schedule (failed to load)
  // this all switches off and the step works as usual.
  const [preferredPandit, setPreferredPandit] = useState(() => preserved?.preferredPandit || null);
  const [schedule, setSchedule] = useState(null);
  const [panditPick, setPanditPick] = useState(() => (preserved?.date && preserved?.slot ? { date: preserved.date, slot: preserved.slot } : null));
  const [autoPicked, setAutoPicked] = useState(null);
  const [noPanditSlot, setNoPanditSlot] = useState(false);
  const [timeWarning, setTimeWarning] = useState(null);
  // Only a fresh visit is auto-picked -- coming Back keeps their choice.
  const autoPickPending = useRef(!(preserved?.date && preserved?.slot));
  const panditLock = Boolean(preferredPandit && schedule);
  const suitsPandit = (d, slot) => !panditLock || isPanditAvailable(schedule, d, slot?.time);

  // Festival-specific pujas: suggest the festival date and warn before
  // going on with a different one (utils/festivalDates.js).
  const { festivalName, festivals } = useFestivalDates(puja?.id, puja?.festival_name);
  const [festivalWarning, setFestivalWarning] = useState(null);
  const today = localToday();
  const upcomingFestival = nextFestival(festivals, festivalName, today);

  // Admin-configured minimum notice before a puja can be booked (see
  // Admin Settings -> Booking Lead Time). Fails open to the documented
  // default rather than blocking booking if this can't be read.
  useEffect(() => {
    let mounted = true;
    get('/settings/booking')
      .then((data) => {
        if (mounted && Number.isFinite(data?.min_lead_hours)) {
          setMinLeadHours(data.min_lead_hours);
        }
      })
      .catch(() => {
        /* keep the default */
      })
      .finally(() => {
        if (mounted) setSettingsLoaded(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (missingPath) return undefined;
    const controller = new AbortController();
    let mounted = true;

    async function loadAvailability() {
      setLoadingAvailability(true);
      setAvailability(null);
      setAvailabilityError(null);

      try {
        const res = await getAvailability(puja.id, date, { signal: controller.signal });
        if (!mounted) return;
        // getAvailability returns { date, pujaId, slots }
        setAvailability(res?.slots ?? null);

        // Optionally: if previously selected slot is not available on new date, clear it
        if (selectedSlot) {
          const found = Object.values(res?.slots ?? {}).some((group) =>
            group.some((s) => s.id === selectedSlot.id)
          );
          const slotDT = parseSlotDateTime(date, selectedSlot.time);
          const stillFarEnoughOut = !slotDT || slotDT >= new Date(Date.now() + minLeadHours * 3600 * 1000);
          if (!found || !stillFarEnoughOut) {
            setSelectedSlot(null);
          }
        }
      } catch (err) {
        if (err?.name === 'CanceledError' || err?.isCanceled) {
          // request was aborted - ignore
          return;
        }
        console.error('Failed to load availability', err);
        setAvailabilityError(err);
        // If getAvailability falls back to mock internally, availability will be set above.
        // If it threw, we keep availability null so UI shows an error or empty state.
      } finally {
        if (mounted) setLoadingAvailability(false);
      }
    }

    loadAvailability();

    return () => {
      mounted = false;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, puja?.id]);

  useEffect(() => {
    if (missingPath || !preferredPandit?.id) return undefined;
    const controller = new AbortController();
    get(`/pandits/${preferredPandit.id}/schedule`, { params: { from_date: localToday(), days: 60 }, signal: controller.signal })
      .then((data) => setSchedule(data))
      .catch((err) => {
        if (err?.name === 'CanceledError' || err?.isCanceled) return;
        console.warn('Pandit Ji schedule unavailable; booking without it', err);
      });
    return () => controller.abort();
  }, [missingPath, preferredPandit?.id]);

  useEffect(() => {
    if (!autoPickPending.current || !panditLock || !availability || !settingsLoaded) return;
    autoPickPending.current = false;
    const next = findNextAvailableSlot(schedule, availability, { fromDate: localToday(), minLeadHours, maxDays: 60 });
    if (!next) {
      setNoPanditSlot(true);
      return;
    }
    setDate(next.date);
    setSelectedSlot(next.slot);
    setPanditPick(next);
    setAutoPicked(next);
  }, [panditLock, schedule, availability, settingsLoaded, minLeadHours]);

  useEffect(() => {
    if (missingPath) return;
    saveBookingDraft({ puja, date, slot: selectedSlot });
  }, [puja, date, selectedSlot, missingPath]);

  if (missingPath) {
    return <Navigate to={missingPath} replace state={puja ? { puja } : undefined} />;
  }

  // A choice made before the schedule arrives wins over the auto-pick
  // (it's still checked against the Pandit Ji on Next).
  function changeDate(newDate) {
    autoPickPending.current = false;
    if (selectedSlot && !suitsPandit(newDate, selectedSlot)) {
      setTimeWarning({ date: newDate, slot: selectedSlot });
      return;
    }
    setDate(newDate);
    if (selectedSlot && panditLock) setPanditPick({ date: newDate, slot: selectedSlot });
  }

  function chooseSlot(slot) {
    autoPickPending.current = false;
    if (!suitsPandit(date, slot)) {
      setTimeWarning({ date, slot });
      return;
    }
    setSelectedSlot(slot);
    if (panditLock) setPanditPick({ date, slot });
  }

  // What "Continue with this Pandit Ji" goes back to: their last date &
  // time that suited them, else their next free one.
  const keepPick = timeWarning
    ? panditPick || (panditLock && availability ? findNextAvailableSlot(schedule, availability, { fromDate: localToday(), minLeadHours, maxDays: 60 }) : null)
    : null;

  function keepPandit() {
    setTimeWarning(null);
    if (keepPick) {
      setDate(keepPick.date);
      setSelectedSlot(keepPick.slot);
      setPanditPick(keepPick);
    }
  }

  // Take the yajmaan's date & time; the Pandit Ji step then lists
  // everyone free then instead of just this Pandit Ji.
  function dropPreferredPandit() {
    const chosen = timeWarning;
    setTimeWarning(null);
    setPreferredPandit(null);
    setSchedule(null);
    setAutoPicked(null);
    setNoPanditSlot(false);
    saveBookingDraft({ preferredPandit: null });
    if (chosen) {
      setDate(chosen.date);
      setSelectedSlot(chosen.slot);
    }
  }

  function goNext() {
    saveBookingDraft({ puja, address, date, slot: selectedSlot });
    navigate(nextStepPath('datetime', puja), { state: { puja, address, date, slot: selectedSlot } });
  }

  function handleNext() {
    if (!suitsPandit(date, selectedSlot)) {
      setTimeWarning({ date, slot: selectedSlot });
      return;
    }
    const warning = checkFestivalDate({ festivalName, festivals, selectedDate: date, today });
    if (warning) {
      setFestivalWarning(warning);
      return;
    }
    goNext();
  }

  // "Change Date": move to the festival date; the customer then picks a
  // slot that is open on that day.
  function applyFestivalDate(festivalDate) {
    setFestivalWarning(null);
    if (festivalDate && festivalDate !== date) {
      setDate(festivalDate);
      setSelectedSlot(null);
    }
  }

  function isPast(selectedDate) {
    const today = new Date();
    const d = new Date(selectedDate + 'T00:00:00');
    return d.setHours(0, 0, 0, 0) < today.setHours(0, 0, 0, 0);
  }

  return (
    <BookingFrame
      title={t("Select date & time")}
      description={t("Choose a convenient date and available time slot for your puja.")}
      accentImage={puja.image || undefined}
      asideTitle={t("Puja summary")}
      asideItems={[
        { label: t("Ritual: {value}", { value: puja.title }) },
        { label: t("Address: {value}", { value: address?.city || '' }) },
        { label: 'Shubh muhurat friendly slots' },
      ]}
    >
      <BookingStepper currentStep={stepNumber('datetime', puja)} steps={isPackagePuja(puja) ? PACKAGE_STEPS : undefined} />
      <p className="mt-2 text-sm text-slate-600">{t("Selected ritual:")}{' '}<strong>{t(puja.title)}</strong></p>
      {preferredPandit && (
        <p className="mt-1 text-sm text-slate-600">{t("Pandit Ji:")}{' '}<strong>{preferredPandit.name}</strong></p>
      )}
      {panditLock && autoPicked && autoPicked.date === date && autoPicked.slot.id === selectedSlot?.id && (
        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          ✓ {t("{name} is next available on {date} at {time}. We've selected it for you.", {
            name: preferredPandit.name,
            date: formatFestivalDate(autoPicked.date),
            time: autoPicked.slot.time,
          })}
        </div>
      )}
      {panditLock && noPanditSlot && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {t("{name} has no free time in the next 60 days. Pick a date & time and select a different Pandit Ji on the next step.", { name: preferredPandit.name })}
        </div>
      )}

      <div className="mt-6">
        <label className="block text-sm font-medium text-slate-700">{t("Select Date")}</label>
        <div className="mt-2 rounded-[1.1rem] border border-amber-100 bg-gradient-to-r from-amber-50 via-white to-amber-50/70 p-3 shadow-sm">
          <input
            type="date"
            value={date}
            onChange={(e) => changeDate(e.target.value)}
            className="w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm"
          />
        </div>
        {isPast(date) && <p className="mt-2 text-sm text-red-600">{t("Please select a future date.")}</p>}
        {upcomingFestival && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm">
            <span className="text-slate-700">
              🪔 {t("Recommended date for {festival}", { festival: upcomingFestival.title })}:{' '}
              <strong className="text-maroon">
                {upcomingFestival.end_date
                  ? t("{start} to {end}", { start: formatFestivalDate(upcomingFestival.start_date), end: formatFestivalDate(upcomingFestival.end_date) })
                  : formatFestivalDate(upcomingFestival.start_date)}
              </strong>
            </span>
            {!checkFestivalDate({ festivalName, festivals, selectedDate: date, today }) ? (
              <span className="text-xs font-semibold text-emerald-700">✓ {t("Festival date selected")}</span>
            ) : (
              <button
                type="button"
                onClick={() => applyFestivalDate(upcomingFestival.start_date >= today ? upcomingFestival.start_date : today)}
                className="interactive-button min-h-[36px] rounded-full border border-maroon/30 bg-white px-3 text-xs font-semibold text-maroon hover:bg-maroon hover:text-white"
              >
                {t("Use this date")}
              </button>
            )}
          </div>
        )}

        <div className="mt-6">
          <h3 className="font-semibold text-slate-700">{t("Available Time Slots")}</h3>
          <p className="mt-1 text-sm text-slate-500">
            {t(minLeadHours === 1 ? "Bookings need at least {hours} hour's notice so we can arrange your Pandit Ji." : "Bookings need at least {hours} hours' notice so we can arrange your Pandit Ji.", { hours: minLeadHours })}
          </p>

          {panditLock && (
            <p className="mt-1 text-sm text-slate-500">
              {t("Times with a dashed border don't suit {name}.", { name: preferredPandit.name })}
            </p>
          )}

          {loadingAvailability && <p className="mt-2 text-sm text-slate-500">{t("Loading availability…")}</p>}

          {!loadingAvailability && availabilityError && (
            <p className="mt-2 text-sm text-red-600">{t("Failed to load availability. Please try again.")}</p>
          )}

          {availability && (
            <div className="mt-3 space-y-4">
              {Object.entries(availability).map(([group, slots]) => (
                <div key={group}>
                  <p className="mb-2 text-sm font-semibold capitalize text-slate-600">{t(group)}</p>
                  <div className="flex flex-wrap gap-2">
                    {slots.map((s) => {
                      const slotDT = parseSlotDateTime(date, s.time);
                      const tooSoon = Boolean(slotDT) && slotDT < new Date(Date.now() + minLeadHours * 3600 * 1000);
                      const selectable = s.available && !tooSoon;
                      const panditBusy = panditLock && !suitsPandit(date, s);
                      return (
                        <button
                          key={s.id}
                          disabled={!selectable}
                          title={tooSoon ? t("Needs at least {minLeadHours} hours' notice", { minLeadHours: minLeadHours }) : panditBusy ? t("{name} is not available at this time", { name: preferredPandit.name }) : undefined}
                          onClick={() => chooseSlot(s)}
                          className={`min-h-[44px] rounded-full px-3 py-2 text-sm font-medium transition ${selectable ? (selectedSlot?.id === s.id ? 'bg-maroon text-white shadow-sm' : panditBusy ? 'border border-dashed border-slate-300 bg-white text-slate-400 hover:border-maroon hover:text-maroon' : 'border border-amber-200 bg-white text-slate-700 hover:border-maroon hover:text-maroon') : 'cursor-not-allowed bg-gray-100 text-gray-400'}`}
                        >
                          {s.time} {s.shubh ? '✨' : ''}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loadingAvailability && !availability && !availabilityError && (
            <p className="mt-2 text-sm text-slate-500">{t("No slots available for the selected date.")}</p>
          )}
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button
            disabled={!selectedSlot || isPast(date)}
            onClick={handleNext}
            className={`min-h-[44px] rounded-full px-5 py-2 font-semibold text-white shadow-sm transition ${!selectedSlot || isPast(date) ? 'bg-gray-300' : 'bg-saffron hover:opacity-90'}`}
          >
            {t(nextStepLabel('datetime', puja))}
          </button>
          <button onClick={() => navigate(-1)} className="min-h-[44px] rounded-full border border-amber-200 bg-white px-5 py-2 text-slate-700">{t("Back")}</button>
        </div>
      </div>

      <PanditTimeWarning
        warning={timeWarning}
        pandit={preferredPandit}
        keep={keepPick}
        onKeepPandit={keepPandit}
        onChangePandit={dropPreferredPandit}
        onClose={() => setTimeWarning(null)}
      />

      <FestivalDateWarning
        warning={festivalWarning}
        onChangeDate={() => applyFestivalDate(festivalWarning?.recommendedDate)}
        onContinue={() => {
          setFestivalWarning(null);
          goNext();
        }}
        onClose={() => setFestivalWarning(null)}
      />
    </BookingFrame>
  );
}
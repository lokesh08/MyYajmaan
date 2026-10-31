import { useEffect, useState } from "react";

import { usePanditPortal } from "../../context/PanditPortalContext";
import { listBookingPhotos, listMyBookings, uploadBookingPhotos } from "../../services/panditApi";
import { showError, showSuccess } from "../../utils/toaster";
import LockedNotice from "../../components/pandit/LockedNotice";
import { t } from "../../i18n";

// Keeps Supabase Storage usage bounded -- a few completion photos per
// booking is the point, not an unlimited photo dump. The backend
// enforces this too (see pandit_photos.py); this just gives a clearer
// in-the-moment message than waiting for the upload to fail.
const MAX_PHOTOS_PER_BOOKING = 3;

export default function PanditPhotosPage() {
  const { stage, rejectionReason } = usePanditPortal();
  const [bookings, setBookings] = useState([]);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [selectedId, setSelectedId] = useState("");
  const [photos, setPhotos] = useState([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (stage !== "approved") return;
    setLoadingBookings(true);
    Promise.all([
      listMyBookings({ tab: "upcoming", page: 1, pageSize: 50 }),
      listMyBookings({ tab: "completed", page: 1, pageSize: 50 }),
    ])
      .then(([upcoming, completed]) => {
        const eligible = [
          ...(upcoming?.items || []).filter((b) => b.status === "confirmed"),
          ...(completed?.items || []),
        ];
        setBookings(eligible);
      })
      .catch(() => showError(t("Could not load your bookings.")))
      .finally(() => setLoadingBookings(false));
  }, [stage]);

  function loadPhotos(bookingId) {
    if (!bookingId) {
      setPhotos([]);
      return;
    }
    setLoadingPhotos(true);
    listBookingPhotos(bookingId)
      .then((data) => setPhotos(data?.items || []))
      .catch(() => showError(t("Could not load photos for this booking.")))
      .finally(() => setLoadingPhotos(false));
  }

  function handleSelect(bookingId) {
    setSelectedId(bookingId);
    setFiles([]);
    loadPhotos(bookingId);
  }

  const remainingSlots = Math.max(0, MAX_PHOTOS_PER_BOOKING - photos.length);

  function handleFileChange(event) {
    const chosen = Array.from(event.target.files || []);
    if (chosen.length > remainingSlots) {
      showError(t("You can add {remainingSlots} more photo(s) to this booking (max {MAX_PHOTOS_PER_BOOKING} total).", { remainingSlots: remainingSlots, MAX_PHOTOS_PER_BOOKING: MAX_PHOTOS_PER_BOOKING }));
    }
    setFiles(chosen.slice(0, remainingSlots));
  }

  async function handleUpload() {
    if (!selectedId) {
      showError(t("Please select a booking first."));
      return;
    }
    if (files.length === 0) {
      showError(t("Please choose at least one photo to upload."));
      return;
    }
    setUploading(true);
    try {
      await uploadBookingPhotos(selectedId, files);
      showSuccess(t("Photos uploaded successfully."));
      setFiles([]);
      loadPhotos(selectedId);
    } catch (error) {
      showError(error?.message || t("Could not upload these photos."));
    } finally {
      setUploading(false);
    }
  }

  if (stage !== "approved") {
    return <LockedNotice stage={stage} rejectionReason={rejectionReason} />;
  }

  return (
    <div className="space-y-4">
      <h1 className="font-serif text-2xl font-semibold text-maroon">{t("Upload Photos")}</h1>

      <div className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm">
        <label className="block max-w-md">
          <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">{t("Select Booking")}</span>
          <select
            value={selectedId}
            onChange={(e) => handleSelect(e.target.value)}
            disabled={loadingBookings}
            className="w-full rounded-xl border border-amber-200 px-3 py-2 text-sm outline-none focus:border-maroon focus:ring-2 focus:ring-amber-100"
          >
            <option value="">{loadingBookings ? t("Loading bookings...") : t("Select a booking")}</option>
            {bookings.map((booking) => (
              <option key={booking.id} value={booking.id}>
                {booking.customer_name || t("Customer")} — {booking.booking_date || booking.date} ({booking.status})
              </option>
            ))}
          </select>
        </label>

        {selectedId && (
          <div className="mt-4">
            <p className="mb-2 text-xs text-slate-500">
              {remainingSlots > 0
                ? t("You can add up to {remainingSlots} more photo(s) for this booking (max {MAX_PHOTOS_PER_BOOKING} total).", { remainingSlots: remainingSlots, MAX_PHOTOS_PER_BOOKING: MAX_PHOTOS_PER_BOOKING })
                : t("This booking already has the maximum of {MAX_PHOTOS_PER_BOOKING} photos.", { MAX_PHOTOS_PER_BOOKING: MAX_PHOTOS_PER_BOOKING })}
            </p>
            <input
              type="file"
              accept="image/*"
              multiple
              disabled={remainingSlots === 0}
              onChange={handleFileChange}
              className="w-full text-xs text-slate-500 file:mr-3 file:rounded-full file:border-0 file:bg-amber-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-maroon disabled:cursor-not-allowed disabled:opacity-60"
            />
            {files.length > 0 && <p className="mt-1 text-xs text-emerald-600">{files.length}{' '}{t("file(s) selected")}</p>}

            <button
              type="button"
              onClick={handleUpload}
              disabled={uploading || remainingSlots === 0}
              className="interactive-button mt-3 rounded-full bg-maroon px-6 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {uploading ? t("Uploading...") : t("Upload Photos")}
            </button>
          </div>
        )}
      </div>

      {selectedId && (
        <div className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-serif text-lg font-semibold text-maroon">{t("Uploaded Photos")}</h2>
          {loadingPhotos ? (
            <p className="py-6 text-center text-sm text-slate-400">{t("Loading...")}</p>
          ) : photos.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">{t("No photos uploaded for this booking yet.")}</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {photos.map((photo) => (
                <img key={photo.id} src={photo.image_url} alt={t("Puja")} className="h-32 w-full rounded-xl object-cover" />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";

import Modal from "./Modal";
import { listActiveCoupons } from "../services/coupons";
import { showSuccess } from "../utils/toaster";

function formatDiscount(coupon) {
  if (coupon.discount_type === "percentage") {
    const capped = coupon.max_discount_amount
      ? ` (up to ₹${Math.round(coupon.max_discount_amount).toLocaleString("en-IN")})`
      : "";
    return `${coupon.discount_value}% off${capped}`;
  }
  return `₹${Math.round(coupon.discount_value).toLocaleString("en-IN")} off`;
}

function formatValidUntil(value) {
  if (!value) return null;
  try {
    return new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return null;
  }
}

async function copyCode(code) {
  try {
    await navigator.clipboard.writeText(code);
    showSuccess(`Code ${code} copied.`);
  } catch {
    showSuccess(`Your coupon code is ${code}.`);
  }
}

/**
 * Reused two ways:
 *  - HomePage: variant="banner" (default), a clickable "Available
 *    Coupons" card. Clicking a coupon just copies the code.
 *  - BookPayment: variant="link", a small inline trigger next to the
 *    manual coupon-code field. Pass onSelectCode(code) so clicking a
 *    coupon there fills the field and applies it immediately instead
 *    of just copying.
 * Renders nothing once loaded if there are no active coupons, same
 * empty-state pattern as OffersBanner.
 */
export default function CouponsShowcase({ variant = "banner", onSelectCode }) {
  const [coupons, setCoupons] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let active = true;
    listActiveCoupons()
      .then((data) => {
        if (active) setCoupons(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (active) setCoupons([]);
      })
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loaded && coupons.length === 0) return null;

  function handleCardClick(coupon) {
    if (onSelectCode) {
      onSelectCode(coupon.code);
      setOpen(false);
    } else {
      copyCode(coupon.code);
    }
  }

  return (
    <>
      {variant === "banner" ? (
        <section className="mt-8" aria-label="Available coupons">
          <button
            type="button"
            onClick={() => setOpen(true)}
            title="View all available coupons"
            className="interactive-button flex w-full flex-wrap items-center justify-between gap-4 rounded-[1.4rem] border border-amber-200 bg-gradient-to-r from-maroon via-maroon to-saffron px-5 py-5 text-left text-white shadow-lift sm:px-8"
          >
            <span className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15 text-2xl">🎁</span>
              <span>
                <span className="block font-serif text-xl font-semibold">Available Coupons</span>
                <span className="mt-0.5 block text-sm text-amber-50">
                  Tap to see live discount codes for your next puja.
                </span>
              </span>
            </span>
            <span className="rounded-full border border-white/40 px-4 py-2 text-sm font-semibold">
              View {coupons.length} coupon{coupons.length === 1 ? "" : "s"} →
            </span>
          </button>
        </section>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          title="View available coupons"
          className="text-sm font-semibold text-saffron hover:text-maroon"
        >
          View available coupons
        </button>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Available Coupons">
        <div className="grid gap-3">
          {coupons.map((coupon) => {
            const validUntil = formatValidUntil(coupon.valid_until);
            return (
              <article
                key={coupon.id}
                className="rounded-[1.1rem] border border-amber-100 bg-parchment-50 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <span className="inline-block rounded-lg bg-white px-3 py-1 font-mono text-sm font-bold tracking-wide text-maroon shadow-sm">
                      {coupon.code}
                    </span>
                    <p className="mt-2 text-sm font-semibold text-maroon">{formatDiscount(coupon)}</p>
                    {coupon.description && (
                      <p className="mt-1 text-sm text-slate-600">{coupon.description}</p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                      {coupon.min_booking_amount ? (
                        <span>Min. booking ₹{Math.round(coupon.min_booking_amount).toLocaleString("en-IN")}</span>
                      ) : null}
                      {coupon.applicable_puja_ids?.length ? (
                        <span>Valid on select pujas</span>
                      ) : (
                        <span>Valid on all pujas</span>
                      )}
                      {validUntil && <span>Valid until {validUntil}</span>}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCardClick(coupon)}
                    className="interactive-button shrink-0 rounded-full bg-maroon px-4 py-2 text-xs font-semibold text-white"
                  >
                    {onSelectCode ? "Use code" : "Copy code"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </Modal>
    </>
  );
}

import { post } from '../api';

export async function createBooking(
  {
    pujaId,
    pujaTitle,
    packageId = null,
    panditId,
    date,
    timeslot,
    amount,
    paymentRef,
    notes,
    couponId,
    couponDiscount,
    address,
    paymentMethod,
    packageTier,
    premiumFee,
    gstAmount,
    platformFee,
    panditFeeAmount,
  },
  { signal } = {} // optional { signal: AbortSignal }
) {
  // Always goes through the authenticated FastAPI endpoint (cookies
  // included via src/api's axios instance) regardless of the mock/api/
  // supabase demo-mode toggle used elsewhere for read-only catalog
  // browsing -- a real booking write must be correctly attributed to
  // the logged-in customer (client_id), which only this path does.
  //
  // puja_id/pandit_id here are the modern real catalog's UUIDs, but
  // bookings.puja_id is a legacy integer column that can't hold a
  // UUID -- so the puja's title is carried in `notes` instead (same
  // "denormalized on purpose" approach already used for reviews).
  const body = {
    pandit_id: panditId,
    catalog_puja_id: pujaId || undefined,
    package_id: packageId,
    date,
    timeslot,
    amount,
    payment_ref: paymentRef,
    coupon_id: couponId || undefined,
    coupon_discount: couponDiscount || undefined,
    notes: notes || (pujaTitle ? `Puja: ${pujaTitle}` : undefined),
    // Checkout snapshot -- collected on the Address/Payment steps but
    // previously never sent, so bookings had no address or payment-mode
    // on file at all. See BookAddress.jsx for the `address` shape.
    address_id: address?.savedAddressId || undefined,
    contact_name: address?.name || undefined,
    contact_phone: address?.phone || undefined,
    address_line: address?.address || undefined,
    address_city: address?.city || undefined,
    address_state: address?.state || undefined,
    address_pincode: address?.pin || undefined,
    special_instructions: address?.note || undefined,
    payment_method: paymentMethod || undefined,
    // Pricing breakdown (see admin_settings.py's /admin/settings/pricing
    // and BookPayment.jsx) -- a complete record of what was charged.
    package_tier: packageTier || undefined,
    premium_fee: premiumFee || undefined,
    gst_amount: gstAmount || undefined,
    platform_fee: platformFee || undefined,
    // The Pandit Ji's own price at booking time, separate from `amount`
    // (the full payable total) -- see invoicing.py. This is what the
    // customer's invoice always shows, even after a later reassignment.
    pandit_fee_amount: panditFeeAmount || undefined,
  };

  const response = await post('/bookings', body, { signal });
  return response;
}

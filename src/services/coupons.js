import { get, post } from "../api";

export async function validateCoupon({ code, amount, pujaId }) {
  return post("/coupons/validate", {
    code,
    amount,
    puja_id: pujaId ? String(pujaId) : null,
  });
}

export async function listActiveCoupons() {
  return get("/coupons");
}

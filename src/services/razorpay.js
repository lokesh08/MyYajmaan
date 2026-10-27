import { post } from "../api";
import { colors } from "../theme/tokens";

// Razorpay Checkout runs from Razorpay's own hosted script -- no npm
// package needed, and card/UPI details never touch this app.
const CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

let scriptPromise = null;

function loadCheckoutScript() {
  if (window.Razorpay) return Promise.resolve(true);
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = CHECKOUT_SRC;
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => {
        scriptPromise = null; // allow a retry
        reject(new Error("Could not load the payment window. Check your connection and try again."));
      };
      document.body.appendChild(script);
    });
  }
  return scriptPromise;
}

function cancelledError() {
  const error = new Error("Payment cancelled.");
  error.isPaymentCancelled = true;
  return error;
}

/**
 * Opens Razorpay Checkout for `amount` (rupees) and resolves with
 * `{ status: "success", sessionId, orderId }` once the backend has
 * verified Razorpay's signature. Rejects with `isPaymentCancelled`
 * if the customer closes the window, or with the failure message.
 *
 * The secret key never reaches the browser: the order is created and
 * the signature checked by the backend (routers/payments.py).
 */
export async function payWithRazorpay({ amount, description, prefill, signal }) {
  await loadCheckoutScript();

  const order = await post("/payments/razorpay/order", { amount, currency: "INR" }, { signal });

  // Local mock mode (backend RAZORPAY_MOCK_MODE): there is no real
  // order, so instead of Razorpay's window ask the tester to confirm or
  // cancel, then go through the same verify call as a real payment.
  if (order.mock) {
    const rupees = (order.amount / 100).toFixed(2);
    if (!window.confirm(`[TEST MODE] Simulate a successful Razorpay payment of Rs. ${rupees}?\n\nOK = payment succeeds, Cancel = customer closes the window.`)) {
      throw cancelledError();
    }
    return post("/payments/razorpay/verify", {
      razorpay_order_id: order.order_id,
      razorpay_payment_id: `pay_mock_${Date.now()}`,
      razorpay_signature: "mock_signature",
    });
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      fn(value);
    };

    const checkout = new window.Razorpay({
      key: order.key_id,
      order_id: order.order_id,
      amount: order.amount,
      currency: order.currency,
      name: order.merchant_name || "MyYajmaan",
      description,
      prefill,
      theme: { color: colors.maroon.dark },
      handler: async (response) => {
        try {
          const verified = await post("/payments/razorpay/verify", {
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          });
          finish(resolve, verified);
        } catch (error) {
          finish(reject, error);
        }
      },
      modal: {
        // Fires when the customer closes the window without paying.
        ondismiss: () => finish(reject, cancelledError()),
      },
    });

    // A failed attempt is deliberately not handled here: Checkout shows
    // the failure itself and lets the customer retry inside the same
    // window, so rejecting early would drop a retry that then succeeds.
    // The promise settles only on success (handler) or window close.
    checkout.open();
  });
}

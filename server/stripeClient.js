// Lazy-initialized so the app still starts fine before Stripe keys are
// configured (e.g. on first deploy, or in any environment that doesn't need
// real payments yet). Routes that need Stripe check for null and respond
// with a clear error instead of crashing.

let stripeInstance = null;
let StripeLib = null;

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!stripeInstance) {
    if (!StripeLib) StripeLib = require("stripe");
    stripeInstance = new StripeLib(key, { apiVersion: "2024-06-20" });
  }
  return stripeInstance;
}

module.exports = { getStripe };

import app from "../src/api-app.js";

// The Stripe webhook verifies a signature over the raw body. Vercel's default
// JSON parser would consume that body before Express runs. express.json() in
// the app still parses every other route; the webhook route is registered first
// with express.raw().
export const config = {
  api: {
    bodyParser: false,
  },
};

export default app;

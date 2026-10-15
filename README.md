<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/67e0634c-4fb8-46ac-b616-25ece8c42872

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Stripe test mode

Checkout uses Stripe **test mode** by default. The server reads `STRIPE_SECRET_KEY` from the environment (a local `.env` file is loaded on startup) and creates a Checkout Session only when that key starts with `sk_test_`. A live key (`sk_live_`) is refused, with a warning in the server log, unless you set `STRIPE_ALLOW_LIVE=true`.

Get a test key from the Stripe Dashboard:

1. Open [dashboard.stripe.com](https://dashboard.stripe.com) and turn **Test mode** on (the toggle in the dashboard header).
2. Open **Developers → API keys**: [dashboard.stripe.com/test/apikeys](https://dashboard.stripe.com/test/apikeys).
3. Copy the **Secret key**. It starts with `sk_test_`.

Put it in a gitignored `.env` file in the project root. Copy [.env.example](.env.example) if you need the other variable names:

```
STRIPE_SECRET_KEY=sk_test_REPLACE_WITH_YOUR_TEST_KEY
```

Replace the placeholder with your own test secret key. Never commit `.env` or a real key.

On the Stripe-hosted payment page, use test card `4242 4242 4242 4242`, any future expiry date, and any CVC. No real charge is created. Stripe shows its own test-mode badge on that page.

## Delivery

Orders are delivered **only within Panama**. Checkout asks for a name, street or building, corregimiento or district, city, and province (or indigenous comarca). Notes and a landmark are optional. The country is Panama. There is no country picker.

Stripe Checkout is not asked to collect a shipping address. The customer enters the address once, on this site, and then pays on Stripe. The session metadata records `deliveryCountry` as `PA`.

The address is saved with the order. The admin orders list and each order on the customer page show it, so the workshop knows where to deliver. Older orders keep whatever text was already in `shipping_address`.

The live `orders` table needs one new nullable column before the structured address can be stored. Apply this yourself in the Supabase SQL editor. Do not run it against production from CI or from this repository's deploy. `npm run dev` applies `db/migrations/*.sql` only to the database in your local `DATABASE_URL`.

```sql
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_address jsonb;
```

The same statement is in [db/migrations/003_order_delivery_address.sql](db/migrations/003_order_delivery_address.sql). Until that column exists, checkout still saves a readable copy in `shipping_address` and the order goes through.

## Admin password

The shop does not ship a demo admin password. Passwords are stored as bcrypt hashes. Set one against `DATABASE_URL`:

```
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='choose-a-long-password' npm run admin:set-password
```

That upserts the hash for that email. To print only the hash and apply it yourself in SQL:

```
ADMIN_PASSWORD='choose-a-long-password' npm run admin:set-password -- --print-hash
```

Put the real values in the environment for that command. Do not commit them. A stored plaintext password is rejected at login.

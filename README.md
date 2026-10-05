# Golden Ceramic Panama

E-commerce site for Golden Ceramic Panama ceramic molds.

## Run locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Copy the example env file:
   `cp .env.example .env`
3. Set `JWT_SECRET` in `.env` to a long random string. This is required. On startup the server loads `.env` with dotenv and exits if `JWT_SECRET` is missing or empty.
4. Start the dev server:
   `npm run dev`

`npm run dev` does not set `NODE_ENV=production`, so the server uses the Vite dev middleware. It listens on `PORT`, or `3000` when `PORT` is unset.

Optional variables in `.env`:

- `APP_URL` — public base URL used for checkout return links (defaults to `http://localhost:3000`)
- `STRIPE_SECRET_KEY` — Stripe secret key used at checkout

## Production

Build the client, then start the server. `npm start` sets `NODE_ENV=production` (via `cross-env`) so Express serves the static files in `dist` instead of the Vite dev middleware.

1. `npm run build`
2. `npm start`

Set `JWT_SECRET` (and `PORT` if you do not want `3000`) in the environment or in `.env` before starting. `npm run dev` is unchanged.

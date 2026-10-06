# Moving Golden Ceramic Panama to Vercel and Supabase

This file is a plan only. It does not change the shop. Merging it adds this document to the repo and leaves the site, the database, and the payments code as they are.

The move is: stop using Express plus a SQLite file, and run the same shop on **Vercel** (the website and the API) with **Supabase Postgres** (the database).

## A few Git words

You do not need to memorize Git to follow this. Three words cover this pull request:

- **main** is the official copy of the project on GitHub.
- A **branch** is a side copy for one change. This plan lives on its own branch so `main` is untouched until you accept it.
- A **pull request** (PR) is the GitHub page that shows the change. When you have read it, the Merge button on that page copies the file onto `main`. You can close the page without merging and nothing in the repo changes.

Do the actual code move in later pull requests. Do not mix secret keys into any of them.

## What is true today

Checked against this repo:

- The shop UI is React 19, Vite, and Tailwind. `npm run build` runs `vite build` and writes a `dist` folder.
- The API is one Express app in `server.ts`. Locally, `npm run dev` and `npm start` both run that file. It also serves the React app on port 3000.
- Data is SQLite through `better-sqlite3` in `src/db.ts`. The file is `sqlite.db` in the project folder. **That file is not in Git.** GitHub has never stored your orders.
- Tables created in `src/db.ts`, and no others: `products`, `orders`, `order_items`, `admin_users`.
- The first time the server runs, it inserts four sample molds and a demo admin user if those tables are empty. The admin password is stored as plain text. The admin login page pre-fills that demo account. Do not reuse it for a real shop.
- Admin login returns a JWT. The browser stores it as `adminToken` and sends `Authorization: Bearer …` on admin requests.
- Checkout creates a Stripe Checkout session when `STRIPE_SECRET_KEY` is set. There is **no Stripe webhook**. The order row is written and stock is reduced before the customer pays. If Stripe is missing, checkout still reports success.
- `server.ts` falls back to a built-in JWT secret when `JWT_SECRET` is not set. Replace that when you change the code. Do not copy that fallback into a new file or into GitHub.
- `.env.example` lists `GEMINI_API_KEY`, `APP_URL`, `JWT_SECRET`, and `STRIPE_SECRET_KEY` as placeholders. Nothing under `src/` calls Gemini. The shop does not need a Gemini key.
- GitHub Pages is on, publishing the **main branch, folder `/`** (the raw source, not a build): https://jotaeliezer.github.io/golden_ceramic_panama/
- Pages cannot run Express or SQLite. `index.html` asks the browser to load `/src/main.tsx`, which a browser cannot compile, and that path is not even under `/golden_ceramic_panama/`. The result is a blank page. Turning Pages into a Vite build would still leave the API and the database with nowhere to run.

## Secrets: never put them in the repo

Keys belong in the Vercel project’s Environment Variables screen, and in a local `.env.local` on your computer while you develop. `.gitignore` already ignores `.env*` and keeps `.env.example`.

Never put a real key in a commit, a pull request, an issue, a screenshot, or this file. `.env.example` may list the **names** only, with empty placeholders.

| Variable | Who uses it | Secret? |
| --- | --- | --- |
| `SUPABASE_URL` | Server functions | No, but keep it in Vercel anyway |
| `SUPABASE_SECRET_KEY` | Server functions only | Yes. Full database access |
| `JWT_SECRET` | Server functions only | Yes. A long random string you generate |
| `STRIPE_SECRET_KEY` | Server functions only | Yes |
| `STRIPE_WEBHOOK_SECRET` | The webhook function only | Yes |
| `APP_URL` | Checkout return links | No. Your public Vercel URL, including `https://` |
| `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` | Browser, only if you later read products from the browser | The publishable key is meant to be public. Still do not commit it; set it in Vercel |

Anything the browser should see must start with `VITE_`. Anything secret must **not** start with `VITE_`. Vite copies `VITE_` values into the public JavaScript bundle.

Supabase is renaming keys. In **Project Settings → API Keys** you may see:

- A **publishable** key (`sb_publishable_…`), or on older screens an **anon** key. Low privilege. This is the only key that may ever reach the browser, and only together with Row Level Security.
- A **secret** key (`sb_secret_…`), or on older screens a **service_role** key. This skips row security. Server only. The names in the table above mean this key, whichever label the dashboard shows.

Use a current `@supabase/supabase-js` in the server functions. Do not send the secret key from React.

## Suggested order

Do these in order. Each step is expanded below.

1. Create the Supabase project and tables.
2. Load sample products, or import a local `sqlite.db` if you actually have one.
3. In a **later code pull request**, replace SQLite with Supabase and split `server.ts` into Vercel functions. Remove the demo password and the JWT fallback in that same change.
4. Create the Vercel project, set environment variables, and deploy.
5. Add the Stripe webhook and test with Stripe’s test card.
6. Click through the shop and the admin pages on the Vercel URL.
7. Turn GitHub Pages off.

Rough time, working carefully and learning the dashboards as you go: **about 3 to 4 days**. Someone who has shipped a Vite app to Vercel before can do the same work in **about 1 day**. A breakdown is at the end.

## 1. Supabase project and schema

1. Create a free Supabase account and a new project. Pick a region close to your customers. Save the database password in a password manager, not in Git.
2. Open the SQL editor and run the script below. It matches the four tables in `src/db.ts`. Column `imageUrl` from SQLite becomes `image_url` here; the API should still send the browser a field named `imageUrl`, so the React pages do not have to change.
3. `stripe_session_id` is new. It lets the webhook find the order Stripe just finished. It is not in SQLite today.
4. `password_hash` replaces the plain-text `password` column. Do not copy the demo password into this table.
5. Row Level Security is turned on for every table, with no public policies. That means the publishable/anon key cannot read or write anything. The server’s secret key bypasses those rules, which is what we want while all writes go through Vercel.

```sql
create table public.products (
  id text primary key,
  name text not null,
  description text,
  price numeric(10, 2) not null,
  image_url text,
  category text,
  stock integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.orders (
  id text primary key,
  customer_email text not null,
  total_amount numeric(10, 2) not null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'shipped', 'delivered', 'canceled')),
  shipping_address text,
  stripe_session_id text unique,
  created_at timestamptz not null default now()
);

create table public.order_items (
  id text primary key,
  order_id text not null references public.orders (id),
  product_id text not null references public.products (id),
  quantity integer not null check (quantity > 0),
  price numeric(10, 2) not null
);

create table public.admin_users (
  id text primary key,
  email text not null unique,
  password_hash text not null
);

create index order_items_order_id_idx on public.order_items (order_id);

alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.admin_users enable row level security;
```

Leave it that way for launch. Add a public read policy on `products` only if a later change reads products from the browser:

```sql
create policy "public can read products"
on public.products
for select
to anon
using (true);
```

Do not add policies that let `anon` read or write `orders`, `order_items`, or `admin_users`.

Prices in the current checkout code are charged in US dollars (`currency: 'usd'`). This plan does not change that.

## 2. Existing SQLite data

There is nothing to export from GitHub. `sqlite.db` is not committed. Pages never wrote a database. The only rows the repo knows about are the four sample products and the demo admin, and those exist as insert statements in `src/db.ts`, not as a data file.

On your own computer, a `sqlite.db` appears only after you have run `npm run dev` or `npm start`. Check it before you assume it matters:

```bash
sqlite3 sqlite.db "SELECT count(*) AS products FROM products; SELECT count(*) AS orders FROM orders;"
```

- **No file, or only the four sample products and zero orders.** Skip the export. Insert the sample products in the Supabase SQL editor (copy the names, descriptions, prices, image URLs, categories, and stock from the seed list in `src/db.ts`). Do not insert the demo admin.
- **Real orders you care about.** Export, then import. From the project folder:

```bash
sqlite3 sqlite.db ".headers on" ".mode csv" ".once products.csv" "SELECT id, name, description, price, imageUrl AS image_url, category, stock, created_at FROM products;"
sqlite3 sqlite.db ".headers on" ".mode csv" ".once orders.csv" "SELECT id, customer_email, total_amount, status, shipping_address, created_at FROM orders;"
sqlite3 sqlite.db ".headers on" ".mode csv" ".once order_items.csv" "SELECT id, order_id, product_id, quantity, price FROM order_items;"
```

In Supabase, use **Table Editor → Import** from CSV, products first, then orders, then order items. Do not import `admin_users`. Those passwords are plain text.

Afterward, add `sqlite.db` and `*.db` to `.gitignore` in the code pull request so a local database cannot be committed by mistake. It is not ignored today.

Create the real admin only after passwords are hashed (next section). Generate the hash on your machine or in a one-off server script. Store `ADMIN_EMAIL` and `ADMIN_PASSWORD` in Vercel if a script needs them, then you can remove the password variable after the row exists. Do not commit the hash or the password.

## 3. Express on Vercel

Vercel does not keep `app.listen` running, and it will not keep a `sqlite.db` file. Each request runs a short function, then stops. `better-sqlite3` has to go.

**Default shape:** keep this repo as one Vercel project. The React app stays at the root. Each API route becomes a file under `api/`. The browser keeps calling the same paths it already uses (`/api/products`, `/api/checkout`, and so on), so most React pages stay as they are.

| Now in `server.ts` | Vercel file | Who can call it |
| --- | --- | --- |
| `GET /api/products` | `api/products/index.ts` | Anyone |
| `GET /api/products/:id` | `api/products/[id].ts` | Anyone |
| `POST /api/checkout` | `api/checkout.ts` | Anyone |
| `POST /api/auth/login` | `api/auth/login.ts` | Anyone (returns a JWT) |
| `POST /api/products` | `api/products/index.ts` | Admin JWT |
| `PUT /api/products/:id` | `api/products/[id].ts` | Admin JWT |
| `DELETE /api/products/:id` | `api/products/[id].ts` | Admin JWT |
| `GET /api/orders` | `api/orders/index.ts` | Admin JWT |
| `PUT /api/orders/:id/status` | `api/orders/[id]/status.ts` | Admin JWT |
| Stripe webhook (new) | `api/webhooks/stripe.ts` | Stripe only |

Use the Supabase secret key inside those files. Map `image_url` back to `imageUrl` in JSON responses. Join `order_items` to `products` for the admin orders list, the same way `GET /api/orders` does now.

Share one small helper for “read the Bearer token and verify it with `JWT_SECRET`”. If `JWT_SECRET` is missing, refuse to sign or verify tokens. Delete the hardcoded fallback that is in `server.ts` today.

Hash admin passwords with `bcryptjs` (plain JavaScript, no native build). Compare the hash at login. Do not compare plain text.

For local development, use the Vercel CLI (`vercel dev`) so the `api/` routes and the Vite app run together. You can retire `tsx server.ts` once those routes exist.

In that code pull request, also:

- Remove `better-sqlite3` and `src/db.ts` when nothing imports them. Vercel should not compile that native module.
- Stop the demo behavior that marks an order successful when Stripe is not configured. Return an error instead.
- Clear the pre-filled demo email and password on the admin login page.

A single Express app exported as one serverless function also runs on Vercel, but the webhook needs the raw request body, and the rest of the app parses JSON. Separate `api/` files avoid that clash. Prefer the table above.

## 4. Environment variables on Vercel

1. Vercel → your project → **Settings → Environment Variables**.
2. Add the rows from the secrets table for Production and Preview.
3. Generate `JWT_SECRET` with a password manager or `openssl rand -base64 32`. Do not reuse the string that `server.ts` falls back to.
4. Use Stripe **test** keys until a real purchase works end to end. Live keys are a later switch in this same Vercel screen, not a code change.
5. Set `APP_URL` to the public site URL (`https://something.vercel.app` or your domain). Checkout builds the success and cancel URLs from it.
6. On your computer, put the same names in `.env.local` for `vercel dev`. That file stays uncommitted.

`GEMINI_API_KEY` is not part of this move. `vite.config.ts` currently copies that value into the browser bundle if it is set. Leave it unset.

## 5. Connecting the React app

**Default: the browser does not talk to Supabase.** Home, Shop, Product detail, Checkout, and Admin already use relative `fetch('/api/...')`. On Vercel the pages and the functions share one domain, so those calls keep working and you do not need a Supabase client in React for launch.

**Admin auth stays JWT-on-the-server for this move.** The login page, `localStorage` key `adminToken`, and the Bearer header can stay. Supabase Auth (email links, password reset, Supabase sessions) is a later project and would rewrite the admin screens. It is not required to leave SQLite.

Use the publishable/anon key in the browser only in a later step, and only to **read** `products`, after the policy in section 1 exists. Cart data can stay in `localStorage`; it is not a table today.

## 6. Deploy the frontend

1. In Vercel, **Add New Project** and import `jotaeliezer/golden_ceramic_panama`.
2. Framework preset: **Vite**. Root directory: the repo root.
3. Build command: `npm run build`. Output directory: `dist`. Install command: `npm install`.
4. Deploy after the environment variables are set and the `api/` code is on the branch you deploy. The first deploy of today’s Express server will not become a working shop; Vercel cannot run `server.ts` as it stands.
5. Vite’s base path can stay `/`. That is correct on a Vercel domain. (GitHub Pages would have needed a `/golden_ceramic_panama/` base. Do not add that for Vercel.)
6. Open `/shop` and `/admin/login` on the deployed site. If those routes 404, add a `vercel.json` rewrite so non-API paths serve `index.html`:

```json
{
  "rewrites": [
    { "source": "/((?!api/).*)", "destination": "/index.html" }
  ]
}
```

The Vite preset often does this for you. Add the file only if a refresh on a client route 404s.

## 7. Stripe webhook

The success page is not proof of payment. Anyone can open `?success=true`. Stripe must tell the server.

1. Change checkout so it still creates a `pending` order and a Stripe Checkout Session, but **does not reduce stock yet**. Put the order id in the session `metadata`, and save `stripe_session_id` on the order.
2. Add `api/webhooks/stripe.ts`. This one route must see the **raw body bytes**, not parsed JSON, or the signature check fails. Turn off JSON parsing for that function only.
3. Verify the `Stripe-Signature` header with `STRIPE_WEBHOOK_SECRET` and the Stripe SDK. Reject the request if the signature does not match.
4. On `checkout.session.completed`: if the order is still `pending`, reduce stock and set status to `processing` (that is the “paid, please fulfill” value the admin screen already shows). If the event is delivered twice, do nothing the second time.
5. On `checkout.session.expired`: set status to `canceled` if it is still `pending`. Do not restore stock unless you had already reduced it.
6. In the Stripe Dashboard (test mode), add an endpoint: `https://YOUR-VERCEL-DOMAIN/api/webhooks/stripe`, events `checkout.session.completed` and `checkout.session.expired`. Copy the signing secret into `STRIPE_WEBHOOK_SECRET` on Vercel.
7. For local tests, the Stripe CLI can forward events to `vercel dev`. The CLI prints a signing secret for that session; put that one in `.env.local`, not in Git.
8. Pay with Stripe’s test card. Confirm the order moves from `pending` to `processing` and that stock drops only after that. Confirm a refresh of the success URL does not create a second charge.

The admin status list also has `shipped` and `delivered`. Those stay as manual updates in the admin dashboard.

## 8. Admin on Supabase

After the steps above, the current admin screens should work without a redesign:

- `/admin/login` posts to `/api/auth/login`. The function looks up `admin_users` with the secret key, checks the hash, and returns a JWT.
- Product create, edit, and delete keep using the Bearer token. The functions write `products` with the secret key.
- The orders screen reads orders plus line items, and the status dropdown calls `PUT /api/orders/:id/status`.

Check this list on the Vercel URL before you send anyone there:

- [ ] Login with the new admin fails if the password is wrong.
- [ ] Login with the demo password from the old SQLite seed fails.
- [ ] You can add, edit, and delete a product, and the public shop shows the change.
- [ ] Orders from a test payment show the email, address, total, and line items.
- [ ] Changing status to Shipped or Delivered sticks after a refresh.
- [ ] Opening `/admin` with no token sends you to the login page (that guard is already in `AdminLayout`).

## 9. GitHub Pages and the blank site

Leave Pages up until the Vercel URL passes the checks in sections 6 and 8. Then turn it off so visitors are not sent to the blank site:

1. GitHub → this repo → **Settings → Pages**.
2. Under Build and deployment, set Source to **None** (disable Pages).
3. https://jotaeliezer.github.io/golden_ceramic_panama/ will stop serving the repo. Share the Vercel URL instead.
4. Do not “fix” Pages by committing a `dist` folder. The API still cannot run there.

A custom domain, when you want one, is added on the Vercel project, then `APP_URL` and the Stripe webhook URL are updated to match.

## Checklist

- [ ] Supabase project created; SQL from section 1 has been run; RLS is on.
- [ ] Sample products loaded, or a real local `sqlite.db` imported. Demo admin was not imported.
- [ ] Code pull request: `api/` routes, Supabase secret key on the server, hashed admin password, no JWT fallback, no `better-sqlite3`, checkout does not pretend success.
- [ ] `sqlite.db` added to `.gitignore`.
- [ ] Vercel project imported from this GitHub repo; Vite build outputs `dist`.
- [ ] Env vars set in Vercel and in local `.env.local` only. Nothing secret committed.
- [ ] `/`, `/shop`, `/product/…`, `/cart`, `/checkout`, and `/admin/login` load on the Vercel URL.
- [ ] Stripe test webhook moves an order to `processing` and reduces stock once.
- [ ] Admin checklist in section 8 passes.
- [ ] GitHub Pages source set to None.
- [ ] Only then, switch Stripe to live keys in Vercel and create a new live webhook secret.

## How long this takes

| Work | Rough time |
| --- | --- |
| Supabase project, SQL, and sample products | 2–4 hours |
| Export or import, if you have a real local database | 1–2 hours, or skip it |
| Rewrite `server.ts` into `api/` functions and point them at Supabase | 1–2 days |
| Password hashing, remove the demo login and the JWT fallback | 2–4 hours (do this with the rewrite, not later) |
| Stripe webhook and “charge stock only after payment” | about half a day |
| Vercel project, env vars, first good deploy, route check | about half a day |
| Admin click-through and turning Pages off | 1–2 hours |

Total for a first time through Vercel and Supabase: **about 3–4 days**. With prior experience of both: **about 1 day**.

## What not to do in the documentation pull request

The pull request that adds this file should not change application code, should not add a database file, and should not contain keys. Implementation belongs in follow-up pull requests after you have read this.

## Future feature: Physical gallery with QR ordering

This section is a plan only. It sits at the end of the file so it can land beside the proposed schema section without editing that section. Merging it adds these words and leaves the site, the database, and Stripe as they are.

When you rent a gallery space, leave the real ceramic and plaster molds at home. A mold is easy to steal and hard to replace. On the wall, show a high-quality printed photo of each finished piece. Each photo is a card. The card has a QR code. A visitor scans it with their phone and orders that piece on the site: how many, a color if the piece comes in colors, or the choice to paint it themselves.

The shop you have today already has a product page at `/product/:id`. The gallery flow is a shorter, phone-sized order page for one piece. Build it after the move to Vercel and Supabase.

### How a card works

One product, one QR code. The code is a link to your public site, for example:

`https://YOUR-SITE/gallery/<product-id>?src=gallery&loc=casco-viejo`

Use the product id in the path. Ids stay put when you rename a piece, so a card printed this month still opens the right page next year. A readable slug such as `/p/bird-bowl?src=gallery` is fine as a second address, and the slug can redirect to `/gallery/<product-id>`. Once a card is on a wall, keep the old address working.

`src=gallery` marks the visit as a gallery scan. `loc=` is the room or event name (see Gallery operations).

An admin screen, **Print gallery card**, builds the card in the browser:

- The photo (`gallery_card_image_url`, or the normal product photo if that field is empty)
- The name and the price
- The life-size **height, length, and width** of the real piece, in centimeters, with inches beside them
- The QR code

A small client-side QR library (for example the `qrcode` package) draws the code from that public URL. The page never needs a secret key to do this. The admin can use the browser’s Print dialog and choose **Save as PDF**, and can also download a PNG of the same card for a print shop.

The QR encodes the full `https://` URL, including the site name from `APP_URL`. A code that only contains `/gallery/…` fails when a phone camera opens it outside the site.

Checklist for a card:

- [ ] One code per product, pointing at a stable `/gallery/<product-id>` URL.
- [ ] Photo, name, and price are on the card.
- [ ] Height, length, and width of the real piece are on the card, in cm and in inches.
- [ ] The measurements are the finished piece, not the paper card and not the photo.
- [ ] PDF and PNG come from the admin print view.
- [ ] Reprinting for a new event can change `loc=` without changing the product path.

### What the phone page asks

The gallery link opens a mobile page for that one product. The normal product page (`/product/:id`) should show the same size line, so the catalog and the card agree. The QR page shows it again, under the name, before the form.

Then the visitor:

1. Chooses a quantity.
2. Picks a color, when that product has a list of colors. Skip this step when the list is empty.
3. Optionally checks **Paint it yourself** (unpainted / bisque). Show that price when it differs from the finished price. Hide the checkbox when the product does not offer it.
4. Enters contact details (name, email, phone). Save them with the proposed `customers` row when the email already exists, or create that row when it does not.
5. Continues to Stripe Checkout and pays there.

The page is one product. It does not need the full cart. After payment, Stripe sends the visitor back to a short thank-you page on your site.

### Columns to add later

These are sketches for a later migration. Do not run them in the pull request that adds this section. They assume the **proposed** tables already exist (`products`, `purchase_requests`, `purchase_request_items` if you split lines out, `inventory`, `orders`, `customers`, `admin_users`). If a column is already on that proposed table, skip the duplicate.

Sizes are stored in centimeters. `dimension_unit` records that, and the default is `cm`. Inches on the card and on the pages are calculated (`cm / 2.54`, one decimal). Storing inches as well would let the two numbers drift apart.

```sql
alter table public.products
  add column slug text unique,
  add column gallery_card_image_url text,
  add column available_colors text[],
  add column paint_yourself_available boolean not null default false,
  add column paint_yourself_price_cents integer
    check (paint_yourself_price_cents is null or paint_yourself_price_cents >= 0),
  add column height_cm numeric(6, 1)
    check (height_cm is null or height_cm > 0),
  add column length_cm numeric(6, 1)
    check (length_cm is null or length_cm > 0),
  add column width_cm numeric(6, 1)
    check (width_cm is null or width_cm > 0),
  add column dimension_unit text not null default 'cm'
    check (dimension_unit = 'cm');
```

The shop today stores product prices in dollars. `paint_yourself_price_cents` is integer cents so Stripe can use it directly. The code change should convert the normal price to cents the same way when it builds the Checkout Session.

On the proposed admin product form, collect height, length, and width in centimeters when you add or edit a piece. The print view should refuse to print, or mark the card incomplete, until all three numbers are filled in.

Quantity, color, and paint-yourself describe the line. Source and gallery describe the visit, so they live on the request. If the proposed schema has no `purchase_request_items` table, put the three line columns on `purchase_requests` instead.

```sql
alter table public.purchase_requests
  add column source text not null default 'web'
    check (source in ('web', 'gallery_qr')),
  add column gallery_location text;

alter table public.purchase_request_items
  add column quantity integer not null default 1
    check (quantity > 0),
  add column color_preference text,
  add column paint_yourself boolean not null default false;
```

`color_preference` must be one of that product’s `available_colors`, or empty when the product has no colors. `paint_yourself` may be true only when `paint_yourself_available` is true.

### Stripe Checkout and stock

Follow the same payment rule as the rest of this plan: a successful-looking return URL is not proof of payment.

1. Save the proposed `purchase_requests` row first, with `source = 'gallery_qr'`, the `gallery_location`, and the line (quantity, color, paint-yourself). It is not paid yet.
2. Create a Stripe Checkout Session. The line item is the product name, the quantity, and the unit amount. Use `paint_yourself_price_cents` when paint-yourself is checked and that price is set. Otherwise use the normal product price.
3. Put the request id, product id, color, paint-yourself flag, `source`, and `gallery_location` in the session metadata. Stripe shows the line items to the customer; the metadata is for your webhook.
4. When Stripe sends `checkout.session.completed` and the signature matches, create the proposed `orders` row with its Stripe payment status set to paid, and attach it to that purchase request.
5. Decrement proposed `inventory` in that same step, once. A second delivery of the same event must not decrement again.

Stock at zero is a made-to-order piece, which is normal for molds. Still let the visitor order. Show a lead time on the QR page and on the card when you know it. Leave inventory at zero instead of going negative, and mark the order as a backorder so you can cast it after the show. The open questions below are the place to change that rule.

### Gallery operations

Each printed batch can name where it hangs. The `loc` query on the QR is stored as `gallery_location` (a short label such as `casco-viejo` or `feria-2026`). You can also add `utm_source=gallery`, `utm_medium=qr`, and `utm_campaign=<location>` on the same URL. The columns are what the admin list filters on. The UTM tags are a spare copy if you later read traffic in an analytics tool.

An admin view can list proposed orders (or purchase requests) where `source = 'gallery_qr'`, grouped by `gallery_location`, with color, paint-yourself, quantity, and payment status. That view is behind the same admin login as the rest of the shop (`admin_users`). It can be a filter on the orders screen you already plan, rather than a new app.

Wi-Fi: the QR code is only a link. The phone has to open your site and reach Stripe. On gallery Wi-Fi, or on the visitor’s mobile data, that works. With neither, the camera can still read the code and the visitor can open it later. Print one line on the card: “Order on your phone. Gallery Wi-Fi or mobile data.” Taking the whole order offline and syncing it later is a different project.

### Open questions

- [ ] Pickup at the gallery, ship to an address, or both?
- [ ] Do any colors cost extra, or is color only a note on the order?
- [ ] What lead time do you promise when stock is 0?
- [ ] Is paint-yourself cheaper, the same price, or only offered on some pieces?
- [ ] Will more than one gallery or event be open at the same time?
- [ ] Card language: Spanish, English, or both on every card?
- [ ] Is showing inches next to centimeters what you want on the printed card?

### Rough size of the work

Do this after the shop is on Vercel and Supabase and the Stripe webhook from section 7 exists.

| Work | Rough time |
| --- | --- |
| Add the columns above and the three measurement fields on the admin product form | about 1 day |
| Print gallery card view (photo, name, price, size, QR, PDF and PNG) | about 1 day |
| Mobile order page: quantity, color, paint-yourself, contact, size | 1–2 days |
| Checkout Session metadata, then create the order and decrement inventory only in the webhook | about 1 day |
| Admin filter for gallery orders | about half a day |

A first version is **about 4–6 days** after the move in the rest of this file. It is shorter when the proposed purchase-request tables and the webhook are already in place.

Later code pull requests for this feature should still avoid secrets, and should leave this plan as the description of the behavior.

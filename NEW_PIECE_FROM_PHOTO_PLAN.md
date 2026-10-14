# New piece from photo — implementation plan

Goal: a photo of a new piece goes live on the shop
with no redeploy.

This file is research and a plan only.
It does not change the shop.

## What the code does today

Checked against the repo before writing this plan.

- Products are read live from Supabase Postgres
  through the Express API in `src/api-app.ts`
  (`GET /api/products`).
- The server uses `DATABASE_URL` and the `postgres`
  driver (Supabase transaction pooler).
  It does not use the Supabase JS client for this.
- The ten sample photos are static files in
  `public/pieces/`:
  `angel.webp`, `baldosa.webp`, `columna.webp`,
  `cornisa.webp`, `fuente.webp`, `jarron.webp`,
  `maceta.webp`, `marco.webp`, `pedestal.webp`,
  `roseton.webp`.
- Seed rows store paths such as `/pieces/columna.webp`.
  A new file in that folder needs a redeploy.
- The Products tab (`/admin/products`) already has
  Add Product and Edit Product
  (`src/pages/admin/AdminProducts.tsx`).
- That form saves name, English name, description,
  English description, category, price, stock,
  and an image.
- Category is free text. There is no category table.
  The shop builds category pages from names already
  on products (`src/lib/categories.ts`,
  route `/shop/:category`).
- The current image field reads the file in the
  browser and stores a data URL on the product row.
  That is not a storage URL, and it is not this plan.
- New rows get an id of `p_` plus a timestamp.
  `id` is the primary key. `name` is not unique.
- Product create, update, and delete already require
  an admin JWT. The server checks it on every write
  (`authenticateAdmin`). A token only in the browser
  is not enough.
- Dark mode is the `dark` class on the page,
  saved as `gcp-theme`. The switch is in the admin
  settings menu. Shop pages follow that choice.
- `vite.config.ts` copies `GEMINI_API_KEY` into the
  browser bundle when that variable is set.
  The calls in this plan must not do that.

## 1. End-to-end flow

- Admin takes or uploads a photo.
- The browser resizes it to about 2000px on the
  long side before upload.
- The server sends the photo to the Photoroom API.
- Photoroom cuts out the piece, puts it on a white
  studio background, and adds a soft shadow.
- Piece pixels stay unchanged.
- Cost is about $0.02 for the basic cutout,
  or about $0.10 with the AI shadow.
- The server sends the cleaned photo to Gemini
  2.5 Flash-Lite (about $0.0005 per item).
- The prompt is fixed. The reply is JSON:
  - `name_es`
  - `name_en`
  - `description_es`
  - `description_en`
  - a suggested category from names already
    on products
- Rules for the model:
  - Describe only what is visible.
  - Do not invent sizes or prices.
  - Two or three short sentences.
- Nothing is saved until the admin reviews it.
- On Approve:
  - Upload the photo to Supabase Storage.
  - Use a public bucket, for example `product-photos`.
  - Insert the product row:
    name, `name_en`, description, `description_en`,
    category, price, stock,
    and `imageUrl` set to the storage public URL.
- The piece is live on the next product fetch.
  No redeploy.

## 2. Admin screens

- Add a "New piece from photo" button next to
  the existing Add Product button on the Products tab.
- Review screen:
  - Original photo and cleaned photo, side by side.
  - Editable Spanish and English name.
  - Editable Spanish and English description.
  - Category picker of names already on products.
    The admin can still type a new name.
    A new name becomes its own shop category page.
  - Price and stock, entered by the admin.
    The model does not set these.
- Buttons:
  - Approve and publish
  - Retake photo
  - Regenerate text
  - Cancel (discards the draft, saves nothing)

## 3. Errors and fallbacks

- Photoroom fails: use the original photo, or retry.
- Gemini fails: leave the text fields empty
  so the admin can type them.
- Over about 10 MB, or not an image:
  reject it with a clear message.
- Duplicate name: warn, then let the admin rename
  or save anyway.
  Each product still gets its own id.
- If the database insert fails after the upload:
  delete the uploaded photo.
  Do not leave orphan files.

## 4. Security and cost

- `PHOTOROOM_API_KEY` and `GEMINI_API_KEY` live only
  in Vercel environment variables.
- Never put them in the repo, in the browser,
  or in the Vite `define` block in `vite.config.ts`.
- Endpoints require an admin login.
  The server checks the JWT on every request,
  the same way product writes already do.
- Limits: at most 30 photos per hour,
  and 200 per month.
  That caps the extra cost at a few dollars.
- The storage bucket is public-read.
  Only the server can write to it.

## 5. Testing before merge

- On the preview link, try 3 real pieces.
- Check photo quality, Spanish, and English.
- Simulate each service failing
  and confirm the fallbacks above.
- Confirm a logged-out request is blocked.
- After approve, the piece shows in the shop
  immediately:
  - Spanish
  - English (language toggle)
  - dark mode (`gcp-theme`)
  - its category page under `/shop/...`
- `npm run lint` and `npm run build` pass.

## 6. Pull requests, in order

1. Move product photos to Supabase Storage,
   including the 10 existing pieces.
   Nothing else in that pull request.
2. Server side: Photoroom and Gemini calls,
   admin check, and the hourly and monthly limits.
3. Admin button and review screen.

Photoroom and Gemini API keys are needed before
pull request 2.

They will be requested securely and stored only
in Vercel settings.

This repo is public. No secrets anywhere.

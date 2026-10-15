-- Panama delivery address stored with the order.
-- Nullable so orders placed before this column existed stay valid.
-- Apply this file yourself (Supabase SQL editor, or `npm run db:migrate` on a local database).
-- Do not run it against production from this change. The Vercel server does not run this file.
-- Until the column exists, checkout still saves a readable copy in shipping_address.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_address jsonb;

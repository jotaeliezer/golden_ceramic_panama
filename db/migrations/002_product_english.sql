-- Optional English catalog copy. Safe to run more than once.
-- Nullable on purpose: an empty value means the shop keeps the Spanish text.
-- Apply this file yourself (Supabase SQL editor, or `npm run db:migrate`).
-- The Vercel server does not run this file.
-- The shop can be deployed before this file runs. Reads do not require these
-- columns. English text appears only after the columns exist and are filled.

ALTER TABLE products ADD COLUMN IF NOT EXISTS name_en text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS description_en text;

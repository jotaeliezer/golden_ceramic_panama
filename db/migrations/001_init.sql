-- Golden Ceramic Panama schema. Safe to run more than once.
-- Apply this file yourself (Supabase SQL editor, or `npm run db:migrate`).
-- The Vercel server does not run this file.

CREATE TABLE IF NOT EXISTS products (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text,
  price double precision NOT NULL,
  "imageUrl" text,
  category text,
  stock integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
  id text PRIMARY KEY,
  customer_email text NOT NULL,
  total_amount double precision NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  shipping_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- No foreign keys. SQLite listed them, but the server never enabled
-- PRAGMA foreign_keys, so deleting a product after an order still worked.
CREATE TABLE IF NOT EXISTS order_items (
  id text PRIMARY KEY,
  order_id text NOT NULL,
  product_id text NOT NULL,
  quantity integer NOT NULL,
  price double precision NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_users (
  id text PRIMARY KEY,
  email text NOT NULL UNIQUE,
  password text NOT NULL
);

CREATE INDEX IF NOT EXISTS order_items_order_id_idx ON order_items (order_id);

-- Turn on row security with no policies. The public Supabase API cannot read
-- these tables. The DATABASE_URL login (the postgres role) bypasses row security,
-- which is how the Express server reads and writes.
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

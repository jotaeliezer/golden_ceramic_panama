import Database from 'better-sqlite3';
import { join } from 'path';

// Connect to SQLite database
const db = new Database(join(process.cwd(), 'sqlite.db'));
db.pragma('journal_mode = WAL');

// Initialize database schema
db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL,
    imageUrl TEXT,
    category TEXT,
    stock INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    customer_email TEXT NOT NULL,
    total_amount REAL NOT NULL,
    status TEXT DEFAULT 'pending',
    shipping_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    price REAL NOT NULL,
    FOREIGN KEY(order_id) REFERENCES orders(id),
    FOREIGN KEY(product_id) REFERENCES products(id)
  );

  CREATE TABLE IF NOT EXISTS admin_users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL
  );
`);

// Insert default admin if not exists (password is 'admin123' for demo purposes)
const adminExists = db.prepare("SELECT 1 FROM admin_users WHERE email = ?").get('admin@goldenceramic.com');
if (!adminExists) {
  // In a real app we would hash this password with bcrypt. Using plain string to keep demo simple
  db.prepare("INSERT INTO admin_users (id, email, password) VALUES (?, ?, ?)").run('admin-1', 'admin@goldenceramic.com', 'admin123');
}

// Ensure at least some test products exist
const productExists = db.prepare("SELECT 1 FROM products LIMIT 1").get();
if (!productExists) {
    const products = [
        { id: 'p1', name: 'Fluted Column Mold', description: 'Classic fluted column design for elegant plaster or ceramic casting.', price: 125, imageUrl: 'https://images.unsplash.com/photo-1610701596007-11502861dcfa?q=80&w=600&auto=format&fit=crop', category: 'Columns', stock: 10 },
        { id: 'p2', name: 'Baroque Pedestal Mold', description: 'Intricate baroque styling perfect for statement pieces and garden pedestals.', price: 210, imageUrl: 'https://images.unsplash.com/photo-1601614881775-81d3999dae85?q=80&w=600&auto=format&fit=crop', category: 'Pedestals', stock: 5 },
        { id: 'p3', name: 'Minimalist Cylinder Mold', description: 'Clean, modern lines for versatile contemporary pottery.', price: 85, imageUrl: 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?q=80&w=600&auto=format&fit=crop', category: 'Modern', stock: 25 },
        { id: 'p4', name: 'Art Deco Planter Mold', description: 'Geometric art deco patterns for stylish home planters.', price: 145, imageUrl: 'https://images.unsplash.com/photo-1620021307612-4c6dbf6aa9b4?q=80&w=600&auto=format&fit=crop', category: 'Planters', stock: 12 }
    ];

    const insertProduct = db.prepare("INSERT INTO products (id, name, description, price, imageUrl, category, stock) VALUES (?, ?, ?, ?, ?, ?, ?)");
    for (const p of products) {
        insertProduct.run(p.id, p.name, p.description, p.price, p.imageUrl, p.category, p.stock);
    }
}

export default db;

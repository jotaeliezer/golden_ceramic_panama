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

// Sample catalog for an empty shop. Skipped when any product row already exists,
// so a restart never duplicates these rows or overwrites a real catalog.
const productCount = db.prepare("SELECT COUNT(*) AS count FROM products").get() as { count: number };
if (productCount.count === 0) {
    const products: Array<{
        id: string;
        name: string;
        description: string;
        price: number;
        imageUrl: string;
        category: string;
        stock: number;
    }> = [
        {
            id: 'molde-jarron',
            name: 'Molde para jarrón',
            description: 'Molde de dos piezas para colada de barbotina. Produce un jarrón alto de boca estrecha, listo para el horno del taller en la Ciudad de Panamá.',
            price: 92,
            imageUrl: '/products/molde-jarron.svg',
            category: 'Jarrones',
            stock: 8,
        },
        {
            id: 'molde-taza',
            name: 'Molde para taza',
            description: 'Molde de colada para una taza de café con asa. El espesor de la pared queda parejo para un secado uniforme antes de la quema.',
            price: 38,
            imageUrl: '/products/molde-taza.svg',
            category: 'Tazas',
            stock: 16,
        },
        {
            id: 'molde-cuenco',
            name: 'Molde para cuenco',
            description: 'Molde para un cuenco hondo de perfil redondeado, en yeso o en cerámica. Queda bien en la mesa, para fruta o para servir.',
            price: 54,
            imageUrl: '/products/molde-cuenco.svg',
            category: 'Cuencos',
            stock: 12,
        },
        {
            id: 'molde-plato',
            name: 'Molde para plato',
            description: 'Molde de colada para un plato llano de borde suave. Incluye el anillo del pie para que la pieza asiente sin bambolearse.',
            price: 48.5,
            imageUrl: '/products/molde-plato.svg',
            category: 'Platos',
            stock: 14,
        },
        {
            id: 'molde-jarra',
            name: 'Molde para jarra',
            description: 'Molde de colada para una jarra de pico y asa, de tamaño de mesa. La barbotina se reparte de forma pareja en el cuerpo.',
            price: 67,
            imageUrl: '/products/molde-jarra.svg',
            category: 'Jarras',
            stock: 7,
        },
        {
            id: 'figurilla-precolombina',
            name: 'Figurilla precolombina',
            description: 'Molde de una figura de pie con líneas geométricas, inspirada en la cerámica del istmo y no en una pieza de museo. Se cuela en yeso o en pasta cerámica.',
            price: 84,
            imageUrl: '/products/figurilla-precolombina.svg',
            category: 'Figuras',
            stock: 5,
        },
        {
            id: 'plato-pollera-mola',
            name: 'Plato pollera y mola',
            description: 'Molde de un plato decorativo con el vuelo de una pollera y un recuadro de motivos al estilo de la mola. Pensado para colada y para pintar a mano después del horno.',
            price: 72,
            imageUrl: '/products/plato-pollera-mola.svg',
            category: 'Panamá',
            stock: 9,
        },
        {
            id: 'recuerdo-canal',
            name: 'Recuerdo del Canal',
            description: 'Molde de una placa pequeña con un barco entre las esclusas. Un recuerdo de yeso o cerámica del Canal de Panamá.',
            price: 45,
            imageUrl: '/products/recuerdo-canal.svg',
            category: 'Panamá',
            stock: 18,
        },
        {
            id: 'molde-candelero',
            name: 'Molde de candelero',
            description: 'Molde de dos piezas para un candelero bajo de una sola vela, con base ancha. Se desmolda en frío y acepta yeso o pasta.',
            price: 36.5,
            imageUrl: '/products/molde-candelero.svg',
            category: 'Candelabros',
            stock: 20,
        },
        {
            id: 'molde-maceta',
            name: 'Molde de maceta',
            description: 'Molde para una maceta cónica de borde reforzado, con la marca del orificio de drenaje en la base. La pieza va después al horno propio del taller.',
            price: 79,
            imageUrl: '/products/molde-maceta.svg',
            category: 'Macetas',
            stock: 10,
        },
    ];

    const insertProduct = db.prepare(
        "INSERT INTO products (id, name, description, price, imageUrl, category, stock, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    );
    const seedProducts = db.transaction((rows: typeof products) => {
        const newestFirst = Date.UTC(2026, 0, 15, 15, 0, 0);
        rows.forEach((p, index) => {
            const createdAt = new Date(newestFirst - index * 1000)
                .toISOString()
                .slice(0, 19)
                .replace('T', ' ');
            insertProduct.run(p.id, p.name, p.description, p.price, p.imageUrl, p.category, p.stock, createdAt);
        });
    });
    seedProducts(products);
}

export default db;

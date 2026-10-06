import express from "express";
import type { ErrorRequestHandler } from "express";
import { createServer as createViteServer } from "vite";
import cors from "cors";
import fs from "fs";
import path from "path";
import { randomBytes } from "crypto";
import jwt from "jsonwebtoken";
import db from "./src/db.js";
import { defaultMoldName } from "./src/lib/moldName.js";
import Stripe from "stripe";

// Temporary local mold photos until the Supabase migration. Never commit this folder.
const uploadsDir = path.join(process.cwd(), "uploads");
const CAPTURE_JSON_LIMIT = "6mb";
const MAX_JPEG_BYTES = 4 * 1024 * 1024;

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-default-key-golden-ceramic';

let stripeClient: Stripe | null = null;
function getStripe(): Stripe {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error('STRIPE_SECRET_KEY environment variable is required to process real payments.');
    }
    stripeClient = new Stripe(key);
  }
  return stripeClient;
}

class CaptureValidationError extends Error {}

type NewProduct = {
  id?: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  category: string;
  stock: number;
};

function insertProduct(product: NewProduct): string {
  const id = product.id ?? `p_${Date.now()}`;
  db.prepare(
    "INSERT INTO products (id, name, description, price, imageUrl, category, stock) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(
    id,
    product.name,
    product.description,
    product.price,
    product.imageUrl,
    product.category,
    product.stock
  );
  return id;
}

function parseCaptureName(value: unknown): string {
  if (value == null || value === "") return defaultMoldName();
  if (typeof value !== "string") throw new CaptureValidationError("Name must be text.");
  const name = value.replace(/[\u0000-\u001F\u007F]/g, "").replace(/\s+/g, " ").trim();
  if (!name) return defaultMoldName();
  if (name.length > 120) throw new CaptureValidationError("Name must be 120 characters or fewer.");
  return name;
}

function parseCaptureQuantity(value: unknown): number {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 1_000_000) {
    return value;
  }
  if (typeof value === "string" && /^(0|[1-9]\d*)$/.test(value)) {
    const quantity = Number(value);
    if (quantity <= 1_000_000) return quantity;
  }
  throw new CaptureValidationError("Enter a whole number of pieces, 0 or more.");
}

function decodeJpegDataUrl(value: unknown): Buffer {
  if (typeof value !== "string" || !value.startsWith("data:image/jpeg;base64,")) {
    throw new CaptureValidationError("Photo must be a JPEG.");
  }
  const encoded = value.slice("data:image/jpeg;base64,".length).replace(/\s/g, "");
  if (!encoded || encoded.length > 6 * 1024 * 1024) {
    throw new CaptureValidationError("Photo is too large.");
  }
  const buffer = Buffer.from(encoded, "base64");
  if (
    buffer.length < 32 ||
    buffer.length > MAX_JPEG_BYTES ||
    buffer[0] !== 0xff ||
    buffer[1] !== 0xd8 ||
    buffer[2] !== 0xff
  ) {
    throw new CaptureValidationError(buffer.length > MAX_JPEG_BYTES ? "Photo is too large." : "Photo must be a JPEG.");
  }
  return buffer;
}

function saveCapturedMold(body: unknown): { id: string; name: string; stock: number; imageUrl: string } {
  if (!body || typeof body !== "object") throw new CaptureValidationError("Missing capture details.");
  const record = body as { name?: unknown; quantity?: unknown; imageDataUrl?: unknown };
  const name = parseCaptureName(record.name);
  const stock = parseCaptureQuantity(record.quantity);
  const jpeg = decodeJpegDataUrl(record.imageDataUrl);

  const id = `p_${Date.now().toString(36)}_${randomBytes(4).toString("hex")}`;
  const filename = `${id}.jpg`;
  const dest = path.join(uploadsDir, filename);
  fs.mkdirSync(uploadsDir, { recursive: true });
  fs.writeFileSync(dest, jpeg, { flag: "wx" });

  const imageUrl = `/uploads/${filename}`;
  try {
    insertProduct({
      id,
      name,
      description: "Captured on the shop floor. Temporary local catalog entry until the Supabase migration.",
      price: 0,
      imageUrl,
      category: "Molds",
      stock,
    });
  } catch (error) {
    fs.rmSync(dest, { force: true });
    throw error;
  }

  return { id, name, stock, imageUrl };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  fs.mkdirSync(uploadsDir, { recursive: true });

  const parseJson = express.json({ limit: "100kb" });
  const parseCaptureJson = express.json({ limit: CAPTURE_JSON_LIMIT });
  app.use((req, res, next) => {
    if (req.method === "POST" && req.path === "/api/admin/capture") {
      parseCaptureJson(req, res, next);
      return;
    }
    parseJson(req, res, next);
  });

  const handleJsonError: ErrorRequestHandler = (err, _req, res, next) => {
    if (err && typeof err === "object" && "type" in err && err.type === "entity.too.large") {
      res.status(413).json({ error: "Photo is too large. Try a smaller image." });
      return;
    }
    next(err);
  };
  app.use(handleJsonError);

  app.use(cors());
  app.use("/uploads", express.static(uploadsDir, { index: false, dotfiles: "deny", fallthrough: false }));

  // === Authentication Middleware ===

  const authenticateAdmin = (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "No token provided" });
    
    const token = authHeader.split(" ")[1];
    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (err) return res.status(403).json({ error: "Invalid token" });
      req.user = user;
      next();
    });
  };

  // === API ROUTES ===

  // Public: List Products
  app.get("/api/products", (req, res) => {
    try {
      const products = db.prepare("SELECT * FROM products ORDER BY created_at DESC").all();
      res.json(products);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Public: Get single product
  app.get("/api/products/:id", (req, res) => {
    try {
      const product = db.prepare("SELECT * FROM products WHERE id = ?").get(req.params.id);
      if (!product) return res.status(404).json({ error: "Product not found" });
      res.json(product);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Public: Checkout/Order
  app.post("/api/checkout", async (req, res) => {
    const { items, customerEmail, shippingAddress } = req.body;
    
    try {
      // Begin transaction
      const createOrder = db.transaction(() => {
        let totalAmount = 0;
        const orderId = 'ord_' + Date.now();
        const lineItems: any[] = [];
        
        // Calculate total and prepare items
        const processedItems = items.map((item: any) => {
          const product = db.prepare("SELECT name, price, stock, imageUrl FROM products WHERE id = ?").get(item.id) as any;
          if (!product || product.stock < item.quantity) {
             throw new Error(`Invalid or out of stock product: ${item.id}`);
          }
          const price = product.price;
          totalAmount += price * item.quantity;
          
          lineItems.push({
            price_data: {
              currency: 'usd',
              product_data: {
                name: product.name,
                images: product.imageUrl ? [product.imageUrl] : [],
              },
              unit_amount: Math.round(price * 100),
            },
            quantity: item.quantity,
          });

          return { productId: item.id, quantity: item.quantity, price };
        });

        // Insert Order
        db.prepare("INSERT INTO orders (id, customer_email, total_amount, shipping_address) VALUES (?, ?, ?, ?)").run(
          orderId, customerEmail, totalAmount, shippingAddress
        );

        // Insert Items and reduce stock
        const insertItem = db.prepare("INSERT INTO order_items (id, order_id, product_id, quantity, price) VALUES (?, ?, ?, ?, ?)");
        const updateStock = db.prepare("UPDATE products SET stock = stock - ? WHERE id = ?");
        
        processedItems.forEach((pi, index) => {
           insertItem.run(`${orderId}_item_${index}`, orderId, pi.productId, pi.quantity, pi.price);
           updateStock.run(pi.quantity, pi.productId);
        });

        return { orderId, lineItems };
      });

      const { orderId, lineItems } = createOrder();
      
      let checkoutUrl = null;
      try { // Attempt stripe checkout if keys exist
        const stripe = getStripe();
        const session = await stripe.checkout.sessions.create({
          payment_method_types: ['card'],
          line_items: lineItems,
          mode: 'payment',
          success_url: `${process.env.APP_URL || 'http://localhost:3000'}?success=true&orderId=${orderId}`,
          cancel_url: `${process.env.APP_URL || 'http://localhost:3000'}/cart?canceled=true`,
          customer_email: customerEmail,
        });
        checkoutUrl = session.url;
      } catch (e: any) {
         console.warn("Stripe Checkout skipped or failed. Falling back to local direct success.", e.message);
      }

      res.json({ success: true, orderId, checkoutUrl });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Auth: Login
  app.post("/api/auth/login", (req, res) => {
    const { email, password } = req.body;
    try {
      const user = db.prepare("SELECT id FROM admin_users WHERE email = ? AND password = ?").get(email, password) as any;
      if (user) {
        const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ token });
      } else {
        res.status(401).json({ error: "Invalid credentials" });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: create product
  app.post("/api/products", authenticateAdmin, (req, res) => {
    const { name, description, price, imageUrl, category, stock } = req.body;
    try {
      const id = insertProduct({
        name,
        description,
        price: parseFloat(price),
        imageUrl,
        category,
        stock: parseInt(stock),
      });
      res.json({ id });
    } catch(err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Admin: shop-floor photo capture. Temporary local file + the same product insert as POST /api/products.
  app.post("/api/admin/capture", authenticateAdmin, (req, res) => {
    try {
      res.status(201).json(saveCapturedMold(req.body));
    } catch (err: any) {
      if (err instanceof CaptureValidationError) {
        res.status(400).json({ error: err.message });
        return;
      }
      console.error("Capture save failed", err);
      res.status(500).json({ error: "Could not save this piece." });
    }
  });

  // Admin: update product
  app.put("/api/products/:id", authenticateAdmin, (req, res) => {
    const { name, description, price, imageUrl, category, stock } = req.body;
    try {
      db.prepare("UPDATE products SET name=?, description=?, price=?, imageUrl=?, category=?, stock=? WHERE id=?").run(
        name, description, parseFloat(price), imageUrl, category, parseInt(stock), req.params.id
      );
      res.json({ success: true });
    } catch(err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Admin: Delete product
  app.delete("/api/products/:id", authenticateAdmin, (req, res) => {
    try {
      db.prepare("DELETE FROM products WHERE id=?").run(req.params.id);
      res.json({ success: true });
    } catch(err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Admin: List orders
  app.get("/api/orders", authenticateAdmin, (req, res) => {
    try {
      const orders = db.prepare("SELECT * FROM orders ORDER BY created_at DESC").all();
      // fetch items for each order
      const ordersWithItems = orders.map((o: any) => {
        const items = db.prepare(`
          SELECT oi.*, p.name as product_name
          FROM order_items oi
          LEFT JOIN products p ON oi.product_id = p.id
          WHERE oi.order_id = ?
        `).all(o.id);
        return { ...o, items };
      });
      res.json(ordersWithItems);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Update order status
  app.put("/api/orders/:id/status", authenticateAdmin, (req, res) => {
    const { status } = req.body;
    try {
      db.prepare("UPDATE orders SET status=? WHERE id=?").run(status, req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // === Vite Middleware for Development ===
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    // @ts-ignore
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import cors from "cors";
import path from "path";
import jwt from "jsonwebtoken";
import db from "./src/db.js";
import Stripe from "stripe";

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-default-key-golden-ceramic';

// Test mode is the default. Checkout sessions are created only with an sk_test_ key
// unless STRIPE_ALLOW_LIVE=true is set explicitly.
function assertStripeKeyAllowed(key: string): void {
  if (key.startsWith("sk_test_")) return;

  const allowLive = process.env.STRIPE_ALLOW_LIVE === "true";
  if (allowLive && key.startsWith("sk_live_")) return;

  const message = key.startsWith("sk_live_")
    ? "Refusing to create a Stripe Checkout session: STRIPE_SECRET_KEY is a live key (sk_live_). Test mode is the default, so no Checkout session was created and no real charge can be made. Use a test secret key (sk_test_) from the Stripe Dashboard with Test mode turned on, or set STRIPE_ALLOW_LIVE=true to opt in to live charges."
    : "Refusing to create a Stripe Checkout session: STRIPE_SECRET_KEY must be a test secret key starting with sk_test_. Test mode is the default. Set STRIPE_ALLOW_LIVE=true only when you intentionally pass an sk_live_ key.";
  console.warn(message);
  throw new Error(message);
}

let stripeClient: Stripe | null = null;
function getStripe(): Stripe {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY?.trim();
    if (!key) {
      throw new Error('STRIPE_SECRET_KEY environment variable is required to process real payments.');
    }
    assertStripeKeyAllowed(key);
    stripeClient = new Stripe(key);
  }
  return stripeClient;
}

function orderIdFromCheckoutSession(session: Stripe.Checkout.Session): string | null {
  const fromMetadata = session.metadata?.orderId?.trim();
  if (fromMetadata) return fromMetadata;
  const fromReference = session.client_reference_id?.trim();
  if (fromReference) return fromReference;
  return null;
}

// Stock moves only here, and only once. A Stripe retry sees status "paid" and stops.
// orders has no session or payment_intent column, so those ids are not stored.
function markOrderPaidAndLowerStock(orderId: string): "paid" | "already_paid" | "missing" {
  const apply = db.transaction((): "paid" | "already_paid" | "missing" => {
    const claimed = db
      .prepare("UPDATE orders SET status = 'paid' WHERE id = ? AND status != 'paid'")
      .run(orderId);
    if (claimed.changes === 0) {
      const existing = db.prepare("SELECT id FROM orders WHERE id = ?").get(orderId);
      return existing ? "already_paid" : "missing";
    }

    const items = db
      .prepare("SELECT product_id, quantity FROM order_items WHERE order_id = ?")
      .all(orderId) as { product_id: string; quantity: number }[];
    const updateStock = db.prepare("UPDATE products SET stock = stock - ? WHERE id = ?");
    for (const item of items) {
      updateStock.run(item.quantity, item.product_id);
    }
    return "paid";
  });
  return apply();
}

function markPendingOrderCanceled(orderId: string): "canceled" | "unchanged" | "missing" {
  const apply = db.transaction((): "canceled" | "unchanged" | "missing" => {
    const existing = db.prepare("SELECT status FROM orders WHERE id = ?").get(orderId) as
      | { status: string }
      | undefined;
    if (!existing) return "missing";
    if (existing.status !== "pending") return "unchanged";
    db.prepare("UPDATE orders SET status = 'canceled' WHERE id = ? AND status = 'pending'").run(orderId);
    return "canceled";
  });
  return apply();
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Raw body required for signature verification. Must run before express.json().
  app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), (req, res) => {
    const signature = req.headers["stripe-signature"];
    if (!signature || (!Buffer.isBuffer(req.body) && typeof req.body !== "string")) {
      return res.status(400).json({ error: "Invalid signature" });
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
    if (!webhookSecret) {
      console.warn("STRIPE_WEBHOOK_SECRET is not set. Refusing the webhook.");
      return res.status(500).json({ error: "Webhook secret is not configured" });
    }

    let stripe: Stripe;
    try {
      stripe = getStripe();
    } catch (err: any) {
      console.warn(err.message);
      return res.status(500).json({ error: "Stripe is not configured" });
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
    } catch {
      console.warn("Stripe webhook signature verification failed.");
      return res.status(400).json({ error: "Invalid signature" });
    }

    try {
      if (event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.payment_status === "paid") {
          const orderId = orderIdFromCheckoutSession(session);
          if (!orderId) {
            console.warn("checkout.session.completed had no metadata.orderId or client_reference_id.");
          } else {
            const result = markOrderPaidAndLowerStock(orderId);
            if (result === "paid") {
              console.log(`Order ${orderId} marked paid. Stock lowered.`);
            } else if (result === "already_paid") {
              console.log(`Order ${orderId} is already paid. Stock left unchanged.`);
            } else {
              console.warn(`No order found for ${orderId}. Stock left unchanged.`);
            }
          }
        }
      } else if (event.type === "checkout.session.expired") {
        const session = event.data.object as Stripe.Checkout.Session;
        const orderId = orderIdFromCheckoutSession(session);
        if (!orderId) {
          console.warn("checkout.session.expired had no metadata.orderId or client_reference_id.");
        } else {
          const result = markPendingOrderCanceled(orderId);
          if (result === "canceled") {
            console.log(`Order ${orderId} marked canceled. Stock unchanged.`);
          } else if (result === "missing") {
            console.warn(`No order found for expired session ${orderId}.`);
          } else {
            console.log(`Order ${orderId} was not pending. Expired event left it unchanged.`);
          }
        }
      }
    } catch (err: any) {
      console.warn("Stripe webhook failed while updating the order.", err?.message ?? err);
      return res.status(500).json({ error: "Webhook handler failed" });
    }

    return res.status(200).json({ received: true });
  });

  app.use(express.json());
  app.use(cors());

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

        // Orders start pending. Stock is checked above and lowered only after Stripe confirms payment.
        db.prepare("INSERT INTO orders (id, customer_email, total_amount, shipping_address, status) VALUES (?, ?, ?, ?, ?)").run(
          orderId, customerEmail, totalAmount, shippingAddress, "pending"
        );

        const insertItem = db.prepare("INSERT INTO order_items (id, order_id, product_id, quantity, price) VALUES (?, ?, ?, ?, ?)");
        processedItems.forEach((pi, index) => {
           insertItem.run(`${orderId}_item_${index}`, orderId, pi.productId, pi.quantity, pi.price);
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
          client_reference_id: orderId,
          metadata: { orderId },
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
      const id = 'p_' + Date.now();
      db.prepare("INSERT INTO products (id, name, description, price, imageUrl, category, stock) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
        id, name, description, parseFloat(price), imageUrl, category, parseInt(stock)
      );
      res.json({ id });
    } catch(err: any) {
      res.status(500).json({ error: err.message });
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

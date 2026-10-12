import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import Stripe from "stripe";
import { markOrderPaidAndLowerStock, markPendingOrderCanceled, sql } from "./db.js";

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-default-key-golden-ceramic";

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
      throw new Error("STRIPE_SECRET_KEY environment variable is required to process real payments.");
    }
    assertStripeKeyAllowed(key);
    stripeClient = new Stripe(key);
  }
  return stripeClient;
}

function headerValue(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.split(",")[0]?.trim() || undefined;
}

/** Preview deployments use the request host. APP_URL is only a fallback. */
function requestOrigin(req: express.Request): string {
  const host = headerValue(req.headers["x-forwarded-host"]) || req.get("host");
  if (host) {
    const proto = headerValue(req.headers["x-forwarded-proto"]) || req.protocol || "http";
    return `${proto}://${host}`;
  }
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

function stripeImages(imageUrl: unknown): string[] {
  if (typeof imageUrl === "string" && /^https?:\/\//i.test(imageUrl)) return [imageUrl];
  return [];
}

/**
 * Vercel rewrites /api/* onto this one function. Put the original path back
 * when the rewrite stashed it in __vcpath. Leave a normal /api/... URL alone.
 */
function restoreVercelApiPath(req: express.Request, _res: express.Response, next: express.NextFunction) {
  const queryIndex = req.url.indexOf("?");
  if (queryIndex === -1) return next();

  const params = new URLSearchParams(req.url.slice(queryIndex + 1));
  const vcpath = params.get("__vcpath");
  if (!vcpath) return next();

  const pathOnly = req.url.slice(0, queryIndex);
  if (pathOnly.startsWith("/api/") && pathOnly !== "/api/index") return next();

  params.delete("__vcpath");
  const rest = params.toString();
  const suffix = vcpath.startsWith("/") ? vcpath : `/${vcpath}`;
  req.url = `/api${suffix}${rest ? `?${rest}` : ""}`;
  next();
}

function orderIdFromCheckoutSession(session: Stripe.Checkout.Session): string | null {
  const fromMetadata = session.metadata?.orderId?.trim();
  if (fromMetadata) return fromMetadata;
  const fromReference = session.client_reference_id?.trim();
  if (fromReference) return fromReference;
  return null;
}

export function createApp(): express.Express {
  const app = express();

  app.set("trust proxy", 1);
  app.use(restoreVercelApiPath);

  // Raw body required for signature verification. Must run before express.json().
  app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
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
            const result = await markOrderPaidAndLowerStock(orderId);
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
          const result = await markPendingOrderCanceled(orderId);
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

  app.get("/api/products", async (_req, res) => {
    try {
      const products = await sql`SELECT * FROM products ORDER BY created_at DESC`;
      res.json(products);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/products/:id", async (req, res) => {
    try {
      const [product] = await sql`SELECT * FROM products WHERE id = ${req.params.id}`;
      if (!product) return res.status(404).json({ error: "Product not found" });
      res.json(product);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/orders/:id/status", async (req, res) => {
    try {
      const [order] = await sql`SELECT status FROM orders WHERE id = ${req.params.id}`;
      if (!order) return res.status(404).json({ error: "Order not found" });
      res.json({ status: order.status });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/checkout", async (req, res) => {
    const { items, customerEmail, shippingAddress } = req.body;

    try {
      const { orderId, lineItems } = await sql.begin(async (tx) => {
        let totalAmount = 0;
        const orderId = "ord_" + Date.now();
        const lineItems: any[] = [];

        const processedItems = [];
        for (const item of items as any[]) {
          const [product] = await tx`
            SELECT name, price, stock, "imageUrl"
            FROM products
            WHERE id = ${item.id}
            FOR UPDATE
          `;
          if (!product || product.stock < item.quantity) {
            throw new Error(`Invalid or out of stock product: ${item.id}`);
          }
          const price = product.price;
          totalAmount += price * item.quantity;

          lineItems.push({
            price_data: {
              currency: "usd",
              product_data: {
                name: product.name,
                images: stripeImages(product.imageUrl),
              },
              unit_amount: Math.round(price * 100),
            },
            quantity: item.quantity,
          });

          processedItems.push({ productId: item.id, quantity: item.quantity, price });
        }

        // Orders start pending. Stock is checked above and lowered only after Stripe confirms payment.
        await tx`
          INSERT INTO orders (id, customer_email, total_amount, shipping_address, status)
          VALUES (${orderId}, ${customerEmail}, ${totalAmount}, ${shippingAddress}, ${"pending"})
        `;

        for (let index = 0; index < processedItems.length; index++) {
          const pi = processedItems[index];
          await tx`
            INSERT INTO order_items (id, order_id, product_id, quantity, price)
            VALUES (${`${orderId}_item_${index}`}, ${orderId}, ${pi.productId}, ${pi.quantity}, ${pi.price})
          `;
        }

        return { orderId, lineItems };
      });

      let checkoutUrl = null;
      try {
        const stripe = getStripe();
        const origin = requestOrigin(req);
        const session = await stripe.checkout.sessions.create({
          payment_method_types: ["card"],
          line_items: lineItems,
          mode: "payment",
          success_url: `${origin}/gracias?orderId=${encodeURIComponent(orderId)}`,
          cancel_url: `${origin}/cart?canceled=true`,
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

  app.post("/api/auth/login", async (req, res) => {
    const email = typeof req.body?.email === "string" ? req.body.email : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    if (!email || !password) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    try {
      const [user] = await sql`
        SELECT id, password FROM admin_users WHERE email = ${email}
      `;
      // Plaintext rows are refused until they are replaced with a bcrypt hash.
      const stored = user?.password;
      const hash = typeof stored === "string" && /^\$2[aby]\$\d{2}\$/.test(stored) ? stored : null;
      const matches = hash ? await bcrypt.compare(password, hash) : false;
      if (!user || !matches) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: "24h" });
      res.json({ token });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/products", authenticateAdmin, async (req, res) => {
    const { name, description, price, imageUrl, category, stock } = req.body;
    try {
      const id = "p_" + Date.now();
      await sql`
        INSERT INTO products (id, name, description, price, "imageUrl", category, stock)
        VALUES (${id}, ${name}, ${description}, ${parseFloat(price)}, ${imageUrl}, ${category}, ${parseInt(stock)})
      `;
      res.json({ id });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/products/:id", authenticateAdmin, async (req, res) => {
    const { name, description, price, imageUrl, category, stock } = req.body;
    try {
      await sql`
        UPDATE products
        SET name = ${name},
            description = ${description},
            price = ${parseFloat(price)},
            "imageUrl" = ${imageUrl},
            category = ${category},
            stock = ${parseInt(stock)}
        WHERE id = ${req.params.id}
      `;
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/products/:id", authenticateAdmin, async (req, res) => {
    try {
      await sql`DELETE FROM products WHERE id = ${req.params.id}`;
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/orders", authenticateAdmin, async (_req, res) => {
    try {
      const orders = await sql`SELECT * FROM orders ORDER BY created_at DESC`;
      const ordersWithItems = [];
      for (const order of orders) {
        const items = await sql`
          SELECT oi.*, p.name AS product_name
          FROM order_items oi
          LEFT JOIN products p ON oi.product_id = p.id
          WHERE oi.order_id = ${order.id}
        `;
        ordersWithItems.push({ ...order, items });
      }
      res.json(ordersWithItems);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/orders/:id/status", authenticateAdmin, async (req, res) => {
    const { status } = req.body;
    try {
      await sql`UPDATE orders SET status = ${status} WHERE id = ${req.params.id}`;
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  return app;
}

const app = createApp();
export default app;

import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import Stripe from "stripe";
import { sql } from "./db.js";

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-default-key-golden-ceramic";

let stripeClient: Stripe | null = null;
function getStripe(): Stripe {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY?.trim();
    if (!key) {
      throw new Error("STRIPE_SECRET_KEY environment variable is required to process real payments.");
    }
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

export function createApp(): express.Express {
  const app = express();

  app.set("trust proxy", 1);
  app.use(restoreVercelApiPath);
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

        await tx`
          INSERT INTO orders (id, customer_email, total_amount, shipping_address)
          VALUES (${orderId}, ${customerEmail}, ${totalAmount}, ${shippingAddress})
        `;

        for (let index = 0; index < processedItems.length; index++) {
          const pi = processedItems[index];
          await tx`
            INSERT INTO order_items (id, order_id, product_id, quantity, price)
            VALUES (${`${orderId}_item_${index}`}, ${orderId}, ${pi.productId}, ${pi.quantity}, ${pi.price})
          `;
          await tx`
            UPDATE products SET stock = stock - ${pi.quantity} WHERE id = ${pi.productId}
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
          success_url: `${origin}?success=true&orderId=${orderId}`,
          cancel_url: `${origin}/cart?canceled=true`,
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

  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    try {
      const [user] = await sql`
        SELECT id FROM admin_users WHERE email = ${email} AND password = ${password}
      `;
      if (user) {
        const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: "24h" });
        res.json({ token });
      } else {
        res.status(401).json({ error: "Invalid credentials" });
      }
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

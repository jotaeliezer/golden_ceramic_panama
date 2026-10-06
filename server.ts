import "dotenv/config";
import express from "express";
import path from "path";
import { pathToFileURL } from "url";
import app from "./src/api-app.js";
import { bootstrapLocalSchema } from "./src/db.js";

async function startLocal() {
  if (process.env.VERCEL) return;

  await bootstrapLocalSchema();

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const port = 3000;
  app.listen(port, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}

const entry = process.argv[1];
const isDirectRun = Boolean(entry) && import.meta.url === pathToFileURL(entry).href;

if (!process.env.VERCEL && isDirectRun) {
  startLocal().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

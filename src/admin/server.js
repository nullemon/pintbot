// Tiny Express admin app: dashboard + queue controls. Password-protected.
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "../config.js";
import {
  listPins,
  getPin,
  updatePin,
  deletePin,
  countByStatus,
  isPaused,
  setPaused,
} from "../db.js";
import { registerOAuthRoutes } from "../oauth.js";
import { isAuthorized } from "../pinterest.js";
import { ingestAll } from "../ingest.js";
import { tick, computeNextSlot } from "../scheduler.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Simple shared-password gate via HTTP Basic auth (any username).
function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, encoded] = header.split(" ");
  if (scheme === "Basic" && encoded) {
    const decoded = Buffer.from(encoded, "base64").toString("utf8");
    const pass = decoded.slice(decoded.indexOf(":") + 1);
    if (pass === config.admin.password) return next();
  }
  res.set("WWW-Authenticate", 'Basic realm="pinterest-bot"');
  return res.status(401).send("Authentication required.");
}

export function buildAdminApp() {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // OAuth routes are unauthenticated (Pinterest redirects here).
  registerOAuthRoutes(app);

  // Everything below requires the admin password.
  app.use(requireAuth);

  app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "ui.html"));
  });

  app.get("/api/status", (req, res) => {
    res.json({
      paused: isPaused(),
      authorized: isAuthorized(),
      counts: countByStatus(),
    });
  });

  app.get("/api/pins", (req, res) => {
    const status = req.query.status || null;
    res.json(listPins(status, 300));
  });

  app.post("/api/pause", (req, res) => {
    setPaused(true);
    res.json({ paused: true });
  });

  app.post("/api/resume", (req, res) => {
    setPaused(false);
    res.json({ paused: false });
  });

  app.post("/api/ingest", async (req, res) => {
    try {
      const results = await ingestAll();
      res.json({ ok: true, results });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post("/api/tick", async (req, res) => {
    try {
      const result = await tick();
      res.json({ ok: true, result });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // Edit a pin's title/description/board before it posts.
  app.post("/api/pins/:id", (req, res) => {
    const id = Number(req.params.id);
    const pin = getPin(id);
    if (!pin) return res.status(404).json({ error: "not found" });
    const fields = {};
    for (const key of ["title", "description", "board_id", "scheduled_at"]) {
      if (req.body[key] !== undefined) fields[key] = req.body[key];
    }
    updatePin(id, fields);
    res.json({ ok: true, pin: getPin(id) });
  });

  // Re-queue a failed/dead pin.
  app.post("/api/pins/:id/requeue", (req, res) => {
    const id = Number(req.params.id);
    const pin = getPin(id);
    if (!pin) return res.status(404).json({ error: "not found" });
    updatePin(id, {
      status: "pending",
      attempts: 0,
      error: null,
      scheduled_at: computeNextSlot(),
    });
    res.json({ ok: true, pin: getPin(id) });
  });

  app.delete("/api/pins/:id", (req, res) => {
    deletePin(Number(req.params.id));
    res.json({ ok: true });
  });

  return app;
}

export function startAdminServer() {
  const app = buildAdminApp();
  return app.listen(config.admin.port, () => {
    console.log(
      `[admin] http://localhost:${config.admin.port}  (login: any user / ADMIN_PASSWORD)`
    );
    if (!isAuthorized()) {
      console.log(
        `[admin] Not yet authorized — visit http://localhost:${config.admin.port}/oauth/login`
      );
    }
  });
}

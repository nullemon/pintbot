// Tiny Express admin app: dashboard, setup menu + queue controls.
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
  resetQueue,
  isPaused,
  setPaused,
  getAllSites,
  upsertSite,
  deleteSite,
  getDrip,
  setDrip,
  getPinterestConfig,
  setPinterestConfig,
  pinterestConfigured,
  getAdminPassword,
  setAdminPassword,
} from "../db.js";
import { registerOAuthRoutes } from "../oauth.js";
import { isAuthorized, listBoards } from "../pinterest.js";
import { ingestAll } from "../ingest.js";
import { tick, computeNextSlot } from "../scheduler.js";
import { getImageSettings, setImagePreset, IMAGE_PRESETS } from "../image.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Simple shared-password gate via HTTP Basic auth (any username).
function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, encoded] = header.split(" ");
  if (scheme === "Basic" && encoded) {
    const decoded = Buffer.from(encoded, "base64").toString("utf8");
    const pass = decoded.slice(decoded.indexOf(":") + 1);
    if (pass === getAdminPassword()) return next();
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
      configured: pinterestConfigured(),
      counts: countByStatus(),
    });
  });

  /* ----------------------------- pins ----------------------------- */

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
      res.json({ ok: true, results: await ingestAll() });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post("/api/tick", async (req, res) => {
    try {
      const force = !!(req.body && req.body.force);
      res.json({ ok: true, result: await tick({ force }) });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // Wipe local memory then optionally re-ingest fresh (regenerates images).
  app.post("/api/reset", async (req, res) => {
    try {
      const cleared = resetQueue();
      const results = req.body && req.body.reingest === false ? null : await ingestAll();
      res.json({ ok: true, cleared, results });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

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

  /* --------------------------- settings --------------------------- */

  // Return current setup (secret masked — never sent back in full).
  app.get("/api/settings", (req, res) => {
    const p = getPinterestConfig();
    res.json({
      pinterest: {
        clientId: p.clientId,
        clientSecretSet: !!p.clientSecret,
        redirectUri: p.redirectUri,
        sandbox: p.sandbox,
      },
      drip: getDrip(),
      image: getImageSettings(),
      imagePresets: Object.entries(IMAGE_PRESETS).map(([key, v]) => ({
        key,
        label: v.label,
      })),
      authorized: isAuthorized(),
    });
  });

  app.post("/api/settings/image", (req, res) => {
    try {
      setImagePreset(req.body.preset);
      res.json({ ok: true, image: getImageSettings() });
    } catch (e) {
      res.status(400).json({ ok: false, error: e.message });
    }
  });

  app.post("/api/settings/pinterest", (req, res) => {
    setPinterestConfig({
      clientId: req.body.clientId,
      clientSecret: req.body.clientSecret, // ignored if blank
      redirectUri: req.body.redirectUri,
      sandbox:
        req.body.sandbox === true ||
        req.body.sandbox === "true" ||
        req.body.sandbox === "on",
    });
    res.json({ ok: true, configured: pinterestConfigured() });
  });

  app.post("/api/settings/password", (req, res) => {
    if (!req.body.password || !String(req.body.password).trim()) {
      return res.status(400).json({ ok: false, error: "Password cannot be empty." });
    }
    setAdminPassword(req.body.password);
    res.json({ ok: true });
  });

  app.post("/api/settings/drip", (req, res) => {
    setDrip(req.body);
    res.json({ ok: true, drip: getDrip() });
  });

  /* ----------------------------- sites ---------------------------- */

  app.get("/api/sites", (req, res) => {
    res.json(getAllSites());
  });

  app.post("/api/sites", (req, res) => {
    const b = req.body;
    if (!b.name || !b.rss) {
      return res.status(400).json({ ok: false, error: "name and rss are required." });
    }
    let hashtags = b.hashtags;
    if (typeof hashtags === "string") {
      hashtags = hashtags
        .split(/[\s,]+/)
        .map((t) => t.trim())
        .filter(Boolean)
        .map((t) => (t.startsWith("#") ? t : "#" + t));
    }
    upsertSite({
      name: String(b.name).trim(),
      rss: b.rss,
      restBase: b.restBase || "",
      niche: b.niche || "",
      defaultBoardId: b.defaultBoardId || "",
      hashtags: hashtags || [],
      overlayTitle: b.overlayTitle !== false && b.overlayTitle !== "false",
      enabled: b.enabled !== false && b.enabled !== "false",
    });
    res.json({ ok: true, sites: getAllSites() });
  });

  app.delete("/api/sites/:name", (req, res) => {
    deleteSite(req.params.name);
    res.json({ ok: true });
  });

  // Live board list from Pinterest for the site board dropdown.
  app.get("/api/boards", async (req, res) => {
    if (!isAuthorized()) {
      return res.json({ authorized: false, boards: [] });
    }
    try {
      const boards = await listBoards();
      res.json({
        authorized: true,
        boards: boards.map((b) => ({ id: b.id, name: b.name })),
      });
    } catch (e) {
      res.status(500).json({ authorized: true, boards: [], error: e.message });
    }
  });

  return app;
}

export function startAdminServer() {
  const app = buildAdminApp();
  return app.listen(config.admin.port, () => {
    console.log(`[admin] http://localhost:${config.admin.port}`);
    if (!pinterestConfigured()) {
      console.log(
        `[admin] Open the dashboard → Settings tab to enter your Pinterest App ID + secret.`
      );
    } else if (!isAuthorized()) {
      console.log(
        `[admin] Not authorized — visit http://localhost:${config.admin.port}/oauth/login`
      );
    }
  });
}

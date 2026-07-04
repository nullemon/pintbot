// SQLite schema init + query helpers (better-sqlite3, synchronous).
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
fs.mkdirSync(config.imageDir, { recursive: true });

export const db = new Database(config.dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS articles (
    guid TEXT PRIMARY KEY,
    site TEXT NOT NULL,
    title TEXT,
    link TEXT,
    excerpt TEXT,
    image_url TEXT,
    pub_date TEXT,
    seen_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS pins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guid TEXT NOT NULL,
    site TEXT NOT NULL,
    board_id TEXT,
    title TEXT,
    description TEXT,
    link TEXT,
    image_path TEXT,
    scheduled_at TEXT,
    status TEXT DEFAULT 'pending',
    attempts INTEGER DEFAULT 0,
    pinterest_pin_id TEXT,
    error TEXT,
    posted_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(guid)
  );

  CREATE TABLE IF NOT EXISTS tokens (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    access_token TEXT,
    refresh_token TEXT,
    expires_at TEXT
  );

  CREATE TABLE IF NOT EXISTS boards (
    site TEXT,
    niche TEXT,
    board_id TEXT,
    board_name TEXT
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  -- Editable site list (managed from the admin Settings tab).
  CREATE TABLE IF NOT EXISTS site_configs (
    name TEXT PRIMARY KEY,
    rss TEXT,
    rest_base TEXT,
    niche TEXT,
    board_id TEXT,
    hashtags TEXT,               -- JSON array of strings
    overlay_title INTEGER DEFAULT 1,
    enabled INTEGER DEFAULT 1
  );

  CREATE INDEX IF NOT EXISTS idx_pins_status_due ON pins(status, scheduled_at);
`);

/* ----------------------------- settings ----------------------------- */

export function getSetting(key, fallback = null) {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key);
  return row ? row.value : fallback;
}

export function setSetting(key, value) {
  db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(key, String(value));
}

export function isPaused() {
  return getSetting("paused", "false") === "true";
}

export function setPaused(paused) {
  setSetting("paused", paused ? "true" : "false");
}

/* ----------------------------- articles ----------------------------- */

export function articleExists(guid) {
  return !!db.prepare("SELECT 1 FROM articles WHERE guid = ?").get(guid);
}

export function insertArticle(a) {
  db.prepare(
    `INSERT OR IGNORE INTO articles (guid, site, title, link, excerpt, image_url, pub_date)
     VALUES (@guid, @site, @title, @link, @excerpt, @image_url, @pub_date)`
  ).run(a);
}

/* ------------------------------- pins ------------------------------- */

export function pinExists(guid) {
  return !!db.prepare("SELECT 1 FROM pins WHERE guid = ?").get(guid);
}

export function insertPin(p) {
  return db
    .prepare(
      `INSERT OR IGNORE INTO pins
        (guid, site, board_id, title, description, link, image_path, scheduled_at, status)
       VALUES (@guid, @site, @board_id, @title, @description, @link, @image_path, @scheduled_at, @status)`
    )
    .run(p);
}

export function getPin(id) {
  return db.prepare("SELECT * FROM pins WHERE id = ?").get(id);
}

export function listPins(status, limit = 200) {
  if (status) {
    return db
      .prepare(
        "SELECT * FROM pins WHERE status = ? ORDER BY scheduled_at ASC LIMIT ?"
      )
      .all(status, limit);
  }
  return db
    .prepare("SELECT * FROM pins ORDER BY created_at DESC LIMIT ?")
    .all(limit);
}

// Earliest pending pin regardless of schedule (for manual "post now").
export function nextPendingPin() {
  return db
    .prepare(
      "SELECT * FROM pins WHERE status = 'pending' ORDER BY scheduled_at ASC LIMIT 1"
    )
    .get();
}

// Next pending pin that is due now.
export function nextDuePin(nowIso) {
  return db
    .prepare(
      `SELECT * FROM pins
       WHERE status = 'pending' AND scheduled_at <= ?
       ORDER BY scheduled_at ASC
       LIMIT 1`
    )
    .get(nowIso);
}

// Latest scheduled_at among pending pins (used to chain the drip).
export function lastScheduledAt() {
  const row = db
    .prepare(
      "SELECT MAX(scheduled_at) AS last FROM pins WHERE status IN ('pending','posted')"
    )
    .get();
  return row ? row.last : null;
}

export function updatePin(id, fields) {
  const keys = Object.keys(fields);
  if (keys.length === 0) return;
  const set = keys.map((k) => `${k} = @${k}`).join(", ");
  db.prepare(`UPDATE pins SET ${set} WHERE id = @id`).run({ ...fields, id });
}

export function deletePin(id) {
  db.prepare("DELETE FROM pins WHERE id = ?").run(id);
}

// Wipe the local dedupe memory (articles + pins) so everything can be
// re-ingested fresh (e.g. to regenerate images in a new size). Keeps tokens,
// settings, sites and board mappings intact.
export function resetQueue() {
  const a = db.prepare("DELETE FROM articles").run().changes;
  const p = db.prepare("DELETE FROM pins").run().changes;
  return { articles: a, pins: p };
}

export function countByStatus() {
  const rows = db
    .prepare("SELECT status, COUNT(*) AS n FROM pins GROUP BY status")
    .all();
  const out = { pending: 0, posted: 0, failed: 0, dead: 0 };
  for (const r of rows) out[r.status] = r.n;
  return out;
}

/* ------------------------------ tokens ------------------------------ */

export function getTokens() {
  return db.prepare("SELECT * FROM tokens WHERE id = 1").get();
}

export function saveTokens({ access_token, refresh_token, expires_at }) {
  db.prepare(
    `INSERT INTO tokens (id, access_token, refresh_token, expires_at)
     VALUES (1, @access_token, @refresh_token, @expires_at)
     ON CONFLICT(id) DO UPDATE SET
       access_token = excluded.access_token,
       refresh_token = COALESCE(excluded.refresh_token, tokens.refresh_token),
       expires_at = excluded.expires_at`
  ).run({ access_token, refresh_token, expires_at });
}

/* ------------------------------ boards ------------------------------ */

export function upsertBoards(rows) {
  const stmt = db.prepare(
    `INSERT INTO boards (site, niche, board_id, board_name) VALUES (?, ?, ?, ?)`
  );
  const clear = db.prepare("DELETE FROM boards");
  const tx = db.transaction(() => {
    clear.run();
    for (const r of rows) stmt.run(r.site, r.niche, r.board_id, r.board_name);
  });
  tx(rows);
}

export function listBoards() {
  return db.prepare("SELECT * FROM boards").all();
}

/* --------------------------- site configs --------------------------- */

// Map a DB row to the runtime shape ingest.js expects.
function rowToSite(row) {
  let hashtags = [];
  try {
    hashtags = row.hashtags ? JSON.parse(row.hashtags) : [];
  } catch {
    hashtags = [];
  }
  return {
    name: row.name,
    rss: row.rss,
    restBase: row.rest_base,
    niche: row.niche,
    defaultBoardId: row.board_id,
    hashtags,
    overlayTitle: row.overlay_title !== 0,
    enabled: row.enabled !== 0,
  };
}

// All enabled sites, in runtime shape (used by ingest).
export function getSites() {
  return db
    .prepare("SELECT * FROM site_configs WHERE enabled = 1 ORDER BY name")
    .all()
    .map(rowToSite);
}

// All sites (including disabled) for the admin UI.
export function getAllSites() {
  return db
    .prepare("SELECT * FROM site_configs ORDER BY name")
    .all()
    .map(rowToSite);
}

export function upsertSite(s) {
  db.prepare(
    `INSERT INTO site_configs (name, rss, rest_base, niche, board_id, hashtags, overlay_title, enabled)
     VALUES (@name, @rss, @rest_base, @niche, @board_id, @hashtags, @overlay_title, @enabled)
     ON CONFLICT(name) DO UPDATE SET
       rss = excluded.rss,
       rest_base = excluded.rest_base,
       niche = excluded.niche,
       board_id = excluded.board_id,
       hashtags = excluded.hashtags,
       overlay_title = excluded.overlay_title,
       enabled = excluded.enabled`
  ).run({
    name: s.name,
    rss: s.rss || "",
    rest_base: s.restBase || s.rest_base || "",
    niche: s.niche || "",
    board_id: s.defaultBoardId || s.board_id || "",
    hashtags: JSON.stringify(Array.isArray(s.hashtags) ? s.hashtags : []),
    overlay_title: s.overlayTitle === false || s.overlay_title === 0 ? 0 : 1,
    enabled: s.enabled === false || s.enabled === 0 ? 0 : 1,
  });
}

export function deleteSite(name) {
  db.prepare("DELETE FROM site_configs WHERE name = ?").run(name);
}

// Seed the site_configs table from the static SITES defaults on first run.
export function seedSites(defaults) {
  const count = db.prepare("SELECT COUNT(*) AS n FROM site_configs").get().n;
  if (count > 0) return false;
  for (const s of defaults) upsertSite(s);
  return true;
}

/* ------------------------ live drip settings ------------------------ */

// Drip config with per-key overrides stored in the settings table,
// falling back to the .env defaults from config.js.
export function getDrip() {
  const num = (key, fallback) => {
    const v = getSetting(`drip.${key}`, null);
    const n = v === null ? NaN : Number(v);
    return Number.isFinite(n) ? n : fallback;
  };
  return {
    pinsPerDay: num("pinsPerDay", config.drip.pinsPerDay),
    intervalMinutes: num("intervalMinutes", config.drip.intervalMinutes),
    windowStart: num("windowStart", config.drip.windowStart),
    windowEnd: num("windowEnd", config.drip.windowEnd),
  };
}

export function setDrip(partial) {
  for (const key of ["pinsPerDay", "intervalMinutes", "windowStart", "windowEnd"]) {
    if (partial[key] !== undefined && partial[key] !== "" && partial[key] !== null) {
      setSetting(`drip.${key}`, Number(partial[key]));
    }
  }
}

/* ---------------- credentials (DB-first, .env fallback) ------------- */

// Pinterest app config: DB settings win, .env is the fallback default.
export function getPinterestConfig() {
  const sandboxSetting = getSetting("pinterest.sandbox", null);
  return {
    clientId: getSetting("pinterest.clientId", "") || config.pinterest.clientId,
    clientSecret:
      getSetting("pinterest.clientSecret", "") || config.pinterest.clientSecret,
    redirectUri:
      getSetting("pinterest.redirectUri", "") || config.pinterest.redirectUri,
    sandbox:
      sandboxSetting === null ? config.pinterest.sandbox : sandboxSetting === "true",
    scopes: config.pinterest.scopes,
  };
}

export function setPinterestConfig(partial) {
  if (partial.clientId !== undefined)
    setSetting("pinterest.clientId", String(partial.clientId).trim());
  if (partial.clientSecret !== undefined && partial.clientSecret !== "")
    setSetting("pinterest.clientSecret", String(partial.clientSecret).trim());
  if (partial.redirectUri !== undefined && partial.redirectUri !== "")
    setSetting("pinterest.redirectUri", String(partial.redirectUri).trim());
  if (partial.sandbox !== undefined)
    setSetting("pinterest.sandbox", partial.sandbox ? "true" : "false");
}

export function pinterestConfigured() {
  const c = getPinterestConfig();
  return !!(c.clientId && c.clientSecret);
}

// Admin password: DB setting wins, else .env, else the default.
export function getAdminPassword() {
  return getSetting("admin.password", "") || config.admin.password;
}

export function setAdminPassword(pw) {
  if (pw && String(pw).trim()) setSetting("admin.password", String(pw).trim());
}

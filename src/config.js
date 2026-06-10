// Loads .env and exposes typed config used across the bot.
import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function resolveFromRoot(p, fallback) {
  const value = p || fallback;
  return path.isAbsolute(value) ? value : path.resolve(ROOT, value);
}

function bool(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  return /^(1|true|yes|on)$/i.test(String(value).trim());
}

function int(value, fallback) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

export const config = {
  root: ROOT,

  pinterest: {
    clientId: process.env.PINTEREST_CLIENT_ID || "",
    clientSecret: process.env.PINTEREST_CLIENT_SECRET || "",
    redirectUri:
      process.env.PINTEREST_REDIRECT_URI ||
      "http://localhost:8787/oauth/callback",
    sandbox: bool(process.env.PINTEREST_SANDBOX, false),
    scopes: ["boards:read", "pins:read", "pins:write", "user_accounts:read"],
  },

  admin: {
    port: int(process.env.ADMIN_PORT, 8787),
    password: process.env.ADMIN_PASSWORD || "change-me",
  },

  dbPath: resolveFromRoot(process.env.DB_PATH, "./data/bot.db"),
  imageDir: resolveFromRoot(process.env.IMAGE_DIR, "./data/images"),

  drip: {
    pinsPerDay: int(process.env.PINS_PER_DAY, 10),
    intervalMinutes: int(process.env.POST_INTERVAL_MINUTES, 90),
    windowStart: int(process.env.POST_WINDOW_START, 8),
    windowEnd: int(process.env.POST_WINDOW_END, 23),
  },

  retry: {
    maxAttempts: 3,
    // backoff in minutes per attempt number (1-indexed)
    backoffMinutes: [15, 60, 240],
  },
};

export function apiBase() {
  return config.pinterest.sandbox
    ? "https://api-sandbox.pinterest.com/v5"
    : "https://api.pinterest.com/v5";
}

// Entry point: starts the admin server + cron jobs (ingest + drip posting).
import cron from "node-cron";
import { config } from "./config.js";
import { startAdminServer } from "./admin/server.js";
import { ingestAll } from "./ingest.js";
import { tick } from "./scheduler.js";
import { isAuthorized } from "./pinterest.js";
import { seedSites, getDrip, pinterestConfigured } from "./db.js";
import { SITES } from "./sites.js";

function log(...args) {
  console.log(`[${new Date().toISOString()}]`, ...args);
}

// First run: copy the static defaults from sites.js into the editable DB table.
if (seedSites(SITES)) {
  log(`Seeded ${SITES.length} default site(s) into the database.`);
}

startAdminServer();

// Ingest new articles hourly.
cron.schedule("0 * * * *", async () => {
  try {
    const results = await ingestAll();
    const added = results.reduce((n, r) => n + (r.added || 0), 0);
    if (added) log(`ingest: queued ${added} new pin(s)`, results);
  } catch (e) {
    log("ingest error:", e.message);
  }
});

// Drip posting: every 5 minutes, post the next due pin.
cron.schedule("*/5 * * * *", async () => {
  try {
    const result = await tick();
    if (result && result.pinId) log("posted tick:", result);
  } catch (e) {
    log("tick error:", e.message);
  }
});

const drip = getDrip();
log(
  `Pinterest bot running. Drip: ${drip.pinsPerDay}/day, every ` +
    `${drip.intervalMinutes}min, window ${drip.windowStart}:00–${drip.windowEnd}:00.`
);
if (!pinterestConfigured()) {
  log(
    `Not configured yet — open http://localhost:${config.admin.port} → Settings tab to enter your Pinterest keys.`
  );
} else if (!isAuthorized()) {
  log(
    `Not authorized yet — open http://localhost:${config.admin.port}/oauth/login`
  );
}

// Run an ingest shortly after boot so the queue fills without waiting an hour.
setTimeout(() => {
  ingestAll()
    .then((r) => {
      const added = r.reduce((n, x) => n + (x.added || 0), 0);
      log(`startup ingest: ${added} new pin(s)`);
    })
    .catch((e) => log("startup ingest error:", e.message));
}, 5000);

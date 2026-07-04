// Drip scheduler: compute scheduled_at slots, post next due pin, retry/backoff.
import { config } from "./config.js";
import {
  nextDuePin,
  nextPendingPin,
  lastScheduledAt,
  updatePin,
  isPaused,
  getDrip,
} from "./db.js";
import { createPin, isAuthorized } from "./pinterest.js";

const MINUTE = 60 * 1000;

// Move a Date into the allowed posting window [start, end).
function clampToWindow(date) {
  const { windowStart, windowEnd } = getDrip();
  const d = new Date(date);
  const hour = d.getHours();
  if (hour < windowStart) {
    d.setHours(windowStart, 0, 0, 0);
  } else if (hour >= windowEnd) {
    // Push to the start of the next day's window.
    d.setDate(d.getDate() + 1);
    d.setHours(windowStart, 0, 0, 0);
  }
  return d;
}

// Compute the next scheduled_at slot, chaining off the last queued pin so the
// drip stays spaced by POST_INTERVAL_MINUTES and never bursts.
export function computeNextSlot() {
  const interval = getDrip().intervalMinutes * MINUTE;
  const now = Date.now();
  const last = lastScheduledAt();
  const lastMs = last ? new Date(last).getTime() : 0;

  // Chain off the last queued slot; start immediately if the queue is empty.
  const next = last && Number.isFinite(lastMs) ? lastMs + interval : now;

  return clampToWindow(new Date(Math.max(now, next))).toISOString();
}

// Post a single pin row. Updates status on success/failure.
async function postPin(pin) {
  if (!pin.board_id || pin.board_id === "PUT_BOARD_ID") {
    updatePin(pin.id, {
      status: "failed",
      attempts: pin.attempts + 1,
      error: "No valid board_id configured for this pin's site.",
    });
    return { ok: false, reason: "no board_id" };
  }

  try {
    const result = await createPin({
      boardId: pin.board_id,
      title: pin.title,
      description: pin.description,
      link: pin.link,
      imagePath: pin.image_path,
    });
    updatePin(pin.id, {
      status: "posted",
      pinterest_pin_id: result.id || null,
      posted_at: new Date().toISOString(),
      error: null,
    });
    return { ok: true, pinId: result.id };
  } catch (e) {
    const attempts = pin.attempts + 1;
    const dead = attempts >= config.retry.maxAttempts;
    const backoffIdx = Math.min(attempts - 1, config.retry.backoffMinutes.length - 1);
    const retryAt = new Date(
      Date.now() + config.retry.backoffMinutes[backoffIdx] * MINUTE
    ).toISOString();

    updatePin(pin.id, {
      status: dead ? "dead" : "pending",
      attempts,
      error: e.message.slice(0, 500),
      scheduled_at: dead ? pin.scheduled_at : retryAt,
    });
    return { ok: false, reason: e.message, dead };
  }
}

// One scheduler tick. Normally posts the next *due* pin (respects schedule +
// pause). With { force: true } (the "Post next now" button) it posts the
// earliest pending pin immediately, ignoring the schedule and pause.
export async function tick({ force = false } = {}) {
  if (!force && isPaused()) return { skipped: "paused" };
  if (!isAuthorized()) return { skipped: "not authorized" };

  const pin = force ? nextPendingPin() : nextDuePin(new Date().toISOString());
  if (!pin) return { idle: true };

  const result = await postPin(pin);
  return { pinId: pin.id, ...result };
}

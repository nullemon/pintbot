// Pinterest v5 API client: OAuth token exchange/refresh, boards, createPin.
import { fetch } from "undici";
import fs from "node:fs";
import { getTokens, saveTokens, getPinterestConfig } from "./db.js";

const AUTH_URL = "https://www.pinterest.com/oauth/";

// API base derived from the live sandbox setting.
function apiBase() {
  return getPinterestConfig().sandbox
    ? "https://api-sandbox.pinterest.com/v5"
    : "https://api.pinterest.com/v5";
}

function basicAuthHeader() {
  const { clientId, clientSecret } = getPinterestConfig();
  const raw = `${clientId}:${clientSecret}`;
  return "Basic " + Buffer.from(raw).toString("base64");
}

// Build the URL the user visits to authorize the app.
export function buildAuthorizeUrl(state) {
  const cfg = getPinterestConfig();
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    response_type: "code",
    scope: cfg.scopes.join(","),
    state: state || "pinbot",
  });
  return `${AUTH_URL}?${params.toString()}`;
}

function isoFromExpiresIn(expiresIn) {
  // Refresh a little early (60s safety margin).
  const ms = Date.now() + (Number(expiresIn) - 60) * 1000;
  return new Date(ms).toISOString();
}

// Exchange the OAuth `code` for access + refresh tokens.
export async function exchangeCodeForTokens(code) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: getPinterestConfig().redirectUri,
  });

  const res = await fetch(`${apiBase()}/oauth/token`, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Token exchange failed: ${res.status} ${JSON.stringify(data)}`);
  }

  saveTokens({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: isoFromExpiresIn(data.expires_in),
  });
  return data;
}

// Refresh the access token using the stored refresh token.
async function refreshAccessToken() {
  const tokens = getTokens();
  if (!tokens || !tokens.refresh_token) {
    throw new Error("No refresh token stored. Visit /oauth/login to authorize.");
  }

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: tokens.refresh_token,
  });

  const res = await fetch(`${apiBase()}/oauth/token`, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Token refresh failed: ${res.status} ${JSON.stringify(data)}`);
  }

  saveTokens({
    access_token: data.access_token,
    // Pinterest may or may not rotate the refresh token; keep old if absent.
    refresh_token: data.refresh_token || tokens.refresh_token,
    expires_at: isoFromExpiresIn(data.expires_in),
  });
  return data.access_token;
}

// Return a valid access token, refreshing if missing/near expiry.
export async function getAccessToken() {
  const tokens = getTokens();
  if (!tokens || !tokens.access_token) {
    return refreshAccessToken();
  }
  const expired =
    !tokens.expires_at || new Date(tokens.expires_at).getTime() <= Date.now();
  if (expired) {
    return refreshAccessToken();
  }
  return tokens.access_token;
}

export function isAuthorized() {
  const tokens = getTokens();
  return !!(tokens && tokens.refresh_token);
}

// Authenticated request helper. Retries once on 401 after refreshing.
async function api(pathName, { method = "GET", body, retried = false } = {}) {
  const token = await getAccessToken();
  const res = await fetch(`${apiBase()}${pathName}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && !retried) {
    await refreshAccessToken();
    return api(pathName, { method, body, retried: true });
  }

  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const err = new Error(
      `Pinterest API ${method} ${pathName} -> ${res.status}: ${text}`
    );
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

// List all boards (paginated).
export async function listBoards() {
  const boards = [];
  let bookmark = null;
  do {
    const qs = new URLSearchParams({ page_size: "100" });
    if (bookmark) qs.set("bookmark", bookmark);
    const data = await api(`/boards?${qs.toString()}`);
    boards.push(...(data.items || []));
    bookmark = data.bookmark || null;
  } while (bookmark);
  return boards;
}

export async function getUserAccount() {
  return api("/user_account");
}

// Create a pin. Uploads the local cropped image as base64.
export async function createPin({ boardId, title, description, link, imagePath }) {
  const base64 = fs.readFileSync(imagePath).toString("base64");
  const body = {
    board_id: boardId,
    title: title ? title.slice(0, 100) : undefined,
    description: description ? description.slice(0, 800) : undefined,
    link: link || undefined,
    media_source: {
      source_type: "image_base64",
      content_type: "image/jpeg",
      data: base64,
    },
  };
  return api("/pins", { method: "POST", body });
}

// Fetch analytics for a single pin (impressions, clicks, saves, etc.).
export async function getPinAnalytics(pinId, { start, end } = {}) {
  const qs = new URLSearchParams({
    start_date: start,
    end_date: end,
    metric_types: "IMPRESSION,PIN_CLICK,OUTBOUND_CLICK,SAVE",
  });
  return api(`/pins/${pinId}/analytics?${qs.toString()}`);
}

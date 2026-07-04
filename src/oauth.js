// OAuth route handlers mounted by the admin server.
import crypto from "node:crypto";
import {
  buildAuthorizeUrl,
  exchangeCodeForTokens,
  listBoards as fetchBoards,
} from "./pinterest.js";
import { pinterestConfigured } from "./db.js";

// In-memory CSRF state for the OAuth handshake (single-user local bot).
let pendingState = null;

export function registerOAuthRoutes(app) {
  app.get("/oauth/login", (req, res) => {
    if (!pinterestConfigured()) {
      return res
        .status(400)
        .send(
          "Pinterest App ID and secret aren't set yet. Open the Settings tab in the dashboard and save them first."
        );
    }
    pendingState = crypto.randomBytes(16).toString("hex");
    res.redirect(buildAuthorizeUrl(pendingState));
  });

  app.get("/oauth/callback", async (req, res) => {
    const { code, state, error } = req.query;
    if (error) {
      return res.status(400).send(`Authorization denied: ${error}`);
    }
    if (!code) {
      return res.status(400).send("Missing authorization code.");
    }
    if (pendingState && state !== pendingState) {
      return res.status(400).send("State mismatch — possible CSRF. Try again.");
    }
    pendingState = null;

    try {
      await exchangeCodeForTokens(code);
      // Sanity check: list boards to confirm the token works.
      let boardInfo = "";
      try {
        const boards = await fetchBoards();
        boardInfo = `<p>Found ${boards.length} board(s):</p><ul>${boards
          .map((b) => `<li>${escapeHtml(b.name)} — <code>${b.id}</code></li>`)
          .join("")}</ul>`;
      } catch (e) {
        boardInfo = `<p>Token saved, but listing boards failed: ${escapeHtml(
          e.message
        )}</p>`;
      }
      res.send(
        `<h1>✅ Authorized</h1><p>Refresh token stored. You can close this tab.</p>${boardInfo}<p><a href="/">Back to dashboard</a></p>`
      );
    } catch (e) {
      res.status(500).send(`Token exchange failed: ${escapeHtml(e.message)}`);
    }
  });
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

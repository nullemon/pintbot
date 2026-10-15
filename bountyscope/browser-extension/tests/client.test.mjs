import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { apiURL, errorMessage, isTerminal, localOrigin, makeReviewBody, requestAPI, validateTabURL } from "../client.mjs";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

test("local API origin is an exact immutable allowlist", () => {
  for (const origin of ["http://localhost:3000", "http://127.0.0.1:3000"]) assert.equal(localOrigin(origin), origin);
  for (const origin of ["https://localhost:3000", "http://localhost:3000/", "http://localhost:8000", "http://localhost:3000.evil.test", "http://user:secret@localhost:3000", "http://localhost:3000@evil.test", "http://evil.test", "http://[::1]:3000", "http://localhost:3000/path", null]) {
    assert.throws(() => localOrigin(origin));
  }
});

test("API paths cannot escape the local API namespace", () => {
  assert.equal(apiURL("http://localhost:3000", "/api/scans/abc-def/events?category=ai&limit=15"), "http://localhost:3000/api/scans/abc-def/events?category=ai&limit=15");
  for (const path of ["//evil.test/api/", "https://evil.test/api/", "/outside", "/api/../outside", "/api/\\evil", "/api/%2e%2e/outside"]) {
    assert.throws(() => apiURL("http://localhost:3000", path));
  }
});

test("review requires explicit authorization and enumerated checks", () => {
  const snapshot = { url: "https://authorized.test/", references: [], forms: { total: 0, password_fields: 0, file_inputs: 0 }, secure_context: true };
  assert.deepEqual(makeReviewBody("project-id", snapshot, "exposure", "  Inspect media indexes  ", true), {
    project_id: "project-id", target: snapshot.url, scan_profile: "exposure", authorization_confirmed: true, focus: "Inspect media indexes", page_context: snapshot,
  });
  assert.throws(() => makeReviewBody("project-id", snapshot, "exposure", "", false));
  assert.throws(() => makeReviewBody("project-id", snapshot, "extended", "", true));
  assert.throws(() => makeReviewBody("project-id", snapshot, "standard", "x".repeat(1001), true));
  assert.throws(() => makeReviewBody("", snapshot, "standard", "", true));
});

test("client sends credentials only to the fixed local API and refuses redirects", async () => {
  let captured;
  globalThis.fetch = async (url, options) => { captured = { url, options }; return new Response(JSON.stringify({ id: "scan-id" }), { status: 201 }); };
  const result = await requestAPI("http://localhost:3000", "local-token", "/api/page-reviews", { method: "POST", body: { project_id: "project-id" } });
  assert.deepEqual(result, { id: "scan-id" });
  assert.equal(captured.url, "http://localhost:3000/api/page-reviews");
  assert.equal(captured.options.headers.Authorization, "Bearer local-token");
  assert.equal(captured.options.credentials, "omit");
  assert.equal(captured.options.redirect, "error");
  assert.equal(captured.options.cache, "no-store");
  assert.equal(captured.options.body, '{"project_id":"project-id"}');
  await assert.rejects(requestAPI("http://evil.test", "local-token", "/api/projects"));
});

test("client presents structured errors without exposing arbitrary response text", async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ error: { message: "Hostname is not authorized" } }), { status: 422 });
  await assert.rejects(requestAPI("http://localhost:3000", "", "/api/projects"), /Hostname is not authorized/);
  globalThis.fetch = async () => new Response("secret raw diagnostics", { status: 500 });
  await assert.rejects(requestAPI("http://localhost:3000", "", "/api/projects"), (error) => !error.message.includes("secret") && error.message.includes("HTTP 500"));
  assert.match(errorMessage({}, 401), /token/);
  assert.match(errorMessage({ error: { message: "Invalid request", fields: [{ msg: "Review focus must be shorter" }] } }, 422), /Review focus must be shorter/);
});

test("transport errors are bounded, and abort is preserved", async () => {
  globalThis.fetch = async () => { throw new Error("credential-in-transport-error"); };
  await assert.rejects(requestAPI("http://localhost:3000", "", "/api/projects"), (error) => !error.message.includes("credential") && error.message.includes("Cannot reach"));
  globalThis.fetch = async () => { throw new DOMException("Cancelled", "AbortError"); };
  await assert.rejects(requestAPI("http://localhost:3000", "", "/api/projects"), { name: "AbortError" });
});

test("refusal does not masquerade as a completed deterministic scan", () => {
  assert.equal(isTerminal("refused"), false);
  assert.equal(isTerminal("scanning"), false);
  for (const status of ["complete", "failed", "cancelled"]) assert.equal(isTerminal(status), true);
});

test("tab URL preflight rejects credentials and secret fragments before capture", () => {
  for (const url of [
    "https://user:password@authorized.test/", "https://authorized.test/?token=SECRET",
    "https://authorized.test/?api_key=SECRET", "https://authorized.test/?session=SECRET",
    "https://authorized.test/?code=SECRET", "https://authorized.test/#access_token=SECRET",
    "https://authorized.test/#/callback?signature=SECRET", "https://authorized.test/#password:SECRET",
    "https://authorized.test/#%61ccess_token%3DSECRET",
    "https://authorized.test/#eyJhbGciOiJub25lIn0.eyJzdWIiOiJmYWtlIn0.signature",
  ]) assert.throws(() => validateTabURL(url), /^Error: Open a clean URL without credentials before review\.$/);
  const safe = "https://authorized.test/gallery?view=grid#photo-1";
  assert.equal(validateTabURL(safe), safe);
  for (const url of ["edge://settings/", "chrome://extensions/", "file:///C:/private.txt", "invalid URL"]) {
    assert.throws(() => validateTabURL(url));
  }
});

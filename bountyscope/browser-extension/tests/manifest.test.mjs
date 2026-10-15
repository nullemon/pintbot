import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const root = new URL("../", import.meta.url);

test("manifest grants only explicit tab inspection and the two local API origins", async () => {
  const manifest = JSON.parse(await readFile(new URL("manifest.json", root), "utf8"));
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions, ["activeTab", "scripting", "sidePanel", "storage"]);
  assert.deepEqual(manifest.host_permissions, ["http://localhost:3000/*", "http://127.0.0.1:3000/*"]);
  assert.equal(manifest.content_scripts, undefined);
  assert.equal(manifest.externally_connectable, undefined);
  assert.equal(manifest.side_panel.default_path, "panel.html");
  assert.match(manifest.content_security_policy.extension_pages, /script-src 'self'/);
  assert.doesNotMatch(JSON.stringify(manifest), /<all_urls>|cookies|webRequest|debugger|unsafe-eval|unsafe-inline/);
});

test("panel code does not read page text, persist tokens across browser sessions, or inject markup", async () => {
  const files = ["panel.mjs", "client.mjs", "collector.mjs", "tab-access.mjs", "service-worker.js", "panel.html"];
  for (const file of files) {
    const source = await readFile(new URL(file, root), "utf8");
    assert.doesNotMatch(source, /\binnerHTML\b|\bouterHTML\b|document\.cookie|\blocalStorage\b|storage\.(?:local|sync)\b|\beval\s*\(|new Function\s*\(/, file);
  }
  const panel = await readFile(new URL("panel.mjs", root), "utf8");
  assert.match(panel, /chrome\.storage\.session/);
  const access = await readFile(new URL("tab-access.mjs", root), "utf8");
  assert.match(access, /frameIds: \[0\]/);
  assert.doesNotMatch(access, /world:\s*["']MAIN["']/);
  assert.match(panel, /Automatic AI retries stopped/);
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

const source = await readFile(new URL("../service-worker.js", import.meta.url), "utf8");

function worker({ open, store, configure } = {}) {
  const listeners = {}, calls = [];
  const event = (name) => ({ addListener(callback) { listeners[name] = callback; } });
  const chrome = {
    sidePanel: {
      setPanelBehavior: (options) => { calls.push({ kind: "configure", options }); return configure?.(options) ?? Promise.resolve(); },
      open: (options) => { calls.push({ kind: "open", options }); return open?.(options) ?? Promise.resolve(); },
    },
    storage: { session: { set: (value) => { calls.push({ kind: "store", value }); return store?.(value) ?? Promise.resolve(); } } },
    action: { onClicked: event("clicked") },
    runtime: { onInstalled: event("installed"), onStartup: event("startup") },
  };
  runInNewContext(source, { chrome, console: { warn() {}, error() {}, log() {} } }, { filename: "service-worker.js" });
  return { calls, listeners };
}

const plain = (value) => JSON.parse(JSON.stringify(value));
const tick = () => new Promise((resolve) => setImmediate(resolve));

test("worker disables automatic panel toggling and registers an explicit action handler", async () => {
  const { calls, listeners } = worker(); await tick();
  assert.equal(typeof listeners.clicked, "function");
  assert.deepEqual(plain(calls.find((call) => call.kind === "configure").options), { openPanelOnActionClick: false });
  for (const lifecycle of ["installed", "startup"]) {
    assert.equal(typeof listeners[lifecycle], "function"); listeners[lifecycle]();
  }
  await tick();
  assert.ok(calls.filter((call) => call.kind === "configure").every((call) => call.options.openPanelOnActionClick === false));
});

test("toolbar click opens the bound window immediately before storage promises resolve", () => {
  const pending = new Promise(() => {});
  const { calls, listeners } = worker({ open: () => pending, store: () => pending }); calls.length = 0;
  listeners.clicked({ id: 7, windowId: 11, url: "https://authorized.test/?token=SECRET", title: "PRIVATE PAGE", pendingUrl: "https://private.test/" });
  assert.equal(calls[0]?.kind, "open", "sidePanel.open must remain inside the original user gesture");
  assert.deepEqual(plain(calls[0].options), { windowId: 11 });
  const stored = calls.find((call) => call.kind === "store");
  assert.deepEqual(plain(stored?.value), { "captureTarget:11": { tabId: 7, windowId: 11 } });
  assert.doesNotMatch(JSON.stringify(calls), /SECRET|PRIVATE PAGE|private\.test|authorized\.test/);
});

test("bindings are window-specific and a readable tab URL is not required for binding", () => {
  const { calls, listeners } = worker(); calls.length = 0;
  listeners.clicked({ id: 7, windowId: 11 }); listeners.clicked({ id: 8, windowId: 12 });
  assert.deepEqual(plain(calls.filter((call) => call.kind === "open").map((call) => call.options)), [{ windowId: 11 }, { windowId: 12 }]);
  assert.deepEqual(plain(calls.filter((call) => call.kind === "store").map((call) => call.value)), [
    { "captureTarget:11": { tabId: 7, windowId: 11 } }, { "captureTarget:12": { tabId: 8, windowId: 12 } },
  ]);
});

test("invalid toolbar tab records do not open a panel or create a binding", () => {
  const { calls, listeners } = worker(); calls.length = 0;
  for (const tab of [undefined, null, {}, { id: -1, windowId: 11 }, { id: "7", windowId: 11 }, { id: 7, windowId: -1 }, { id: 7 }, { id: 7.5, windowId: 11 }]) {
    assert.doesNotThrow(() => listeners.clicked(tab));
  }
  assert.equal(calls.length, 0);
});

test("browser API promise rejections are handled without unhandled rejections", async () => {
  const { calls, listeners } = worker({
    open: () => Promise.reject(new Error("Panel unavailable")),
    store: () => Promise.reject(new Error("Session storage unavailable")),
    configure: () => Promise.reject(new Error("Configuration unavailable")),
  });
  assert.doesNotThrow(() => listeners.clicked({ id: 7, windowId: 11 }));
  await tick();
  assert.equal(calls.filter((call) => call.kind === "open").length, 1);
});

test("synchronous browser API failures do not escape toolbar handlers", async () => {
  const { listeners } = worker({
    open: () => { throw new Error("Panel API unavailable"); },
    store: () => { throw new Error("Storage API unavailable"); },
  });
  assert.doesNotThrow(() => listeners.clicked({ id: 7, windowId: 11 }));
  await tick();
});

test("unavailable panel behavior APIs cannot prevent registering the toolbar action", async () => {
  let runtime;
  assert.doesNotThrow(() => {
    runtime = worker({ configure: () => { throw new Error("Panel behavior API unavailable"); } });
  });
  assert.equal(typeof runtime.listeners.clicked, "function");
  await tick();
});

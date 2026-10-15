import assert from "node:assert/strict";
import { test } from "node:test";
import { createTabAccess, targetKey } from "../tab-access.mjs";

function fixture() {
  const model = {
    windowID: 11,
    tab: { id: 7, windowId: 11, active: true, status: "complete", url: "https://authorized.test/gallery" },
    binding: { tabId: 7, windowId: 11 },
    probeURL: "https://authorized.test/gallery",
    metadata: { url: "https://authorized.test/gallery", references: [], forms: { total: 0, password_fields: 0, file_inputs: 0 }, secure_context: true },
    scripts: [],
    missingGrant: false,
    closed: false,
    afterProbe: null,
    afterCapture: null,
    frameID: 0,
  };
  const browser = {
    windows: { getCurrent: async () => ({ id: model.windowID }) },
    storage: { session: { get: async () => model.binding ? { [targetKey(11)]: { ...model.binding } } : {} } },
    tabs: {
      query: async (query) => {
        assert.equal(query.active, true);
        return [{ ...model.tab }];
      },
      get: async (tabID) => {
        assert.equal(tabID, 7);
        if (model.closed) throw new Error("No tab with id SECRET-RAW-API-DIAGNOSTIC");
        return { ...model.tab };
      },
    },
    scripting: { executeScript: async (options) => {
      model.scripts.push(options);
      assert.equal(options.target.tabId, 7);
      assert.deepEqual(options.target.frameIds, [0]);
      assert.ok(options.world === undefined || options.world === "ISOLATED");
      assert.equal(options.target.allFrames, undefined);
      if (model.missingGrant) throw new Error("Cannot access contents of url https://private.test/?token=SECRET-RAW-API-DIAGNOSTIC");
      if (options.func.name === "capturePageMetadata") {
        model.afterCapture?.();
        return [{ frameId: model.frameID, result: model.metadata }];
      }
      assert.equal(options.func.name, "readPageURL");
      model.afterProbe?.();
      return [{ frameId: model.frameID, result: model.probeURL }];
    } },
  };
  return { model, browser, access: createTabAccess(browser) };
}

async function rejectedSafely(operation) {
  await assert.rejects(operation, (cause) => cause instanceof Error && cause.message.length > 0 && !/SECRET-RAW-API-DIAGNOSTIC|private\.test/.test(cause.message));
}

test("toolbar binding keys are separated by browser window", () => {
  assert.equal(targetKey(11), "captureTarget:11");
  assert.equal(targetKey(12), "captureTarget:12");
});

test("a bound active tab with a visible safe URL needs no permission probe", async () => {
  const { access, model } = fixture();
  assert.deepEqual(await access.current(), { id: 7, windowId: 11, url: "https://authorized.test/gallery" });
  assert.equal(model.scripts.length, 0);
});

test("a missing tab URL can be recovered only through the bound tab's permission-checked URL probe", async () => {
  const { access, model } = fixture();
  delete model.tab.url;
  assert.deepEqual(await access.current(), { id: 7, windowId: 11, url: "https://authorized.test/gallery" });
  assert.equal(model.scripts.length, 1);
  assert.equal(model.scripts[0].func.name, "readPageURL");
});

test("capture works when tab.url is omitted but the explicit activeTab grant permits injection", async () => {
  const { access, model } = fixture();
  delete model.tab.url;
  const result = await access.capture();
  assert.deepEqual(result, { tabId: 7, windowId: 11, metadata: model.metadata });
  assert.deepEqual(model.scripts.map((options) => options.func.name), ["readPageURL", "capturePageMetadata", "readPageURL"]);
});

test("a visible protected or credential-bearing URL is rejected without injection", async () => {
  for (const url of ["edge://settings/", "chrome://extensions/", "file:///C:/private.txt", "https://authorized.test/?token=SECRET", "https://user:SECRET@authorized.test/"]) {
    const { access, model } = fixture();
    model.tab.url = url;
    await rejectedSafely(access.current());
    assert.equal(model.scripts.length, 0);
  }
});

test("missing, stale, or other-window toolbar bindings never trigger script injection", async () => {
  for (const binding of [null, { tabId: 8, windowId: 11 }, { tabId: 7, windowId: 12 }, { tabId: "7", windowId: 11 }, { tabId: -1, windowId: 11 }]) {
    const { access, model } = fixture();
    model.binding = binding;
    await rejectedSafely(access.current());
    assert.equal(model.scripts.length, 0);
  }
  const { access, model } = fixture();
  model.windowID = 12;
  await rejectedSafely(access.current());
  assert.equal(model.scripts.length, 0);
});

test("inactive, mismatched-window, and closed bound tabs are rejected", async () => {
  for (const mutate of [
    (model) => { model.tab.active = false; },
    (model) => { model.tab.id = 8; },
    (model) => { model.tab.windowId = 12; },
    (model) => { model.closed = true; },
  ]) {
    const { access, model } = fixture(); mutate(model);
    await rejectedSafely(access.current());
    assert.equal(model.scripts.length, 0);
  }
});

test("loading and pending navigation are rejected before probing or metadata capture", async () => {
  for (const mutate of [
    (model) => { model.tab.status = "loading"; },
    (model) => { model.tab.pendingUrl = "https://authorized.test/next"; },
    (model) => { model.tab.pendingUrl = model.tab.url; },
  ]) {
    const { access, model } = fixture(); mutate(model);
    await rejectedSafely(access.capture());
    assert.equal(model.scripts.length, 0);
  }
});

test("missing script permission is reported safely and never yields a stale snapshot", async () => {
  const { access, model } = fixture();
  delete model.tab.url; model.missingGrant = true;
  await rejectedSafely(access.capture());
  assert.deepEqual(model.scripts.map((options) => options.func.name), ["readPageURL"]);
});

test("a visible URL does not substitute for permission to capture the page", async () => {
  const { access, model } = fixture(); model.missingGrant = true;
  await rejectedSafely(access.capture());
  assert.deepEqual(model.scripts.map((options) => options.func.name), ["capturePageMetadata"]);
});

test("a protected or credential-bearing URL recovered by probing is rejected before DOM capture", async () => {
  for (const url of ["edge://settings/", "https://authorized.test/#access_token=SECRET"]) {
    const { access, model } = fixture(); delete model.tab.url; model.probeURL = url;
    await rejectedSafely(access.capture());
    assert.deepEqual(model.scripts.map((options) => options.func.name), ["readPageURL"]);
  }
});

test("changing the bound/active tab while probing invalidates the recovered URL", async () => {
  for (const mutate of [
    (model) => { model.tab.id = 8; },
    (model) => { model.tab.active = false; },
    (model) => { model.binding = { tabId: 8, windowId: 11 }; },
    (model) => { model.tab.status = "loading"; },
    (model) => { model.tab.url = "https://authorized.test/next"; },
  ]) {
    const { access, model } = fixture(); delete model.tab.url; model.afterProbe = () => mutate(model);
    await rejectedSafely(access.current());
  }
});

test("capture rejects metadata from a child frame or a different page URL", async () => {
  for (const mutate of [
    (model) => { model.frameID = 4; },
    (model) => { model.metadata.url = "https://authorized.test/different"; },
  ]) {
    const { access, model } = fixture(); mutate(model);
    await rejectedSafely(access.capture());
  }
});

test("navigation or tab switching between capture and its post-check cannot create a snapshot", async () => {
  for (const mutate of [
    (model) => { model.tab.url = "https://authorized.test/next"; },
    (model) => { model.tab.status = "loading"; },
    (model) => { model.tab.id = 8; },
    (model) => { model.binding = null; },
  ]) {
    const { access, model } = fixture(); model.afterCapture = () => mutate(model);
    await rejectedSafely(access.capture());
  }
});

test("current URL is read freshly before review instead of reusing the captured snapshot", async () => {
  const { access, model } = fixture();
  const captured = await access.capture();
  model.tab.url = "https://authorized.test/next";
  const current = await access.current();
  assert.notEqual(current.url, captured.metadata.url);
  model.binding = null;
  await rejectedSafely(access.current());
});

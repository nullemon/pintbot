import assert from "node:assert/strict";
import { test } from "node:test";
import { createTabAccess, TabAccessError } from "../tab-access.mjs";

const codes = new Set([
  "TAB_QUERY_FAILED", "NO_ACTIVE_TAB", "AMBIGUOUS_TAB", "TAB_LOADING", "TAB_CHANGED",
  "PAGE_ACCESS_DENIED", "URL_REJECTED", "NO_METADATA",
]);

function fixture() {
  const model = {
    tab: { id: 7, windowId: 11, active: true, status: "complete", url: "https://authorized.test/gallery" },
    binding: { tabId: 7, windowId: 11 }, matches: null,
    probeURL: "https://authorized.test/gallery",
    metadata: { url: "https://authorized.test/gallery", references: [], forms: { total: 0, password_fields: 0, file_inputs: 0 }, secure_context: true },
    scripts: [], queries: [], windowReads: 0, tabGets: 0, storageReads: 0,
    queryFailure: false, storageFailure: false, missingGrant: false,
    probeFrameID: 0, metadataFrameID: 0, afterProbe: null, afterCapture: null,
  };
  const browser = {
    windows: { getCurrent: async () => {
      model.windowReads += 1;
      throw new Error("Wrong window lookup SECRET-RAW-API-DIAGNOSTIC");
    } },
    storage: { session: { get: async () => {
      model.storageReads += 1;
      if (model.storageFailure) throw new Error("Storage unavailable SECRET-RAW-API-DIAGNOSTIC");
      return model.binding ? { "captureTarget:11": { ...model.binding } } : {};
    } } },
    tabs: {
      query: async (query) => {
        model.queries.push(query);
        assert.deepEqual(query, { active: true, currentWindow: true }, "never query a stored or last-focused arbitrary window");
        if (model.queryFailure) throw new Error("Query unavailable https://private.test/?token=SECRET-RAW-API-DIAGNOSTIC");
        return (model.matches || [model.tab]).map((tab) => ({ ...tab }));
      },
      get: async () => {
        model.tabGets += 1;
        throw new Error("A stale bound tab must not be used as a fallback");
      },
    },
    scripting: { executeScript: async (options) => {
      model.scripts.push(options);
      assert.equal(options.target.tabId, 7, "capture must never inject into a different tab after a race");
      assert.deepEqual(options.target.frameIds, [0]);
      assert.ok(options.world === undefined || options.world === "ISOLATED");
      assert.equal(options.target.allFrames, undefined);
      if (model.missingGrant) throw new Error("Cannot access https://private.test/?token=SECRET-RAW-API-DIAGNOSTIC");
      if (options.func.name === "capturePageMetadata") {
        model.afterCapture?.();
        return [{ frameId: model.metadataFrameID, result: model.metadata }];
      }
      assert.equal(options.func.name, "readPageURL");
      model.afterProbe?.();
      return [{ frameId: model.probeFrameID, result: model.probeURL }];
    } },
  };
  return { model, browser, access: createTabAccess(browser) };
}

async function rejectedSafely(operation, expected) {
  const accepted = expected ? new Set(Array.isArray(expected) ? expected : [expected]) : codes;
  await assert.rejects(operation, (cause) => {
    assert.ok(cause instanceof TabAccessError);
    assert.ok(accepted.has(cause.code), `unexpected diagnostic code ${cause.code}`);
    assert.ok(cause.message.length > 0);
    const rendered = JSON.stringify({ message: cause.message, code: cause.code, diagnostics: cause.diagnostics });
    assert.doesNotMatch(rendered, /SECRET-RAW-API-DIAGNOSTIC|private\.test|authorized\.test|https?:\/\/|\?token=/);
    if (cause.diagnostics) for (const value of Object.values(cause.diagnostics)) {
      assert.ok(value === null || ["number", "boolean", "string"].includes(typeof value), "diagnostics must contain scalar identifiers/counts/flags/fixed stages only");
    }
    return true;
  });
}

test("current-window selection always checks actual scripting permission", async () => {
  const { access, model } = fixture();
  assert.deepEqual(await access.current(), { id: 7, windowId: 11, url: "https://authorized.test/gallery" });
  assert.deepEqual(model.scripts.map((options) => options.func.name), ["readPageURL"]);
  assert.equal(model.windowReads, 0); assert.equal(model.tabGets, 0);
  assert.ok(model.queries.length >= 2, "recheck active tab after URL probe");
});

test("missing or stale toolbar bindings do not replace browser permission decisions", async () => {
  for (const binding of [null, { tabId: 99, windowId: 11 }, { tabId: 7, windowId: 12 }, { tabId: "old", windowId: 11 }]) {
    const { access, model } = fixture(); model.binding = binding;
    assert.deepEqual(await access.capture(), { tabId: 7, windowId: 11, metadata: model.metadata });
    assert.ok(model.scripts.every((options) => options.target.tabId === 7));
  }
});

test("session storage failure does not prevent explicitly requested current-tab capture", async () => {
  const { access, model } = fixture(); model.storageFailure = true;
  assert.equal((await access.capture()).tabId, 7);
  assert.equal(model.windowReads, 0); assert.equal(model.tabGets, 0);
});

test("omitted tab URL is recovered by permission-checked URL probes without a stored binding", async () => {
  const { access, model } = fixture(); delete model.tab.url; model.binding = null;
  assert.deepEqual(await access.capture(), { tabId: 7, windowId: 11, metadata: model.metadata });
  assert.deepEqual(model.scripts.map((options) => options.func.name), ["readPageURL", "capturePageMetadata", "readPageURL"]);
});

test("known protected and credential-bearing URLs fail before any injection", async () => {
  for (const url of ["edge://settings/", "chrome://extensions/", "file:///C:/private.txt", "https://authorized.test/?token=SECRET", "https://user:SECRET@authorized.test/"]) {
    const { access, model } = fixture(); model.tab.url = url;
    await rejectedSafely(access.current(), "URL_REJECTED");
    assert.equal(model.scripts.length, 0);
  }
});

test("a readable URL does not substitute for permission: missing grant fails before DOM capture", async () => {
  const { access, model } = fixture(); model.missingGrant = true;
  await rejectedSafely(access.capture(), "PAGE_ACCESS_DENIED");
  assert.deepEqual(model.scripts.map((options) => options.func.name), ["readPageURL"]);
});

test("a missing URL and missing permission never yield a stale snapshot", async () => {
  const { access, model } = fixture(); delete model.tab.url; model.missingGrant = true;
  await rejectedSafely(access.capture(), "PAGE_ACCESS_DENIED");
  assert.deepEqual(model.scripts.map((options) => options.func.name), ["readPageURL"]);
});

test("query failures expose typed safe diagnostics instead of native browser errors", async () => {
  const { access, model } = fixture(); model.queryFailure = true;
  await rejectedSafely(access.current(), "TAB_QUERY_FAILED");
  assert.equal(model.scripts.length, 0);
});

test("no active tab does not fall back to a stored tab or another window", async () => {
  const { access, model } = fixture(); model.matches = [];
  await rejectedSafely(access.current(), "NO_ACTIVE_TAB");
  assert.equal(model.scripts.length, 0); assert.equal(model.windowReads, 0); assert.equal(model.tabGets, 0);
});

test("ambiguous active-tab results are rejected instead of selecting the first record", async () => {
  const { access, model } = fixture(); model.matches = [model.tab, { ...model.tab, id: 9, windowId: 12 }];
  await rejectedSafely(access.current(), "AMBIGUOUS_TAB");
  assert.equal(model.scripts.length, 0);
});

test("malformed and inactive current-window tab records are rejected", async () => {
  for (const mutate of [
    (model) => { model.tab.active = false; }, (model) => { model.tab.id = -1; },
    (model) => { model.tab.id = "7"; }, (model) => { model.tab.windowId = -1; }, (model) => { delete model.tab.id; },
  ]) {
    const { access, model } = fixture(); mutate(model);
    await rejectedSafely(access.current(), "NO_ACTIVE_TAB");
    assert.equal(model.scripts.length, 0);
  }
});

test("loading and pending navigation are rejected before URL probing or metadata capture", async () => {
  for (const mutate of [
    (model) => { model.tab.status = "loading"; }, (model) => { model.tab.pendingUrl = "https://authorized.test/next"; },
    (model) => { model.tab.pendingUrl = model.tab.url; },
  ]) {
    const { access, model } = fixture(); mutate(model);
    await rejectedSafely(access.capture(), "TAB_LOADING");
    assert.equal(model.scripts.length, 0);
  }
});

test("protected and credential-bearing probed URLs fail before DOM capture", async () => {
  for (const url of ["edge://settings/", "https://authorized.test/#access_token=SECRET"]) {
    const { access, model } = fixture(); delete model.tab.url; model.probeURL = url;
    await rejectedSafely(access.capture(), "URL_REJECTED");
    assert.deepEqual(model.scripts.map((options) => options.func.name), ["readPageURL"]);
  }
});

test("the URL probe must agree with a visible URL before metadata capture", async () => {
  const { access, model } = fixture(); model.probeURL = "https://authorized.test/next";
  await rejectedSafely(access.capture(), "TAB_CHANGED");
  assert.deepEqual(model.scripts.map((options) => options.func.name), ["readPageURL"]);
});

test("a changed current tab or window during the URL probe invalidates its result", async () => {
  for (const mutate of [
    (model) => { model.tab.id = 8; }, (model) => { model.tab.windowId = 12; },
    (model) => { model.tab.url = "https://authorized.test/next"; }, (model) => { model.tab.active = false; },
    (model) => { model.tab.status = "loading"; }, (model) => { model.matches = []; },
  ]) {
    const { access, model } = fixture(); model.afterProbe = () => mutate(model);
    await rejectedSafely(access.current(), ["TAB_CHANGED", "NO_ACTIVE_TAB", "TAB_LOADING"]);
  }
});

test("a missing main-frame URL probe result never proceeds to DOM capture", async () => {
  const { access, model } = fixture(); model.probeFrameID = 4;
  await rejectedSafely(access.capture(), ["NO_METADATA", "URL_REJECTED"]);
  assert.deepEqual(model.scripts.map((options) => options.func.name), ["readPageURL"]);
});

test("metadata must come from the main frame and the same captured URL", async () => {
  for (const mutate of [
    (model) => { model.metadataFrameID = 4; }, (model) => { model.metadata = null; },
    (model) => { model.metadata.url = "https://authorized.test/different"; },
  ]) {
    const { access, model } = fixture(); mutate(model);
    await rejectedSafely(access.capture(), ["NO_METADATA", "TAB_CHANGED"]);
  }
});

test("navigation and tab/window changes after capture discard the snapshot without switching injection targets", async () => {
  for (const mutate of [
    (model) => { model.tab.url = "https://authorized.test/next"; model.probeURL = model.tab.url; },
    (model) => { model.tab.status = "loading"; }, (model) => { model.tab.id = 8; },
    (model) => { model.tab.windowId = 12; }, (model) => { model.matches = []; },
  ]) {
    const { access, model } = fixture(); model.afterCapture = () => mutate(model);
    await rejectedSafely(access.capture(), ["TAB_CHANGED", "NO_ACTIVE_TAB", "TAB_LOADING"]);
    assert.ok(model.scripts.every((options) => options.target.tabId === 7));
  }
});

test("current verifies a fresh URL and real permission before starting a captured review", async () => {
  const { access, model } = fixture();
  const captured = await access.capture();
  model.tab.url = "https://authorized.test/next"; model.probeURL = model.tab.url;
  assert.notEqual((await access.current()).url, captured.metadata.url);
  model.missingGrant = true;
  await rejectedSafely(access.current(), "PAGE_ACCESS_DENIED");
});

test("review identity guards reject a different tab/window/visible URL before injection", async () => {
  for (const mutate of [
    (model) => { model.tab.id = 8; },
    (model) => { model.tab.windowId = 12; },
    (model) => { model.tab.url = "https://authorized.test/next"; },
  ]) {
    const { access, model } = fixture();
    const expected = { id: 7, windowId: 11, url: model.tab.url };
    mutate(model);
    await rejectedSafely(access.current(expected), "TAB_CHANGED");
    assert.equal(model.scripts.length, 0);
  }
});

test("review identity guards detect hidden-URL navigation through a URL-only probe", async () => {
  const { access, model } = fixture();
  const expected = { id: 7, windowId: 11, url: model.tab.url };
  delete model.tab.url; model.probeURL = "https://authorized.test/next";
  await rejectedSafely(access.current(expected), "TAB_CHANGED");
  assert.deepEqual(model.scripts.map((options) => options.func.name), ["readPageURL"]);
});

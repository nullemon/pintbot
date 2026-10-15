import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { capturePageMetadata } from "../collector.mjs";

const original = Object.fromEntries(["document", "location", "isSecureContext", "fetch", "performance"].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
afterEach(() => {
  for (const [key, descriptor] of Object.entries(original)) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else delete globalThis[key];
  }
});

function element(tag, attributes = {}) {
  const node = { tagName: tag.toUpperCase(), getAttribute: (key) => attributes[key] ?? null };
  for (const forbidden of ["value", "textContent", "innerText", "innerHTML", "outerHTML", "title"]) {
    Object.defineProperty(node, forbidden, { get() { throw new Error(`Must not read ${forbidden}`); } });
  }
  return node;
}

function page(nodes, { url = "https://authorized.test/current/", baseURI, forms = 0, passwords = 0, files = 0, resources = [] } = {}) {
  const document = {
    baseURI,
    querySelectorAll(selector) {
      if (selector === "form") return { length: forms };
      if (selector === 'input[type="password"]') return { length: passwords };
      if (selector === 'input[type="file"]') return { length: files };
      if (selector === "script[src]") return nodes.filter((node) => node.tagName === "SCRIPT");
      if (selector === "img, source[src], video[src], audio[src]") return nodes.filter((node) => ["IMG", "SOURCE", "VIDEO", "AUDIO"].includes(node.tagName));
      return nodes.filter((node) => !["SCRIPT", "IMG", "SOURCE", "VIDEO", "AUDIO"].includes(node.tagName));
    },
  };
  for (const forbidden of ["cookie", "title", "body", "documentElement"]) {
    Object.defineProperty(document, forbidden, { get() { throw new Error(`Must not read ${forbidden}`); } });
  }
  Object.defineProperties(globalThis, {
    document: { configurable: true, value: document },
    location: { configurable: true, value: { href: url } },
    isSecureContext: { configurable: true, value: true },
    fetch: { configurable: true, value() { throw new Error("Collector must never fetch target resources"); } },
    performance: { configurable: true, value: { getEntriesByType(type) { assert.equal(type, "resource"); return resources; } } },
  });
}

test("captures bounded URL metadata by reference type without page content", () => {
  page([
    element("a", { href: "/docs" }), element("script", { src: "/app.js" }),
    element("link", { rel: "stylesheet", href: "/style.css" }),
    element("link", { rel: "canonical", href: "/canonical" }),
    element("img", { src: "/uploads/avatar.jpg" }), element("source", { src: "/media/movie.mp4" }),
    element("iframe", { src: "https://third-party.test/embed" }),
    element("form", { action: "/login" }), element("div", { "data-api-url": "/api/info" }),
  ], { forms: 2, passwords: 1, files: 1 });
  const result = capturePageMetadata();
  assert.deepEqual(result.forms, { total: 2, password_fields: 1, file_inputs: 1 });
  assert.deepEqual(result.references.map((reference) => reference.kind), ["script", "image", "media", "link", "stylesheet", "canonical", "iframe", "form", "api"]);
  assert.equal(result.references[0].url, "https://authorized.test/app.js");
  assert.equal(result.secure_context, true);
  assert.deepEqual(Object.keys(result), ["url", "references", "forms", "secure_context"]);
});

test("strips all reference queries/fragments and rejects credential URLs and executable schemes", () => {
  page([
    element("img", { src: "/media/a.jpg?token=super-secret#session-secret" }),
    element("a", { href: "https://user:password@cdn.test/private" }),
    element("a", { href: "javascript:fetch('/sensitive')" }), element("a", { href: "data:text/html,secrets" }),
    element("form", { action: "/submit?password=hidden-password", value: "never-read" }),
    element("a", { href: "/docs?api_key=never-send" }),
  ]);
  const result = capturePageMetadata();
  assert.deepEqual(result.references, [
    { kind: "image", url: "https://authorized.test/media/a.jpg" },
    { kind: "form", url: "https://authorized.test/submit" },
    { kind: "link", url: "https://authorized.test/docs" },
  ]);
  assert.doesNotMatch(JSON.stringify(result), /super-secret|session-secret|hidden-password|user:password|never-read|never-send/);
});

test("caps resource references at 200 without fetching", () => {
  const nodes = [element("a", { href: "/same?x=1" }), element("a", { href: "/same?x=2#hash" })];
  for (let index = 0; index < 600; index += 1) nodes.push(element("img", { src: `/media/${index}.jpg` }));
  page(nodes);
  const result = capturePageMetadata();
  assert.equal(result.references.length, 200);
  assert.equal(result.references.filter((reference) => reference.kind === "image").length, 200);
});

test("does not silently alter the captured page target", () => {
  const url = "https://authorized.test/page?view=gallery#anchor";
  page([], { url });
  assert.equal(capturePageMetadata().url, url, "safe page targets must not be silently changed");
});

test("refuses browser pages, embedded credentials, and overlong targets", () => {
  for (const url of ["edge://settings/", "chrome://extensions/", "file:///C:/private.txt", "https://name:password@authorized.test/", `https://authorized.test/${"x".repeat(3000)}`]) {
    page([], { url });
    assert.throws(capturePageMetadata);
  }
});

test("caps counts and skips malformed or oversized reference paths", () => {
  page([element("img", { src: `/${"x".repeat(6500)}` }), element("a", { href: "http://[not-an-ip]/" })], { forms: 40000, passwords: 10001, files: 20000 });
  const result = capturePageMetadata();
  assert.deepEqual(result.forms, { total: 10000, password_fields: 10000, file_inputs: 10000 });
  assert.deepEqual(result.references, []);
});

test("keeps scripts and images despite a large earlier navigation menu", () => {
  const nodes = Array.from({ length: 6000 }, (_, index) => element("a", { href: `/navigation/${index}` }));
  nodes.push(element("img", { src: "/uploads/important.jpg" }), element("script", { src: "/app.js" }));
  page(nodes);
  const result = capturePageMetadata();
  assert.equal(result.references[0].kind, "script");
  assert.equal(result.references[1].kind, "image");
  assert.equal(result.references.length, 200);
});

test("caps encoded context below the backend size limit", () => {
  page(Array.from({ length: 200 }, (_, index) => element("img", { src: `/uploads/${"é".repeat(400)}-${index}.jpg` })));
  const result = capturePageMetadata();
  const bytes = new TextEncoder().encode(JSON.stringify(result)).length;
  assert.ok(bytes <= 50 * 1024, `context uses ${bytes} bytes`);
  assert.ok(result.references.length > 0 && result.references.length < 200);
});

test("deduplicates reference variants when resource capacity remains", () => {
  page([element("a", { href: "/same?x=1" }), element("a", { href: "/same?x=2#fragment" })]);
  assert.equal(capturePageMetadata().references.length, 1);
});

test("resolves relative URLs against the actual external document base without altering the page target", () => {
  page([
    element("script", { src: "assets/app.js?key=SECRET#fragment" }),
    element("img", { src: "/media/photo.jpg?token=SECRET" }),
    element("a", { href: "directory/" }),
  ], { baseURI: "https://cdn.thirdparty.test/published/" });
  const result = capturePageMetadata();
  assert.equal(result.url, "https://authorized.test/current/");
  assert.deepEqual(result.references, [
    { kind: "script", url: "https://cdn.thirdparty.test/published/assets/app.js" },
    { kind: "image", url: "https://cdn.thirdparty.test/media/photo.jpg" },
    { kind: "link", url: "https://cdn.thirdparty.test/published/directory/" },
  ]);
  assert.doesNotMatch(JSON.stringify(result), /SECRET|fragment/);
});

test("invalid or credential-bearing document bases do not invent same-origin relative references", () => {
  for (const baseURI of ["data:text/html,ignored", "https://user:secret@cdn.thirdparty.test/", "not a URL"]) {
    page([element("img", { src: "relative.jpg" }), element("a", { href: "https://authorized.test/absolute" })], { baseURI });
    assert.deepEqual(capturePageMetadata().references, [{ kind: "link", url: "https://authorized.test/absolute" }]);
  }
});

test("keeps only the observed selected srcset image URL without parsing or fetching variants", () => {
  const image = element("img", { srcset: "/small.jpg 1x, /large.jpg 2x" });
  image.currentSrc = "https://images.cdn.test/selected.jpg?token=SECRET#fragment";
  page([image]);
  assert.deepEqual(capturePageMetadata().references, [{ kind: "image", url: "https://images.cdn.test/selected.jpg" }]);
});

test("rejects sensitive target query names before reading page metadata", () => {
  const keys = ["token", "session", "password", "api_key", "code", "signature", "authorization", "cookie", "credential", "access-key", "key", "sig", "refreshToken"];
  for (const key of keys) {
    page([], { url: `https://authorized.test/?${encodeURIComponent(key)}=SECRET` });
    globalThis.document.querySelectorAll = () => { throw new Error("Metadata must not be read before target privacy checks"); };
    assert.throws(capturePageMetadata, /Open a clean URL without credentials/);
  }
});

test("rejects OAuth/secret fragments and JWT-looking fragments without logging or copying them", () => {
  for (const fragment of ["access_token=SECRET", "/callback?token=SECRET", "password:SECRET", "%61ccess_token%3DSECRET", "eyJhbGciOiJub25lIn0.eyJzdWIiOiJmYWtlIn0.signature"]) {
    page([], { url: `https://authorized.test/#${fragment}` });
    assert.throws(capturePageMetadata, /Open a clean URL without credentials/);
  }
});

test("captures existing fetch/XHR resource URL clues without reading network content", () => {
  const recorded = (name, initiatorType) => {
    const entry = { name, initiatorType };
    for (const forbidden of ["body", "headers", "response", "responseStatus", "transferSize", "encodedBodySize", "decodedBodySize", "duration", "serverTiming"]) {
      Object.defineProperty(entry, forbidden, { get() { throw new Error(`Must not read resource ${forbidden}`); } });
    }
    return entry;
  };
  page([], { resources: [
    recorded("https://storage.cdn.test/uploads/photo.webp?signature=SECRET#fragment", "fetch"),
    recorded("https://storage.cdn.test/media/content/123?token=SECRET", "xmlhttprequest"),
    recorded("https://authorized.test/assets/lazy.js", "script"),
    recorded("https://cdn.thirdparty.test/theme.css", "link"),
    recorded("https://storage.cdn.test/media/video.mp4", "fetch"),
  ] });
  const result = capturePageMetadata();
  assert.deepEqual(result.references, [
    { kind: "image", url: "https://storage.cdn.test/uploads/photo.webp" },
    { kind: "api", url: "https://storage.cdn.test/media/content/123" },
    { kind: "script", url: "https://authorized.test/assets/lazy.js" },
    { kind: "stylesheet", url: "https://cdn.thirdparty.test/theme.css" },
    { kind: "media", url: "https://storage.cdn.test/media/video.mp4" },
  ]);
  assert.doesNotMatch(JSON.stringify(result), /SECRET|signature|token|fragment/);
});

test("drops blob/data resource references and never dereferences their contents", () => {
  const image = element("img", { src: "blob:https://authorized.test/fake-image" });
  image.currentSrc = "blob:https://authorized.test/fake-image";
  page([image], { resources: [
    { name: "blob:https://authorized.test/fake-image", initiatorType: "fetch" },
    { name: "data:image/png;base64,SECRET", initiatorType: "img" },
    { name: "https://name:SECRET@storage.cdn.test/private.jpg", initiatorType: "img" },
    { name: "https://storage.cdn.test/api/image/1?api_key=SECRET", initiatorType: "fetch" },
  ] });
  assert.deepEqual(capturePageMetadata().references, [{ kind: "api", url: "https://storage.cdn.test/api/image/1" }]);
});

test("resource timing is optional and remains within the existing count/byte caps", () => {
  const resources = Array.from({ length: 800 }, (_, index) => ({ name: `https://storage.cdn.test/uploads/${"é".repeat(400)}-${index}.jpg?token=SECRET`, initiatorType: "fetch" }));
  page([], { resources });
  const result = capturePageMetadata();
  assert.ok(result.references.length > 0 && result.references.length <= 200);
  assert.ok(result.references.every((item) => Number(item.url.match(/-(\d+)\.jpg$/)?.[1]) >= 300), "only the latest 500 recorded entries are inspected");
  assert.ok(new TextEncoder().encode(JSON.stringify(result)).length <= 50 * 1024);
  page([element("img", { src: "/safe.jpg" })]);
  globalThis.performance.getEntriesByType = () => { throw new Error("Timing buffer unavailable"); };
  assert.deepEqual(capturePageMetadata().references, [{ kind: "image", url: "https://authorized.test/safe.jpg" }]);
});

test("resource clues are captured before navigation menus and deduplicated with DOM URLs", () => {
  const nodes = Array.from({ length: 6000 }, (_, index) => element("a", { href: `/navigation/${index}` }));
  nodes.push(element("img", { src: "https://storage.cdn.test/photo.jpg?token=SECRET" }));
  page(nodes, { resources: [
    { name: "https://storage.cdn.test/photo.jpg?signature=SECRET", initiatorType: "fetch" },
    { name: "https://storage.cdn.test/api/image/7?key=SECRET", initiatorType: "xmlhttprequest" },
  ] });
  const result = capturePageMetadata();
  assert.deepEqual(result.references.slice(0, 2), [
    { kind: "image", url: "https://storage.cdn.test/photo.jpg" },
    { kind: "api", url: "https://storage.cdn.test/api/image/7" },
  ]);
  assert.equal(result.references.length, 200);
});

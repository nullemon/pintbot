/** Executed once in the selected tab's isolated world; never makes requests. */
export function capturePageMetadata() {
  const current = new URL(location.href);
  if (!["http:", "https:"].includes(current.protocol)) {
    throw new Error("Only ordinary HTTP or HTTPS pages can be reviewed.");
  }
  if (current.username || current.password) throw new Error("Open a clean URL without credentials before review.");
  if (current.href.length > 3000) throw new Error("The page URL exceeds the URL limit. Open a shorter URL before review.");
  // This isolated-world function must remain self-contained for executeScript.
  // The panel repeats the same URL privacy checks before injection for clear UX.
  const sensitiveName = /authorization|cookie|password|passwd|secret|token|api.?key|access.?key|credential|session|signature|^key$|^code$|^sig$/i;
  let fragment = current.hash.slice(1);
  try { fragment = decodeURIComponent(fragment); } catch { /* Inspect the original fragment when percent encoding is malformed. */ }
  const secretFragment = [...fragment.matchAll(/([a-z0-9_.-]+)\s*[:=]/gi)].some((match) => sensitiveName.test(match[1]));
  const jwtFragment = /eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]*)?/.test(fragment);
  if ([...current.searchParams.keys()].some((name) => sensitiveName.test(name)) || secretFragment || jwtFragment) {
    throw new Error("Open a clean URL without credentials before review.");
  }
  let referenceBase = current.href;
  if (document.baseURI) {
    try {
      const base = new URL(document.baseURI);
      referenceBase = ["http:", "https:"].includes(base.protocol) && !base.username && !base.password && base.href.length <= 6000 ? base.href : undefined;
    } catch { referenceBase = undefined; }
  }
  const forms = {
    total: Math.min(document.querySelectorAll("form").length, 10000),
    password_fields: Math.min(document.querySelectorAll('input[type="password"]').length, 10000),
    file_inputs: Math.min(document.querySelectorAll('input[type="file"]').length, 10000),
  };
  const references = [];
  const seen = new Set();
  const encoder = new TextEncoder();
  let contextBytes = encoder.encode(JSON.stringify({ url: current.href, references, forms, secure_context: Boolean(globalThis.isSecureContext) })).length;
  const add = (raw, kind) => {
    if (!raw || references.length >= 200 || typeof raw !== "string" || raw.length > 6000) return;
    let url;
    try { url = new URL(raw, referenceBase); } catch { return; }
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return;
    url.search = "";
    url.hash = "";
    if (url.href.length > 3000) return;
    const key = `${kind}:${url.href}`;
    if (seen.has(key)) return;
    const reference = { url: url.href, kind };
    const bytes = encoder.encode(JSON.stringify(reference)).length + 1;
    if (contextBytes + bytes > 50 * 1024) return;
    seen.add(key);
    references.push(reference);
    contextBytes += bytes;
  };
  // Resource-first passes prevent a large navigation menu from hiding media/scripts.
  for (const selector of ["script[src]", "img, source[src], video[src], audio[src]", "link[href], a[href], iframe[src], form[action], [data-api-url], [data-endpoint]"]) {
    const nodes = document.querySelectorAll(selector);
    for (let index = 0; index < Math.min(nodes.length, 5000) && references.length < 200; index += 1) {
      const node = nodes[index];
      const tag = node.tagName.toLowerCase();
      const attr = (name) => node.getAttribute(name);
      if (tag === "a") add(attr("href"), "link");
      else if (tag === "script") add(attr("src"), "script");
      else if (tag === "link") {
        const rel = (attr("rel") || "").toLowerCase().split(/\s+/);
        if (rel.includes("canonical")) add(attr("href"), "canonical");
        else if (rel.includes("stylesheet")) add(attr("href"), "stylesheet");
      } else if (tag === "img") {
        // currentSrc is the browser-selected URL, including srcset/picture images.
        // Reading it does not initiate a request or enumerate alternative variants.
        add(node.currentSrc, "image");
        add(attr("src"), "image");
      }
      else if (["source", "video", "audio"].includes(tag)) add(attr("src"), "media");
      else if (tag === "iframe") add(attr("src"), "iframe");
      else if (tag === "form") add(attr("action"), "form");
      add(attr("data-api-url"), "api");
      add(attr("data-endpoint"), "api");
    }
  }
  return {
    url: current.href,
    references,
    forms,
    secure_context: Boolean(globalThis.isSecureContext),
  };
}

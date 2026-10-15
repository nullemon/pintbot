export const LOCAL_ORIGINS = Object.freeze(["http://localhost:3000", "http://127.0.0.1:3000"]);

export function localOrigin(value) {
  if (typeof value !== "string" || !LOCAL_ORIGINS.includes(value)) {
    throw new Error("Choose a supported local BountyScope address.");
  }
  return value;
}

/** Repeat capture's URL privacy check before injection so Chrome cannot hide its error. */
export function validateTabURL(value) {
  let current;
  try { current = new URL(value); }
  catch { throw new Error("Open an ordinary HTTP or HTTPS target page before review."); }
  if (!["http:", "https:"].includes(current.protocol)) throw new Error("Only ordinary HTTP or HTTPS pages can be reviewed.");
  if (current.username || current.password) throw new Error("Open a clean URL without credentials before review.");
  if (current.href.length > 3000) throw new Error("The page URL exceeds the URL limit. Open a shorter URL before review.");
  // Deliberately duplicated in the self-contained isolated-world collector.
  const sensitiveName = /authorization|cookie|password|passwd|secret|token|api.?key|access.?key|credential|session|signature|^key$|^code$|^sig$/i;
  let fragment = current.hash.slice(1);
  try { fragment = decodeURIComponent(fragment); } catch { /* Use the original fragment if malformed. */ }
  const secretFragment = [...fragment.matchAll(/([a-z0-9_.-]+)\s*[:=]/gi)].some((match) => sensitiveName.test(match[1]));
  const jwtFragment = /eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]*)?/.test(fragment);
  if ([...current.searchParams.keys()].some((name) => sensitiveName.test(name)) || secretFragment || jwtFragment) {
    throw new Error("Open a clean URL without credentials before review.");
  }
  return current.href;
}

export function apiURL(origin, path) {
  const base = localOrigin(origin);
  if (!/^\/api\/[a-z0-9/_?=&%.-]+$/i.test(path) || path.includes("..")) {
    throw new Error("Invalid API path.");
  }
  const target = new URL(path, base);
  if (target.origin !== base || !target.pathname.startsWith("/api/")) throw new Error("Invalid API destination.");
  return target.href;
}

export function errorMessage(body, status) {
  if (status === 401 || status === 403 && !body?.error?.message) {
    return "Access was denied. Check the local API token and project authorization.";
  }
  const message = body?.error?.message ?? body?.detail;
  if (typeof message === "string") {
    const fields = Array.isArray(body?.error?.fields) ? body.error.fields.map((item) => String(item?.msg || "Invalid field")).join("; ") : "";
    return (fields ? `${message}: ${fields}` : message).slice(0, 1000);
  }
  if (Array.isArray(message)) return message.map((item) => String(item?.msg || "Invalid field")).join("; ").slice(0, 1000);
  if (Array.isArray(body?.error?.fields)) return body.error.fields.map((item) => String(item?.msg || "Invalid field")).join("; ").slice(0, 1000);
  return `BountyScope returned HTTP ${status}. Check the dashboard or container logs.`;
}

export async function requestAPI(origin, token, path, options = {}) {
  const url = apiURL(origin, path);
  const { body, signal, method = "GET" } = options;
  let response;
  try {
    response = await fetch(url, {
      method, signal, credentials: "omit", cache: "no-store", redirect: "error",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch (cause) {
    if (cause?.name === "AbortError") throw cause;
    throw new Error("Cannot reach the local dashboard. Start Docker Compose and check http://localhost:3000.");
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(errorMessage(data, response.status));
    error.status = response.status;
    throw error;
  }
  if (data === null && response.status !== 204) throw new Error("The local API returned an invalid response.");
  return data;
}

export function isTerminal(status) {
  return ["complete", "cancelled", "failed"].includes(status);
}

export function makeReviewBody(projectID, snapshot, profile, focus, confirmed) {
  if (!projectID || !snapshot?.url || !confirmed) throw new Error("Select a project, capture the page, and confirm authorization.");
  if (!["passive", "standard", "exposure"].includes(profile)) throw new Error("Invalid review profile.");
  if (typeof focus !== "string" || focus.length > 1000) throw new Error("Review focus must be at most 1,000 characters.");
  return { project_id: projectID, target: snapshot.url, scan_profile: profile, authorization_confirmed: true, focus: focus.trim(), page_context: snapshot };
}

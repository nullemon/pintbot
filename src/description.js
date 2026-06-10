// Build an SEO-friendly Pinterest description + hashtags from an article.
// Pinterest is a search engine: front-load keywords, keep it natural.

const STOPWORDS = new Set(
  "the a an and or but of to in on for with at by from as is are was were be been this that these those your you how what why when where which who will can".split(
    " "
  )
);

function stripHtml(s) {
  return String(s || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Pull a few keyword hashtags from the title.
function keywordsFromTitle(title, max = 2) {
  const words = stripHtml(title)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOPWORDS.has(w));
  const seen = new Set();
  const tags = [];
  for (const w of words) {
    if (seen.has(w)) continue;
    seen.add(w);
    tags.push("#" + w);
    if (tags.length >= max) break;
  }
  return tags;
}

export function buildDescription({ title, excerpt, hashtags = [] }) {
  const cleanExcerpt = stripHtml(excerpt);
  const cleanTitle = stripHtml(title);

  // Front-load with the title, then the excerpt body.
  let body = cleanTitle;
  if (cleanExcerpt && !cleanExcerpt.startsWith(cleanTitle)) {
    body = `${cleanTitle}. ${cleanExcerpt}`;
  } else if (cleanExcerpt) {
    body = cleanExcerpt;
  }

  // Trim to ~400 chars on a word boundary, leaving room for hashtags.
  if (body.length > 400) {
    body = body.slice(0, 400);
    body = body.slice(0, body.lastIndexOf(" ")) + "…";
  }

  // Merge site hashtags with keyword hashtags, dedupe, cap at 5.
  const merged = [];
  const seen = new Set();
  for (const tag of [...hashtags, ...keywordsFromTitle(cleanTitle)]) {
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(tag);
    if (merged.length >= 5) break;
  }

  const tagLine = merged.join(" ");
  const desc = tagLine ? `${body}\n\n${tagLine}` : body;
  return desc.slice(0, 800); // Pinterest hard limit
}

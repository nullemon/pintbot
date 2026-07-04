// Fetch RSS, enrich featured image via WP REST, dedupe, queue new pins.
import Parser from "rss-parser";
import { fetch } from "undici";
import {
  articleExists,
  insertArticle,
  pinExists,
  insertPin,
  getSites,
} from "./db.js";
import { buildDescription } from "./description.js";
import { prepareImage } from "./image.js";
import { computeNextSlot } from "./scheduler.js";

const parser = new Parser({
  customFields: {
    item: [
      ["media:content", "mediaContent", { keepArray: true }],
      ["media:thumbnail", "mediaThumbnail"],
      ["content:encoded", "contentEncoded"],
    ],
  },
});

// Try to find a featured image directly from the RSS item.
function imageFromRssItem(item) {
  if (Array.isArray(item.mediaContent)) {
    for (const m of item.mediaContent) {
      const url = m?.$?.url;
      if (url) return url;
    }
  }
  if (item.mediaThumbnail?.$?.url) return item.mediaThumbnail.$.url;
  if (item.enclosure?.url) return item.enclosure.url;

  const html = item.contentEncoded || item.content || "";
  const match = /<img[^>]+src=["']([^"']+)["']/i.exec(html);
  if (match) return match[1];
  return null;
}

function slugFromLink(link) {
  try {
    const u = new URL(link);
    const parts = u.pathname.split("/").filter(Boolean);
    return parts[parts.length - 1] || null;
  } catch {
    return null;
  }
}

// Fall back to the WP REST API to read the featured media source_url.
async function imageFromRest(site, link) {
  const slug = slugFromLink(link);
  if (!slug) return null;
  try {
    const url = `${site.restBase}/posts?slug=${encodeURIComponent(slug)}&_embed=1`;
    const res = await fetch(url, {
      headers: { "User-Agent": "pinterest-bot/1.0 (+local)" },
    });
    if (!res.ok) return null;
    const posts = await res.json();
    const post = Array.isArray(posts) ? posts[0] : null;
    const media = post?._embedded?.["wp:featuredmedia"]?.[0];
    return media?.source_url || null;
  } catch {
    return null;
  }
}

// Ingest one site. Returns { added, skipped, errors }.
async function ingestSite(site) {
  const summary = { site: site.name, added: 0, skipped: 0, errors: 0 };

  let feed;
  try {
    feed = await parser.parseURL(site.rss);
  } catch (e) {
    summary.errors++;
    summary.feedError = e.message;
    return summary;
  }

  for (const item of feed.items || []) {
    const guid = item.guid || item.link;
    if (!guid) {
      summary.skipped++;
      continue;
    }

    if (articleExists(guid) || pinExists(guid)) {
      summary.skipped++;
      continue;
    }

    try {
      let imageUrl = imageFromRssItem(item);
      if (!imageUrl) imageUrl = await imageFromRest(site, item.link);

      const article = {
        guid,
        site: site.name,
        title: item.title || "",
        link: item.link || "",
        excerpt: item.contentSnippet || item.summary || "",
        image_url: imageUrl,
        pub_date: item.isoDate || item.pubDate || null,
      };
      insertArticle(article);

      if (!imageUrl) {
        // No image — record the article but don't queue a pin.
        summary.skipped++;
        continue;
      }

      const imagePath = await prepareImage({
        guid,
        imageUrl,
        title: article.title,
        overlay: site.overlayTitle !== false,
      });

      const description = buildDescription({
        title: article.title,
        excerpt: article.excerpt,
        hashtags: site.hashtags || [],
      });

      insertPin({
        guid,
        site: site.name,
        board_id: site.defaultBoardId,
        title: article.title,
        description,
        link: article.link,
        image_path: imagePath,
        scheduled_at: computeNextSlot(),
        status: "pending",
      });
      summary.added++;
    } catch (e) {
      summary.errors++;
      summary.lastError = e.message;
    }
  }

  return summary;
}

// Ingest every configured (enabled) site.
export async function ingestAll() {
  const results = [];
  for (const site of getSites()) {
    results.push(await ingestSite(site));
  }
  return results;
}

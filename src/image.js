// Download featured image, smart-crop to a vertical format, optional title overlay.
import { fetch } from "undici";
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { config } from "./config.js";
import { getSetting, setSetting } from "./db.js";

// Vertical output presets. "wallpaper" (9:16) is the phone-wallpaper trend;
// "pin" (2:3) is Pinterest's classic recommended ratio (displays fully in feed).
export const IMAGE_PRESETS = {
  wallpaper: { width: 1080, height: 1920, label: "Phone wallpaper — 9:16 (1080×1920)" },
  wallpaper_hd: { width: 1440, height: 2560, label: "Phone wallpaper HD — 9:16 (1440×2560)" },
  pin: { width: 1000, height: 1500, label: "Pinterest standard — 2:3 (1000×1500)" },
};

const DEFAULT_PRESET = "wallpaper";

// Current output dimensions, from the menu setting.
export function getImageSettings() {
  const preset = getSetting("image.preset", DEFAULT_PRESET);
  const dims = IMAGE_PRESETS[preset] || IMAGE_PRESETS[DEFAULT_PRESET];
  return { preset: IMAGE_PRESETS[preset] ? preset : DEFAULT_PRESET, ...dims };
}

export function setImagePreset(key) {
  if (!IMAGE_PRESETS[key]) throw new Error(`Unknown image preset: ${key}`);
  setSetting("image.preset", key);
}

export function imagePathForGuid(guid) {
  const hash = crypto.createHash("sha1").update(guid).digest("hex").slice(0, 16);
  return path.join(config.imageDir, `${hash}.jpg`);
}

async function downloadBuffer(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "pinterest-bot/1.0 (+local)" },
  });
  if (!res.ok) throw new Error(`Image download failed: ${res.status} ${url}`);
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Wrap text into lines that fit roughly within the pin width.
function wrapText(text, maxCharsPerLine, maxLines) {
  const words = String(text).trim().split(/\s+/);
  const lines = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxCharsPerLine && current) {
      lines.push(current);
      current = word;
      if (lines.length === maxLines - 1) break;
    } else {
      current = candidate;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  if (lines.length === maxLines && words.join(" ").length > lines.join(" ").length) {
    lines[lines.length - 1] = lines[lines.length - 1].replace(/.{1}$/, "…");
  }
  return lines;
}

// Build an SVG gradient band + title text for the lower portion, scaled to size.
function titleOverlaySvg(title, width, height) {
  const fontSize = Math.round(width * 0.062); // scales with width
  const charsPerLine = Math.max(16, Math.round(width / (fontSize * 0.52)));
  const lines = wrapText(title, charsPerLine, 3);
  const lineHeight = fontSize * 1.2;
  const pad = Math.round(fontSize * 0.9);
  const blockHeight = lines.length * lineHeight + pad * 2;
  const bandTop = height - blockHeight;
  const gradTop = Math.max(0, bandTop - height * 0.12);
  const textStartY = bandTop + pad + fontSize;

  const tspans = lines
    .map(
      (line, i) =>
        `<text x="${width / 2}" y="${textStartY + i * lineHeight}" ` +
        `text-anchor="middle" font-family="'DejaVu Sans','Segoe UI',Arial,sans-serif" ` +
        `font-size="${fontSize}" font-weight="700" fill="#ffffff" ` +
        `stroke="#000000" stroke-width="${Math.max(2, fontSize * 0.04)}" paint-order="stroke">` +
        `${escapeXml(line)}</text>`
    )
    .join("");

  return Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="black" stop-opacity="0"/>
          <stop offset="1" stop-color="black" stop-opacity="0.72"/>
        </linearGradient>
      </defs>
      <rect x="0" y="${gradTop}" width="${width}" height="${height - gradTop}" fill="url(#fade)"/>
      ${tspans}
    </svg>`
  );
}

// Download + smart-crop to the configured vertical size. Returns the saved path.
export async function prepareImage({ guid, imageUrl, title, overlay = true }) {
  if (!imageUrl) throw new Error("No image_url for article");
  const outPath = imagePathForGuid(guid);
  const { width, height } = getImageSettings();

  const input = await downloadBuffer(imageUrl);
  let pipeline = sharp(input).resize(width, height, {
    fit: "cover",
    position: "attention", // bias crop toward the salient region (faces/subjects)
  });

  if (overlay && title) {
    pipeline = pipeline.composite([
      { input: titleOverlaySvg(title, width, height), top: 0, left: 0 },
    ]);
  }

  await pipeline.jpeg({ quality: 88, mozjpeg: true }).toFile(outPath);
  return outPath;
}

export function imageExists(guid) {
  return fs.existsSync(imagePathForGuid(guid));
}

// Download featured image, smart-crop to 1000x1500 (2:3), optional title overlay.
import { fetch } from "undici";
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { config } from "./config.js";

const WIDTH = 1000;
const HEIGHT = 1500;

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

// Build an SVG band + title text for the lower third.
function titleOverlaySvg(title) {
  const lines = wrapText(title, 24, 3);
  const fontSize = 64;
  const lineHeight = fontSize * 1.2;
  const blockHeight = lines.length * lineHeight + 60;
  const bandTop = HEIGHT - blockHeight;
  const textStartY = bandTop + 60 + fontSize;

  const tspans = lines
    .map(
      (line, i) =>
        `<text x="${WIDTH / 2}" y="${textStartY + i * lineHeight}" ` +
        `text-anchor="middle" font-family="'Segoe UI', Arial, sans-serif" ` +
        `font-size="${fontSize}" font-weight="700" fill="#ffffff" ` +
        `stroke="#000000" stroke-width="2" paint-order="stroke">${escapeXml(line)}</text>`
    )
    .join("");

  return Buffer.from(
    `<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="${bandTop}" width="${WIDTH}" height="${blockHeight}"
            fill="black" fill-opacity="0.45"/>
      ${tspans}
    </svg>`
  );
}

// Download + crop. Returns the saved local path.
export async function prepareImage({ guid, imageUrl, title, overlay = true }) {
  if (!imageUrl) throw new Error("No image_url for article");
  const outPath = imagePathForGuid(guid);

  const input = await downloadBuffer(imageUrl);
  let pipeline = sharp(input).resize(WIDTH, HEIGHT, {
    fit: "cover",
    position: "attention", // bias crop toward the salient region
  });

  if (overlay && title) {
    pipeline = pipeline.composite([
      { input: titleOverlaySvg(title), top: 0, left: 0 },
    ]);
  }

  await pipeline.jpeg({ quality: 85, mozjpeg: true }).toFile(outPath);
  return outPath;
}

export function imageExists(guid) {
  return fs.existsSync(imagePathForGuid(guid));
}

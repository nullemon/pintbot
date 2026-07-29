/**
 * Bundles the whole site in site/ into ONE self-contained Worker file.
 *
 *   node site-worker/build-single-file.mjs
 *   -> site-worker/dist/worker.js
 *
 * The output has no imports, no assets binding and no wrangler config: paste it
 * straight into the Cloudflare dashboard editor, or `wrangler deploy` it.
 *
 * Re-run this after editing anything in site/.
 */

import { readFileSync, readdirSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const SITE = join(here, '..', 'site');
const OUT_DIR = join(here, 'dist');
const OUT = join(OUT_DIR, 'worker.js');

/* Server-side concerns, not page assets. */
const SKIP = new Set(['contact.php', '.htaccess', '.assetsignore', 'README.md']);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, files);
    else files.push(full);
  }
  return files;
}

const assets = {};
let total = 0;

for (const file of walk(SITE)) {
  const path = relative(SITE, file).split('\\').join('/');
  if (SKIP.has(path)) continue;

  const ext = extname(path);
  const type = TYPES[ext];
  if (!type) {
    console.warn(`  skipped (binary or unknown type): ${path}`);
    continue;
  }

  const body = readFileSync(file, 'utf8');
  assets['/' + path] = { type, body };
  total += Buffer.byteLength(body);
}

const template = readFileSync(join(here, 'single-file-template.js'), 'utf8');
const output = template.replace('__ASSETS__', JSON.stringify(assets, null, 0));

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT, output);

console.log(`Embedded ${Object.keys(assets).length} files (${(total / 1024).toFixed(1)} KB of content)`);
console.log(`Wrote ${relative(process.cwd(), OUT)} — ${(Buffer.byteLength(output) / 1024).toFixed(1)} KB`);
console.log('Free-plan Worker limit is 3 MB after compression, so there is plenty of headroom.');

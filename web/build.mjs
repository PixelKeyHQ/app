// Builds web/manual.html: bundles web/entry.ts (which reuses the app's own
// src/core modules) into one inline <script>, puts the bundled libraries'
// license notices in an HTML comment at the top, and pins every inline
// script and style block in the Content-Security-Policy by hash. The page is
// a single self-contained file and makes no network requests.
//
// Usage: node web/build.mjs
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const version = (pkg) => JSON.parse(readFileSync(join(root, 'node_modules', pkg, 'package.json'), 'utf8')).version;

const result = await build({
  entryPoints: [join(here, 'entry.ts')],
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'es2019',
  minify: true,
  legalComments: 'none',
  write: false,
});
const bundle = result.outputFiles[0].text.trimEnd();

const MIT = `Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.`;

const libs = [
  { name: 'fflate', pkg: 'fflate', copyright: 'Copyright (c) 2023 Arjun Barrett' },
  { name: 'qrcode-generator', pkg: 'qrcode-generator', copyright: 'Copyright (c) 2009 Kazuhiko Arase' },
  { name: '@noble/curves', pkg: '@noble/curves', copyright: 'Copyright (c) 2022 Paul Miller (https://paulmillr.com)' },
  { name: '@noble/hashes', pkg: '@noble/hashes', copyright: 'Copyright (c) 2022 Paul Miller (https://paulmillr.com)' },
  { name: '@noble/ciphers', pkg: '@noble/ciphers', copyright: 'Copyright (c) 2022 Paul Miller (https://paulmillr.com)\nCopyright (c) 2016 Thomas Pornin <pornin@bolet.org>' },
];

// Text inside an HTML comment must not contain "--", or a stray "-->" could
// end the comment early. Break up every run of dashes.
const commentSafe = (s) => {
  let out = s;
  while (out.includes('--')) out = out.replace(/--/g, '- -');
  return out;
};
const notice = '<!--\n' + commentSafe(
  'Pixel Key manual page. Generated from web/manual.template.html by web/build.mjs.\n\n' +
    'This page bundles the following open-source libraries, each under the MIT License:\n\n' +
    libs.map((l) => `${l.name} ${version(l.pkg)}\n${l.copyright}`).join('\n\n') +
    '\n\nMIT License\n\n' +
    MIT,
) + '\n-->';

const sha256 = (s) => `'sha256-${createHash('sha256').update(s, 'utf8').digest('base64')}'`;
const blocks = (html, tag) => [...html.matchAll(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'g'))].map((m) => m[1]);

const template = readFileSync(join(here, 'manual.template.html'), 'utf8');
let html = template.replace('__NOTICE__', () => notice).replace('__BUNDLE__', () => bundle);
const csp = [
  "default-src 'none'",
  `script-src ${blocks(html, 'script').map(sha256).join(' ')}`,
  `style-src ${blocks(html, 'style').map(sha256).join(' ')}`,
  'img-src data:',
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');
html = html.replace('__CSP__', () => csp);
writeFileSync(join(here, 'manual.html'), html);
console.log(`web/manual.html written (${html.length} bytes, bundle ${bundle.length} bytes)`);

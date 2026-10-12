// Builds web/offline.html: bundles web/entry.ts (which reuses the app's own
// src/core modules) into one inline <script>, and injects open-source license
// notices. The page is fully self-contained and makes no network requests.
//
// Usage: node web/build.mjs
import { build } from 'esbuild';
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

const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const licenses = escapeHtml(
  '本页内置以下开源库，均为 MIT 许可证：\n\n' +
    libs.map((l) => `${l.name} ${version(l.pkg)}\n${l.copyright}`).join('\n\n') +
    '\n\nMIT License\n\n' +
    MIT,
);

const template = readFileSync(join(here, 'offline.template.html'), 'utf8');
const html = template.replace('__LICENSES__', licenses).replace('__BUNDLE__', () => bundle);
writeFileSync(join(here, 'offline.html'), html);
console.log(`web/offline.html written (${html.length} bytes, bundle ${bundle.length} bytes)`);

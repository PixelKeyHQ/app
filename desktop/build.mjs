import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url)), root = join(here, '..'), dist = join(here, 'dist');
mkdirSync(dist, { recursive: true });
for (const name of ['main', 'preload', 'renderer']) {
  await build({
    entryPoints: [join(here, 'src', `${name}.ts`)], bundle: true,
    outfile: join(dist, name === 'renderer' ? 'renderer.js' : `${name}.cjs`),
    platform: name === 'renderer' ? 'browser' : 'node',
    format: name === 'renderer' ? 'iife' : 'cjs',
    target: name === 'renderer' ? 'chrome144' : 'node24',
    external: ['electron'], legalComments: 'eof', sourcemap: false,
  });
}

// Share the offline manual page's styles; its markup and scripts stay web-only.
const base = /<style>([\s\S]*?)<\/style>/.exec(readFileSync(join(root, 'web/manual.template.html'), 'utf8'))?.[1];
if (!base) throw new Error('Manual page styles missing.');
let html = readFileSync(join(here, 'src/index.html'), 'utf8');
for (const marker of ['__STYLE__', '__CSP__']) if (html.split(marker).length !== 2) throw new Error(`Desktop markup needs one ${marker}.`);
html = html.replace('__STYLE__', () => base);
const style = /<style>([\s\S]*?)<\/style>/.exec(html)[1];
const hash = createHash('sha256').update(style).digest('base64');
html = html.replace('__CSP__', `default-src 'none'; script-src 'self'; style-src 'sha256-${hash}'; img-src data:; base-uri 'none'; form-action 'none'; frame-src 'none'; connect-src 'none'`);
writeFileSync(join(dist, 'index.html'), html);
copyFileSync(join(root, 'assets/icon.png'), join(dist, 'icon.png'));
copyFileSync(join(root, 'LICENSE'), join(dist, 'LICENSE'));
// Preserve the third-party notices already shipped by the offline page.
const notice = /^<!doctype html>\n<!--([\s\S]*?)-->/.exec(readFileSync(join(root, 'web/manual.html'), 'utf8'))?.[1];
if (!notice) throw new Error('Offline page license notice missing.');
writeFileSync(join(dist, 'THIRD-PARTY-NOTICES.txt'), notice.trim() + '\n');
console.log('Desktop bundles and interface built.');

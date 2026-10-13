import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { encodeProfile, profileLink, qrMatrix } from '../src/core/codec';
import { manualProfile, parseAuthRequest, type ManualFields } from '../src/core/input';
import { DEFAULT_MODEL, maskedAccount, type Model, profileModel, qrFits } from '../src/core/profile';
import { alias } from './fixtures';

// Load the built manual page and run its inlined bundle in a sandbox, so the
// test exercises the exact bytes the browser would run (not the TS source).
const html = readFileSync(new URL('../web/manual.html', import.meta.url), 'utf8');
const bundle = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1];
assert.ok(bundle && bundle.includes('PixelKey'), 'manual.html must embed the bundle; run `node web/build.mjs`');

const sandbox: Record<string, unknown> = { TextEncoder, TextDecoder, crypto, console };
sandbox.globalThis = sandbox;
vm.runInNewContext(bundle!, sandbox);
const web = (sandbox as { PixelKey: any }).PixelKey;
// Values from the bundle live in another vm realm; compare them as JSON.
const same = (actual: unknown, expected: unknown, message = 'mismatch') => assert.equal(JSON.stringify(actual), JSON.stringify(expected), message);

const vectors: Array<{ fields: ManualFields; model: Model }> = [
  { fields: { email: 'alice@example.invalid', token: 'aas_et/FAKE-master-token-0001', androidId: '0123456789abcdef', alias: '' }, model: 'Pixel XL' },
  { fields: { email: '测试+backup@example.invalid', token: 'aas_et/FAKE-master-token-0002', androidId: 'ABCDEF0123456789', alias: '' }, model: 'Pixel 2' },
  { fields: { email: 'bob@example.invalid', token: 'aas_et/FAKE-master-token-0003', androidId: 'fedcba9876543210', alias }, model: 'Pixel' },
  { fields: { email: 'carol@example.invalid', token: 'aas_et/FAKE-master-token-0004', androidId: '00112233445566aa', alias }, model: 'Pixel 5' },
];

test('web bundle and app produce byte-for-byte identical profiles, codes and QR matrices', () => {
  assert.equal(web.DEFAULT_MODEL, DEFAULT_MODEL);
  for (const { fields, model } of vectors) {
    const appProfile = manualProfile(fields, model), webProfile = web.manualProfile(fields, model);
    assert.equal(web.encodeProfile(webProfile), encodeProfile(appProfile), `code mismatch for ${model}`);
    const appLink = profileLink(appProfile), webLink = web.profileLink(webProfile);
    assert.equal(webLink, appLink, `link mismatch for ${model}`);
    assert.equal(web.qrFits(webLink), qrFits(appLink));
    same(web.qrMatrix(webLink), qrMatrix(appLink), `qr mismatch for ${model}`);
    assert.equal(web.profileModel(webProfile), profileModel(appProfile));
    assert.equal(web.maskedAccount(fields.email), maskedAccount(fields.email));
  }
});

test('web bundle parses pasted auth requests like the app', () => {
  const form = 'androidId=0123456789abcdef&lang=en&Email=alice%40example.invalid&has_permission=1&Token=aas_et%2FFAKE-master-token-0001&service=ac2dm';
  const json = JSON.stringify({ androidId: '0123456789abcdef', Email: 'alice@example.invalid', Token: 'aas_et/FAKE-master-token-0001', token_binding_alias: alias });
  for (const input of [form, json]) same(web.parseAuthRequest(input), parseAuthRequest(input));
  same(web.parseAuthRequest(form), { email: 'alice@example.invalid', token: 'aas_et/FAKE-master-token-0001', androidId: '0123456789abcdef', alias: '' });
  for (const bad of ['', 'curl https://example.invalid', '{"v":1}', 'Authorization: Bearer x']) {
    assert.throws(() => parseAuthRequest(bad));
    assert.throws(() => web.parseAuthRequest(bad));
    assert.equal(web.safeMessage(catchError(() => web.parseAuthRequest(bad))), '剪贴板里不是认证请求内容。');
  }
});

test('web bundle reuses the app validation (bad input rejected the same way)', () => {
  const bad: ManualFields = { email: 'not-an-email', token: 'ya29.short', androidId: 'xyz', alias: '' };
  assert.throws(() => manualProfile(bad, DEFAULT_MODEL));
  assert.throws(() => web.manualProfile(bad, DEFAULT_MODEL));
  same(web.manualErrors(bad), {
    email: '邮箱格式不正确。',
    token: '这是短期令牌。Master Token 以 aas_et/ 开头。',
    androidId: 'Android ID 是 16 位十六进制。',
  });
});

test('manual page is one self-contained file locked down by its CSP', () => {
  const csp = /<meta http-equiv="Content-Security-Policy" content="([^"]+)">/.exec(html)?.[1];
  assert.ok(csp, 'CSP meta tag missing');
  assert.match(csp!, /^default-src 'none';/);
  assert.doesNotMatch(csp!, /unsafe-|https?:|\*/);
  // Every inline script and style block must be pinned by hash, or the
  // browser refuses to run it.
  const hash = (s: string) => `'sha256-${createHash('sha256').update(s, 'utf8').digest('base64')}'`;
  for (const tag of ['script', 'style']) {
    const blocks = [...html.matchAll(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'g'))].map(m => m[1]!);
    assert.ok(blocks.length > 0);
    for (const block of blocks) assert.ok(csp!.includes(hash(block)), `${tag} block not in CSP; run \`node web/build.mjs\``);
  }
  // Check the page markup, not the script bodies (library code may hold such strings).
  const markup = html.replace(/<script>[\s\S]*?<\/script>/g, '<script></script>');
  // Plain <a> links are navigation the user chooses, not resource loads.
  const resources = markup.replace(/<a\s[^>]*>/gi, '<a>');
  assert.doesNotMatch(resources, /\s(?:src|href|action)=["']?(?:https?:)?\/\//i, 'page must not reference remote resources');
  assert.doesNotMatch(markup, /<(?:script|style)\s[^>]*>|\sstyle=/i, 'inline style attributes and attributed script/style tags are not covered by the CSP');

  const notice = /^<!doctype html>\n<!--([\s\S]*?)-->/.exec(html)?.[1];
  assert.ok(notice, 'license notice comment missing at the top of the page');
  assert.ok(!notice!.includes('--'), 'license notice must not contain "--"');
  for (const lib of ['fflate', 'qrcode-generator', '@noble/curves', '@noble/hashes', '@noble/ciphers', 'MIT License']) assert.ok(notice!.includes(lib), lib);
});

function catchError(fn: () => unknown): unknown {
  try { fn(); } catch (error) { return error; }
  throw new Error('expected a throw');
}

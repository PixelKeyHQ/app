import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { profileLink, qrMatrix } from '../src/core/codec';
import { manualProfile, type ManualFields } from '../src/core/input';
import { DEFAULT_MODEL, type Model } from '../src/core/profile';
import { alias } from './fixtures';

// Load the built offline page and run its inlined bundle in a sandbox, so the
// test exercises the exact bytes the browser would run (not the TS source).
const html = readFileSync(new URL('../web/offline.html', import.meta.url), 'utf8');
const bundle = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1];
assert.ok(bundle && bundle.includes('PixelKey'), 'offline.html must embed the bundle; run `node web/build.mjs`');

const sandbox: Record<string, unknown> = { TextEncoder, TextDecoder, crypto, console };
sandbox.globalThis = sandbox;
vm.runInNewContext(bundle!, sandbox);
const web = (sandbox as { PixelKey: any }).PixelKey;

const vectors: Array<{ fields: ManualFields; model: Model }> = [
  { fields: { email: 'alice@example.invalid', token: 'aas_et/FAKE-master-token-0001', androidId: '0123456789abcdef', alias: '' }, model: 'Pixel XL' },
  { fields: { email: '测试+backup@example.invalid', token: 'aas_et/FAKE-master-token-0002', androidId: 'ABCDEF0123456789', alias: '' }, model: 'Pixel 2' },
  { fields: { email: 'bob@example.invalid', token: 'aas_et/FAKE-master-token-0003', androidId: 'fedcba9876543210', alias }, model: 'Pixel' },
  { fields: { email: 'carol@example.invalid', token: 'aas_et/FAKE-master-token-0004', androidId: '00112233445566aa', alias }, model: 'Pixel 5' },
];

test('web bundle and app produce byte-for-byte identical profiles and QR matrices', () => {
  assert.equal(web.DEFAULT_MODEL, DEFAULT_MODEL);
  for (const { fields, model } of vectors) {
    const appLink = profileLink(manualProfile(fields, model));
    const webLink = web.profileLink(web.manualProfile(fields, model));
    assert.equal(webLink, appLink, `link mismatch for ${model}`);
    // Compare via JSON: the bundle runs in a separate vm realm, so its arrays
    // have a different prototype and would fail reference-equal deepEqual.
    assert.equal(JSON.stringify(web.qrMatrix(webLink)), JSON.stringify(qrMatrix(appLink)), `qr mismatch for ${model}`);
  }
});

test('web bundle reuses the app validation (bad input rejected the same way)', () => {
  const bad: ManualFields = { email: 'not-an-email', token: 'ya29.short', androidId: 'xyz', alias: '' };
  const appErr = manualProfile.bind(null, bad, DEFAULT_MODEL);
  assert.throws(appErr);
  assert.throws(() => web.manualProfile(bad, DEFAULT_MODEL));
  assert.equal(
    JSON.stringify(web.manualErrors(bad)),
    JSON.stringify({
      email: '邮箱格式不正确。',
      token: '这是短期令牌。Master Token 以 aas_et/ 开头。',
      androidId: 'Android ID 是 16 位十六进制。',
    }),
  );
});

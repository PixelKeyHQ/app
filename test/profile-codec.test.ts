import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inflateRawSync, deflateRawSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { base64url, INPUT_LIMIT, unbase64 } from '../src/core/bytes';
import { decodeProfile, encodeProfile, profileLink, qrMatrix } from '../src/core/codec';
import { importProfile } from '../src/core/input';
import { canonicalJSON } from '../src/core/json';
import { authForm, buildProfile, formEncode, LINK_PREFIX, qrFits, type Fields } from '../src/core/profile';
import { alias, fields } from './fixtures';

test('production parser and codec round-trip JSON/form/code/link, preserving Unicode and optional fields', () => {
  const additionsList: Fields[] = [{}, { oauth2_foreground: '1' }, { oauth2_foreground: '1', token_binding_alias: alias }];
  for (const additions of additionsList) {
    const data = { ...fields, ...additions }, profile = buildProfile(data), code = encodeProfile(profile);
    assert.deepEqual(importProfile(JSON.stringify(data)), profile);
    assert.deepEqual(importProfile(formEncode(data)), profile);
    assert.deepEqual(decodeProfile(code), profile);
    assert.deepEqual(importProfile(profileLink(profile)), profile);
    assert.equal(code.slice(0, 5), 'lp1z.');
    assert.equal(inflateRawSync(unbase64(code.slice(5))).toString(), canonicalJSON(profile));
    assert.equal('oauth2_foreground' in authForm(profile), !!data.oauth2_foreground);
  }
});

test('builder output, canonical JSON and codes match the golden fixtures', () => {
  const vectors = [{ ...fields }, { ...fields, oauth2_foreground: '1' }, { ...fields, oauth2_foreground: '1', token_binding_alias: alias }];
  const expected = JSON.parse(readFileSync(new URL('./golden-profiles.json', import.meta.url), 'utf8'));
  for (let i = 0; i < vectors.length; i++) {
    const profile = buildProfile(vectors[i]!); assert.deepEqual(profile, expected[i].profile);
    assert.equal(canonicalJSON(profile), expected[i].raw);
    assert.deepEqual(decodeProfile(expected[i].code), profile);
  }
});

test('QR capacity includes full setup link; accepts 2953 bytes and rejects 2954', () => {
  const max = LINK_PREFIX + 'A'.repeat(2953 - LINK_PREFIX.length);
  assert.equal(qrFits(max), true); assert.equal(qrMatrix(max).length, 177);
  assert.equal(qrFits(max + 'A'), false); assert.throws(() => qrMatrix(max + 'A'), /容量/);
});

test('duplicate/prototype keys, short tokens, old assertions, damaged encoding and arbitrary protocols are rejected safely', () => {
  const fake = 'FAKE-NOT-A-REAL-MASTER';
  for (const input of [
    formEncode(fields) + '&Token=' + fake,
    '{"Token":"' + fake + '","Token":"duplicate"}',
    '{"__proto__":{"polluted":true}}',
    'Email=%GG&Token=' + fake,
    JSON.stringify({ ...fields, Token: 'ya29.short-bearer' }),
    JSON.stringify({ ...fields, assertion_jwt: 'captured-old-proof' }),
    JSON.stringify({ ...buildProfile(fields), auth: { ...buildProfile(fields).auth, url: 'https://evil.invalid/auth' } }),
  ]) { assert.throws(() => importProfile(input), error => error instanceof Error && !error.message.includes(fake)); }
});

test('bounded raw DEFLATE rejects large expansion and malformed codes without allocating expansion', () => {
  const bomb = 'lp1z.' + base64url(deflateRawSync(Buffer.from('A'.repeat(8 * 1024 * 1024))));
  assert.throws(() => decodeProfile(bomb), /64 KiB/);
  assert.throws(() => decodeProfile('lp1.A'), /Base64/);
  assert.throws(() => importProfile(' '.repeat(INPUT_LIMIT + 1)), /64 KiB/);
});

test('optional source/operatorCountry fields and the original androidId are retained', () => {
  const ordinary = buildProfile({ ...fields, oauth2_foreground: '1' });
  const extra = buildProfile({ ...fields, oauth2_foreground: '1', source: 'android', operatorCountry: 'us' });
  assert.equal(ordinary.auth.form.length, 13); assert.equal(extra.auth.form.length, 15);
  assert.equal(extra.credential.androidId, fields.androidId);
  assert.equal(authForm(extra).operatorCountry, 'us'); assert.deepEqual(importProfile(JSON.stringify(extra)), extra);
});

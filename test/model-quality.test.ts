import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeProfile, encodeProfile, profileLink } from '../src/core/codec';
import { connectGoogle } from '../src/core/google-auth';
import { importProfile, manualErrors, manualProfile, parseAuthRequest } from '../src/core/input';
import { canonicalJSON } from '../src/core/json';
import { buildProfile, formEncode, ORIGINAL_MODELS, profileModel, qualityFor, SAVER_MODELS, validateProfile, type Model } from '../src/core/profile';
import dialect from '../src/core/profile-dialect.json';
import { alias, fields, random } from './fixtures';

const signal = () => new AbortController().signal;
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

test('original-quality models keep Pixel 2 as the compressed tier; saver models have no original tier', () => {
  for (const model of ORIGINAL_MODELS) {
    assert.deepEqual(buildProfile(fields, model).quality, { original: { code: 3, model }, compressed: { code: 1, model: 'Pixel 2' } });
  }
  for (const model of SAVER_MODELS) {
    const profile = buildProfile(fields, model);
    assert.deepEqual(profile.quality, { compressed: { code: 1, model } });
    assert.equal('original' in profile.quality, false); assert.equal(profileModel(profile), model);
  }
  assert.deepEqual(buildProfile(fields).quality, dialect.quality);
  assert.deepEqual(buildProfile(fields, 'Pixel XL'), buildProfile(fields));
});

test('validateProfile accepts exactly the two quality shapes for listed models and round-trips them', () => {
  for (const model of [...ORIGINAL_MODELS, ...SAVER_MODELS] as Model[]) {
    const profile = buildProfile({ ...fields, token_binding_alias: alias }, model);
    assert.deepEqual(validateProfile(clone(profile)), profile);
    assert.deepEqual(decodeProfile(encodeProfile(profile)), profile);
    assert.deepEqual(importProfile(profileLink(profile)), profile);
  }
});

test('any other quality shape, model or code is rejected', () => {
  const base = buildProfile(fields);
  const bad: unknown[] = [
    { compressed: { code: 1, model: 'Pixel 5a' } },
    { compressed: { code: 1, model: 'Pixel 9' } },
    { original: { code: 3, model: 'Pixel 3' }, compressed: { code: 1, model: 'Pixel 2' } },
    { original: { code: 3, model: 'Pixel' }, compressed: { code: 1, model: 'Pixel 3' } },
    { original: { code: 3, model: 'Pixel' } },
    { compressed: { code: 1, model: 'Pixel' } },
    { compressed: { code: 3, model: 'Pixel 4' } },
    { original: { code: 1, model: 'Pixel XL' }, compressed: { code: 1, model: 'Pixel 2' } },
    { original: { code: 3, model: 'Pixel XL' }, compressed: { code: 1, model: 'Pixel 2' }, extra: { code: 2, model: 'Pixel 2' } },
    { compressed: { code: 1, model: 'Pixel 4', note: 'x' } },
    { compressed: { code: 1, model: ' Pixel 4' } },
    {}, null, 'Pixel XL',
  ];
  for (const quality of bad) assert.throws(() => validateProfile({ ...clone(base), quality }), Error, canonicalJSON(quality));
  const saver = clone(buildProfile(fields, 'Pixel 4'));
  assert.throws(() => validateProfile({ ...saver, server: 'evil.invalid' }));
  assert.throws(() => validateProfile({ ...saver, client: { ...saver.client, make: 'Other' } }));
});

test('imported lp1 codes and profiles keep their quality; raw auth request fields take the chosen model', () => {
  const saver = buildProfile(fields, 'Pixel 3a');
  assert.deepEqual(importProfile(encodeProfile(saver), '', 'Pixel XL').quality, saver.quality);
  assert.deepEqual(importProfile(JSON.stringify(saver), '', 'Pixel').quality, saver.quality);
  assert.deepEqual(importProfile(formEncode(fields), '', 'Pixel 5').quality, { compressed: { code: 1, model: 'Pixel 5' } });
  assert.deepEqual(importProfile(JSON.stringify(fields), '', 'Pixel').quality.original, { code: 3, model: 'Pixel' });
});

test('connectGoogle builds the profile for the chosen model', async () => {
  const transport = async () => ({ status: 200, body: 'Email=owner@example.invalid\nToken=aas_et/FAKE-MASTER' });
  const profile = await connectGoogle('FAKE-COOKIE-SELF-PROVIDED', transport, random, signal(), 'Pixel 4a (5G)');
  assert.deepEqual(profile.quality, { compressed: { code: 1, model: 'Pixel 4a (5G)' } });
  assert.deepEqual(validateProfile(clone(profile)), profile);
});

test('manual entry validates each field and fills the Photos constants', () => {
  const good = { email: 'test@example.com', token: 'aas_et/FAKE-NOT-A-REAL-MASTER', androidId: '0123456789abcdef', alias: '' };
  assert.deepEqual(manualErrors(good), {});
  assert.match(manualErrors({ ...good, token: 'ya29.short' }).token!, /短期令牌/);
  assert.match(manualErrors({ ...good, token: 'Bearer abc' }).token!, /短期令牌/);
  assert.match(manualErrors({ ...good, token: 'FAKE-NO-PREFIX-0000' }).token!, /aas_et/);
  assert.ok(manualErrors({ ...good, email: 'nope' }).email);
  assert.ok(manualErrors({ ...good, androidId: '0123' }).androidId);
  assert.ok(manualErrors({ ...good, alias: 'auth_account:ecdsa_keypair:broken' }).alias);
  assert.deepEqual(manualErrors({ ...good, alias }), {});
  const profile = manualProfile({ ...good, alias }, 'Pixel 2 XL');
  assert.equal(profile.credential.Email, good.email); assert.equal(profile.credential.token_binding_alias, alias);
  assert.deepEqual(profile.quality, { compressed: { code: 1, model: 'Pixel 2 XL' } });
  assert.deepEqual(validateProfile(clone(profile)), profile);
  assert.throws(() => manualProfile({ ...good, token: 'ya29.short' }, 'Pixel'), /短期令牌/);
});

test('pasted auth request fills only the user-facing fields, from form or field JSON', () => {
  const data = { ...fields, token_binding_alias: alias };
  const expected = { email: fields.Email, token: fields.Token, androidId: fields.androidId, alias };
  assert.deepEqual(parseAuthRequest(formEncode(data)), expected);
  assert.deepEqual(parseAuthRequest(JSON.stringify(data)), expected);
  assert.deepEqual(parseAuthRequest(formEncode({ Email: 'a@example.com' })), { email: 'a@example.com', token: '', androidId: '', alias: '' });
  for (const input of ['hello', '{"v":1}', 'client_sig=abc', 'curl -X POST', JSON.stringify(buildProfile(fields)), encodeProfile(buildProfile(fields))]) {
    assert.throws(() => parseAuthRequest(input), /剪贴板里不是认证请求内容。/);
  }
});

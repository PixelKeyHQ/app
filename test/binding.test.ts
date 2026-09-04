import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCipheriv, createECDH, hkdfSync, verify } from 'node:crypto';
import { base64url, concat, text, unbase64, utf8 } from '../src/core/bytes';
import { bindingSession, parseAlias, pbBytes, publicKeyset } from '../src/core/token-binding';
import { checkProfile } from '../src/core/google-auth';
import { buildProfile } from '../src/core/profile';
import dialect from '../src/core/profile-dialect.json';
import { alias, fields, nodeKey, pkcs8, point, random, secret, spki } from './fixtures';

function encryptFor(ephemeral: Uint8Array, id: number, token = 'FAKE-ENCRYPTED-BEARER'): string {
  const sender = createECDH('prime256v1'); sender.generateKeys(); const kem = sender.getPublicKey();
  const shared = sender.computeSecret(ephemeral);
  const key = hkdfSync('sha256', Buffer.concat([kem, shared]), Buffer.alloc(0), Buffer.alloc(0), 16);
  const iv = Buffer.alloc(12, 9), cipher = createCipheriv('aes-128-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(token), cipher.final(), cipher.getAuthTag()]);
  const prefix = Buffer.alloc(5); prefix[0] = 1; prefix.writeUInt32BE(id, 1);
  return base64url(Buffer.concat([prefix, kem, iv, encrypted]));
}

test('alias validates PKCS8 P-256 and matching SPKI; rejects mismatched or malformed keys', () => {
  const key = parseAlias(alias); assert.deepEqual(key.secret, secret); assert.deepEqual(key.point, point);
  const wrong = createECDH('prime256v1'); wrong.generateKeys();
  const mismatched = spki.slice(); mismatched.set(wrong.getPublicKey(), mismatched.length - 65);
  assert.throws(() => parseAlias('auth_account:ecdsa_keypair:' + base64url(concat(pbBytes(1, pkcs8), pbBytes(2, mismatched)))), /alias/);
  assert.throws(() => parseAlias(alias + 'A')); assert.throws(() => parseAlias('auth_account:ecdsa_keypair:AAAA'));
});

test('fresh assertion verifies with Node crypto; response decrypt interoperates with OpenSSL HKDF and AES-GCM', async () => {
  const ephemeral = new Uint8Array(32); ephemeral[31] = 2; const id = 0x01020304;
  const session = await bindingSession(alias, dialect.auth.binding, async n => n === 32 ? ephemeral.slice() : Uint8Array.of(1, 2, 3, 4), 1_700_000_000_000);
  const jwt = session.assertion.split('.');
  assert.equal(verify('sha256', utf8(jwt[0] + '.' + jwt[1]), { key: nodeKey, dsaEncoding: 'ieee-p1363' }, unbase64(jwt[2]!)), true);
  const payload = JSON.parse(text(unbase64(jwt[1]!)));
  assert.equal(payload.iat, 1700000000); assert.equal(payload.aud, dialect.auth.binding.audience);
  const expected = publicKeyset(createECDHPoint(ephemeral), id, dialect.auth.binding);
  assert.deepEqual(unbase64(payload.ephemeral_key.TinkKeysetPublicKeyInfo), expected);
  const encrypted = encryptFor(createECDHPoint(ephemeral), id); assert.equal(session.decrypt(encrypted), 'FAKE-ENCRYPTED-BEARER');
  const altered = unbase64(encrypted); altered[altered.length - 1]! ^= 1;
  assert.throws(() => session.decrypt(base64url(altered)), /解密/);
  session.dispose(); assert.throws(() => session.decrypt(encrypted), /取消/);
});
function createECDHPoint(privateKey: Uint8Array): Uint8Array { const ecdh = createECDH('prime256v1'); ecdh.setPrivateKey(privateKey); return new Uint8Array(ecdh.getPublicKey()); }

test('bound production auth signs each request and discards short bearer after validation', async () => {
  const ephemeral = new Uint8Array(32); ephemeral[31] = 3;
  const profile = buildProfile({ ...fields, token_binding_alias: alias });
  let calls = 0;
  const result = await checkProfile(profile, async request => {
    calls++; assert.ok(new URLSearchParams(request.body).get('assertion_jwt'));
    return { status: 200, body: `TokenEncrypted=${encryptFor(createECDHPoint(ephemeral), 7)}\nExpiry=2000000000` };
  }, async n => n === 32 ? ephemeral.slice() : Uint8Array.of(0, 0, 0, 7), new AbortController().signal, 1700000000000);
  assert.equal(calls, 1); assert.deepEqual(result, { bound: true, expiresAt: 2000000000000 });
  assert.equal(profile.credential.token_binding_alias, alias);
});

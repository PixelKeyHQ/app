import { createPrivateKey, createPublicKey, randomBytes as nodeRandomBytes } from 'node:crypto';
import { p256 } from '@noble/curves/nist.js';
import { base64url, concat } from '../src/core/bytes';
import { pbBytes } from '../src/core/token-binding';
import type { Fields } from '../src/core/profile';

export const secret = new Uint8Array(32); secret[31] = 1;
export const point = p256.getPublicKey(secret, false);
export const nodeKey = createPrivateKey({ format: 'jwk', key: { kty: 'EC', crv: 'P-256', d: base64url(secret), x: base64url(point.slice(1, 33)), y: base64url(point.slice(33)) } });
export const pkcs8 = new Uint8Array(nodeKey.export({ type: 'pkcs8', format: 'der' }));
export const spki = new Uint8Array(createPublicKey(nodeKey).export({ type: 'spki', format: 'der' }));
export const alias = 'auth_account:ecdsa_keypair:' + base64url(concat(pbBytes(1, pkcs8), pbBytes(2, spki)));
export const random = async (size: number) => new Uint8Array(nodeRandomBytes(size));
export const fields: Fields = {
  Email: '测试+backup@example.invalid', Token: 'FAKE-NOT-A-REAL-MASTER&=+%/🙂', androidId: '00123456789abcde',
  client_sig: 'a'.repeat(40), callerSig: 'b'.repeat(40), service: 'oauth2:openid https://www.googleapis.com/auth/photos.native', device_country: 'ca',
  lang: 'zh_CN', sdk_version: '35', google_play_services_version: '250932000',
};

import { p256 } from '@noble/curves/nist.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { hkdf } from '@noble/hashes/hkdf.js';
import { gcm } from '@noble/ciphers/aes.js';
import { base64url, concat, text, unbase64, utf8 } from './bytes';
import { fail } from './errors';
import { canonicalJSON } from './json';
import dialect from './profile-dialect.json';
import type { BindingConfig } from './profile';

export type RandomBytes = (size: number) => Promise<Uint8Array>;
const invalid = (): never => fail('binding', '绑定 alias 无效，需要本人原账号的 P-256 私钥和匹配公钥。');
const equal = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((v, i) => v === b[i]);
const ecOid = Uint8Array.of(0x2a, 0x86, 0x48, 0xce, 0x3d, 2, 1);
const curveOid = Uint8Array.of(0x2a, 0x86, 0x48, 0xce, 0x3d, 3, 1, 7);

class DER {
  private offset = 0;
  constructor(private readonly data: Uint8Array) { if (data.length > 2048) invalid(); }
  get done() { return this.offset === this.data.length; }
  peek() { return this.data[this.offset]; }
  read(tag: number): Uint8Array {
    if (this.data[this.offset++] !== tag) invalid();
    let length = this.data[this.offset++]; if (length === undefined) invalid();
    if (length! & 128) {
      const count = length! & 127; if (count < 1 || count > 2) invalid(); length = 0;
      for (let n = 0; n < count; n++) { const b = this.data[this.offset++]; if (b === undefined || n === 0 && b === 0) invalid(); length = length! * 256 + b!; }
      if (length! < 128) invalid();
    }
    const end = this.offset + length!; if (end > this.data.length) invalid();
    const result = this.data.slice(this.offset, end); this.offset = end; return result;
  }
  end(): void { if (!this.done) invalid(); }
}
function sequence(bytes: Uint8Array): DER { const outer = new DER(bytes); const inner = new DER(outer.read(0x30)); outer.end(); return inner; }
function algorithm(bytes: Uint8Array): void {
  const der = new DER(bytes); if (!equal(der.read(6), ecOid) || !equal(der.read(6), curveOid)) invalid(); der.end();
}
function bitPoint(bytes: Uint8Array): Uint8Array { if (bytes.length !== 66 || bytes[0] !== 0 || bytes[1] !== 4) invalid(); return bytes.slice(1); }

export function aliasParts(raw: Uint8Array): { pkcs8: Uint8Array; spki: Uint8Array } {
  if (raw.length > 4096) invalid(); let offset = 0; const fields = new Map<number, Uint8Array>();
  function varint(): number {
    let value = 0, factor = 1;
    for (let n = 0; n < 5; n++) { const b = raw[offset++]; if (b === undefined) invalid(); value += (b! & 127) * factor; if (b! < 128) return value; factor *= 128; }
    return invalid();
  }
  while (offset < raw.length) {
    const tag = varint(), number = Math.floor(tag / 8); if (tag % 8 !== 2 || number !== 1 && number !== 2 || fields.has(number)) invalid();
    const length = varint(), end = offset + length; if (length < 1 || end > raw.length) invalid();
    fields.set(number, raw.slice(offset, end)); offset = end;
  }
  const pkcs8 = fields.get(1), spki = fields.get(2); if (!pkcs8 || !spki) invalid();
  return { pkcs8: pkcs8!, spki: spki! };
}
export function parseAlias(alias: string): { secret: Uint8Array; point: Uint8Array; spki: Uint8Array; issuer: string } {
  try {
    const prefix = dialect.auth.binding.aliasPrefix; if (!alias.startsWith(prefix)) invalid();
    const { pkcs8, spki } = aliasParts(unbase64(alias.slice(prefix.length), 4096));
    const pub = sequence(spki); algorithm(pub.read(0x30)); const point = bitPoint(pub.read(3)); pub.end();
    const privateDer = sequence(pkcs8); if (!equal(privateDer.read(2), Uint8Array.of(0))) invalid();
    algorithm(privateDer.read(0x30)); const sec = sequence(privateDer.read(4)); privateDer.end();
    if (!equal(sec.read(2), Uint8Array.of(1))) invalid(); const secret = sec.read(4);
    if (secret.length !== 32 || !p256.utils.isValidSecretKey(secret)) invalid();
    if (sec.peek() === 0xa0) { const params = new DER(sec.read(0xa0)); if (!equal(params.read(6), curveOid)) invalid(); params.end(); }
    if (sec.peek() === 0xa1) { const inner = new DER(sec.read(0xa1)); if (!equal(bitPoint(inner.read(3)), point)) invalid(); inner.end(); }
    sec.end(); if (!equal(p256.getPublicKey(secret, false), point)) invalid();
    return { secret, point, spki, issuer: base64url(sha256(spki)) };
  } catch { return invalid(); }
}

function varint(value: number): Uint8Array {
  const bytes: number[] = []; do { const part = value % 128; value = Math.floor(value / 128); bytes.push(part + (value ? 128 : 0)); } while (value); return Uint8Array.from(bytes);
}
export function pbBytes(field: number, value: Uint8Array): Uint8Array { return concat(varint(field * 8 + 2), varint(value.length), value); }
const pbInt = (field: number, value: number) => concat(varint(field * 8), varint(value));
const pbString = (field: number, value: string) => pbBytes(field, utf8(value));

export function publicKeyset(point: Uint8Array, keyId: number, config: BindingConfig): Uint8Array {
  const format = pbInt(2, 16);
  const dem = concat(pbString(1, config.aeadType), pbBytes(2, format), pbInt(3, 1));
  const kem = concat(pbInt(1, 2), pbInt(2, 3));
  const params = concat(pbBytes(1, kem), pbBytes(2, pbBytes(2, dem)), pbInt(3, 1));
  const key = concat(pbBytes(2, params), pbBytes(3, point.slice(1, 33)), pbBytes(4, point.slice(33, 65)));
  const data = concat(pbString(1, config.publicKeyType), pbBytes(2, key), pbInt(3, 3));
  return concat(pbInt(1, keyId), pbBytes(2, concat(pbBytes(1, data), pbInt(2, 1), pbInt(3, keyId), pbInt(4, 1))));
}

export async function bindingSession(alias: string, config: BindingConfig, random: RandomBytes, now: number) {
  const key = parseAlias(alias); let ephemeral: Uint8Array = new Uint8Array();
  try {
    for (let attempt = 0; attempt < 16; attempt++) { ephemeral = await random(32); if (ephemeral.length === 32 && p256.utils.isValidSecretKey(ephemeral)) break; ephemeral.fill(0); }
    if (!p256.utils.isValidSecretKey(ephemeral)) fail('random', '无法取得安全随机数。');
    const idBytes = await random(4); if (idBytes.length !== 4) fail('random', '无法取得安全随机数。');
    const keyId = new DataView(idBytes.buffer, idBytes.byteOffset, 4).getUint32(0) || 1;
    const keyset = publicKeyset(p256.getPublicKey(ephemeral, false), keyId, config);
    const payload = { namespace: config.namespace, aud: config.audience, iss: key.issuer, iat: Math.floor(now / 1000), ephemeral_key: { kty: config.publicKeyType, [config.keysetTypeUrl]: base64url(keyset) } };
    const signingInput = base64url(utf8(canonicalJSON({ alg: 'ES256', typ: 'JWT' }))) + '.' + base64url(utf8(canonicalJSON(payload)));
    const assertion = signingInput + '.' + base64url(p256.sign(utf8(signingInput), key.secret));
    let disposed = false;
    return {
      assertion, field: config.assertionField,
      decrypt(encrypted: string): string {
        if (disposed) fail('binding', '绑定检查已取消。');
        let aes: Uint8Array | undefined;
        try {
          let cipher = unbase64(encrypted); const prefix = concat(Uint8Array.of(1), idBytes);
          if (keyId === 1 && idBytes.every(v => v === 0)) prefix.set(Uint8Array.of(0, 0, 0, 1), 1);
          if (cipher[0] === 1) { if (!equal(cipher.slice(0, 5), prefix)) throw new Error(); cipher = cipher.slice(5); }
          if (cipher.length <= 65 + 12 + 16 || cipher[0] !== 4) throw new Error();
          const kem = cipher.slice(0, 65), shared = p256.getSharedSecret(ephemeral, kem, false).slice(1, 33);
          aes = hkdf(sha256, concat(kem, shared), new Uint8Array(), new Uint8Array(), 16); shared.fill(0);
          const plain = gcm(aes, cipher.slice(65, 77), new Uint8Array()).decrypt(cipher.slice(77));
          const token = text(plain); plain.fill(0); if (!token || /[\u0000-\u0020\u007f]/.test(token)) throw new Error();
          return token;
        } catch { return fail('binding-decrypt', '无法解密绑定响应，请核对原始 alias。'); }
        finally { aes?.fill(0); }
      },
      dispose() { disposed = true; ephemeral.fill(0); },
    };
  } catch (error) { ephemeral.fill(0); throw error; }
  finally { key.secret.fill(0); }
}

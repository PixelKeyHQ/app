import { fail } from './errors';

export const INPUT_LIMIT = 64 * 1024;
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
export const utf8 = (text: string) => new TextEncoder().encode(text);
export function text(bytes: Uint8Array): string {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { return fail('encoding', '输入不是有效的 UTF-8 文本。'); }
}
export function bounded(value: string): string {
  if (value.length > INPUT_LIMIT || utf8(value).length > INPUT_LIMIT) fail('size', '输入最多 64 KiB，请只导入所需的认证请求或配置。');
  return value;
}
export function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0; for (const part of parts) { out.set(part, offset); offset += part.length; } return out;
}
export function base64url(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!, b = bytes[i + 1], c = bytes[i + 2];
    out += alphabet[a >>> 2]! + alphabet[((a & 3) << 4) | ((b ?? 0) >>> 4)]!;
    if (b !== undefined) out += alphabet[((b & 15) << 2) | ((c ?? 0) >>> 6)]!;
    if (c !== undefined) out += alphabet[c & 63]!;
  }
  return out.replace(/\+/g, '-').replace(/\//g, '_');
}
export function unbase64(value: string, limit = INPUT_LIMIT): Uint8Array {
  if (!/^[A-Za-z0-9+/_-]*={0,2}$/.test(value) || value.length > Math.ceil(limit / 3) * 4 + 2) fail('encoding', 'Base64 编码无效或过长。');
  const clean = value.replace(/=/g, '').replace(/-/g, '+').replace(/_/g, '/');
  if (clean.length % 4 === 1) fail('encoding', 'Base64 编码不完整。');
  const out: number[] = []; let accumulator = 0, bits = 0;
  for (const ch of clean) {
    accumulator = (accumulator << 6) | alphabet.indexOf(ch); bits += 6;
    if (bits >= 8) { bits -= 8; out.push((accumulator >>> bits) & 255); }
  }
  if ((accumulator & ((1 << bits) - 1)) !== 0 || out.length > limit) fail('encoding', 'Base64 编码无效。');
  return Uint8Array.from(out);
}
export const hex = (bytes: Uint8Array) => Array.from(bytes, v => v.toString(16).padStart(2, '0')).join('');

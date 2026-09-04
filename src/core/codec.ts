import { deflateSync, inflateSync } from 'fflate';
import qrcode from 'qrcode-generator';
import { base64url, bounded, INPUT_LIMIT, text, unbase64, utf8 } from './bytes';
import { fail } from './errors';
import { canonicalJSON, strictJSON } from './json';
import { LINK_PREFIX, qrFits, type Profile, validateProfile } from './profile';

export function encodeProfile(profile: Profile): string {
  const raw = utf8(bounded(canonicalJSON(profile)));
  const plain = 'lp1.' + base64url(raw);
  const packed = 'lp1z.' + base64url(deflateSync(raw, { level: 9 }));
  return packed.length < plain.length ? packed : plain;
}
export function decodeProfile(input: string): Profile {
  let code = bounded(input).trim();
  if (code.startsWith(LINK_PREFIX)) code = code.slice(LINK_PREFIX.length);
  code = code.replace(/\s/g, '');
  const packed = code.startsWith('lp1z.');
  if (!packed && !code.startsWith('lp1.')) fail('code', '配置码需要 lp1. 或 lp1z. 前缀。');
  let raw = unbase64(code.slice(packed ? 5 : 4));
  if (packed) {
    try {
      raw = inflateSync(raw, { out: new Uint8Array(INPUT_LIMIT + 1) });
    } catch { fail('deflate', '配置码损坏，无法解压。'); }
    if (raw.length > INPUT_LIMIT) fail('size', '配置解压后超过 64 KiB。');
  }
  return validateProfile(strictJSON(text(raw)));
}
export function profileLink(profile: Profile): string { return LINK_PREFIX + encodeProfile(profile); }
export function qrMatrix(link: string): boolean[][] {
  if (!qrFits(link)) fail('qr-size', '配置超过单个二维码容量，请复制配置码或导出文本。');
  try {
    const qr = qrcode(0, 'L'); qr.addData(link, 'Byte'); qr.make();
    return Array.from({ length: qr.getModuleCount() }, (_, y) => Array.from({ length: qr.getModuleCount() }, (_, x) => qr.isDark(y, x)));
  } catch { return fail('qr', '无法生成二维码，请复制配置码或导出文本。'); }
}

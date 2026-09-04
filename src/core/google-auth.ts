import { bounded, hex } from './bytes';
import { fail, serviceFailure } from './errors';
import { normalizeOAuthToken } from './input';
import { authForm, buildProfile, DEFAULT_MODEL, formEncode, type Fields, type Model, PHOTOS_DEFAULTS, type Profile, validateProfile } from './profile';
import { bindingSession, type RandomBytes } from './token-binding';
import { ensureActive, type AuthResponse, type AuthTransport } from './transport';

const CRITICAL = new Set(['Error', 'Email', 'Token', 'Auth', 'TokenEncrypted', 'Expiry']);

export function parseResponse(response: AuthResponse): Fields {
  bounded(response.body); const fields: Fields = Object.create(null);
  for (const line of response.body.split(/\r?\n/)) {
    if (!line.trim()) continue; const index = line.indexOf('=');
    if (index < 1) fail('response', '认证服务返回了无法识别的响应。');
    const key = line.slice(0, index), value = line.slice(index + 1);
    if (!CRITICAL.has(key)) continue;
    if (Object.hasOwn(fields, key) || /[\u0000-\u001f\u007f]/.test(value)) fail('response', '认证响应字段损坏或重复。');
    fields[key] = value;
  }
  if (fields.Error) serviceFailure(fields.Error);
  if (response.status < 200 || response.status >= 300) {
    if (response.status === 429) fail('rate-limit', '认证请求过于频繁，请稍后重试。');
    if (response.status >= 300 && response.status < 400) fail('redirect', '认证端点发生重定向，已停止。');
    fail('http', `认证服务返回 HTTP ${response.status}，请稍后重试或核对材料。`);
  }
  return fields;
}

export async function connectGoogle(input: string, transport: AuthTransport, random: RandomBytes, signal: AbortSignal, model: Model = DEFAULT_MODEL): Promise<Profile> {
  ensureActive(signal); const cookie = normalizeOAuthToken(input);
  const id = await random(8); ensureActive(signal); if (id.length !== 8) fail('random', '无法取得安全随机数。');
  const androidId = hex(id);
  const sig = '38918a453d07199354f8b19af05ec6562ced5788';
  const fields: Fields = {
    accountType: 'HOSTED_OR_GOOGLE', Email: 'user@pixelkey.invalid', has_permission: '1', add_account: '1', ACCESS_TOKEN: '1', Token: cookie,
    service: 'ac2dm', source: 'android', androidId, device_country: 'us', operatorCountry: 'us', lang: 'en', sdk_version: '17',
    google_play_services_version: '243560038', client_sig: sig, callerSig: sig, droidguard_results: 'none',
  };
  const response = parseResponse(await transport({ stage: 'master', body: formEncode(fields) }, signal)); ensureActive(signal);
  if (!response.Email || !response.Token) fail('master-response', '认证响应缺少邮箱或长期主凭证。');
  return buildProfile({ ...PHOTOS_DEFAULTS, Email: response.Email, Token: response.Token, androidId }, model);
}

export async function checkProfile(profile: Profile, transport: AuthTransport, random: RandomBytes, signal: AbortSignal, now = Date.now()): Promise<{ expiresAt: number; bound: boolean }> {
  ensureActive(signal); validateProfile(profile);
  const fields = authForm(profile), alias = profile.credential.token_binding_alias;
  const session = alias ? await bindingSession(alias, profile.auth.binding, random, now) : undefined;
  try {
    ensureActive(signal); if (session) fields[session.field] = session.assertion;
    const response = parseResponse(await transport({ stage: 'photos', body: formEncode(fields), device: profile.credential.androidId }, signal)); ensureActive(signal);
    if (response.Auth && response.TokenEncrypted) fail('response', '认证响应同时含明文和加密令牌，已停止。');
    let token = response.Auth;
    if (response.TokenEncrypted) {
      if (!session) fail('binding-required', '服务返回设备绑定令牌。需要本人原始绑定 alias，单独主凭证无法完成检查。');
      token = session.decrypt(response.TokenEncrypted);
    }
    if (!token || /[\u0000-\u0020\u007f]/.test(token)) fail('photos-response', 'Photos 认证响应缺少有效令牌。');
    if (!/^\d{1,12}$/.test(response.Expiry ?? '')) fail('expiry', '认证响应缺少有效过期时间。');
    const expiresAt = Number(response.Expiry) * 1000;
    if (!Number.isSafeInteger(expiresAt) || expiresAt <= now) fail('expired', '认证服务返回已过期令牌，请核对设备时间后重试。');
    return { expiresAt, bound: !!session };
  } finally { session?.dispose(); }
}

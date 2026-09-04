import dialect from './profile-dialect.json';
import fieldLists from './profile-fields.json';
import { bounded, utf8 } from './bytes';
import { fail } from './errors';
import { canonicalJSON } from './json';

export type Fields = Record<string, string>;
export type BindingConfig = typeof dialect.auth.binding;
type Tier = { code: number; model: string };
export type Quality = { original?: Tier; compressed: Tier };
export type Profile = Omit<typeof dialect, 'auth' | 'quality'> & {
  quality: Quality;
  credential: Fields;
  auth: Omit<typeof dialect.auth, 'const' | 'form'> & { const: Fields; form: string[][] };
};
export const PHOTOS_ENDPOINT = dialect.auth.url;
export const MASTER_ENDPOINT = 'https://android.clients.google.com/auth';
export const LOGIN_URL = 'https://accounts.google.com/EmbeddedSetup';
export const QR_LIMIT = 2953;
export const LINK_PREFIX = 'librepixel://setup?code=';
export const requiredFields = fieldLists.required_fields;
const constants = fieldLists.const_fields;
const credentials = fieldLists.credential_fields;

export const ORIGINAL_MODELS = ['Pixel', 'Pixel XL'] as const;
export const SAVER_MODELS = ['Pixel 2', 'Pixel 2 XL', 'Pixel 3', 'Pixel 3 XL', 'Pixel 3a', 'Pixel 3a XL', 'Pixel 4', 'Pixel 4 XL', 'Pixel 4a', 'Pixel 4a (5G)', 'Pixel 5'] as const;
export type Model = typeof ORIGINAL_MODELS[number] | typeof SAVER_MODELS[number];
export const DEFAULT_MODEL: Model = 'Pixel XL';
export const isOriginalModel = (model: string) => (ORIGINAL_MODELS as readonly string[]).includes(model);
export const isModel = (model: unknown): model is Model => typeof model === 'string' && (isOriginalModel(model) || (SAVER_MODELS as readonly string[]).includes(model));
export function qualityFor(model: Model): Quality {
  if (!isModel(model)) fail('model', '不支持这个机型。');
  return isOriginalModel(model)
    ? { original: { code: dialect.quality.original.code, model }, compressed: { ...dialect.quality.compressed } }
    : { compressed: { code: dialect.quality.compressed.code, model } };
}
export const profileModel = (profile: Profile) => profile.quality.original?.model ?? profile.quality.compressed.model;

export function requireFields(fields: Fields): void {
  const missing = requiredFields.filter(k => !fields[k]);
  if (missing.length) fail('missing', `缺少字段：${missing.join('、')}。需要完整认证请求，单独 Key 或短期 bearer 不够。`);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(fields.Email!)) fail('email', 'Email 字段不是有效邮箱。');
  if (/^Bearer\s/i.test(fields.Token!) || /^ya29\./.test(fields.Token!) || fields.Token!.startsWith('oauth_token=')) fail('short-token', 'Token 是短期 bearer 或登录 cookie，不能当作长期主凭证。');
  for (const value of Object.values(fields)) {
    if (/[\u0000-\u001f\u007f]/.test(value)) fail('control', '认证字段包含控制字符。');
    bounded(value);
  }
  if (!/^[0-9a-f]{16}$/i.test(fields.androidId!)) fail('device-id', 'androidId 需要原请求中的 16 位十六进制值。');
  if (!/^oauth2:/.test(fields.service!) || !fields.service!.slice(7).split(/\s+/).includes('https://www.googleapis.com/auth/photos.native')) fail('scope', '认证请求缺少 Photos native 权限，请导入 Photos 的完整请求。');
  if (![fields.client_sig, fields.callerSig].every(v => /^[0-9a-f]{40}$/i.test(v!))) fail('signature', 'client_sig / callerSig 需要原请求中的 40 位十六进制签名。');
  if (!/^\d{1,3}$/.test(fields.sdk_version!) || !/^\d{1,12}$/.test(fields.google_play_services_version!)) fail('environment', '设备环境版本字段格式无效。');
  if (fields.app && fields.app !== dialect.auth.clientPackage || fields.callerPkg && fields.callerPkg !== dialect.auth.clientPackage) fail('application', '这份请求不是 Google Photos 的认证请求。');
  if (fields.assertion_jwt && !fields.token_binding_alias) fail('binding-missing', '输入包含旧 assertion_jwt，但缺少原绑定 alias。旧断言无法续期，请补充本人原始绑定材料。');
}

const photosSig = '24bb24c05e47e0aefa68a58a766179d9b613a600';
export const PHOTOS_DEFAULTS: Fields = {
  app: 'com.google.android.apps.photos', callerPkg: 'com.google.android.apps.photos',
  client_sig: photosSig, callerSig: photosSig, device_country: 'us', lang: 'en_US', sdk_version: '33', google_play_services_version: '243560038',
  oauth2_foreground: '1', source: 'android', operatorCountry: 'us',
  service: 'oauth2:openid https://www.googleapis.com/auth/mobileapps.native https://www.googleapis.com/auth/photos.native',
};

export function buildProfile(fields: Fields, model: Model = DEFAULT_MODEL): Profile {
  requireFields(fields);
  const profile = JSON.parse(JSON.stringify(dialect)) as Profile;
  profile.quality = qualityFor(model);
  profile.credential = Object.fromEntries(credentials.filter(k => fields[k]).map(k => [k, fields[k]!]));
  profile.auth.const = Object.fromEntries(constants.filter(k => fields[k]).map(k => [k, fields[k]!]));
  profile.auth.form = profile.auth.form.filter(([, source]) => !source?.startsWith('const:') || source === 'const:clientPackage' || fields[source.slice(6)]);
  for (const key of ['source', 'operatorCountry']) if (fields[key]) {
    profile.auth.const[key] = fields[key]!;
    profile.auth.form.push([key, `const:${key}`]);
  }
  bounded(canonicalJSON(profile));
  return profile;
}

function record(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value); }
function stringMap(value: unknown): value is Fields { return record(value) && Object.values(value).every(v => typeof v === 'string'); }

export function validateProfile(value: unknown): Profile {
  if (!record(value) || value.v !== 1) fail('version', '仅支持 v1 配置。');
  if (!record(value.auth) || !stringMap(value.credential) || !stringMap(value.auth.const) || !Array.isArray(value.auth.form)) fail('profile', '配置缺少凭证或认证设置。');
  const form = value.auth.form;
  if (!form.every(v => Array.isArray(v) && v.length === 2 && v.every(x => typeof x === 'string'))) fail('profile', '认证表单格式无效。');
  const fields: Fields = { ...value.auth.const, ...value.credential };
  const quality = record(value.quality) ? value.quality : {};
  const tier = record(quality.original) ? quality.original : record(quality.compressed) ? quality.compressed : {};
  if (!isModel(tier.model)) fail('model', '配置里的机型不在支持范围内。');
  const expected = buildProfile(fields, tier.model);
  if (canonicalJSON(value) !== canonicalJSON(expected)) fail('dialect', '配置使用了不同或不完整的协议设置。请导入本人原始 Photos 认证请求内容，避免把凭证发送到未知地址。');
  return expected;
}

export function authForm(profile: Profile): Fields {
  const result: Fields = Object.create(null);
  for (const [key, source] of profile.auth.form) {
    if (!key || !source || Object.hasOwn(result, key)) fail('profile', '认证配置含重复字段。');
    const value = source === 'const:clientPackage' ? profile.auth.clientPackage : source.startsWith('cred:') ? profile.credential[source.slice(5)] : source.startsWith('const:') ? profile.auth.const[source.slice(6)] : undefined;
    if (!value) fail('profile', '认证配置引用了缺失字段。');
    result[key] = value;
  }
  return result;
}

export function formEncode(fields: Fields): string {
  return Object.entries(fields).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
}
export function maskedAccount(email: string): string {
  const at = email.indexOf('@'); return `${email.slice(0, Math.min(at < 0 ? email.length : at, 2))}•••${at >= 0 ? email.slice(at) : ''}`;
}
export const qrFits = (link: string) => utf8(link).length <= QR_LIMIT;

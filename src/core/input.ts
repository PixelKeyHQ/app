import { bounded } from './bytes';
import { decodeProfile } from './codec';
import { fail } from './errors';
import { strictJSON } from './json';
import { buildProfile, DEFAULT_MODEL, type Fields, LINK_PREFIX, type Model, PHOTOS_DEFAULTS, type Profile, validateProfile } from './profile';
import { parseAlias } from './token-binding';

function formFields(input: string): Fields {
  const result: Fields = Object.create(null);
  for (const part of input.trim().split('&')) {
    const split = part.indexOf('='); if (split < 1) fail('form', '请粘贴完整 URL 编码表单正文，而非请求头、curl 命令或抓包文件。');
    let key: string, value: string;
    try { key = decodeURIComponent(part.slice(0, split).replace(/\+/g, ' ')); value = decodeURIComponent(part.slice(split + 1).replace(/\+/g, ' ')); }
    catch { return fail('form', '表单包含损坏的 URL 编码。'); }
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(key) || Object.hasOwn(result, key)) fail('duplicate', '表单字段无效或重复，请只提供一个账号的一次请求。');
    result[key] = value;
  }
  return result;
}

export function normalizeOAuthToken(input: string): string {
  let value = bounded(input).trim();
  if (value.startsWith('oauth_token=')) value = value.slice('oauth_token='.length);
  if (value.length < 16 || value.length > 8192 || /[\s\u0000-\u001f\u007f;&]/.test(value) || value.startsWith('ya29.') || value.startsWith('Bearer ')) fail('oauth-input', '请输入本人 EmbeddedSetup 会话的 oauth_token 值，不能使用短期 bearer 或整段 Cookie。');
  return value;
}

export function importProfile(input: string, aliasInput = '', model: Model = DEFAULT_MODEL): Profile {
  const source = bounded(input).trim();
  let profile: Profile;
  const alias = bounded(aliasInput).trim();
  const attach = (data: Fields): Fields => {
    if (alias && data.token_binding_alias && data.token_binding_alias !== alias) fail('alias-conflict', '输入中已有不同的绑定 alias，请核对后再导入。');
    return { ...data, ...(alias ? { token_binding_alias: alias } : {}) };
  };
  if (source.startsWith('lp1.') || source.startsWith('lp1z.') || source.startsWith(LINK_PREFIX)) profile = decodeProfile(source);
  else if (source.startsWith('{')) {
    const data = strictJSON(source);
    if (!data || typeof data !== 'object' || Array.isArray(data)) fail('json', '请提供认证请求字段对象或完整 Profile。');
    if ('v' in data) profile = validateProfile(data);
    else {
      if (!Object.values(data).every(v => typeof v === 'string')) fail('json', '认证请求字段值必须都是字符串。');
      profile = buildProfile(attach(data as Fields), model);
    }
  } else {
    profile = buildProfile(attach(formFields(source)), model);
  }
  if (alias) {
    if (profile.credential.token_binding_alias && profile.credential.token_binding_alias !== alias) fail('alias-conflict', '输入中已有不同的绑定 alias，请核对后再导入。');
    profile.credential.token_binding_alias = alias;
  }
  if (profile.credential.token_binding_alias) parseAlias(profile.credential.token_binding_alias).secret.fill(0);
  return validateProfile(profile);
}

export type ManualFields = { email: string; token: string; androidId: string; alias: string };
export function parseAuthRequest(input: string): ManualFields {
  const source = bounded(input).trim();
  let data: Fields;
  if (source.startsWith('{')) {
    const value = strictJSON(source);
    if (!value || typeof value !== 'object' || Array.isArray(value) || 'v' in value || !Object.values(value).every(v => typeof v === 'string')) fail('json', '剪贴板里不是认证请求内容。');
    data = value as Fields;
  } else {
    try { data = formFields(source); } catch { fail('auth-request', '剪贴板里不是认证请求内容。'); }
  }
  if (!data.Email && !data.Token && !data.androidId) fail('auth-request', '剪贴板里不是认证请求内容。');
  return { email: data.Email ?? '', token: data.Token ?? '', androidId: data.androidId ?? '', alias: data.token_binding_alias ?? '' };
}

export type ManualErrors = Partial<Record<keyof ManualFields, string>>;
export function manualErrors(value: ManualFields): ManualErrors {
  const errors: ManualErrors = {};
  const email = value.email.trim(), token = value.token.trim(), androidId = value.androidId.trim(), alias = value.alias.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) errors.email = '邮箱格式不正确。';
  if (/^ya29\./.test(token) || /^Bearer\s/i.test(token) || token.startsWith('oauth_token=')) errors.token = '这是短期令牌。Master Token 以 aas_et/ 开头。';
  else if (!token.startsWith('aas_et/') || token.length < 16 || /[\s\u0000-\u001f\u007f]/.test(token)) errors.token = 'Master Token 以 aas_et/ 开头。';
  if (!/^[0-9a-f]{16}$/i.test(androidId)) errors.androidId = 'Android ID 是 16 位十六进制。';
  if (alias) { try { parseAlias(alias).secret.fill(0); } catch { errors.alias = '绑定 alias 格式不正确。'; } }
  return errors;
}

export function manualProfile(value: ManualFields, model: Model): Profile {
  const errors = Object.values(manualErrors(value));
  if (errors.length) fail('manual', errors[0]!);
  const fields: Fields = { ...PHOTOS_DEFAULTS, Email: value.email.trim(), Token: value.token.trim(), androidId: value.androidId.trim() };
  return importProfile(JSON.stringify(fields), value.alias.trim(), model);
}

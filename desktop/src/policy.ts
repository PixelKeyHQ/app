import { LOGIN_URL } from '../../src/core/profile';

export const APP_URL = 'pixelkey://app/index.html';
const NAVIGATION_HOSTS = new Set(['accounts.google.com', 'myaccount.google.com']);
const RESOURCE_DOMAINS = ['google.com', 'gstatic.com', 'googleusercontent.com'];

function httpsURL(raw: string): URL | undefined {
  try {
    const url = new URL(raw);
    if (url.protocol === 'https:' && !url.username && !url.password && (!url.port || url.port === '443')) return url;
  } catch {}
  return undefined;
}

export function loginNavigationAllowed(raw: string): boolean {
  const url = httpsURL(raw);
  return !!url && NAVIGATION_HOSTS.has(url.hostname);
}

export function loginResourceAllowed(raw: string): boolean {
  if (raw.startsWith('data:') || raw === 'about:blank') return true;
  const url = httpsURL(raw);
  return !!url && RESOURCE_DOMAINS.some(domain => url.hostname === domain || url.hostname.endsWith(`.${domain}`));
}

export function loginCookieAllowed(cookie: { name: string; domain?: string; secure?: boolean; value: string }): boolean {
  const host = new URL(LOGIN_URL).hostname;
  const domain = cookie.domain?.replace(/^\./, '').toLowerCase();
  return cookie.name === 'oauth_token' && cookie.secure === true && !!cookie.value &&
    (domain === host || domain === 'google.com');
}

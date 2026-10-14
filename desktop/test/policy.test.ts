import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loginCookieAllowed, loginNavigationAllowed, loginResourceAllowed } from '../src/policy';

test('Google navigation rejects lookalike domains, credentials, ports and non-HTTPS URLs', () => {
  assert.ok(loginNavigationAllowed('https://accounts.google.com/EmbeddedSetup'));
  for (const url of ['https://accounts.google.com.evil.invalid', 'https://evilgoogle.com', 'https://accounts.google.com@evil.invalid', 'https://user@accounts.google.com', 'https://accounts.google.com:444', 'http://accounts.google.com', 'file:///tmp/key', 'pixelkey://app/index.html', 'javascript:alert(1)', 'https://googleusercontent.com']) {
    assert.equal(loginNavigationAllowed(url), false, url);
  }
  assert.ok(loginResourceAllowed('https://ssl.gstatic.com/test.js'));
  assert.equal(loginResourceAllowed('https://gstatic.com.evil.invalid/test.js'), false);
});

test('login cookies must be secure and belong to the expected Google domain', () => {
  const cookie = { name: 'oauth_token', domain: '.google.com', secure: true, value: 'FAKE' };
  assert.ok(loginCookieAllowed(cookie));
  assert.ok(loginCookieAllowed({ ...cookie, domain: 'accounts.google.com' }));
  for (const changed of [{ domain: '.evil.invalid' }, { domain: '.googleusercontent.com' }, { secure: false }, { domain: undefined }, { value: '' }, { name: 'SID' }]) {
    assert.equal(loginCookieAllowed({ ...cookie, ...changed }), false);
  }
});

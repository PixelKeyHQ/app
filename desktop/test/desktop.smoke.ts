import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test';
import { join } from 'node:path';
import { encodeProfile } from '../../src/core/codec';
import { manualProfile } from '../../src/core/input';

const fields = { email: 'owner@example.invalid', token: 'aas_et/FAKE-master-token-0001', androidId: '0123456789abcdef', alias: '' };
let app: ElectronApplication, page: Page;
test.beforeEach(async () => {
  const { ELECTRON_RUN_AS_NODE: _, ...env } = process.env;
  app = await electron.launch({ args: [join(__dirname, '..')], chromiumSandbox: true, env: env as Record<string, string> });
  page = await app.firstWindow();
  await page.bringToFront();
  await expect(page.locator('#google')).toBeVisible();
});
test.afterEach(async () => { await app?.close(); });

async function manual() {
  await page.locator('#manual-open').click();
  for (const key of ['email', 'token', 'androidId'] as const) await page.locator(`#${key}`).fill(fields[key]);
  await page.locator('#generate').click();
  await expect(page.locator('#result')).toBeVisible();
}

test('manual export matches the app and completion clears it', async ({}, info) => {
  await page.locator('#manual-open').click();
  await expect(page.locator('#token')).toHaveAttribute('type', 'password');
  await page.locator('#manual-back').click();
  await manual();
  const code = encodeProfile(manualProfile(fields, 'Pixel XL'));
  await expect(page.locator('#code')).toHaveText(code);
  await expect(page.locator('#qr svg')).toHaveCount(1);
  await expect(page.locator('#account-meta')).toHaveText('Pixel XL · 原画质');
  await page.screenshot({ path: info.outputPath('desktop-result.png') });
  await expect(page.locator('#token')).toHaveValue('');
  await page.locator('#done').click();
  await expect(page.locator('#result')).toBeHidden();
  await expect(page.locator('#home')).toBeVisible();
  await expect(page.locator('#code')).toBeEmpty();
});

test('clipboard ownership and completion clear the copied export', async () => {
  await manual();
  const code = encodeProfile(manualProfile(fields, 'Pixel XL'));
  await page.locator('#copy').click();
  await expect(page.locator('#copy-label')).toHaveText('已复制');
  await expect.poll(() => app.evaluate(async ({ clipboard }) => clipboard.readText())).toBe(code);
  await page.locator('#done').click();
  await expect(page.locator('#result')).toBeHidden();
  await expect.poll(() => app.evaluate(async ({ clipboard }) => clipboard.readText())).toBe('');
  await expect(page.locator('#code')).toBeEmpty();
});

test('home keeps Google sign-in and manual entry separate and the model applies to both', async () => {
  await expect(page.locator('#email')).toBeHidden();
  await expect(page.locator('#model-value')).toHaveText('Pixel XL');
  await page.locator('#model-row').click();
  await expect(page.locator('#models')).toBeVisible();
  await expect(page.locator('#models [aria-checked="true"]')).toHaveText('Pixel XL');
  await page.keyboard.press('Escape');
  await expect(page.locator('#home')).toBeVisible();
  await page.locator('#model-row').click();
  await page.locator('#models button[value="Pixel 5"]').click();
  await expect(page.locator('#models [aria-checked="true"]')).toHaveText('Pixel 5');
  await page.locator('#models-done').click();
  await expect(page.locator('#model-value')).toHaveText('Pixel 5');

  await page.locator('#manual-open').click();
  await expect(page.locator('#google')).toBeHidden();
  await expect(page.locator('#alias-hint')).toBeVisible();
  await page.locator('#email').fill('owner@');
  await page.locator('#token').focus();
  await expect(page.locator('#email-error')).toHaveText('邮箱格式不正确。');
  await expect(page.locator('#generate')).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(page.locator('#home')).toBeVisible();
  await page.locator('#manual-open').click();
  await expect(page.locator('#email')).toHaveValue('');
  await expect(page.locator('#email-error')).toBeEmpty();
  await page.locator('#manual-back').click();

  await manual();
  await expect(page.locator('#account-meta')).toHaveText('Pixel 5 · 节省空间画质');
  await expect(page.locator('#code')).toHaveText(encodeProfile(manualProfile(fields, 'Pixel 5')));
  await page.keyboard.press('Escape');
  await expect(page.locator('#home')).toBeVisible();
  await expect(page.locator('#code')).toBeEmpty();
  await expect(page.locator('#model-value')).toHaveText('Pixel 5');
});

test('renderer has no Node access and cannot navigate or request remote resources', async () => {
  expect(await page.evaluate(() => ({ node: typeof (globalThis as any).require, bridge: Object.keys(window.pixelkey).sort() }))).toEqual({
    node: 'undefined', bridge: ['clear', 'copy', 'generate', 'login', 'onClear', 'paste', 'touch'],
  });
  expect(await page.evaluate(() => window.open('https://example.invalid'))).toBeNull();
  expect(await page.evaluate(async () => { try { await fetch('https://accounts.google.com'); return false; } catch { return true; } })).toBe(true);
  await page.evaluate(() => { location.href = 'https://example.invalid'; });
  expect(page.url()).toBe('pixelkey://app/index.html');
});

test('lock screen clears the form, result, and copied export', async () => {
  await manual(); await page.locator('#copy').click();
  await app.evaluate(({ powerMonitor }) => { powerMonitor.emit('lock-screen'); });
  await expect(page.locator('#result')).toBeHidden();
  await expect(page.locator('#code')).toBeEmpty();
  await expect.poll(() => app.evaluate(async ({ clipboard }) => clipboard.readText())).toBe('');
});

test('Google login uses an isolated session without a bridge and exchanges its cookie', async () => {
  await app.evaluate(({ app }) => {
    app.on('session-created', browserSession => {
      browserSession.protocol.handle('https', () => new Response('<!doctype html><title>Google test</title><p>Login fixture</p>', { headers: { 'Content-Type': 'text/html' } }));
    });
  });
  await app.evaluate(({ session }) => {
    session.fromPartition('pixelkey-auth').protocol.handle('https', async request => {
      if (request.url !== 'https://android.clients.google.com/auth' || request.method !== 'POST') return new Response(null, { status: 400 });
      if (request.headers.get('User-Agent') !== 'GoogleAuth/1.4' || request.headers.get('Accept-Encoding') !== 'identity' || request.headers.has('Cookie')) {
        return new Response('Error=BadAuthentication', { status: 400 });
      }
      if (!(await request.text()).includes('Token=FAKE-login-cookie-0001')) return new Response(null, { status: 400 });
      return new Response('Email=owner@example.invalid\nToken=aas_et/FAKE-master-token-0001');
    });
  });
  const opened = app.waitForEvent('window');
  await page.locator('#google').click();
  const login = await opened;
  await login.waitForLoadState('domcontentloaded');
  expect(await login.evaluate(() => typeof window.pixelkey)).toBe('undefined');
  expect(await app.evaluate(({ BrowserWindow }) => {
    const browser = BrowserWindow.getAllWindows().find(win => win.webContents.getURL().startsWith('https://accounts.google.com'))!;
    return browser.webContents.session.isPersistent();
  })).toBe(false);
  expect(await login.evaluate(() => typeof (globalThis as any).require)).toBe('undefined');
  expect(await app.evaluate(({ BrowserWindow }) => {
    const browser = BrowserWindow.getAllWindows().find(win => win.webContents.getURL().startsWith('https://accounts.google.com'))!;
    return browser.getTitle();
  })).toBe('accounts.google.com');
  await app.evaluate(async ({ BrowserWindow }) => {
    const browser = BrowserWindow.getAllWindows().find(win => win.webContents.getURL().startsWith('https://accounts.google.com'))!;
    await browser.webContents.session.cookies.set({ url: 'https://accounts.google.com/EmbeddedSetup', name: 'oauth_token', value: 'FAKE-login-cookie-0001', secure: true, httpOnly: true });
  });
  await page.bringToFront();
  await expect(page.locator('#result')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('#account')).toContainText('example.invalid');
  expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(1);
});

test('closing Google login clears its cookies and cannot restore a cancelled result', async () => {
  await app.evaluate(({ app }) => {
    app.on('session-created', browserSession => {
      browserSession.protocol.handle('https', () => new Response('<!doctype html><p>Login fixture</p>', { headers: { 'Content-Type': 'text/html' } }));
      (globalThis as any).loginSession = browserSession;
    });
  });
  const opened = app.waitForEvent('window'); await page.locator('#google').click();
  const login = await opened; await login.waitForLoadState('domcontentloaded');
  await app.evaluate(async ({ BrowserWindow }) => {
    const browser = BrowserWindow.getAllWindows().find(win => win.webContents.getURL().startsWith('https://accounts.google.com'))!;
    await browser.webContents.session.cookies.set({ url: 'https://accounts.google.com', name: 'SID', value: 'FAKE-session-cookie', secure: true });
    browser.close();
  });
  await page.bringToFront();
  await expect(page.locator('#home')).toBeVisible();
  await expect(page.locator('#result')).toBeHidden();
  await expect(page.locator('#google')).toBeEnabled();
  await expect(page.locator('#home-error')).toBeEmpty();
  await expect.poll(() => app.evaluate(async () => (globalThis as any).loginSession.cookies.get({}))).toEqual([]);
});

test('idle timeout clears secrets and blur only covers them', async () => {
  await manual();
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(page.locator('#privacy-cover')).toBeVisible();
  await expect(page.locator('#code')).not.toBeEmpty();
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.locator('#privacy-cover')).toBeHidden();
  // Run the registered main-process idle timer without waiting five minutes.
  await app.evaluate(() => {
    const original = globalThis.setTimeout;
    (globalThis as any).setTimeout = (callback: () => void, delay: number, ...args: unknown[]) => original(callback, delay === 300_000 ? 20 : delay, ...args);
  });
  await page.evaluate(() => window.pixelkey.touch());
  await expect(page.locator('#result')).toBeHidden();
  await expect(page.locator('#home')).toBeVisible();
  await expect(page.locator('#code')).toBeEmpty();
});

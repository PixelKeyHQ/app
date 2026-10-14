import { randomUUID } from 'node:crypto';
import { BrowserWindow, session } from 'electron';
import { BridgeError } from '../../src/core/errors';
import { LOGIN_URL } from '../../src/core/profile';
import { ensureActive } from '../../src/core/transport';
import { loginCookieAllowed, loginNavigationAllowed, loginResourceAllowed } from './policy';

const hostOf = (url: string) => { try { return new URL(url).host; } catch { return ''; } };

export function openGoogleLogin(parent: BrowserWindow, signal: AbortSignal, activity: () => void): Promise<string> {
  ensureActive(signal);
  const browserSession = session.fromPartition(`pixelkey-login-${randomUUID()}`, { cache: false });
  browserSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  browserSession.setPermissionCheckHandler(() => false);
  browserSession.webRequest.onBeforeRequest((details, callback) => {
    callback({ cancel: !loginResourceAllowed(details.url) });
  });
  browserSession.on('will-download', event => event.preventDefault());

  const win = new BrowserWindow({
    parent, modal: true, width: 560, height: 760, minWidth: 420, minHeight: 560,
    show: false, autoHideMenuBar: true, title: hostOf(LOGIN_URL),
    webPreferences: {
      session: browserSession, sandbox: true, contextIsolation: true,
      nodeIntegration: false, devTools: false, spellcheck: false,
    },
  });
  win.setContentProtection(true);
  win.removeMenu();
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event, url) => {
    if (!loginNavigationAllowed(url)) event.preventDefault();
  });
  win.webContents.on('will-redirect', (event, url, _inPlace, mainFrame) => {
    if (mainFrame && !loginNavigationAllowed(url)) event.preventDefault();
  });
  win.on('page-title-updated', event => event.preventDefault());
  const showHost = (url: string) => { const host = hostOf(url); if (host && !win.isDestroyed()) win.setTitle(host); };
  win.webContents.on('did-navigate', (_event, url) => showHost(url));
  win.webContents.on('did-navigate-in-page', (_event, url, mainFrame) => { if (mainFrame) showHost(url); });
  win.webContents.on('before-input-event', activity);

  return new Promise((resolve, reject) => {
    let finished = false, reading = false, closing = false;
    const finish = async (token?: string, error?: BridgeError) => {
      if (finished) return;
      finished = true;
      signal.removeEventListener('abort', cancel);
      browserSession.cookies.removeListener('changed', cookieChanged);
      if (!win.isDestroyed()) win.destroy();
      await Promise.allSettled([
        browserSession.clearStorageData(), browserSession.clearCache(),
        browserSession.clearAuthCache(), browserSession.closeAllConnections(),
      ]);
      if (error || signal.aborted) reject(error ?? new BridgeError('cancelled', '操作已取消。'));
      else resolve(token!);
    };
    const cancel = () => { void finish(undefined, new BridgeError('cancelled', '操作已取消。')); };
    const fail = (error: BridgeError) => { if (closing) cancel(); else void finish(undefined, error); };
    const cookieChanged = () => { void check(); };
    async function check() {
      if (finished || reading) return;
      reading = true;
      try {
        const cookies = await browserSession.cookies.get({ url: LOGIN_URL, name: 'oauth_token' });
        const cookie = cookies.find(loginCookieAllowed);
        if (cookie) await finish(cookie.value);
      } catch {
        await finish(undefined, new BridgeError('login-cookie', '无法读取登录会话，请重新登录。'));
      } finally { reading = false; }
    }
    signal.addEventListener('abort', cancel, { once: true });
    browserSession.cookies.on('changed', cookieChanged);
    win.once('close', () => { closing = true; });
    win.once('closed', cancel);
    win.webContents.on('did-finish-load', () => { void check(); });
    win.webContents.on('render-process-gone', () => fail(new BridgeError('login-closed', '登录窗口意外关闭，请重新登录。')));
    win.once('ready-to-show', () => { if (!finished) win.show(); });
    void win.loadURL(LOGIN_URL).catch(() => fail(new BridgeError('login-network', '无法打开 Google 登录页，请检查网络或使用手动配置。')));
  });
}

import { randomBytes } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { app, BrowserWindow, clipboard, ipcMain, Menu, nativeTheme, powerMonitor, protocol, session, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron';
import { BridgeError, safeMessage } from '../../src/core/errors';
import { MASTER_ENDPOINT, PHOTOS_ENDPOINT } from '../../src/core/profile';
import { fetchTransport } from '../../src/core/transport';
import type { Reply } from './api';
import { DesktopController, IDLE_TTL } from './controller';
import { openGoogleLogin } from './login';
import { APP_URL } from './policy';

app.setName('Pixel Key');
app.enableSandbox();
protocol.registerSchemesAsPrivileged([{ scheme: 'pixelkey', privileges: { standard: true, secure: true } }]);

// Chromium's auxiliary data also goes to a fresh temporary directory. Login
// cookies use a separate non-persistent session, never the default profile.
const runtimeDirectory = mkdtempSync(join(tmpdir(), 'pixelkey-'));
app.setPath('userData', runtimeDirectory);
app.setPath('sessionData', runtimeDirectory);
process.once('exit', () => { try { rmSync(runtimeDirectory, { recursive: true, force: true }); } catch {} });

let win: BrowserWindow | undefined;
let idleTimer: ReturnType<typeof setTimeout> | undefined;
const controller = new DesktopController({
  transport: fetchTransport((input, init) => {
    const auth = session.fromPartition('pixelkey-auth', { cache: false });
    return auth.fetch(String(input), init);
  }),
  random: async size => new Uint8Array(randomBytes(size)),
  clipboard,
  openLogin: signal => openGoogleLogin(win!, signal, touch),
});

function trusted(event: IpcMainEvent | IpcMainInvokeEvent): boolean {
  return !!win && !win.isDestroyed() && event.sender === win.webContents &&
    event.senderFrame === win.webContents.mainFrame && event.senderFrame.url === APP_URL;
}

function touch(): void {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(clear, IDLE_TTL);
  idleTimer.unref();
}

function clear(): void {
  clearTimeout(idleTimer);
  controller.clear();
  if (win && !win.isDestroyed()) win.webContents.send('pixelkey:cleared');
}

function handle<T>(channel: string, action: (...args: unknown[]) => T | Promise<T>): void {
  ipcMain.handle(channel, async (event, ...args): Promise<Reply<T>> => {
    if (!trusted(event)) return { ok: false, error: '操作来源无效。' };
    touch();
    try { return { ok: true, value: await action(...args) }; }
    catch (error) {
      const cancelled = error instanceof BridgeError && error.code === 'cancelled';
      return { ok: false, error: cancelled ? '' : safeMessage(error) };
    }
  });
}

handle('pixelkey:generate', (fields, model) => controller.generate(fields, model));
handle('pixelkey:login', model => controller.login(model));
handle('pixelkey:paste', () => controller.paste());
handle('pixelkey:copy', () => controller.copy());
ipcMain.handle('pixelkey:clear', event => { if (trusted(event)) clear(); });
ipcMain.on('pixelkey:touch', event => { if (trusted(event)) touch(); });

function createWindow(): void {
  const local = session.fromPartition('pixelkey-ui', { cache: false });
  const assets: Record<string, [string, string]> = {
    '/index.html': ['index.html', 'text/html; charset=utf-8'],
    '/renderer.js': ['renderer.js', 'text/javascript; charset=utf-8'],
  };
  if (!local.protocol.isProtocolHandled('pixelkey')) {
    local.protocol.handle('pixelkey', request => {
      const url = new URL(request.url), asset = assets[url.pathname];
      if (url.hostname !== 'app' || url.username || url.password || url.port || url.search || !asset) return new Response(null, { status: 404 });
      return new Response(readFileSync(join(__dirname, asset[0])), {
        headers: { 'Content-Type': asset[1], 'Cache-Control': 'no-store' },
      });
    });
  }
  local.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  local.setPermissionCheckHandler(() => false);
  local.webRequest.onBeforeRequest((details, callback) => {
    const url = new URL(details.url);
    callback({ cancel: url.protocol !== 'pixelkey:' || url.hostname !== 'app' || !assets[url.pathname] });
  });
  local.on('will-download', event => event.preventDefault());
  win = new BrowserWindow({
    width: 640, height: 860, minWidth: 440, minHeight: 620,
    show: false, title: 'Pixel Key', backgroundColor: nativeTheme.shouldUseDarkColors ? '#060607' : '#F5F5F5',
    icon: join(__dirname, 'icon.png'), autoHideMenuBar: true,
    webPreferences: {
      session: local, preload: join(__dirname, 'preload.cjs'),
      sandbox: true, contextIsolation: true, nodeIntegration: false,
      devTools: false, spellcheck: false,
    },
  });
  win.setContentProtection(true);
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', event => event.preventDefault());
  win.webContents.on('will-redirect', event => event.preventDefault());
  win.webContents.on('render-process-gone', clear);
  win.webContents.on('unresponsive', clear);
  win.on('minimize', clear);
  win.on('closed', () => { clear(); win = undefined; });
  win.once('ready-to-show', () => win?.show());
  void win.loadURL(APP_URL).catch(() => { clear(); app.quit(); });
}

void app.whenReady().then(() => {
  const auth = session.fromPartition('pixelkey-auth', { cache: false });
  auth.webRequest.onBeforeRequest((details, callback) => {
    callback({ cancel: details.url !== MASTER_ENDPOINT && details.url !== PHOTOS_ENDPOINT });
  });
  auth.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  auth.setPermissionCheckHandler(() => false);
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(process.platform === 'darwin' ? [{ label: 'Pixel Key', submenu: [{ role: 'about' as const }, { type: 'separator' as const }, { role: 'quit' as const }] }] : []),
    { label: '编辑', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
  ]));
  powerMonitor.on('lock-screen', clear);
  powerMonitor.on('suspend', clear);
  createWindow();
});
app.on('activate', () => { if (!win) createWindow(); });
let quitting = false;
app.on('before-quit', event => {
  clear();
  if (quitting) return;
  event.preventDefault();
  quitting = true;
  void controller.clearClipboard().catch(() => {}).finally(() => app.quit());
});
app.on('window-all-closed', () => app.quit());

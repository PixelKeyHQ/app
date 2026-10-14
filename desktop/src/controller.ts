import { encodeProfile, profileLink } from '../../src/core/codec';
import { bounded } from '../../src/core/bytes';
import { fail } from '../../src/core/errors';
import { connectGoogle } from '../../src/core/google-auth';
import { manualProfile, parseAuthRequest, type ManualFields } from '../../src/core/input';
import { isModel, maskedAccount, profileModel, qrFits, type Model, type Profile } from '../../src/core/profile';
import { Session } from '../../src/core/session';
import { ensureActive, type AuthTransport } from '../../src/core/transport';
import type { RandomBytes } from '../../src/core/token-binding';
import type { Output } from './api';

export const CLIPBOARD_TTL = 60_000;
export const IDLE_TTL = 5 * 60_000;

export function selectedModel(value: unknown): Model {
  if (!isModel(value)) fail('model', '不支持这个机型。');
  return value;
}

function manualFields(value: unknown): ManualFields {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('input', '输入无效。');
  const record = value as Record<string, unknown>;
  const fields: ManualFields = { email: '', token: '', androidId: '', alias: '' };
  for (const key of Object.keys(fields) as Array<keyof ManualFields>) {
    if (typeof record[key] !== 'string') fail('input', '输入无效。');
    fields[key] = bounded(record[key]);
  }
  bounded(JSON.stringify(fields));
  return fields;
}

export function outputFor(profile: Profile): Output {
  const link = profileLink(profile);
  return {
    code: encodeProfile(profile), link,
    account: maskedAccount(profile.credential.Email ?? ''),
    model: profileModel(profile) as Model,
    quality: profile.quality.original ? '原画质' : '节省空间画质',
    fits: qrFits(link),
  };
}

type Dependencies = {
  transport: AuthTransport;
  random: RandomBytes;
  openLogin(signal: AbortSignal): Promise<string>;
  clipboard: { readText(): Promise<string>; writeText(text: string): Promise<void>; clear(): void | Promise<void> };
};

// Owns exported credentials and cancellation; the renderer cannot send arbitrary
// network requests or clipboard writes through the desktop bridge.
export class DesktopController {
  private readonly session = new Session();
  private code = '';
  private copied = '';
  private copyTimer: ReturnType<typeof setTimeout> | undefined;
  private clipboardJob = Promise.resolve();

  constructor(private readonly deps: Dependencies) {}

  private enqueueClipboard(action: () => Promise<void>): Promise<void> {
    const job = this.clipboardJob.then(action);
    this.clipboardJob = job.catch(() => {});
    return job;
  }

  clearClipboard(): Promise<void> {
    clearTimeout(this.copyTimer);
    this.copyTimer = undefined;
    return this.enqueueClipboard(async () => {
      try {
        if (this.copied && await this.deps.clipboard.readText() === this.copied) await this.deps.clipboard.clear();
      } finally { this.copied = ''; }
    });
  }

  clear(): void {
    this.session.clear();
    this.code = '';
    void this.clearClipboard().catch(() => {});
  }

  private remember(profile: Profile): Output {
    const output = outputFor(profile);
    this.code = output.code;
    return output;
  }

  generate(fields: unknown, model: unknown): Output {
    this.clear();
    return this.remember(manualProfile(manualFields(fields), selectedModel(model)));
  }

  async login(model: unknown): Promise<Output> {
    this.clear();
    const selected = selectedModel(model), task = this.session.begin();
    const token = await this.deps.openLogin(task.signal);
    ensureActive(task.signal);
    const profile = await connectGoogle(token, this.deps.transport, this.deps.random, task.signal, selected);
    ensureActive(task.signal);
    return this.remember(profile);
  }

  async paste(): Promise<ManualFields> {
    return parseAuthRequest(bounded(await this.deps.clipboard.readText()));
  }

  async copy(): Promise<null> {
    if (!this.code) fail('cleared', '连接信息已清空，请重新生成。');
    const code = this.code;
    clearTimeout(this.copyTimer);
    await this.enqueueClipboard(async () => {
      await this.deps.clipboard.writeText(code);
      this.copied = code;
      this.copyTimer = setTimeout(() => { void this.clearClipboard().catch(() => {}); }, CLIPBOARD_TTL);
      this.copyTimer.unref();
    });
    return null;
  }
}

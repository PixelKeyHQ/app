import assert from 'node:assert/strict';
import { test } from 'node:test';
import { encodeProfile, profileLink } from '../../src/core/codec';
import { manualProfile } from '../../src/core/input';
import type { AuthTransport } from '../../src/core/transport';
import { DesktopController } from '../src/controller';

const fields = { email: 'owner@example.invalid', token: 'aas_et/FAKE-master-token-0001', androidId: '0123456789abcdef', alias: '' };
function setup(transport: AuthTransport = async () => ({ status: 200, body: 'Email=owner@example.invalid\nToken=aas_et/FAKE-master-token-0001' }), openLogin = async (_signal: AbortSignal) => 'FAKE-login-cookie-0001') {
  let text = '', writes = 0;
  const controller = new DesktopController({
    transport, openLogin, random: async size => new Uint8Array(size),
    clipboard: {
      readText: async () => text,
      writeText: async value => { text = value; writes++; },
      clear: async () => { text = ''; },
    },
  });
  return { controller, text: () => text, writes: () => writes, replace: (value: string) => { text = value; } };
}

test('desktop output exactly matches the shared profile codec and selected quality', async () => {
  const { controller } = setup();
  for (const model of ['Pixel XL', 'Pixel 5'] as const) {
    const output = controller.generate(fields, model), profile = manualProfile(fields, model);
    assert.equal(output.code, encodeProfile(profile));
    assert.equal(output.link, profileLink(profile));
    assert.equal(output.model, model);
    assert.equal(output.quality, model === 'Pixel XL' ? '原画质' : '节省空间画质');
  }
  controller.clear(); await controller.clearClipboard();
});

test('IPC data is validated and failures clear the previous export', async () => {
  const { controller, writes } = setup();
  controller.generate(fields, 'Pixel XL');
  assert.throws(() => controller.generate(fields, 'unknown'));
  await assert.rejects(controller.copy(), /已清空/);
  for (const bad of [null, [], { ...fields, token: 2 }, { ...fields, alias: 'x'.repeat(65_537) }]) {
    assert.throws(() => controller.generate(bad, 'Pixel XL'));
  }
  assert.equal(writes(), 0);
});

test('clipboard clears only its own export and serializes copy against clearing', async () => {
  const { controller, text, replace } = setup();
  const output = controller.generate(fields, 'Pixel XL');
  const copy = controller.copy(); controller.clear();
  await copy; await controller.clearClipboard();
  assert.equal(text(), '');
  controller.generate(fields, 'Pixel XL'); await controller.copy();
  assert.equal(text(), output.code);
  replace('another application');
  controller.clear(); await controller.clearClipboard();
  assert.equal(text(), 'another application');
});

test('clipboard TTL expires without erasing content copied later', async context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const { controller, text } = setup();
  controller.generate(fields, 'Pixel XL'); await controller.copy();
  context.mock.timers.tick(60_000);
  await controller.clearClipboard();
  assert.equal(text(), '');
});

test('paste parses only captured auth fields, not arbitrary clipboard content', async () => {
  const { controller, replace } = setup();
  replace(JSON.stringify({ Email: fields.email, Token: fields.token, androidId: fields.androidId }));
  assert.deepEqual(await controller.paste(), fields);
  replace('Authorization: Bearer FAKE');
  await assert.rejects(controller.paste());
});

test('cancelled login cannot start an exchange or restore an export', async () => {
  let resolve!: (value: string) => void, requests = 0;
  const { controller } = setup(async () => { requests++; return { status: 200, body: '' }; }, () => new Promise(done => { resolve = done; }));
  const login = controller.login('Pixel XL');
  controller.clear(); resolve('FAKE-login-cookie-0001');
  await assert.rejects(login, /已取消/);
  assert.equal(requests, 0);
  await assert.rejects(controller.copy(), /已清空/);
});

test('a late exchange response cannot replace a newer manual profile', async () => {
  let resolve!: (value: { status: number; body: string }) => void, started!: () => void;
  const exchanging = new Promise<void>(done => { started = done; });
  const { controller, text } = setup(async () => { started(); return new Promise(done => { resolve = done; }); });
  const login = controller.login('Pixel XL'); await exchanging;
  const manual = controller.generate(fields, 'Pixel 5');
  resolve({ status: 200, body: 'Email=owner@example.invalid\nToken=aas_et/FAKE-late-master-token' });
  await assert.rejects(login, /已取消/);
  await controller.copy(); assert.equal(text(), manual.code);
  controller.clear(); await controller.clearClipboard();
});

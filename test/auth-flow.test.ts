import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkProfile, connectGoogle, parseResponse } from '../src/core/google-auth';
import { buildProfile } from '../src/core/profile';
import { fetchTransport, type AuthRequest } from '../src/core/transport';
import { Session } from '../src/core/session';
import { fields, random } from './fixtures';

const signal = () => new AbortController().signal;
test('sign-in exchange then repeated checks reuse one androidId and export no short bearer', async () => {
  const requests: AuthRequest[] = [], now = Date.now();
  const transport = async (request: AuthRequest) => {
    requests.push(request);
    return { status: 200, body: request.stage === 'master' ? 'Email=owner@example.invalid\nToken=FAKE-MASTER' : `Auth=FAKE-SHORT-BEARER\nExpiry=${Math.floor(now / 1000) + 3600}` };
  };
  const profile = await connectGoogle('oauth_token=FAKE-COOKIE-SELF-PROVIDED', transport, random, signal());
  const a = await checkProfile(profile, transport, random, signal(), now), b = await checkProfile(profile, transport, random, signal(), now);
  assert.equal(requests.length, 3); assert.equal(profile.credential.Token, 'FAKE-MASTER');
  assert.ok(!JSON.stringify(profile).includes('FAKE-SHORT-BEARER'));
  for (const request of requests) assert.equal(new URLSearchParams(request.body).get('androidId'), profile.credential.androidId);
  assert.equal(a.expiresAt, b.expiresAt); assert.deepEqual(Object.keys(a).sort(), ['bound', 'expiresAt']);
});

test('device verification refusal is terminal and server secrets never appear in errors', async () => {
  let requests = 0;
  await assert.rejects(connectGoogle('FAKE-COOKIE-SELF-PROVIDED', async () => { requests++; return { status: 200, body: 'Error=MissingDroidguard\nToken=FAKE-MASTER' }; }, random, signal()), /设备验证/);
  assert.equal(requests, 1);
  for (const body of ['Error=FAKE-SECRET-IN-UNKNOWN-ERROR', 'Auth=FAKE-SECRET\nAuth=FAKE-SECRET', 'Error=BadAuthentication\nAuth=FAKE-SECRET']) {
    assert.throws(() => parseResponse({ status: 200, body }), error => error instanceof Error && !error.message.includes('FAKE-SECRET'));
  }
});

test('encrypted response without original alias, expired tokens, missing expiry and ambiguous tokens fail', async () => {
  const now = Date.now();
  for (const body of ['TokenEncrypted=AAAA\nExpiry=2000000000', 'Auth=FAKE-SHORT\nExpiry=1', 'Auth=FAKE-SHORT', 'Auth=FAKE-SHORT\nTokenEncrypted=AAAA\nExpiry=2000000000']) {
    await assert.rejects(checkProfile(buildProfile(fields), async () => ({ status: 200, body }), random, signal(), now));
  }
});

test('native transport fixes endpoint/headers, omits cookies, refuses redirects and bounds streamed responses', async () => {
  let actual: RequestInit | undefined, endpoint: unknown;
  const fetcher = (async (url: unknown, init: RequestInit) => { endpoint = url; actual = init; return new Response('Auth=FAKE\nExpiry=2000000000'); }) as typeof fetch;
  const send = fetchTransport(fetcher);
  await send({ stage: 'photos', body: 'Token=FAKE', device: fields.androidId }, signal());
  assert.equal(endpoint, 'https://android.googleapis.com/auth'); assert.equal(actual?.redirect, 'error'); assert.equal(actual?.credentials, 'omit');
  const huge = fetchTransport((async () => new Response(new Uint8Array(65537))) as typeof fetch);
  await assert.rejects(huge({ stage: 'master', body: 'Token=FAKE' }, signal()), /过大/);
  const redirect = fetchTransport((async () => new Response('', { status: 302 })) as typeof fetch);
  await assert.rejects(redirect({ stage: 'master', body: 'Token=FAKE' }, signal()), /重定向/);
});

test('cancel aborts native request and session discards stale completions', async () => {
  const session = new Session(), first = session.begin(), second = session.begin();
  assert.equal(first.current(), false); assert.equal(first.signal.aborted, true); assert.equal(second.current(), true);
  session.clear(); assert.equal(second.current(), false);
  const controller = new AbortController();
  const fetcher = (async (_: unknown, init: RequestInit) => new Promise<Response>((_, reject) => init.signal!.addEventListener('abort', () => reject(new Error('FAKE-SENSITIVE-NETWORK-ERROR'))))) as typeof fetch;
  const job = fetchTransport(fetcher)({ stage: 'master', body: 'Token=FAKE' }, controller.signal);
  controller.abort(); await assert.rejects(job, /已取消/);
});

test('account metadata in a master response (dotted or repeated keys) is ignored', () => {
  const body = 'SID=BAD_COOKIE\nLSID=BAD_COOKIE\nservices=a,b\nservices=a,b\ncapabilities.canHaveUsername=1\nfirstName=测试\nEmail=test@example.com\nToken=aas_et/FAKE-MASTER';
  assert.deepEqual({ ...parseResponse({ status: 200, body }) }, { Email: 'test@example.com', Token: 'aas_et/FAKE-MASTER' });
});

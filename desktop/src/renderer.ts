import { qrMatrix } from '../../src/core/codec';
import { manualErrors, type ManualFields } from '../../src/core/input';
import { DEFAULT_MODEL, ORIGINAL_MODELS, SAVER_MODELS, type Model } from '../../src/core/profile';
import type { Output, Reply } from './api';

type Screen = 'home' | 'models' | 'manual' | 'result';
const api = window.pixelkey;
const element = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const keys = ['email', 'token', 'androidId', 'alias'] as const;
const inputs = Object.fromEntries(keys.map(key => [key, element<HTMLInputElement>(key)])) as Record<keyof ManualFields, HTMLInputElement>;
const SVG = 'http://www.w3.org/2000/svg';
let screen: Screen = 'home', model: Model = DEFAULT_MODEL;
let generation = 0, busy = false, fits = true;
let copyTimer: ReturnType<typeof setTimeout> | undefined;
const touched = new Set<keyof ManualFields>();

function go(next: Screen, focus?: HTMLElement) {
  screen = next;
  for (const name of ['home', 'models', 'manual', 'result'] as const) element(name).hidden = name !== next;
  window.scrollTo(0, 0);
  focus?.focus();
}

const options: HTMLButtonElement[] = [];
for (const [id, models] of [['original-models', ORIGINAL_MODELS], ['saver-models', SAVER_MODELS]] as const) {
  for (const name of models) {
    const option = document.createElement('button'), label = document.createElement('span');
    option.type = 'button'; option.className = 'option'; option.setAttribute('role', 'radio'); option.value = name;
    label.textContent = name;
    const check = document.createElementNS(SVG, 'svg'), path = document.createElementNS(SVG, 'path');
    for (const [key, value] of Object.entries({ width: '20', height: '20', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2.4', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' })) check.setAttribute(key, value);
    path.setAttribute('d', 'M5 12.5l4.5 4.5L19 7.5'); check.append(path);
    option.append(label, check);
    option.addEventListener('click', () => pick(name));
    element(id).append(option); options.push(option);
  }
}
function pick(name: Model) {
  model = name;
  element('model-value').textContent = name;
  element('model-row').setAttribute('aria-label', `备份机型 ${name}`);
  for (const option of options) option.setAttribute('aria-checked', String(option.value === name));
}
pick(DEFAULT_MODEL);
element('model-row').addEventListener('click', () => go('models', options.find(option => option.value === model)));
element('models-done').addEventListener('click', () => go('home', element('model-row')));

function renderHome() {
  element('working').hidden = !busy;
  element('home-actions').hidden = busy;
  element<HTMLButtonElement>('model-row').disabled = busy;
}

function values(): ManualFields {
  return { email: inputs.email.value, token: inputs.token.value, androidId: inputs.androidId.value, alias: inputs.alias.value };
}
function renderForm() {
  const fields = values(), errors = manualErrors(fields);
  for (const key of keys) {
    const message = fields[key] && touched.has(key) && document.activeElement !== inputs[key] ? errors[key] ?? '' : '';
    element(`${key}-error`).textContent = message;
    document.getElementById(`${key}-hint`)?.toggleAttribute('hidden', !!message);
    inputs[key].classList.toggle('invalid', !!message);
    inputs[key].setAttribute('aria-invalid', String(!!message));
    inputs[key].disabled = busy;
  }
  element<HTMLButtonElement>('generate').disabled = busy || Object.keys(errors).length > 0;
  element<HTMLButtonElement>('paste').disabled = busy;
}
for (const key of keys) {
  inputs[key].addEventListener('input', () => { element('manual-error').textContent = ''; renderForm(); });
  inputs[key].addEventListener('blur', () => { touched.add(key); renderForm(); });
  inputs[key].addEventListener('focus', renderForm);
}

function clearInputs() {
  for (const input of Object.values(inputs)) input.value = '';
  touched.clear();
}
function copied(value: boolean) {
  element('copy-icon').hidden = value;
  element('copied-icon').hidden = !value;
  element('copy-label').textContent = value ? '已复制' : '复制连接信息';
  element('copy-status').textContent = value ? '已复制' : '';
}
function clearUI() {
  generation++;
  busy = false;
  clearTimeout(copyTimer);
  clearInputs();
  for (const id of ['code', 'qr', 'account', 'account-meta', 'avatar', 'home-error', 'manual-error', 'copy-error']) element(id).textContent = '';
  copied(false);
  renderForm(); renderHome();
  go('home');
}
api.onClear(clearUI);
async function reset() {
  clearUI();
  await api.clear();
  element('google').focus();
}
element('done').addEventListener('click', () => { void reset(); });
element('manual-back').addEventListener('click', () => { void reset(); });
element('manual-open').addEventListener('click', () => {
  element('home-error').textContent = '';
  go('manual', element('paste'));
});

function mode(value: 'qr' | 'text', focus = false) {
  for (const name of ['qr', 'text'] as const) {
    const tab = element<HTMLButtonElement>(`tab-${name}`);
    tab.setAttribute('aria-selected', String(name === value)); tab.tabIndex = name === value ? 0 : -1;
  }
  element('panel').setAttribute('aria-labelledby', `tab-${value}`);
  element('view-qr').hidden = value !== 'qr' || !fits;
  element('view-qr-too-big').hidden = value !== 'qr' || fits;
  element('view-text').hidden = value !== 'text';
  if (focus) element(`tab-${value}`).focus();
}
for (const name of ['qr', 'text'] as const) element(`tab-${name}`).addEventListener('click', () => mode(name));
element('tabs').addEventListener('keydown', event => {
  if (['ArrowLeft', 'Home', 'ArrowRight', 'End'].includes(event.key)) {
    event.preventDefault(); mode(event.key === 'ArrowLeft' || event.key === 'Home' ? 'qr' : 'text', true);
  }
});

function show(output: Output) {
  clearInputs();
  element('code').textContent = output.code;
  element('account').textContent = output.account;
  element('account-meta').textContent = `${output.model} · ${output.quality}`;
  element('avatar').textContent = output.account[0]?.toUpperCase() ?? '?';
  element('qr').textContent = '';
  fits = output.fits;
  if (fits) {
    const cells = qrMatrix(output.link), size = cells.length + 4;
    let path = '';
    for (let y = 0; y < cells.length; y++) {
      const row = cells[y]!;
      for (let x = 0; x < row.length; x++) if (row[x]) path += `M${x + 2},${y + 2}h1v1h-1z`;
    }
    const svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('viewBox', `0 0 ${size} ${size}`); svg.setAttribute('shape-rendering', 'crispEdges');
    const background = document.createElementNS(SVG, 'rect');
    background.setAttribute('width', String(size)); background.setAttribute('height', String(size)); background.setAttribute('fill', '#fff');
    const pixels = document.createElementNS(SVG, 'path');
    pixels.setAttribute('d', path); pixels.setAttribute('fill', '#000');
    svg.append(background, pixels); element('qr').append(svg);
  }
  mode(fits ? 'qr' : 'text');
  go('result', element('done'));
}

async function run(action: () => Promise<Reply<Output>>, error: string, render: () => void) {
  const current = ++generation;
  busy = true; element(error).textContent = ''; render();
  try {
    const reply = await action();
    if (current !== generation) return;
    if (reply.ok) show(reply.value);
    else element(error).textContent = reply.error;
  } catch { if (current === generation) element(error).textContent = '操作未完成，请重试。'; }
  finally { if (current === generation) { busy = false; render(); } }
}
element('google').addEventListener('click', async () => {
  if (busy) return;
  const selected = model;
  clearUI();
  await run(() => api.login(selected), 'home-error', renderHome);
  if (screen === 'home' && !busy) element('google').focus();
});
element('form').addEventListener('submit', event => {
  event.preventDefault();
  if (busy) return;
  const fields = values();
  if (Object.keys(manualErrors(fields)).length) { keys.forEach(key => touched.add(key)); renderForm(); return; }
  void run(() => api.generate(fields, model), 'manual-error', renderForm);
});

element('paste').addEventListener('click', async () => {
  if (busy) return;
  const current = generation;
  element('manual-error').textContent = '';
  const reply = await api.paste();
  if (current !== generation) return;
  if (!reply.ok) { element('manual-error').textContent = reply.error; return; }
  for (const key of keys) { inputs[key].value = reply.value[key]; touched.add(key); }
  renderForm();
});

element('copy').addEventListener('click', async () => {
  const current = generation;
  element('copy-error').textContent = '';
  const reply = await api.copy();
  if (current !== generation) return;
  if (!reply.ok) { copied(false); element('copy-error').textContent = '复制失败。'; return; }
  copied(true); clearTimeout(copyTimer);
  copyTimer = setTimeout(() => copied(false), 2000);
});

window.addEventListener('blur', () => { element('privacy-cover').hidden = false; });
window.addEventListener('focus', () => { element('privacy-cover').hidden = true; });
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  if (screen === 'models') go('home', element('model-row'));
  else if (screen !== 'home' || busy) void reset();
});
let lastTouch = 0;
for (const name of ['input', 'keydown', 'pointerdown']) document.addEventListener(name, () => {
  if (Date.now() - lastTouch > 1000) { lastTouch = Date.now(); api.touch(); }
});
renderForm(); renderHome();

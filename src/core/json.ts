import { bounded } from './bytes';
import { fail } from './errors';

export function strictJSON(source: string): unknown {
  bounded(source); let i = 0;
  const invalid = () => fail('json', 'JSON 无效、包含重复字段或嵌套过深。');
  const ws = () => { while (/\s/.test(source[i] ?? '') && i < source.length) i++; };
  function string(): string {
    const start = i++; while (i < source.length) {
      const ch = source[i++]; if (ch === '\\') { i++; continue; }
      if (ch === '"') { try { return JSON.parse(source.slice(start, i)); } catch { return invalid(); } }
    } return invalid();
  }
  function value(depth: number): void {
    if (depth > 24) invalid(); ws(); const ch = source[i];
    if (ch === '"') { string(); return; }
    if (ch === '{') {
      i++; ws(); const keys = new Set<string>(); if (source[i] === '}') { i++; return; }
      while (i < source.length) {
        ws(); if (source[i] !== '"') invalid(); const key = string();
        if (keys.has(key) || ['__proto__', 'prototype', 'constructor'].includes(key)) invalid(); keys.add(key);
        ws(); if (source[i++] !== ':') invalid(); value(depth + 1); ws();
        const end = source[i++]; if (end === '}') return; if (end !== ',') invalid();
      } invalid();
    }
    if (ch === '[') {
      i++; ws(); if (source[i] === ']') { i++; return; }
      while (i < source.length) { value(depth + 1); ws(); const end = source[i++]; if (end === ']') return; if (end !== ',') invalid(); }
      invalid();
    }
    const match = /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(source.slice(i));
    if (!match) invalid(); i += match![0].length;
  }
  value(0); ws(); if (i !== source.length) invalid();
  try { return JSON.parse(source); } catch { return invalid(); }
}

export function canonicalJSON(value: unknown): string {
  function sorted(v: unknown): unknown {
    if (Array.isArray(v)) return v.map(sorted);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, x]) => [k, sorted(x)]));
    return v;
  }
  return JSON.stringify(sorted(value)).replace(/[\u007f-\uffff]/g, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
}

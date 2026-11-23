/*
 * Adapter: producono il testo con i blocchi <file path="...">.
 *  - replay: tentativi predefiniti da harness/fixtures/<unit>.json (solo per validare il loop)
 *  - anthropic: chiama l'API Messages (richiede ANTHROPIC_API_KEY nell'ambiente di chi lancia lo script)
 */
'use strict';

const fs = require('fs');
const path = require('path');

function replayAdapter({ root, fixturesDir }) {
  const dir = fixturesDir || path.join(root, 'harness', 'fixtures');
  return {
    name: 'replay',
    model: null,
    async propose({ unit, attempt }) {
      const f = path.join(dir, unit.id + '.json');
      if (!fs.existsSync(f)) {
        throw new Error('Nessuna fixture per l\'unità "' + unit.id + '" in ' + dir);
      }
      const fixture = JSON.parse(fs.readFileSync(f, 'utf8'));
      const a = fixture.attempts[attempt - 1];
      if (!a) {
        throw new Error('Fixture esaurita: l\'unità "' + unit.id + '" ha solo ' + fixture.attempts.length + ' tentativi');
      }
      const text = Object.keys(a.files)
        .map((p) => '<file path="' + p + '">\n' + a.files[p] + '</file>')
        .join('\n');
      return { text, note: a.note || '' };
    },
  };
}

function anthropicAdapter({ model, fetchImpl, env }) {
  const e = env || process.env;
  const doFetch = fetchImpl || (typeof fetch === 'function' ? fetch : null);
  const m = model || e.HARNESS_MODEL || 'claude-sonnet-5-5';
  return {
    name: 'anthropic',
    model: m,
    async propose({ prompt, maxTokens }) {
      const key = e.ANTHROPIC_API_KEY;
      if (!key) throw new Error('ANTHROPIC_API_KEY non impostata nell\'ambiente');
      if (!doFetch) throw new Error('fetch non disponibile (serve Node 18+)');
      const res = await doFetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({ model: m, max_tokens: maxTokens || 16000, messages: [{ role: 'user', content: prompt }] }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error('API Anthropic ' + res.status + ': ' + body.slice(0, 300));
      }
      const data = await res.json();
      const text = (data.content || [])
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('\n');
      return { text, note: '', usage: data.usage || null };
    },
  };
}

function createAdapter(name, opts) {
  if (name === 'replay') return replayAdapter(opts);
  if (name === 'anthropic') return anthropicAdapter(opts);
  throw new Error('Adapter sconosciuto: ' + name + ' (usa replay o anthropic)');
}

module.exports = { createAdapter, replayAdapter, anthropicAdapter };

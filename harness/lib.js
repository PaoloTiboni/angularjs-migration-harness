/*
 * Libreria del loop di migrazione: manifest, ordine di dipendenza, prompt, parsing,
 * gate di verifica, metriche e report. Nessuna dipendenza esterna (solo Node).
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ANSI = /\u001b\[[0-9;]*m/g;

/* ---------- manifest ---------- */

function loadManifest(root) {
  const m = JSON.parse(fs.readFileSync(path.join(root, 'harness', 'units.json'), 'utf8'));
  const ids = new Set(m.units.map((u) => u.id));
  m.units.forEach((u) => {
    (u.deps || []).forEach((d) => {
      if (!ids.has(d)) {
        throw new Error('Dipendenza sconosciuta "' + d + '" nell\'unità "' + u.id + '"');
      }
    });
  });
  return m;
}

/** Unità pending in ordine topologico (le foglie prima). `only` limita a una unità. */
function pendingInOrder(manifest, only) {
  const byId = new Map(manifest.units.map((u) => [u.id, u]));
  const state = new Map(); // id -> 'visiting' | 'done'
  const order = [];

  function visit(id, stack) {
    if (state.get(id) === 'done') return;
    if (state.get(id) === 'visiting') {
      throw new Error('Ciclo di dipendenze: ' + stack.concat(id).join(' -> '));
    }
    state.set(id, 'visiting');
    const u = byId.get(id);
    (u.deps || []).forEach((d) => visit(d, stack.concat(id)));
    state.set(id, 'done');
    order.push(u);
  }

  manifest.units.forEach((u) => visit(u.id, []));
  let pending = order.filter((u) => u.status === 'pending');
  if (only) {
    if (!byId.has(only)) throw new Error('Unità sconosciuta: ' + only);
    pending = pending.filter((u) => u.id === only);
    const unmet = (byId.get(only).deps || []).filter((d) => byId.get(d).status !== 'done');
    if (unmet.length) {
      throw new Error('Le dipendenze di "' + only + '" non sono ancora migrate: ' + unmet.join(', '));
    }
  }
  return pending;
}

/** Dipendenze di `unit` che sono fallite (o saltate): l'unità non va tentata. */
function blockedBy(unit, failedIds) {
  return (unit.deps || []).filter((d) => failedIds.has(d));
}

/* ---------- prompt e parsing ---------- */

function readIfExists(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
}

function buildPrompt({ root, workdir, unit, manifest, attempt, previous }) {
  const byId = new Map(manifest.units.map((u) => [u.id, u]));
  const section = (titolo, corpo) => '### ' + titolo + '\n' + corpo + '\n';
  const file = (p, content) => '<source path="' + p + '">\n' + content + '\n</source>';
  const parts = [];

  parts.push(
    'Migra l\'unità "' + unit.id + '" da AngularJS 1.8 ad Angular 19 (TypeScript, standalone, signals dove sensato).\n' +
      'REGOLE:\n' +
      '- Il comportamento deve restare IDENTICO, quirk e bug latenti inclusi: non correggere nulla.\n' +
      '- Il test Angular qui sotto è il contratto: è di sola lettura e non lo puoi modificare.\n' +
      '- Scrivi SOLO i file di destinazione elencati. Qualsiasi altro percorso viene rifiutato.\n' +
      '- Rispondi esclusivamente con blocchi <file path="...">contenuto completo del file</file>, senza altro testo.'
  );

  if (unit.notes) parts.push(section('Note sull\'unità', unit.notes));
  parts.push(section('File di destinazione consentiti', unit.targets.map((t) => '- ' + t).join('\n')));
  parts.push(
    section('Sorgente legacy', unit.legacy.map((p) => file(p, fs.readFileSync(path.join(root, p), 'utf8'))).join('\n'))
  );

  const lt = (unit.legacyTests || []).map((p) => file(p, fs.readFileSync(path.join(root, p), 'utf8')));
  if (lt.length) parts.push(section('Test legacy (descrivono il comportamento attuale)', lt.join('\n')));

  if (unit.goldSpec) {
    parts.push(
      section(
        'Test Angular da far passare (sola lettura): ' + unit.goldSpec.to,
        file(unit.goldSpec.to, fs.readFileSync(path.join(root, unit.goldSpec.from), 'utf8'))
      )
    );
  }

  const deps = (unit.deps || [])
    .map((d) => byId.get(d))
    .flatMap((d) => d.targets)
    .map((t) => {
      const c = readIfExists(path.join(workdir || root, t));
      return c === null ? null : file(t, c);
    })
    .filter(Boolean);
  if (deps.length) parts.push(section('Dipendenze già migrate (da importare, non da riscrivere)', deps.join('\n')));

  if (attempt > 1 && previous) {
    parts.push(
      section(
        'Tentativo precedente (' + (attempt - 1) + ') — FALLITO al gate "' + previous.failedGate + '"',
        Object.keys(previous.files || {})
          .map((p) => file(p, previous.files[p]))
          .join('\n') +
          '\n<errore>\n' +
          previous.failure +
          '\n</errore>\nCorreggi il problema senza indebolire il comportamento atteso.'
      )
    );
  }
  return parts.join('\n');
}

/** Estrae blocchi <file path="...">...</file>. Ritorna { files, rejected, empty }. */
function parseFiles(text, allowedTargets) {
  const files = {};
  const rejected = [];
  const re = /<file\s+path="([^"]+)"\s*>\r?\n?([\s\S]*?)\r?\n?<\/file>/g;
  let m;
  let found = 0;
  while ((m = re.exec(text)) !== null) {
    found++;
    const p = path.posix.normalize(m[1].trim());
    if (allowedTargets.indexOf(p) === -1) {
      rejected.push(m[1].trim());
    } else {
      files[p] = m[2].replace(/^```[a-z]*\r?\n/, '').replace(/\r?\n```\s*$/, '') + '\n';
    }
  }
  return { files, rejected, empty: found === 0 };
}

/* ---------- workdir e gate ---------- */

function createWorkdir(root, workdir, manifest) {
  fs.rmSync(workdir, { recursive: true, force: true });
  fs.mkdirSync(workdir, { recursive: true });
  fs.copyFileSync(path.join(root, 'package.json'), path.join(workdir, 'package.json'));
  // la config di Jest valida TUTTI i progetti: nella workdir esiste solo "migrated", quindi si filtra
  fs.copyFileSync(path.join(root, 'jest.config.js'), path.join(workdir, 'jest.base.config.js'));
  fs.writeFileSync(
    path.join(workdir, 'jest.config.js'),
    "const base = require('./jest.base.config.js');\n" +
      "module.exports = { projects: base.projects.filter((p) => p.displayName === 'migrated') };\n"
  );
  ['migrated', 'contracts'].forEach((d) =>
    fs.cpSync(path.join(root, d), path.join(workdir, d), { recursive: true })
  );
  fs.symlinkSync(path.join(root, 'node_modules'), path.join(workdir, 'node_modules'), 'dir');
  return workdir;
}

function run(cmd, args, cwd, timeoutMs) {
  const t0 = Date.now();
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', timeout: timeoutMs, env: process.env });
  const output = ((r.stdout || '') + (r.stderr || '')).replace(ANSI, '');
  return { ok: r.status === 0 && !r.error, ms: Date.now() - t0, output: r.error ? String(r.error) + '\n' + output : output };
}

function tail(text, maxLines) {
  const lines = text.split('\n');
  return lines.length <= maxLines ? text : lines.slice(0, maxLines).join('\n') + '\n… (' + (lines.length - maxLines) + ' righe omesse)';
}

/** Esegue i gate in ordine e si ferma al primo che fallisce. */
function runGates(workdir, unit) {
  const gates = [];
  const tsc = run('npx', ['tsc', '--noEmit', '-p', 'migrated/tsconfig.spec.json'], workdir, 180000);
  gates.push({ name: 'typecheck', ok: tsc.ok, ms: tsc.ms, output: tsc.output });
  if (!tsc.ok) return { ok: false, failedGate: 'typecheck', gates };

  const spec = unit.goldSpec ? unit.goldSpec.to : null;
  const jestArgs = ['jest', '--selectProjects', 'migrated', '--ci', '--colors=false'];
  if (spec) jestArgs.push('--runTestsByPath', spec);
  const jest = run('npx', jestArgs, workdir, 240000);
  gates.push({ name: 'tests', ok: jest.ok, ms: jest.ms, output: jest.output });
  if (!jest.ok) return { ok: false, failedGate: 'tests', gates };
  return { ok: true, failedGate: null, gates };
}

/* ---------- metriche e report ---------- */

function summarize(attempts, units) {
  const byUnit = {};
  units.forEach((u) => {
    byUnit[u] = { unit: u, attempts: 0, success: false, firstTry: false, totalMs: 0, outcomes: [] };
  });
  attempts.forEach((a) => {
    const s = byUnit[a.unit];
    s.attempts++;
    s.totalMs += a.agentMs + a.gateMs;
    s.outcomes.push(a.outcome + (a.failedGate ? ':' + a.failedGate : ''));
    if (a.outcome === 'pass') {
      s.success = true;
      s.firstTry = a.attempt === 1;
    }
  });
  const list = Object.values(byUnit);
  const failures = {};
  attempts.forEach((a) => {
    if (a.outcome !== 'pass') {
      const k = a.failedGate || a.outcome;
      failures[k] = (failures[k] || 0) + 1;
    }
  });
  const ok = list.filter((u) => u.success);
  return {
    units: list,
    totals: {
      units: list.length,
      succeeded: ok.length,
      firstTry: list.filter((u) => u.firstTry).length,
      meanAttemptsToSuccess: ok.length ? ok.reduce((n, u) => n + u.attempts, 0) / ok.length : null,
      totalAttempts: attempts.length,
      failuresByKind: failures,
    },
  };
}

function renderReport({ adapter, model, startedAt, maxAttempts, summary }) {
  const t = summary.totals;
  const lines = [];
  lines.push('# Report di migrazione');
  lines.push('');
  if (adapter === 'replay') {
    lines.push('> **RUN DIMOSTRATIVO (replay).** I tentativi sono scritti a mano per verificare il meccanismo del loop.');
    lines.push('> Questi numeri **non misurano nessun modello**.');
    lines.push('');
  }
  lines.push('- Adapter: `' + adapter + '`' + (model ? ' (modello `' + model + '`)' : ''));
  lines.push('- Avvio: ' + startedAt + ' — max tentativi per unità: ' + maxAttempts);
  lines.push('- Unità riuscite: **' + t.succeeded + '/' + t.units + '** — al primo tentativo: ' + t.firstTry);
  lines.push(
    '- Tentativi medi per le unità riuscite: ' +
      (t.meanAttemptsToSuccess === null ? 'n/d' : t.meanAttemptsToSuccess.toFixed(2))
  );
  lines.push('- Fallimenti per tipo: ' + (Object.keys(t.failuresByKind).length ? JSON.stringify(t.failuresByKind) : 'nessuno'));
  lines.push('');
  lines.push('| Unità | Esito | Tentativi | Percorso | Tempo (s) |');
  lines.push('|---|---|---|---|---|');
  summary.units.forEach((u) => {
    lines.push(
      '| ' + u.unit + ' | ' + (u.success ? 'ok' : 'FALLITA') + ' | ' + u.attempts + ' | ' + u.outcomes.join(' → ') + ' | ' + (u.totalMs / 1000).toFixed(1) + ' |'
    );
  });
  lines.push('');
  return lines.join('\n');
}

module.exports = {
  loadManifest,
  pendingInOrder,
  blockedBy,
  buildPrompt,
  parseFiles,
  createWorkdir,
  runGates,
  summarize,
  renderReport,
  tail,
};

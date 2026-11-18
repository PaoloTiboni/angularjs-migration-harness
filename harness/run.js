#!/usr/bin/env node
/*
 * Loop di migrazione: per ogni unità pending (foglie prima)
 *   propone codice -> gate (typecheck, test gold) -> se fallisce rimanda l'errore -> max N tentativi.
 *
 * Uso:
 *   node harness/run.js --adapter replay [--unit stato-label] [--max-attempts 3] [--out dir] [--apply]
 *   ANTHROPIC_API_KEY=... node harness/run.js --adapter anthropic
 */
'use strict';

const fs = require('fs');
const path = require('path');
const lib = require('./lib');
const { createAdapter } = require('./adapters');

function parseArgs(argv) {
  const o = { adapter: 'replay', maxAttempts: 3, apply: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--adapter') o.adapter = argv[++i];
    else if (a === '--unit') o.unit = argv[++i];
    else if (a === '--max-attempts') o.maxAttempts = parseInt(argv[++i], 10);
    else if (a === '--out') o.out = argv[++i];
    else if (a === '--fixtures') o.fixtures = argv[++i];
    else if (a === '--model') o.model = argv[++i];
    else if (a === '--apply') o.apply = true;
    else throw new Error('Argomento sconosciuto: ' + a);
  }
  if (!(o.maxAttempts >= 1)) throw new Error('--max-attempts deve essere >= 1');
  return o;
}

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

/** Esegue il loop per una unità. Ritorna { records, accepted } */
async function migrateUnit({ root, workdir, unit, manifest, adapter, maxAttempts, outDir, log }) {
  const records = [];
  let previous = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const rec = { unit: unit.id, attempt, agentMs: 0, gateMs: 0, outcome: null, failedGate: null };
    const attemptDir = path.join(outDir, 'attempts', unit.id + '-' + attempt);

    // legacy e gold dal repo; dipendenze già accettate dalla workdir
    const prompt = lib.buildPrompt({ root, workdir, unit, manifest, attempt, previous });
    rec.promptChars = prompt.length;
    write(path.join(attemptDir, 'prompt.txt'), prompt);

    let proposal;
    const t0 = Date.now();
    try {
      proposal = await adapter.propose({ unit, attempt, prompt, previous });
    } catch (e) {
      rec.agentMs = Date.now() - t0;
      rec.outcome = 'agent_error';
      rec.detail = String(e.message || e);
      records.push(rec);
      log('  ' + unit.id + ' #' + attempt + ': errore dell\'agente: ' + rec.detail);
      break; // un errore dell'adapter non è un tentativo recuperabile con feedback
    }
    rec.agentMs = Date.now() - t0;
    write(path.join(attemptDir, 'response.txt'), proposal.text);
    if (proposal.usage) rec.usage = proposal.usage;

    const parsed = lib.parseFiles(proposal.text, unit.targets);
    if (parsed.rejected.length || parsed.empty || Object.keys(parsed.files).length !== unit.targets.length) {
      rec.outcome = 'rejected';
      rec.failedGate = 'output';
      rec.detail = parsed.empty
        ? 'nessun blocco <file> nella risposta'
        : parsed.rejected.length
          ? 'percorsi non consentiti: ' + parsed.rejected.join(', ')
          : 'file di destinazione mancanti';
      records.push(rec);
      previous = { files: {}, failedGate: 'output', failure: rec.detail + '. Percorsi consentiti: ' + unit.targets.join(', ') };
      log('  ' + unit.id + ' #' + attempt + ': RIFIUTATO (' + rec.detail + ')');
      continue;
    }

    // applica i file dell'agente e RIPRISTINA il gold spec: l'agente non può indebolire il contratto
    Object.keys(parsed.files).forEach((p) => write(path.join(workdir, p), parsed.files[p]));
    if (unit.goldSpec) {
      fs.mkdirSync(path.dirname(path.join(workdir, unit.goldSpec.to)), { recursive: true });
      fs.copyFileSync(path.join(root, unit.goldSpec.from), path.join(workdir, unit.goldSpec.to));
    }

    const g = lib.runGates(workdir, unit);
    rec.gateMs = g.gates.reduce((n, x) => n + x.ms, 0);
    g.gates.forEach((x) => write(path.join(attemptDir, 'gate-' + x.name + '.txt'), x.output));
    Object.keys(parsed.files).forEach((p) => write(path.join(attemptDir, 'files', p), parsed.files[p]));

    if (g.ok) {
      rec.outcome = 'pass';
      records.push(rec);
      log('  ' + unit.id + ' #' + attempt + ': OK');
      return { records, accepted: parsed.files };
    }
    rec.outcome = 'fail';
    rec.failedGate = g.failedGate;
    records.push(rec);
    const failing = g.gates.find((x) => !x.ok);
    previous = { files: parsed.files, failedGate: g.failedGate, failure: lib.tail(failing.output, 60) };
    log('  ' + unit.id + ' #' + attempt + ': FALLITO al gate ' + g.failedGate);
  }
  return { records, accepted: null };
}

async function main() {
  const root = path.resolve(__dirname, '..');
  const args = parseArgs(process.argv.slice(2));
  const manifest = lib.loadManifest(root);
  const units = lib.pendingInOrder(manifest, args.unit);
  const adapter = createAdapter(args.adapter, { root, fixturesDir: args.fixtures && path.resolve(args.fixtures), model: args.model });
  const startedAt = new Date().toISOString();
  const outDir = path.resolve(args.out || path.join(root, 'runs', startedAt.replace(/[:.]/g, '-') + '-' + adapter.name));
  const workdir = path.join(root, '.harness-work');
  const log = (s) => console.log(s);

  if (!units.length) {
    log('Nessuna unità pending da migrare.');
    return;
  }
  log('Adapter: ' + adapter.name + ' — unità: ' + units.map((u) => u.id).join(', ') + ' — max tentativi: ' + args.maxAttempts);
  lib.createWorkdir(root, workdir, manifest);

  const all = [];
  const acceptedAll = {};
  const failed = new Set();
  for (const unit of units) {
    const blocked = lib.blockedBy(unit, failed);
    if (blocked.length) {
      log('Unità ' + unit.id + ': SALTATA (dipende da ' + blocked.join(', ') + ', non migrata)');
      failed.add(unit.id);
      continue;
    }
    log('Unità ' + unit.id);
    const { records, accepted } = await migrateUnit({ root, workdir, unit, manifest, adapter, maxAttempts: args.maxAttempts, outDir, log });
    all.push(...records);
    if (accepted) {
      Object.assign(acceptedAll, accepted);
      if (unit.goldSpec) acceptedAll[unit.goldSpec.to] = fs.readFileSync(path.join(root, unit.goldSpec.from), 'utf8');
    } else {
      failed.add(unit.id);
      log('  -> unità ' + unit.id + ' non migrata entro ' + args.maxAttempts + ' tentativi; le unità che ne dipendono verranno saltate');
    }
  }

  const summary = lib.summarize(all, units.map((u) => u.id));
  const report = lib.renderReport({ adapter: adapter.name, model: adapter.model, startedAt, maxAttempts: args.maxAttempts, summary });
  write(path.join(outDir, 'metrics.json'), JSON.stringify({ adapter: adapter.name, model: adapter.model, startedAt, maxAttempts: args.maxAttempts, attempts: all, summary }, null, 2) + '\n');
  write(path.join(outDir, 'report.md'), report);
  Object.keys(acceptedAll).forEach((p) => write(path.join(outDir, 'accepted', p), acceptedAll[p]));
  log('\n' + report);
  log('Output in ' + outDir);

  if (args.apply) {
    Object.keys(acceptedAll).forEach((p) => write(path.join(root, p), acceptedAll[p]));
    log('Applicati ' + Object.keys(acceptedAll).length + ' file in migrated/ (rivedi il diff prima di committare).');
  }
  fs.rmSync(workdir, { recursive: true, force: true });
  process.exitCode = summary.totals.succeeded === summary.totals.units ? 0 : 1;
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e.message || e);
    process.exit(2);
  });
}

module.exports = { parseArgs, migrateUnit };

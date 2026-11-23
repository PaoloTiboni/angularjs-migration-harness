#!/usr/bin/env node
/*
 * Controllo preliminare prima del primo run reale:
 *   node harness/doctor.js [--model <id>]
 * Verifica Node, strumenti, che i gate girino sulla TUA macchina (stessa strada del loop, junction inclusa)
 * e, se ANTHROPIC_API_KEY è impostata, che l'API risponda (una chiamata da pochi token).
 * Non stampa mai la chiave.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const lib = require('./lib');
const { anthropicAdapter } = require('./adapters');

const root = path.resolve(__dirname, '..');
const modelArg = process.argv.indexOf('--model') > -1 ? process.argv[process.argv.indexOf('--model') + 1] : undefined;
const risultati = [];

function registra(nome, ok, dettaglio, fatale = true) {
  risultati.push({ nome, ok, fatale });
  console.log((ok ? '  OK    ' : fatale ? '  ERRORE ' : '  AVVISO ') + nome + (dettaglio ? ' — ' + dettaglio : ''));
}

async function main() {
  console.log('Controllo ambiente (' + process.platform + ', Node ' + process.versions.node + ')');

  const major = parseInt(process.versions.node.split('.')[0], 10);
  registra('Node >= 18', major >= 18, 'versione ' + process.versions.node);

  const tsc = lib.nodeBin(root, 'typescript', 'bin', 'tsc');
  const jest = lib.nodeBin(root, 'jest', 'bin', 'jest.js');
  registra('dipendenze installate (typescript, jest)', fs.existsSync(tsc) && fs.existsSync(jest), fs.existsSync(tsc) && fs.existsSync(jest) ? '' : 'esegui `npm install`');
  if (!(fs.existsSync(tsc) && fs.existsSync(jest))) return fine();

  // stessa strada del loop: workdir con junction a node_modules + gate typecheck e jest
  const workdir = path.join(root, '.harness-doctor');
  try {
    const manifest = lib.loadManifest(root);
    registra('manifest', true, manifest.units.length + ' unità, ' + manifest.units.filter((u) => u.status === 'pending').length + ' da migrare');
    lib.createWorkdir(root, workdir, manifest);
    registra('workdir isolata (junction a node_modules)', fs.existsSync(path.join(workdir, 'node_modules', 'typescript')), '');
    const unitProva = { goldSpec: { to: 'migrated/src/app/services/scadenze.service.spec.ts' } };
    const g = lib.runGates(workdir, unitProva);
    g.gates.forEach((x) => registra('gate ' + x.name + ' su codice già migrato', x.ok, (x.ms / 1000).toFixed(1) + 's' + (x.ok ? '' : '\n' + lib.tail(x.output, 15))));
    if (!g.ok && g.gates.length < 2) registra('gate tests', false, 'non eseguito (typecheck fallito)');
  } catch (e) {
    registra('preparazione workdir', false, String(e.message || e));
  } finally {
    fs.rmSync(workdir, { recursive: true, force: true });
  }

  if (process.env.ANTHROPIC_API_KEY) {
    const adapter = anthropicAdapter({ model: modelArg });
    try {
      const t0 = Date.now();
      const r = await adapter.propose({ prompt: 'Rispondi con la sola parola: ok', maxTokens: 16 });
      registra('API Anthropic (modello ' + adapter.model + ')', true, 'risposta "' + r.text.trim().slice(0, 20) + '" in ' + (Date.now() - t0) + ' ms' + (r.usage ? ', token in/out: ' + r.usage.input_tokens + '/' + r.usage.output_tokens : ''));
    } catch (e) {
      registra('API Anthropic (modello ' + adapter.model + ')', false, String(e.message || e).slice(0, 300));
    }
  } else {
    registra('ANTHROPIC_API_KEY', false, 'non impostata: ok per il replay, serve per --adapter anthropic', false);
  }
  fine();
}

function fine() {
  const ko = risultati.filter((r) => !r.ok && r.fatale).length;
  console.log(ko ? '\n' + ko + ' problema/i da risolvere prima del run.' : '\nTutto a posto per partire.');
  process.exitCode = ko ? 1 : 0;
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(2);
});

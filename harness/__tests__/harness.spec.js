const fs = require('fs');
const os = require('os');
const path = require('path');

const lib = require('../lib');
const { anthropicAdapter, replayAdapter } = require('../adapters');
const { migrateUnit } = require('../run');

const ROOT = path.resolve(__dirname, '..', '..');

const manifestSintetico = (units) => ({ units });
const U = (id, status, deps = []) => ({ id, status, deps, legacy: [], targets: ['t/' + id + '.ts'] });

describe('manifest e ordine di dipendenza', () => {
  it('il manifest reale si carica e ha dipendenze coerenti', () => {
    const m = lib.loadManifest(ROOT);
    expect(m.units.map((u) => u.id)).toEqual(
      expect.arrayContaining(['orologio', 'scadenze', 'scadenza-badge', 'stato-label', 'pratiche-service'])
    );
  });

  it('le foglie vengono prima di chi le usa; le unità done non compaiono', () => {
    const m = manifestSintetico([U('c', 'pending', ['b']), U('b', 'pending', ['a']), U('a', 'done')]);
    expect(lib.pendingInOrder(m).map((u) => u.id)).toEqual(['b', 'c']);
  });

  it('rifiuta un ciclo di dipendenze', () => {
    const m = manifestSintetico([U('a', 'pending', ['b']), U('b', 'pending', ['a'])]);
    expect(() => lib.pendingInOrder(m)).toThrow(/Ciclo di dipendenze/);
  });

  it('con --unit rifiuta se le dipendenze non sono ancora migrate', () => {
    const m = manifestSintetico([U('b', 'pending', ['a']), U('a', 'pending')]);
    expect(() => lib.pendingInOrder(m, 'b')).toThrow(/non sono ancora migrate: a/);
  });

  it('con --unit su unità sconosciuta lancia', () => {
    expect(() => lib.pendingInOrder(manifestSintetico([U('a', 'done')]), 'zzz')).toThrow(/sconosciuta/);
  });
});

describe('blockedBy', () => {
  it('elenca solo le dipendenze fallite o saltate', () => {
    const u = U('c', 'pending', ['a', 'b']);
    expect(lib.blockedBy(u, new Set())).toEqual([]);
    expect(lib.blockedBy(u, new Set(['b', 'zzz']))).toEqual(['b']);
    expect(lib.blockedBy(U('x', 'pending'), new Set(['a']))).toEqual([]);
  });
});

describe('discardUnit', () => {
  it('rimuove target e gold spec dell\'unità fallita e lascia in pace gli altri file', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-discard-'));
    try {
      const unit = { id: 'x', targets: ['m/x.ts'], goldSpec: { to: 'm/x.spec.ts' } };
      ['m/x.ts', 'm/x.spec.ts', 'm/altro.ts'].forEach((f) => {
        fs.mkdirSync(path.dirname(path.join(tmp, f)), { recursive: true });
        fs.writeFileSync(path.join(tmp, f), 'x');
      });
      expect(lib.discardUnit(tmp, unit)).toEqual(['m/x.ts', 'm/x.spec.ts']);
      expect(fs.existsSync(path.join(tmp, 'm/x.ts'))).toBe(false);
      expect(fs.existsSync(path.join(tmp, 'm/x.spec.ts'))).toBe(false);
      expect(fs.existsSync(path.join(tmp, 'm/altro.ts'))).toBe(true);
      expect(() => lib.discardUnit(tmp, unit)).not.toThrow(); // idempotente
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe('parseFiles', () => {
  const TARGETS = ['migrated/a.ts', 'migrated/b.ts'];

  it('estrae i blocchi consentiti', () => {
    const r = lib.parseFiles('<file path="migrated/a.ts">\nconst a = 1;\n</file>', TARGETS);
    expect(r.files).toEqual({ 'migrated/a.ts': 'const a = 1;\n' });
    expect(r.rejected).toEqual([]);
    expect(r.empty).toBe(false);
  });

  it('rifiuta percorsi non consentiti (es. il gold spec) senza scriverli', () => {
    const r = lib.parseFiles(
      '<file path="migrated/a.ts">x</file>\n<file path="migrated/a.spec.ts">expect(true).toBe(true)</file>',
      TARGETS
    );
    expect(Object.keys(r.files)).toEqual(['migrated/a.ts']);
    expect(r.rejected).toEqual(['migrated/a.spec.ts']);
  });

  it('non si lascia ingannare da percorsi con ./ o ..', () => {
    const r = lib.parseFiles('<file path="./migrated/a.ts">ok</file><file path="migrated/../../etc/x">no</file>', TARGETS);
    expect(Object.keys(r.files)).toEqual(['migrated/a.ts']);
    expect(r.rejected).toEqual(['migrated/../../etc/x']);
  });

  it('toglie i recinti di codice markdown dentro il blocco', () => {
    const r = lib.parseFiles('<file path="migrated/a.ts">\n```ts\nconst a = 1;\n```\n</file>', TARGETS);
    expect(r.files['migrated/a.ts']).toBe('const a = 1;\n');
  });

  it('segnala una risposta senza blocchi', () => {
    expect(lib.parseFiles('Ecco il codice: const a = 1;', TARGETS).empty).toBe(true);
  });
});

describe('buildPrompt', () => {
  const m = lib.loadManifest(ROOT);
  const unit = m.units.find((u) => u.id === 'pratiche-service');

  it('contiene legacy, test legacy, gold spec, note e dipendenze già migrate', () => {
    const p = lib.buildPrompt({ root: ROOT, workdir: ROOT, unit, manifest: m, attempt: 1, previous: null });
    expect(p).toContain('src/services/pratiche.service.js');
    expect(p).toContain('tests/pratiche.service.spec.js');
    expect(p).toContain('migrated/src/app/services/pratiche.service.spec.ts');
    expect(p).toContain('Orologio'); // dipendenza già migrata
    expect(p).toContain('ScadenzeService');
    expect(p).toContain('IDENTICO, quirk e bug latenti inclusi');
  });

  it('non contiene nessuna soluzione di riferimento (le fixture non entrano nel prompt)', () => {
    const p = lib.buildPrompt({ root: ROOT, workdir: ROOT, unit, manifest: m, attempt: 1, previous: null });
    expect(p).not.toContain('export class PraticheService');
    expect(p).not.toContain('padStart');
  });

  it('dal secondo tentativo include file precedenti e errore', () => {
    const p = lib.buildPrompt({
      root: ROOT,
      workdir: ROOT,
      unit,
      manifest: m,
      attempt: 2,
      previous: { files: { 'x.ts': 'CODICE_PRECEDENTE' }, failedGate: 'typecheck', failure: 'TS7053 boom' },
    });
    expect(p).toContain('FALLITO al gate "typecheck"');
    expect(p).toContain('CODICE_PRECEDENTE');
    expect(p).toContain('TS7053 boom');
  });
});

describe('summarize', () => {
  it('calcola esito, primo tentativo, medie e fallimenti per tipo', () => {
    const rec = (unit, attempt, outcome, failedGate) => ({ unit, attempt, outcome, failedGate: failedGate || null, agentMs: 1000, gateMs: 500 });
    const s = lib.summarize(
      [rec('a', 1, 'pass'), rec('b', 1, 'fail', 'typecheck'), rec('b', 2, 'fail', 'tests'), rec('b', 3, 'pass'), rec('c', 1, 'agent_error')],
      ['a', 'b', 'c']
    );
    expect(s.totals).toMatchObject({ units: 3, succeeded: 2, firstTry: 1, totalAttempts: 5 });
    expect(s.totals.meanAttemptsToSuccess).toBe(2);
    expect(s.totals.failuresByKind).toEqual({ typecheck: 1, tests: 1, agent_error: 1 });
    expect(s.units.find((u) => u.unit === 'b').outcomes).toEqual(['fail:typecheck', 'fail:tests', 'pass']);
  });
});

describe('adapter', () => {
  it('replay: errore chiaro se i tentativi sono esauriti', async () => {
    const a = replayAdapter({ root: ROOT });
    await expect(a.propose({ unit: { id: 'stato-label' }, attempt: 99 })).rejects.toThrow(/Fixture esaurita/);
  });

  it('anthropic: senza ANTHROPIC_API_KEY lancia senza chiamare la rete', async () => {
    const fetchImpl = jest.fn();
    const a = anthropicAdapter({ fetchImpl, env: {} });
    await expect(a.propose({ prompt: 'x' })).rejects.toThrow(/ANTHROPIC_API_KEY/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('anthropic: invia la richiesta attesa e concatena i blocchi di testo', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ type: 'text', text: 'uno' }, { type: 'tool_use' }, { type: 'text', text: 'due' }], usage: { input_tokens: 5 } }),
    });
    const a = anthropicAdapter({ fetchImpl, env: { ANTHROPIC_API_KEY: 'k-test' }, model: 'modello-x' });
    const r = await a.propose({ prompt: 'ciao' });
    expect(r.text).toBe('uno\ndue');
    expect(r.usage).toEqual({ input_tokens: 5 });
    const [url, opts] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(opts.headers['x-api-key']).toBe('k-test');
    expect(opts.headers['anthropic-version']).toBe('2023-06-01');
    const body = JSON.parse(opts.body);
    expect(body.model).toBe('modello-x');
    expect(body.messages).toEqual([{ role: 'user', content: 'ciao' }]);
  });

  it('anthropic: un errore HTTP diventa un errore con lo status', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: false, status: 429, text: async () => 'rate limited' });
    const a = anthropicAdapter({ fetchImpl, env: { ANTHROPIC_API_KEY: 'k' } });
    await expect(a.propose({ prompt: 'x' })).rejects.toThrow(/429.*rate limited/);
  });
});

describe('migrateUnit: guardie del loop (senza eseguire i gate)', () => {
  const m = lib.loadManifest(ROOT);
  const unit = m.units.find((u) => u.id === 'stato-label');
  let tmp;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-spec-'));
  });
  afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

  const adapterDa = (risposte, prompts) => ({
    name: 'stub',
    async propose({ prompt }) {
      prompts.push(prompt);
      const r = risposte.shift();
      if (r instanceof Error) throw r;
      return { text: r };
    },
  });

  it('un tentativo che scrive il gold spec viene RIFIUTATO e il file non viene toccato', async () => {
    const workdir = path.join(tmp, 'work');
    fs.mkdirSync(workdir);
    const prompts = [];
    const tamper = '<file path="' + unit.goldSpec.to + '">it("finto", () => {})</file>';
    const res = await migrateUnit({
      root: ROOT, workdir, unit, manifest: m, maxAttempts: 2, outDir: path.join(tmp, 'out'), log: () => {},
      adapter: adapterDa([tamper, tamper], prompts),
    });
    expect(res.accepted).toBeNull();
    expect(res.records.map((r) => r.outcome)).toEqual(['rejected', 'rejected']);
    expect(res.records[0].detail).toMatch(/percorsi non consentiti/);
    expect(fs.existsSync(path.join(workdir, unit.goldSpec.to))).toBe(false);
    expect(prompts[1]).toContain('percorsi non consentiti'); // il feedback arriva al tentativo 2
  });

  it('una risposta senza blocchi <file> è rifiutata', async () => {
    const res = await migrateUnit({
      root: ROOT, workdir: path.join(tmp, 'work'), unit, manifest: m, maxAttempts: 1, outDir: path.join(tmp, 'out'), log: () => {},
      adapter: adapterDa(['Certo! Ecco il codice...'], []),
    });
    expect(res.records[0]).toMatchObject({ outcome: 'rejected', detail: 'nessun blocco <file> nella risposta' });
  });

  it('un errore dell\'adapter (es. rete) ferma l\'unità senza consumare altri tentativi', async () => {
    const prompts = [];
    const res = await migrateUnit({
      root: ROOT, workdir: path.join(tmp, 'work'), unit, manifest: m, maxAttempts: 3, outDir: path.join(tmp, 'out'), log: () => {},
      adapter: adapterDa([new Error('rete giù')], prompts),
    });
    expect(res.records).toHaveLength(1);
    expect(res.records[0]).toMatchObject({ outcome: 'agent_error', detail: 'rete giù' });
    expect(prompts).toHaveLength(1);
  });
});

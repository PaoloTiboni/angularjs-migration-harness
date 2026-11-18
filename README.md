# AngularJS migration harness

Progetto per dimostrare (e misurare) una migrazione AngularJS → Angular assistita da AI, con verifica automatica.

## Stato

**Fase 1 (fatta): app legacy + test di caratterizzazione.**

- `src/`: app demo "Pratiche" in AngularJS 1.8, scritta in stile legacy
  (service, filter, direttiva con isolated scope + `$watch`, componenti con `templateUrl`,
  controller con `$scope` e `$timeout`).
- `tests/`: 77 test Jest + jsdom + angular-mocks che fissano il comportamento attuale,
  compresi i comportamenti "scomodi" (es. un binding `<` non reagisce a `push()` sullo stesso array).
- Verifica della qualità dei test: 7 bug finti diversi introdotti uno alla volta, tutti intercettati
  (uno sopravvissuto al primo giro, coperto poi con 2 test in più).

```bash
npm install
npm test          # legacy + migrated
npx jest --selectProjects legacy
npx jest --selectProjects migrated
```

**Fase 2 (fatta): migrazione manuale "gold" di 3 pezzi, in ordine di dipendenza.**

- `migrated/`: Angular 19 (standalone, signals) + `jest-preset-angular`.
  `Orologio` → `ScadenzeService` → `ScadenzaBadgeComponent` (prima le foglie, poi chi le usa).
- `contracts/scadenza-badge.cases.json`: **contratto condiviso**. Lo stesso elenco di casi
  è eseguito sia dal test AngularJS sia da quello Angular: se i due lati divergono, uno dei due diventa rosso.
- Quirk del legacy preservato e testato su entrambi i lati: il badge legge "oggi" solo quando
  cambia `scadenza` (non si aggiorna al passare del tempo).
- Mutazioni sul codice migrato: 10 diverse catturate; 1 sopravvissuta ma equivalente
  (`Math.round`→`Math.floor` su differenze di `Date.UTC`, che sono sempre multipli esatti).
- Lezione: un test di Ferragosto era vuoto perché nel 2026 il 15/8 è di sabato. L'ha scoperto la
  mutazione, non la lettura del test. Aggiunti test in un anno in cui cade in un giorno feriale.

## Perché i test di caratterizzazione

Prima di migrare qualcosa serve un modo oggettivo per dire "il comportamento non è cambiato".
I test descrivono *cosa fa oggi* il codice, non cosa "dovrebbe" fare. Quando un componente migrato
li fa passare, la migrazione è corretta; quando fallisce, l'agente riceve l'errore e riprova.

## Fase 3 e 4: il loop dell'agente (fatto) e le metriche

```bash
npm run migrate:replay                 # demo senza modello: fixture scritte a mano
ANTHROPIC_API_KEY=... npm run migrate -- --adapter anthropic --max-attempts 3
npm run migrate -- --adapter anthropic --unit stato-label --out runs/prova --apply
```

Per ogni unità `pending` di `harness/units.json` (le foglie prima, in ordine di dipendenza):

1. **Prompt**: sorgente legacy + test legacy + test Angular da far passare + dipendenze già migrate
   (+ file e errore del tentativo precedente).
2. **Agente** (adapter `anthropic` o `replay`) risponde con blocchi `<file path="...">`.
3. **Guardie**: sono ammessi solo i file di destinazione dell'unità; il gold spec viene
   **ripristinato prima di ogni gate**, quindi l'agente non può indebolire il contratto.
4. **Gate**: `tsc --noEmit` e poi Jest sul gold spec. Al primo gate rosso, errore rimandato all'agente.
5. **Metriche** in `metrics.json` e `report.md`: esito, tentativi, primo tentativo, tipo di fallimento, tempi.
   I file accettati finiscono in `accepted/`; con `--apply` vengono copiati in `migrated/`.

`examples/replay-demo/` contiene un run completo (prompt, risposte, output dei gate di ogni tentativo).

### Cosa è reale e cosa no (importante)

- **Reale e testato**: ordine di dipendenza, parsing, guardie anti-manomissione, gate tsc+Jest,
  feedback degli errori, metriche e report (22 test in `harness/__tests__`, mutation-checked).
- **Replay = solo validazione del meccanismo**. Le fixture sono codice scritto da me con errori voluti
  (pipe col nome sbagliato; errore di tipo; transizione mancante). Il report lo dichiara in testa.
  **Non misura nessun modello.**
- **Adapter `anthropic`: non provato contro l'API reale** (qui non c'è una chiave). È coperto da test con
  `fetch` finto (header, body, errori). Il primo run vero è anche il suo primo test: aspettati di dover
  sistemare qualcosa.
- Il gold spec è **visibile** all'agente (è il contratto). Rischio noto: "insegnare al test". Una variante
  più severa è tenere un secondo gruppo di test nascosti, usati solo per il giudizio finale.
- Un bug latente del legacy trovato scrivendo i test: `statoLabel('constructor')` restituisce la funzione
  `Object`. È documentato come quirk nei test legacy e **non corretto**: la migrazione preserva il comportamento.

## Prossimi passi

1. **Primo run reale** con una chiave API sul tuo PC, su `stato-label` e `pratiche-service`.
   Dati veri: tasso di successo, tentativi, dove sbaglia l'agente.
2. **Più unità**: `pratica-form`, `pratiche-list`, `main.controller` (servono gold spec e migrazione dei template).
3. **Fase 5, confronto**: stesso set di unità con e senza gate/feedback, e con test nascosti.
4. **Report aggregato** su più run (varianza tra run, costo in token da `usage`).

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

## Prossimi passi

1. **Fase 3: loop dell'agente.** Per ogni componente: migra → build + lint + test → se fallisce,
   rimanda l'errore all'agente (max N tentativi) → una PR per componente.
2. **Fase 4: metriche.** Esito, tentativi, tempo e tipo di errore per componente; report finale.
3. **Fase 5: confronto.** Stesso set di componenti con e senza i gate di verifica.

## Note

- jQuery è caricato prima di Angular nei test (`angular.element` = jQuery), come in molte app legacy.
- In `tests/` si usa `angular.mock.module/inject` perché `module` in Jest è l'oggetto CommonJS.
- Tutti i dati sono inventati: nessun codice o dato di clienti.

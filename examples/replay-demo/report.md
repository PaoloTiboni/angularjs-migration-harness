# Report di migrazione

> **RUN DIMOSTRATIVO (replay).** I tentativi sono scritti a mano per verificare il meccanismo del loop.
> Questi numeri **non misurano nessun modello**.

- Adapter: `replay`
- Avvio: 2026-11-23T11:45:26.933Z — max tentativi per unità: 3
- Unità riuscite: **5/5** — al primo tentativo: 0
- Tentativi medi per le unità riuscite: 2.60
- Fallimenti per tipo: {"tests":7,"typecheck":1}

| Unità | Esito | Tentativi | Percorso | Tempo (s) |
|---|---|---|---|---|
| stato-label | ok | 2 | fail:tests → pass | 7.5 |
| pratiche-service | ok | 3 | fail:typecheck → fail:tests → pass | 9.5 |
| pratica-form | ok | 3 | fail:tests → fail:tests → pass | 12.7 |
| pratiche-list | ok | 2 | fail:tests → pass | 9.1 |
| pagina-pratiche | ok | 3 | fail:tests → fail:tests → pass | 13.6 |

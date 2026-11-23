# Report di migrazione

> **RUN DIMOSTRATIVO (replay).** I tentativi sono scritti a mano per verificare il meccanismo del loop.
> Questi numeri **non misurano nessun modello**.

- Adapter: `replay`
- Avvio: 2026-11-23T11:20:42.406Z — max tentativi per unità: 3
- Unità riuscite: **4/4** — al primo tentativo: 0
- Tentativi medi per le unità riuscite: 2.50
- Fallimenti per tipo: {"tests":5,"typecheck":1}

| Unità | Esito | Tentativi | Percorso | Tempo (s) |
|---|---|---|---|---|
| stato-label | ok | 2 | fail:tests → pass | 7.8 |
| pratiche-service | ok | 3 | fail:typecheck → fail:tests → pass | 8.2 |
| pratica-form | ok | 3 | fail:tests → fail:tests → pass | 12.1 |
| pratiche-list | ok | 2 | fail:tests → pass | 9.1 |

# Report di migrazione

> **RUN DIMOSTRATIVO (replay).** I tentativi sono scritti a mano per verificare il meccanismo del loop.
> Questi numeri **non misurano nessun modello**.

- Adapter: `replay`
- Avvio: 2026-11-18T23:31:39.179Z — max tentativi per unità: 3
- Unità riuscite: **2/2** — al primo tentativo: 0
- Tentativi medi per le unità riuscite: 2.50
- Fallimenti per tipo: {"tests":2,"typecheck":1}

| Unità | Esito | Tentativi | Percorso | Tempo (s) |
|---|---|---|---|---|
| stato-label | ok | 2 | fail:tests → pass | 8.0 |
| pratiche-service | ok | 3 | fail:typecheck → fail:tests → pass | 9.5 |

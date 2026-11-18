import { TestBed } from '@angular/core/testing';

import { ScadenzeService } from './scadenze.service';

// Valori attesi calcolati in modo indipendente (python + dateutil.easter),
// gli stessi usati dai test della versione AngularJS.
describe('ScadenzeService (Angular)', () => {
  let S: ScadenzeService;

  beforeEach(() => {
    S = TestBed.inject(ScadenzeService);
  });

  describe('aggiungiGiorniLavorativi', () => {
    it('salta il weekend (ven 2026-01-02 +1 -> lun 2026-01-05)', () => {
      expect(S.aggiungiGiorniLavorativi(new Date(2026, 0, 2), 1)).toEqual(new Date(2026, 0, 5));
    });

    it('salta Pasquetta 2026 (gio 2026-04-02 +3 -> mer 2026-04-08)', () => {
      expect(S.aggiungiGiorniLavorativi(new Date(2026, 3, 2), 3)).toEqual(new Date(2026, 3, 8));
    });

    it('salta Natale, Santo Stefano e weekend (mer 2026-12-23 +2 -> lun 2026-12-28)', () => {
      expect(S.aggiungiGiorniLavorativi(new Date(2026, 11, 23), 2)).toEqual(new Date(2026, 11, 28));
    });

    it('30 giorni lavorativi da lun 2026-03-02 -> 2026-04-14', () => {
      expect(S.aggiungiGiorniLavorativi(new Date(2026, 2, 2), 30)).toEqual(new Date(2026, 3, 14));
    });

    it('salta Ferragosto (ven 2026-08-14 +1 -> lun 2026-08-17)', () => {
      expect(S.aggiungiGiorniLavorativi(new Date(2026, 7, 14), 1)).toEqual(new Date(2026, 7, 17));
    });

    // Nel 2026 il 15/8 cade di sabato: il test sopra non prova il festivo. Questi sì (2025, giorni feriali).
    it('salta Ferragosto in un anno in cui è feriale (gio 2025-08-14 +1 -> lun 2025-08-18)', () => {
      expect(S.aggiungiGiorniLavorativi(new Date(2025, 7, 14), 1)).toEqual(new Date(2025, 7, 18));
    });

    it('salta il 25 aprile 2025 (gio 2025-04-24 +1 -> lun 2025-04-28)', () => {
      expect(S.aggiungiGiorniLavorativi(new Date(2025, 3, 24), 1)).toEqual(new Date(2025, 3, 28));
    });

    it('salta il 1 maggio 2025 (mer 2025-04-30 +1 -> ven 2025-05-02)', () => {
      expect(S.aggiungiGiorniLavorativi(new Date(2025, 3, 30), 1)).toEqual(new Date(2025, 4, 2));
    });

    it('con 0 giorni restituisce la stessa data', () => {
      expect(S.aggiungiGiorniLavorativi(new Date(2026, 5, 1), 0)).toEqual(new Date(2026, 5, 1));
    });

    it('non modifica la data in input', () => {
      const d = new Date(2026, 0, 2);
      S.aggiungiGiorniLavorativi(d, 5);
      expect(d).toEqual(new Date(2026, 0, 2));
    });
  });

  describe('eFestivo / eLavorativo', () => {
    it('riconosce festività fisse', () => {
      expect(S.eFestivo(new Date(2026, 0, 1))).toBe(true);
      expect(S.eFestivo(new Date(2026, 11, 25))).toBe(true);
    });

    it('riconosce tutte le festività fisse (e non i giorni accanto)', () => {
      const FISSE = [[0, 1], [0, 6], [3, 25], [4, 1], [5, 2], [7, 15], [10, 1], [11, 8], [11, 25], [11, 26]];
      [2025, 2026, 2027].forEach((anno) => {
        FISSE.forEach(([m, g]) => {
          expect(S.eFestivo(new Date(anno, m, g))).toBe(true);
        });
      });
      expect(S.eFestivo(new Date(2025, 7, 14))).toBe(false);
      expect(S.eFestivo(new Date(2025, 7, 16))).toBe(false);
    });

    it('riconosce Pasquetta 2026 e 2025, ma non la domenica di Pasqua', () => {
      expect(S.eFestivo(new Date(2026, 3, 6))).toBe(true);
      expect(S.eFestivo(new Date(2025, 3, 21))).toBe(true);
      expect(S.eFestivo(new Date(2026, 3, 5))).toBe(false);
    });

    it('un giorno feriale normale è lavorativo; sabato e domenica no', () => {
      expect(S.eLavorativo(new Date(2026, 2, 4))).toBe(true);
      expect(S.eLavorativo(new Date(2026, 2, 7))).toBe(false);
      expect(S.eLavorativo(new Date(2026, 2, 8))).toBe(false);
    });

    it('un festivo infrasettimanale non è lavorativo', () => {
      expect(S.eLavorativo(new Date(2026, 3, 6))).toBe(false);
    });
  });

  describe('giorniRimanenti', () => {
    it('positivo se la scadenza è futura', () => {
      expect(S.giorniRimanenti(new Date(2026, 2, 10), new Date(2026, 2, 5))).toBe(5);
    });

    it('zero se oggi', () => {
      expect(S.giorniRimanenti(new Date(2026, 2, 5), new Date(2026, 2, 5))).toBe(0);
    });

    it('negativo se scaduta', () => {
      expect(S.giorniRimanenti(new Date(2026, 2, 1), new Date(2026, 2, 5))).toBe(-4);
    });

    it('è corretto attraverso il cambio ora legale (2026-03-29)', () => {
      expect(S.giorniRimanenti(new Date(2026, 2, 31), new Date(2026, 2, 27))).toBe(4);
    });
  });
});

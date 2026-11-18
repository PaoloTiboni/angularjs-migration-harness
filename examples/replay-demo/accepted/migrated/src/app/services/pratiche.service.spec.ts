import { TestBed } from '@angular/core/testing';

import { Orologio } from './orologio.service';
import { PraticheService } from './pratiche.service';

const CF_OK = 'RSSMRA80A01H501U';

const dati = (extra: Record<string, unknown> = {}) =>
  ({ oggetto: 'Richiesta contributo', richiedente: 'Mario Rossi', codiceFiscale: CF_OK, ...extra }) as never;

/* eslint-disable @typescript-eslint/no-explicit-any */
function cattura(fn: () => unknown): any {
  try {
    fn();
  } catch (e) {
    return e;
  }
  return undefined;
}

describe('PraticheService (gold, portato dal service AngularJS)', () => {
  let S: PraticheService;
  let oggi: Date;

  beforeEach(() => {
    oggi = new Date(2026, 2, 2); // lunedì 2026-03-02
    TestBed.configureTestingModule({
      providers: [{ provide: Orologio, useValue: { oggi: () => new Date(oggi.getTime()) } }],
    });
    S = TestBed.inject(PraticheService);
  });

  describe('valida', () => {
    it('nessun errore con dati completi', () => {
      expect(S.valida(dati())).toEqual({});
    });

    it('segnala i campi obbligatori mancanti', () => {
      expect(S.valida({} as never)).toEqual({
        oggetto: 'Oggetto obbligatorio',
        richiedente: 'Richiedente obbligatorio',
        codiceFiscale: 'Codice fiscale obbligatorio',
      });
    });

    it('considera vuoti oggetto e richiedente fatti solo di spazi', () => {
      const e: any = S.valida(dati({ oggetto: '   ', richiedente: ' ' }));
      expect(e.oggetto).toBe('Oggetto obbligatorio');
      expect(e.richiedente).toBe('Richiedente obbligatorio');
    });

    it('rifiuta un codice fiscale con formato errato', () => {
      const e: any = S.valida(dati({ codiceFiscale: 'ABC123' }));
      expect(e.codiceFiscale).toBe('Codice fiscale non valido');
    });

    it('accetta un codice fiscale in minuscolo', () => {
      expect(S.valida(dati({ codiceFiscale: CF_OK.toLowerCase() }))).toEqual({});
    });

    it('accetta undefined senza lanciare', () => {
      expect(Object.keys(S.valida(undefined as never))).toHaveLength(3);
    });
  });

  describe('crea', () => {
    it('crea una bozza con id progressivo e dati normalizzati', () => {
      const p = S.crea(dati({ oggetto: '  Titolo  ', codiceFiscale: CF_OK.toLowerCase() }));
      expect(p).toEqual({
        id: 1,
        oggetto: 'Titolo',
        richiedente: 'Mario Rossi',
        codiceFiscale: CF_OK,
        stato: 'BOZZA',
        dataCreazione: new Date(2026, 2, 2),
        numeroProtocollo: null,
        dataProtocollo: null,
        scadenza: null,
      });
      expect(S.crea(dati()).id).toBe(2);
    });

    it('lancia un errore di validazione con code e dettaglio campi', () => {
      const err = cattura(() => S.crea({ oggetto: 'x' } as never));
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toBe('Dati non validi');
      expect(err.code).toBe('VALIDAZIONE');
      expect(Object.keys(err.errori).sort()).toEqual(['codiceFiscale', 'richiedente']);
      expect(S.tutte()).toHaveLength(0);
    });
  });

  describe('cambiaStato', () => {
    it('BOZZA -> PROTOCOLLATA assegna protocollo, data e scadenza a 30 giorni lavorativi', () => {
      const p = S.crea(dati());
      S.cambiaStato(p.id, 'PROTOCOLLATA' as never);
      const aggiornata: any = S.trova(p.id);
      expect(aggiornata.stato).toBe('PROTOCOLLATA');
      expect(aggiornata.numeroProtocollo).toBe('2026/0001');
      expect(aggiornata.dataProtocollo).toEqual(new Date(2026, 2, 2));
      expect(aggiornata.scadenza).toEqual(new Date(2026, 3, 14)); // vedi scadenze.service.spec
    });

    it('i numeri di protocollo sono progressivi per anno e ripartono a nuovo anno', () => {
      const a = S.crea(dati());
      const b = S.crea(dati());
      S.cambiaStato(a.id, 'PROTOCOLLATA' as never);
      S.cambiaStato(b.id, 'PROTOCOLLATA' as never);
      expect((S.trova(b.id) as any).numeroProtocollo).toBe('2026/0002');

      oggi = new Date(2027, 0, 11);
      const c = S.crea(dati());
      S.cambiaStato(c.id, 'PROTOCOLLATA' as never);
      expect((S.trova(c.id) as any).numeroProtocollo).toBe('2027/0001');
    });

    it('percorso completo fino ad APPROVATA', () => {
      const p = S.crea(dati());
      S.cambiaStato(p.id, 'PROTOCOLLATA' as never);
      S.cambiaStato(p.id, 'IN_ISTRUTTORIA' as never);
      S.cambiaStato(p.id, 'APPROVATA' as never);
      expect((S.trova(p.id) as any).stato).toBe('APPROVATA');
    });

    it('IN_ISTRUTTORIA può finire anche in RESPINTA', () => {
      const p = S.crea(dati());
      S.cambiaStato(p.id, 'PROTOCOLLATA' as never);
      S.cambiaStato(p.id, 'IN_ISTRUTTORIA' as never);
      S.cambiaStato(p.id, 'RESPINTA' as never);
      expect((S.trova(p.id) as any).stato).toBe('RESPINTA');
    });

    it('mappa completa delle transizioni consentite', () => {
      expect(S.stati).toEqual(['BOZZA', 'PROTOCOLLATA', 'IN_ISTRUTTORIA', 'APPROVATA', 'RESPINTA', 'ANNULLATA']);
      expect(S.transizioniPossibili('BOZZA' as never)).toEqual(['PROTOCOLLATA', 'ANNULLATA']);
      expect(S.transizioniPossibili('PROTOCOLLATA' as never)).toEqual(['IN_ISTRUTTORIA', 'ANNULLATA']);
      expect(S.transizioniPossibili('IN_ISTRUTTORIA' as never)).toEqual(['APPROVATA', 'RESPINTA']);
    });

    it('rifiuta transizioni non consentite (con messaggio e code)', () => {
      const p = S.crea(dati());
      const err = cattura(() => S.cambiaStato(p.id, 'APPROVATA' as never));
      expect(err.message).toBe('Transizione non consentita: BOZZA -> APPROVATA');
      expect(err.code).toBe('TRANSIZIONE');
      expect((S.trova(p.id) as any).stato).toBe('BOZZA');
    });

    it('gli stati finali non hanno uscite', () => {
      ['APPROVATA', 'RESPINTA', 'ANNULLATA'].forEach((s) => {
        expect(S.transizioniPossibili(s as never)).toEqual([]);
      });
    });

    it('una pratica annullata non si può riaprire e non ha avuto protocollo', () => {
      const p = S.crea(dati());
      S.cambiaStato(p.id, 'ANNULLATA' as never);
      expect(() => S.cambiaStato(p.id, 'PROTOCOLLATA' as never)).toThrow();
      expect((S.trova(p.id) as any).numeroProtocollo).toBeNull();
    });

    it('lancia NON_TROVATA per un id inesistente', () => {
      const err = cattura(() => S.cambiaStato(999, 'PROTOCOLLATA' as never));
      expect(err).toBeDefined();
      expect(err.code).toBe('NON_TROVATA');
    });

    it('transizioniPossibili restituisce una copia', () => {
      const t: any = S.transizioniPossibili('BOZZA' as never);
      t.push('X');
      expect(S.transizioniPossibili('BOZZA' as never)).toEqual(['PROTOCOLLATA', 'ANNULLATA']);
    });
  });

  describe('cerca', () => {
    beforeEach(() => {
      S.crea(dati({ oggetto: 'Contributo affitto', richiedente: 'Mario Rossi' }));
      const b = S.crea(dati({ oggetto: 'Permesso edilizio', richiedente: 'Anna Verdi' }));
      S.cambiaStato(b.id, 'PROTOCOLLATA' as never);
    });

    it('senza criteri restituisce tutto', () => {
      expect(S.cerca()).toHaveLength(2);
      expect(S.cerca({})).toHaveLength(2);
    });

    it('filtra per testo su oggetto e richiedente, senza distinguere maiuscole', () => {
      expect(S.cerca({ testo: 'AFFITTO' }).map((p) => p.id)).toEqual([1]);
      expect(S.cerca({ testo: 'verdi' }).map((p) => p.id)).toEqual([2]);
    });

    it('filtra per stato', () => {
      expect(S.cerca({ stato: 'PROTOCOLLATA' as never }).map((p) => p.id)).toEqual([2]);
    });

    it('combina testo e stato', () => {
      expect(S.cerca({ testo: 'affitto', stato: 'PROTOCOLLATA' as never })).toEqual([]);
    });

    it('il testo di soli spazi non filtra', () => {
      expect(S.cerca({ testo: '   ' })).toHaveLength(2);
    });
  });

  describe('contaPerStato', () => {
    it('restituisce tutti gli stati, anche a zero', () => {
      S.crea(dati());
      const p = S.crea(dati());
      S.cambiaStato(p.id, 'ANNULLATA' as never);
      expect(S.contaPerStato()).toEqual({
        BOZZA: 1,
        PROTOCOLLATA: 0,
        IN_ISTRUTTORIA: 0,
        APPROVATA: 0,
        RESPINTA: 0,
        ANNULLATA: 1,
      });
    });
  });
});

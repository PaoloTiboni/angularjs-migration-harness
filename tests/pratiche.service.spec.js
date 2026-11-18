describe('PraticheService', () => {
  let S;
  let oggi;
  const CF_OK = 'RSSMRA80A01H501U';

  const dati = (extra) => Object.assign(
    { oggetto: 'Richiesta contributo', richiedente: 'Mario Rossi', codiceFiscale: CF_OK },
    extra
  );

  beforeEach(() => {
    oggi = new Date(2026, 2, 2); // lunedì 2026-03-02
    angular.mock.module('pratiche', ($provide) => {
      $provide.value('Orologio', { oggi: () => new Date(oggi.getTime()) });
    });
    angular.mock.inject((PraticheService) => {
      S = PraticheService;
      S.reset();
    });
  });

  describe('valida', () => {
    it('nessun errore con dati completi', () => {
      expect(S.valida(dati())).toEqual({});
    });

    it('segnala i campi obbligatori mancanti', () => {
      expect(S.valida({})).toEqual({
        oggetto: 'Oggetto obbligatorio',
        richiedente: 'Richiedente obbligatorio',
        codiceFiscale: 'Codice fiscale obbligatorio'
      });
    });

    it('considera vuoti oggetto e richiedente fatti solo di spazi', () => {
      const e = S.valida(dati({ oggetto: '   ', richiedente: ' ' }));
      expect(e.oggetto).toBe('Oggetto obbligatorio');
      expect(e.richiedente).toBe('Richiedente obbligatorio');
    });

    it('rifiuta un codice fiscale con formato errato', () => {
      expect(S.valida(dati({ codiceFiscale: 'ABC123' })).codiceFiscale).toBe('Codice fiscale non valido');
    });

    it('accetta un codice fiscale in minuscolo', () => {
      expect(S.valida(dati({ codiceFiscale: CF_OK.toLowerCase() }))).toEqual({});
    });

    it('accetta undefined senza lanciare', () => {
      expect(Object.keys(S.valida(undefined))).toHaveLength(3);
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
        scadenza: null
      });
      expect(S.crea(dati()).id).toBe(2);
    });

    it('lancia un errore di validazione con code e dettaglio campi', () => {
      let err;
      try {
        S.crea({ oggetto: 'x' });
      } catch (e) {
        err = e;
      }
      expect(err.message).toBe('Dati non validi');
      expect(err.code).toBe('VALIDAZIONE');
      expect(Object.keys(err.errori).sort()).toEqual(['codiceFiscale', 'richiedente']);
      expect(S.tutte()).toHaveLength(0);
    });
  });

  describe('cambiaStato', () => {
    it('BOZZA -> PROTOCOLLATA assegna protocollo, data e scadenza a 30 giorni lavorativi', () => {
      const p = S.crea(dati());
      S.cambiaStato(p.id, 'PROTOCOLLATA');
      expect(p.stato).toBe('PROTOCOLLATA');
      expect(p.numeroProtocollo).toBe('2026/0001');
      expect(p.dataProtocollo).toEqual(new Date(2026, 2, 2));
      expect(p.scadenza).toEqual(new Date(2026, 3, 14)); // vedi scadenze.service.spec
    });

    it('i numeri di protocollo sono progressivi per anno e ripartono a nuovo anno', () => {
      const a = S.crea(dati());
      const b = S.crea(dati());
      S.cambiaStato(a.id, 'PROTOCOLLATA');
      S.cambiaStato(b.id, 'PROTOCOLLATA');
      expect(b.numeroProtocollo).toBe('2026/0002');

      oggi = new Date(2027, 0, 11);
      const c = S.crea(dati());
      S.cambiaStato(c.id, 'PROTOCOLLATA');
      expect(c.numeroProtocollo).toBe('2027/0001');
    });

    it('percorso completo fino ad APPROVATA', () => {
      const p = S.crea(dati());
      S.cambiaStato(p.id, 'PROTOCOLLATA');
      S.cambiaStato(p.id, 'IN_ISTRUTTORIA');
      S.cambiaStato(p.id, 'APPROVATA');
      expect(p.stato).toBe('APPROVATA');
    });

    it('IN_ISTRUTTORIA può finire anche in RESPINTA', () => {
      const p = S.crea(dati());
      S.cambiaStato(p.id, 'PROTOCOLLATA');
      S.cambiaStato(p.id, 'IN_ISTRUTTORIA');
      S.cambiaStato(p.id, 'RESPINTA');
      expect(p.stato).toBe('RESPINTA');
    });

    it('mappa completa delle transizioni consentite', () => {
      expect(S.stati).toEqual(['BOZZA', 'PROTOCOLLATA', 'IN_ISTRUTTORIA', 'APPROVATA', 'RESPINTA', 'ANNULLATA']);
      expect(S.transizioniPossibili('BOZZA')).toEqual(['PROTOCOLLATA', 'ANNULLATA']);
      expect(S.transizioniPossibili('PROTOCOLLATA')).toEqual(['IN_ISTRUTTORIA', 'ANNULLATA']);
      expect(S.transizioniPossibili('IN_ISTRUTTORIA')).toEqual(['APPROVATA', 'RESPINTA']);
    });

    it('rifiuta transizioni non consentite (con messaggio e code)', () => {
      const p = S.crea(dati());
      expect(() => S.cambiaStato(p.id, 'APPROVATA')).toThrow('Transizione non consentita: BOZZA -> APPROVATA');
      try {
        S.cambiaStato(p.id, 'APPROVATA');
      } catch (e) {
        expect(e.code).toBe('TRANSIZIONE');
      }
      expect(p.stato).toBe('BOZZA');
    });

    it('gli stati finali non hanno uscite', () => {
      ['APPROVATA', 'RESPINTA', 'ANNULLATA'].forEach((s) => {
        expect(S.transizioniPossibili(s)).toEqual([]);
      });
    });

    it('una pratica annullata non si può riaprire e non ha avuto protocollo', () => {
      const p = S.crea(dati());
      S.cambiaStato(p.id, 'ANNULLATA');
      expect(() => S.cambiaStato(p.id, 'PROTOCOLLATA')).toThrow();
      expect(p.numeroProtocollo).toBeNull();
    });

    it('lancia NON_TROVATA per un id inesistente', () => {
      try {
        S.cambiaStato(999, 'PROTOCOLLATA');
        throw new Error('non doveva arrivare qui');
      } catch (e) {
        expect(e.code).toBe('NON_TROVATA');
      }
    });

    it('transizioniPossibili restituisce una copia', () => {
      const t = S.transizioniPossibili('BOZZA');
      t.push('X');
      expect(S.transizioniPossibili('BOZZA')).toEqual(['PROTOCOLLATA', 'ANNULLATA']);
    });
  });

  describe('cerca', () => {
    beforeEach(() => {
      S.crea(dati({ oggetto: 'Contributo affitto', richiedente: 'Mario Rossi' }));
      const b = S.crea(dati({ oggetto: 'Permesso edilizio', richiedente: 'Anna Verdi' }));
      S.cambiaStato(b.id, 'PROTOCOLLATA');
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
      expect(S.cerca({ stato: 'PROTOCOLLATA' }).map((p) => p.id)).toEqual([2]);
    });

    it('combina testo e stato', () => {
      expect(S.cerca({ testo: 'affitto', stato: 'PROTOCOLLATA' })).toEqual([]);
    });

    it('il testo di soli spazi non filtra', () => {
      expect(S.cerca({ testo: '   ' })).toHaveLength(2);
    });
  });

  describe('contaPerStato', () => {
    it('restituisce tutti gli stati, anche a zero', () => {
      S.crea(dati());
      const p = S.crea(dati());
      S.cambiaStato(p.id, 'ANNULLATA');
      expect(S.contaPerStato()).toEqual({
        BOZZA: 1,
        PROTOCOLLATA: 0,
        IN_ISTRUTTORIA: 0,
        APPROVATA: 0,
        RESPINTA: 0,
        ANNULLATA: 1
      });
    });
  });
});

/*
 * Gestione in memoria delle pratiche con workflow di stato.
 * BOZZA -> PROTOCOLLATA -> IN_ISTRUTTORIA -> APPROVATA | RESPINTA
 * BOZZA e PROTOCOLLATA possono anche andare in ANNULLATA.
 */
(function () {
  'use strict';

  angular.module('pratiche').service('PraticheService', function (Orologio, ScadenzeService) {
    var self = this;

    var TRANSIZIONI = {
      BOZZA: ['PROTOCOLLATA', 'ANNULLATA'],
      PROTOCOLLATA: ['IN_ISTRUTTORIA', 'ANNULLATA'],
      IN_ISTRUTTORIA: ['APPROVATA', 'RESPINTA'],
      APPROVATA: [],
      RESPINTA: [],
      ANNULLATA: []
    };

    var GIORNI_SCADENZA = 30;
    var CF_REGEX = /^[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]$/;

    var pratiche = [];
    var prossimoId = 1;
    var contatoriProtocollo = {}; // anno -> ultimo numero assegnato

    self.stati = Object.keys(TRANSIZIONI);

    self.reset = function () {
      pratiche = [];
      prossimoId = 1;
      contatoriProtocollo = {};
    };

    self.tutte = function () {
      return pratiche;
    };

    self.trova = function (id) {
      for (var i = 0; i < pratiche.length; i++) {
        if (pratiche[i].id === id) {
          return pratiche[i];
        }
      }
      return null;
    };

    // Ritorna un oggetto { campo: messaggio }; vuoto se i dati sono validi
    self.valida = function (dati) {
      var errori = {};
      dati = dati || {};
      if (!dati.oggetto || !String(dati.oggetto).trim()) {
        errori.oggetto = 'Oggetto obbligatorio';
      }
      if (!dati.richiedente || !String(dati.richiedente).trim()) {
        errori.richiedente = 'Richiedente obbligatorio';
      }
      if (!dati.codiceFiscale) {
        errori.codiceFiscale = 'Codice fiscale obbligatorio';
      } else if (!CF_REGEX.test(String(dati.codiceFiscale).toUpperCase())) {
        errori.codiceFiscale = 'Codice fiscale non valido';
      }
      return errori;
    };

    self.crea = function (dati) {
      var errori = self.valida(dati);
      if (Object.keys(errori).length > 0) {
        var err = new Error('Dati non validi');
        err.code = 'VALIDAZIONE';
        err.errori = errori;
        throw err;
      }
      var pratica = {
        id: prossimoId++,
        oggetto: String(dati.oggetto).trim(),
        richiedente: String(dati.richiedente).trim(),
        codiceFiscale: String(dati.codiceFiscale).toUpperCase(),
        stato: 'BOZZA',
        dataCreazione: Orologio.oggi(),
        numeroProtocollo: null,
        dataProtocollo: null,
        scadenza: null
      };
      pratiche.push(pratica);
      return pratica;
    };

    self.transizioniPossibili = function (stato) {
      return (TRANSIZIONI[stato] || []).slice();
    };

    self.cambiaStato = function (id, nuovoStato) {
      var pratica = self.trova(id);
      if (!pratica) {
        var e1 = new Error('Pratica non trovata');
        e1.code = 'NON_TROVATA';
        throw e1;
      }
      if (TRANSIZIONI[pratica.stato].indexOf(nuovoStato) === -1) {
        var e2 = new Error('Transizione non consentita: ' + pratica.stato + ' -> ' + nuovoStato);
        e2.code = 'TRANSIZIONE';
        throw e2;
      }
      if (nuovoStato === 'PROTOCOLLATA') {
        var oggi = Orologio.oggi();
        var anno = oggi.getFullYear();
        contatoriProtocollo[anno] = (contatoriProtocollo[anno] || 0) + 1;
        var n = String(contatoriProtocollo[anno]);
        while (n.length < 4) {
          n = '0' + n;
        }
        pratica.numeroProtocollo = anno + '/' + n;
        pratica.dataProtocollo = oggi;
        pratica.scadenza = ScadenzeService.aggiungiGiorniLavorativi(oggi, GIORNI_SCADENZA);
      }
      pratica.stato = nuovoStato;
      return pratica;
    };

    // criteri: { testo, stato } entrambi opzionali
    self.cerca = function (criteri) {
      criteri = criteri || {};
      var testo = criteri.testo ? String(criteri.testo).trim().toLowerCase() : '';
      return pratiche.filter(function (p) {
        if (criteri.stato && p.stato !== criteri.stato) {
          return false;
        }
        if (testo) {
          var haystack = (p.oggetto + ' ' + p.richiedente).toLowerCase();
          if (haystack.indexOf(testo) === -1) {
            return false;
          }
        }
        return true;
      });
    };

    self.contaPerStato = function () {
      var conteggi = {};
      self.stati.forEach(function (s) {
        conteggi[s] = 0;
      });
      pratiche.forEach(function (p) {
        conteggi[p.stato]++;
      });
      return conteggi;
    };
  });
})();

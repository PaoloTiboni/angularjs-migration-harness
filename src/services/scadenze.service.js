/*
 * Calcolo scadenze in giorni lavorativi italiani.
 * Esclude sabato, domenica, festività nazionali fisse e Pasquetta.
 */
(function () {
  'use strict';

  angular.module('pratiche').service('ScadenzeService', function () {
    var self = this;

    var FESTIVITA_FISSE = [
      [0, 1],   // Capodanno
      [0, 6],   // Epifania
      [3, 25],  // Liberazione
      [4, 1],   // Festa del lavoro
      [5, 2],   // Festa della Repubblica
      [7, 15],  // Ferragosto
      [10, 1],  // Ognissanti
      [11, 8],  // Immacolata
      [11, 25], // Natale
      [11, 26]  // Santo Stefano
    ];

    // Algoritmo di Meeus/Jones/Butcher per la domenica di Pasqua
    function pasqua(anno) {
      var a = anno % 19;
      var b = Math.floor(anno / 100);
      var c = anno % 100;
      var d = Math.floor(b / 4);
      var e = b % 4;
      var f = Math.floor((b + 8) / 25);
      var g = Math.floor((b - f + 1) / 3);
      var h = (19 * a + b - d - g + 15) % 30;
      var i = Math.floor(c / 4);
      var k = c % 4;
      var l = (32 + 2 * e + 2 * i - h - k) % 7;
      var m = Math.floor((a + 11 * h + 22 * l) / 451);
      var mese = Math.floor((h + l - 7 * m + 114) / 31) - 1; // 0-based
      var giorno = ((h + l - 7 * m + 114) % 31) + 1;
      return new Date(anno, mese, giorno);
    }

    self.eFestivo = function (data) {
      var m = data.getMonth();
      var g = data.getDate();
      for (var i = 0; i < FESTIVITA_FISSE.length; i++) {
        if (FESTIVITA_FISSE[i][0] === m && FESTIVITA_FISSE[i][1] === g) {
          return true;
        }
      }
      var p = pasqua(data.getFullYear());
      var pasquetta = new Date(p.getFullYear(), p.getMonth(), p.getDate() + 1);
      return pasquetta.getMonth() === m && pasquetta.getDate() === g;
    };

    self.eLavorativo = function (data) {
      var dow = data.getDay();
      if (dow === 0 || dow === 6) {
        return false;
      }
      return !self.eFestivo(data);
    };

    self.aggiungiGiorniLavorativi = function (data, n) {
      var corrente = new Date(data.getFullYear(), data.getMonth(), data.getDate());
      var rimasti = n;
      while (rimasti > 0) {
        corrente = new Date(corrente.getFullYear(), corrente.getMonth(), corrente.getDate() + 1);
        if (self.eLavorativo(corrente)) {
          rimasti--;
        }
      }
      return corrente;
    };

    // Differenza in giorni di calendario (scadenza - oggi); negativa se scaduta
    self.giorniRimanenti = function (scadenza, oggi) {
      var MS = 24 * 60 * 60 * 1000;
      var a = Date.UTC(scadenza.getFullYear(), scadenza.getMonth(), scadenza.getDate());
      var b = Date.UTC(oggi.getFullYear(), oggi.getMonth(), oggi.getDate());
      return Math.round((a - b) / MS);
    };
  });
})();

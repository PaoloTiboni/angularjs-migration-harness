/* Trasforma il codice di stato in etichetta leggibile. */
(function () {
  'use strict';

  angular.module('pratiche').filter('statoLabel', function () {
    var ETICHETTE = {
      BOZZA: 'Bozza',
      PROTOCOLLATA: 'Protocollata',
      IN_ISTRUTTORIA: 'In istruttoria',
      APPROVATA: 'Approvata',
      RESPINTA: 'Respinta',
      ANNULLATA: 'Annullata'
    };

    return function (stato) {
      if (!stato) {
        return '';
      }
      return ETICHETTE[stato] || stato;
    };
  });
})();

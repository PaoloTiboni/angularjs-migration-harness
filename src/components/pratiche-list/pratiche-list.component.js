/*
 * <pratiche-list pratiche="..." on-seleziona="...">
 * Lista con filtro testuale e per stato. Usa il template esterno (templateUrl).
 */
(function () {
  'use strict';

  angular.module('pratiche').component('praticheList', {
    templateUrl: 'components/pratiche-list/pratiche-list.html',
    bindings: {
      pratiche: '<',
      onSeleziona: '&'
    },
    controller: function () {
      var ctrl = this;

      ctrl.testo = '';
      ctrl.stato = '';
      ctrl.visibili = [];

      function filtra() {
        var testo = ctrl.testo.trim().toLowerCase();
        ctrl.visibili = (ctrl.pratiche || []).filter(function (p) {
          if (ctrl.stato && p.stato !== ctrl.stato) {
            return false;
          }
          if (testo && (p.oggetto + ' ' + p.richiedente).toLowerCase().indexOf(testo) === -1) {
            return false;
          }
          return true;
        });
      }

      ctrl.$onChanges = function (changes) {
        if (changes.pratiche) {
          filtra();
        }
      };

      ctrl.cambiaFiltro = function () {
        filtra();
      };

      ctrl.seleziona = function (pratica) {
        ctrl.onSeleziona({ pratica: pratica });
      };

      ctrl.resetFiltri = function () {
        ctrl.testo = '';
        ctrl.stato = '';
        filtra();
      };
    }
  });
})();

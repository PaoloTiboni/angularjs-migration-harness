/*
 * <pratica-form on-salva="...">
 * Form di inserimento con validazione tramite PraticheService.
 */
(function () {
  'use strict';

  angular.module('pratiche').component('praticaForm', {
    templateUrl: 'components/pratica-form/pratica-form.html',
    bindings: {
      onSalva: '&'
    },
    controller: function (PraticheService) {
      var ctrl = this;

      function vuoto() {
        return { oggetto: '', richiedente: '', codiceFiscale: '' };
      }

      ctrl.dati = vuoto();
      ctrl.errori = {};
      ctrl.tentato = false;

      ctrl.invia = function () {
        ctrl.tentato = true;
        ctrl.errori = PraticheService.valida(ctrl.dati);
        if (Object.keys(ctrl.errori).length > 0) {
          return false;
        }
        ctrl.onSalva({ dati: angular.copy(ctrl.dati) });
        ctrl.dati = vuoto();
        ctrl.errori = {};
        ctrl.tentato = false;
        return true;
      };
    }
  });
})();

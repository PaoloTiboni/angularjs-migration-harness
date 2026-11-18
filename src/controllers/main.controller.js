/*
 * Controller di pagina in stile legacy: $scope, funzioni sullo scope, $timeout.
 */
(function () {
  'use strict';

  angular.module('pratiche').controller('MainController', function ($scope, $timeout, PraticheService) {
    $scope.pratiche = PraticheService.tutte();
    $scope.selezionata = null;
    $scope.messaggio = null;
    $scope.contatori = PraticheService.contaPerStato();

    function aggiornaContatori() {
      $scope.contatori = PraticheService.contaPerStato();
    }

    function mostraMessaggio(tipo, testo) {
      $scope.messaggio = { tipo: tipo, testo: testo };
      $timeout(function () {
        $scope.messaggio = null;
      }, 3000);
    }

    $scope.salva = function (dati) {
      try {
        var p = PraticheService.crea(dati);
        $scope.pratiche = PraticheService.tutte().slice();
        aggiornaContatori();
        mostraMessaggio('ok', 'Pratica ' + p.id + ' creata');
      } catch (e) {
        mostraMessaggio('errore', e.message);
      }
    };

    $scope.seleziona = function (pratica) {
      $scope.selezionata = pratica;
    };

    $scope.azioniDisponibili = function () {
      if (!$scope.selezionata) {
        return [];
      }
      return PraticheService.transizioniPossibili($scope.selezionata.stato);
    };

    $scope.avanza = function (nuovoStato) {
      if (!$scope.selezionata) {
        return;
      }
      try {
        PraticheService.cambiaStato($scope.selezionata.id, nuovoStato);
        $scope.pratiche = PraticheService.tutte().slice();
        aggiornaContatori();
        mostraMessaggio('ok', 'Stato aggiornato a ' + nuovoStato);
      } catch (e) {
        mostraMessaggio('errore', e.message);
      }
    };
  });
})();

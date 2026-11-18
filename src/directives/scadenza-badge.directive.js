/*
 * <scadenza-badge scadenza="p.scadenza"></scadenza-badge>
 * Direttiva "vecchio stile" con isolated scope, link function e $watch.
 */
(function () {
  'use strict';

  angular.module('pratiche').directive('scadenzaBadge', function (Orologio, ScadenzeService) {
    return {
      restrict: 'E',
      scope: {
        scadenza: '='
      },
      template: '<span class="badge" ng-class="classe">{{testo}}</span>',
      link: function (scope) {
        function aggiorna() {
          if (!scope.scadenza) {
            scope.classe = 'nessuna';
            scope.testo = '—';
            return;
          }
          var giorni = ScadenzeService.giorniRimanenti(scope.scadenza, Orologio.oggi());
          if (giorni < 0) {
            scope.classe = 'scaduta';
            scope.testo = 'Scaduta da ' + Math.abs(giorni) + (Math.abs(giorni) === 1 ? ' giorno' : ' giorni');
          } else if (giorni <= 5) {
            scope.classe = 'in-scadenza';
            scope.testo = giorni === 0 ? 'Scade oggi' : 'Scade tra ' + giorni + (giorni === 1 ? ' giorno' : ' giorni');
          } else {
            scope.classe = 'ok';
            scope.testo = giorni + ' giorni';
          }
        }

        scope.$watch('scadenza', aggiorna);
      }
    };
  });
})();

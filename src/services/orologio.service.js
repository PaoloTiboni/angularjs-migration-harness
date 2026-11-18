/* Wrapper sull'ora corrente: rende il codice testabile (si sostituisce nei test). */
(function () {
  'use strict';

  angular.module('pratiche').factory('Orologio', function () {
    return {
      oggi: function () {
        var d = new Date();
        return new Date(d.getFullYear(), d.getMonth(), d.getDate());
      }
    };
  });
})();

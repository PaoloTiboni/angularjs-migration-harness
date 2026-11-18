/*
 * Carica AngularJS, angular-mocks e i sorgenti dell'app (script globali, in ordine)
 * nell'ambiente jsdom di Jest.
 */
const fs = require('fs');
const path = require('path');

// jQuery prima di Angular: angular.element diventa jQuery (come in molte app legacy)
window.jQuery = window.$ = require('jquery');
require('angular');
// angular-mocks si aggancia a jasmine/mocha: con jest-circus serve un segnaposto
window.jasmine = window.jasmine || {};
require('angular-mocks');

const SRC = path.join(__dirname, '..', 'src');
const ORDINE = [
  'app.js',
  'services/orologio.service.js',
  'services/scadenze.service.js',
  'services/pratiche.service.js',
  'filters/stato-label.filter.js',
  'directives/scadenza-badge.directive.js',
  'components/pratiche-list/pratiche-list.component.js',
  'components/pratica-form/pratica-form.component.js',
  'controllers/main.controller.js'
];

ORDINE.forEach((f) => {
  const codice = fs.readFileSync(path.join(SRC, f), 'utf8');
  // eslint-disable-next-line no-new-func
  new Function(codice).call(window);
});

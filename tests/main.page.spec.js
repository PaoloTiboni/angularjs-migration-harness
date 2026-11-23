const fs = require('fs');
const path = require('path');
const { caricaTemplates } = require('./helpers/templates');

// Test di integrazione della pagina: index.html (senza il tag <body>) + MainController + componenti reali.
describe('pagina Pratiche (index.html + MainController)', () => {
  const CF_OK = 'RSSMRA80A01H501U';
  let scope;
  let $timeout;
  let el;

  const q = (sel) => el.find(sel);
  const digest = () => scope.$digest();

  function scrivi(name, valore) {
    q('input[name="' + name + '"]').val(valore).triggerHandler('input');
  }

  function creaDaForm(oggetto) {
    scrivi('oggetto', oggetto || 'Richiesta contributo');
    scrivi('richiedente', 'Mario Rossi');
    scrivi('codiceFiscale', CF_OK);
    q('form').triggerHandler('submit');
    digest();
  }

  const bottoni = () => q('.dettaglio button').toArray().map((b) => b.textContent.trim());

  beforeEach(() => {
    angular.mock.module('pratiche', ($provide) => {
      $provide.value('Orologio', { oggi: () => new Date(2026, 2, 2) });
    });
    angular.mock.inject(($compile, $rootScope, _$timeout_, $templateCache) => {
      $timeout = _$timeout_;
      caricaTemplates($templateCache);
      const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.html'), 'utf8');
      const body = new DOMParser().parseFromString(html, 'text/html').body.innerHTML;
      scope = $rootScope.$new();
      el = $compile('<div ng-controller="MainController">' + body + '</div>')(scope);
      scope.$digest();
    });
  });

  it('stato iniziale: nessun messaggio, nessun dettaglio, lista vuota', () => {
    expect(q('.messaggio')).toHaveLength(0);
    expect(q('.dettaglio')).toHaveLength(0);
    expect(q('p.vuoto').text()).toBe('Nessuna pratica');
  });

  it('compilando il form compare la pratica in lista e un messaggio ok', () => {
    creaDaForm('Richiesta contributo');
    expect(q('li')).toHaveLength(1);
    expect(q('li .oggetto').text()).toBe('Richiesta contributo');
    expect(q('li .stato').text()).toBe('Bozza');
    expect(q('.messaggio').text()).toBe('Pratica 1 creata');
    expect(q('.messaggio').hasClass('msg-ok')).toBe(true);
    expect(q('.messaggio').hasClass('msg-errore')).toBe(false);
  });

  it('il messaggio sparisce dopo 3 secondi', () => {
    creaDaForm();
    $timeout.flush(2999);
    expect(q('.messaggio')).toHaveLength(1);
    $timeout.flush(1);
    expect(q('.messaggio')).toHaveLength(0);
  });

  it('cliccando una riga compare il dettaglio con le azioni possibili (etichette leggibili)', () => {
    creaDaForm('Richiesta contributo');
    q('li').eq(0).triggerHandler('click');
    expect(q('.dettaglio h2').text()).toBe('Richiesta contributo');
    expect(bottoni()).toEqual(['Protocollata', 'Annullata']);
  });

  it('avanzare di stato aggiorna lista, protocollo, bottoni e messaggio (con il codice, non l\'etichetta)', () => {
    creaDaForm();
    q('li').eq(0).triggerHandler('click');
    q('.dettaglio button').eq(0).triggerHandler('click');
    expect(q('li .stato').text()).toBe('Protocollata');
    expect(q('li .protocollo').text()).toBe('2026/0001');
    expect(bottoni()).toEqual(['In istruttoria', 'Annullata']);
    expect(q('.messaggio').text()).toBe('Stato aggiornato a PROTOCOLLATA');
  });

  it('il form invalido non crea nulla e non mostra messaggi di pagina', () => {
    q('form').triggerHandler('submit');
    digest();
    expect(q('li')).toHaveLength(0);
    expect(q('.messaggio')).toHaveLength(0);
    expect(q('.errore').length).toBeGreaterThan(0);
  });

  it('una transizione non consentita mostra un messaggio di errore', () => {
    creaDaForm();
    q('li').eq(0).triggerHandler('click');
    scope.$$childHead.avanza('APPROVATA');
    digest();
    expect(q('.messaggio').text()).toBe('Transizione non consentita: BOZZA -> APPROVATA');
    expect(q('.messaggio').hasClass('msg-errore')).toBe(true);
    expect(q('li .stato').text()).toBe('Bozza');
  });

  it('QUIRK: i timer dei messaggi non si annullano; il primo cancella in anticipo il secondo messaggio', () => {
    creaDaForm('Prima');
    $timeout.flush(2000);
    creaDaForm('Seconda');
    expect(q('.messaggio').text()).toBe('Pratica 2 creata');
    $timeout.flush(1000); // t=3000: scade il timer del PRIMO messaggio
    expect(q('.messaggio')).toHaveLength(0); // il secondo ha vissuto solo 1 secondo
    $timeout.flush(2000); // scade il timer del secondo: nessun effetto visibile
    expect(q('.messaggio')).toHaveLength(0);
  });
});

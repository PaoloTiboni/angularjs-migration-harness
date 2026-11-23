const { caricaTemplates } = require('./helpers/templates');

describe('componente praticaForm', () => {
  let $compile;
  let $rootScope;
  let scope;
  let el;

  const CF_OK = 'RSSMRA80A01H501U';

  const compila = () => {
    scope = $rootScope.$new();
    scope.salvati = [];
    el = $compile('<pratica-form on-salva="salvati.push(dati)"></pratica-form>')(scope);
    scope.$digest();
  };

  const scrivi = (name, valore) => {
    el.find('input[name="' + name + '"]').val(valore).triggerHandler('input');
  };

  const invia = () => {
    el.find('form').triggerHandler('submit');
    scope.$digest();
  };

  beforeEach(() => {
    angular.mock.module('pratiche');
    angular.mock.inject((_$compile_, _$rootScope_, $templateCache) => {
      $compile = _$compile_;
      $rootScope = _$rootScope_;
      caricaTemplates($templateCache);
    });
    compila();
  });

  it('all\'inizio non mostra errori', () => {
    expect(el.find('.errore')).toHaveLength(0);
  });

  it('inviando il form vuoto mostra gli errori e non salva', () => {
    invia();
    expect(el.find('.errore-oggetto').text()).toBe('Oggetto obbligatorio');
    expect(el.find('.errore-richiedente').text()).toBe('Richiedente obbligatorio');
    expect(el.find('.errore-cf').text()).toBe('Codice fiscale obbligatorio');
    expect(scope.salvati).toHaveLength(0);
  });

  it('segnala un codice fiscale non valido', () => {
    scrivi('oggetto', 'Titolo');
    scrivi('richiedente', 'Mario Rossi');
    scrivi('codiceFiscale', 'ABC');
    invia();
    expect(el.find('.errore')).toHaveLength(1);
    expect(el.find('.errore-cf').text()).toBe('Codice fiscale non valido');
    expect(scope.salvati).toHaveLength(0);
  });

  it('con dati validi chiama on-salva con una copia dei dati e azzera il form', () => {
    scrivi('oggetto', 'Titolo');
    scrivi('richiedente', 'Mario Rossi');
    scrivi('codiceFiscale', CF_OK);
    invia();

    expect(scope.salvati).toEqual([
      { oggetto: 'Titolo', richiedente: 'Mario Rossi', codiceFiscale: CF_OK }
    ]);
    expect(el.find('input[name="oggetto"]').val()).toBe('');
    expect(el.find('.errore')).toHaveLength(0);
  });

  it('dopo un errore e una correzione gli errori spariscono', () => {
    invia();
    expect(el.find('.errore').length).toBeGreaterThan(0);
    scrivi('oggetto', 'Titolo');
    scrivi('richiedente', 'Mario Rossi');
    scrivi('codiceFiscale', CF_OK);
    invia();
    expect(el.find('.errore')).toHaveLength(0);
    expect(scope.salvati).toHaveLength(1);
  });

  it('gli errori compaiono solo dopo il primo tentativo di invio, non mentre si scrive', () => {
    scrivi('oggetto', 'x');
    scope.$digest();
    expect(el.find('.errore')).toHaveLength(0);
  });

  it('TRAPPOLA ng-trim: gli spazi ai bordi digitati dall\'utente vengono tolti prima di validare ed emettere', () => {
    scrivi('oggetto', '  Titolo  ');
    scrivi('richiedente', ' Mario Rossi ');
    scrivi('codiceFiscale', '  ' + CF_OK + '  ');
    invia();
    expect(el.find('.errore')).toHaveLength(0);
    expect(scope.salvati).toEqual([
      { oggetto: 'Titolo', richiedente: 'Mario Rossi', codiceFiscale: CF_OK }
    ]);
  });
});

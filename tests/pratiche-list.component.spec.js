const { caricaTemplates } = require('./helpers/templates');

describe('componente praticheList', () => {
  let $compile;
  let $rootScope;
  let scope;
  let el;

  const P = (id, oggetto, richiedente, stato, extra) =>
    Object.assign({ id, oggetto, richiedente, stato, numeroProtocollo: null, scadenza: null }, extra);

  beforeEach(() => {
    angular.mock.module('pratiche', ($provide) => {
      $provide.value('Orologio', { oggi: () => new Date(2026, 2, 10) });
    });
    angular.mock.inject((_$compile_, _$rootScope_, $templateCache) => {
      $compile = _$compile_;
      $rootScope = _$rootScope_;
      caricaTemplates($templateCache);
    });
    scope = $rootScope.$new();
    scope.lista = [
      P(1, 'Contributo affitto', 'Mario Rossi', 'BOZZA'),
      P(2, 'Permesso edilizio', 'Anna Verdi', 'PROTOCOLLATA', {
        numeroProtocollo: '2026/0001',
        scadenza: new Date(2026, 2, 13)
      }),
      P(3, 'Passo carraio', 'Luca Bianchi', 'APPROVATA')
    ];
    scope.selezionate = [];
    el = $compile(
      '<pratiche-list pratiche="lista" on-seleziona="selezionate.push(pratica)"></pratiche-list>'
    )(scope);
    scope.$digest();
  });

  const righe = () => el.find('li');

  it('mostra tutte le pratiche con oggetto, richiedente e stato leggibile', () => {
    expect(righe()).toHaveLength(3);
    const prima = righe().eq(0);
    expect(prima.find('.oggetto').text()).toBe('Contributo affitto');
    expect(prima.find('.richiedente').text()).toBe('Mario Rossi');
    expect(prima.find('.stato').text()).toBe('Bozza');
    expect(prima.find('.stato').hasClass('stato-BOZZA')).toBe(true);
  });

  it('mostra il protocollo oppure un trattino', () => {
    expect(righe().eq(0).find('.protocollo').text()).toBe('—');
    expect(righe().eq(1).find('.protocollo').text()).toBe('2026/0001');
  });

  it('include il badge di scadenza', () => {
    expect(righe().eq(1).find('scadenza-badge').text().trim()).toBe('Scade tra 3 giorni');
    expect(righe().eq(0).find('scadenza-badge').text().trim()).toBe('—');
  });

  it('filtra per testo (oggetto o richiedente)', () => {
    const input = el.find('input');
    input.val('verdi').triggerHandler('input');
    scope.$digest();
    expect(righe()).toHaveLength(1);
    expect(righe().eq(0).find('.oggetto').text()).toBe('Permesso edilizio');
  });

  it('filtra per stato', () => {
    const select = el.find('select');
    select.val('APPROVATA').triggerHandler('change');
    scope.$digest();
    expect(righe()).toHaveLength(1);
    expect(righe().eq(0).find('.oggetto').text()).toBe('Passo carraio');
  });

  it('mostra "Nessuna pratica" quando il filtro non trova nulla', () => {
    el.find('input').val('zzz').triggerHandler('input');
    scope.$digest();
    expect(righe()).toHaveLength(0);
    expect(el.find('p').text()).toBe('Nessuna pratica');
  });

  it('"Azzera" ripristina i filtri e la lista completa', () => {
    el.find('input').val('verdi').triggerHandler('input');
    scope.$digest();
    el.find('button').triggerHandler('click');
    scope.$digest();
    expect(righe()).toHaveLength(3);
    expect(el.find('input').val()).toBe('');
  });

  it('il click su una riga chiama on-seleziona con la pratica', () => {
    righe().eq(1).triggerHandler('click');
    expect(scope.selezionate).toHaveLength(1);
    expect(scope.selezionate[0].id).toBe(2);
  });

  it('si aggiorna quando il binding "pratiche" cambia riferimento (le $onChanges)', () => {
    scope.lista = scope.lista.concat([P(4, 'Nuova', 'Zeta', 'BOZZA')]);
    scope.$digest();
    expect(righe()).toHaveLength(4);
  });

  it('NON si aggiorna se si muta l\'array in place (binding one-way senza watch profondo)', () => {
    scope.lista.push(P(4, 'Nuova', 'Zeta', 'BOZZA'));
    scope.$digest();
    expect(righe()).toHaveLength(3);
  });

  it('il filtro attivo viene riapplicato quando arriva una nuova lista', () => {
    el.find('input').val('verdi').triggerHandler('input');
    scope.$digest();
    scope.lista = scope.lista.concat([P(4, 'Altro permesso', 'Anna Verdi', 'BOZZA')]);
    scope.$digest();
    expect(righe()).toHaveLength(2);
  });
});

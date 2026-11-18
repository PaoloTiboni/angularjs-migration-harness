describe('direttiva scadenzaBadge', () => {
  let $compile;
  let $rootScope;

  beforeEach(() => {
    angular.mock.module('pratiche', ($provide) => {
      $provide.value('Orologio', { oggi: () => new Date(2026, 2, 10) });
    });
    angular.mock.inject((_$compile_, _$rootScope_) => {
      $compile = _$compile_;
      $rootScope = _$rootScope_;
    });
  });

  function render(scadenza) {
    const scope = $rootScope.$new();
    scope.s = scadenza;
    const el = $compile('<scadenza-badge scadenza="s"></scadenza-badge>')(scope);
    scope.$digest();
    return { el, scope, badge: el.find('span') };
  }

  it('senza scadenza mostra un trattino e la classe "nessuna"', () => {
    const { badge } = render(null);
    expect(badge.text()).toBe('—');
    expect(badge.hasClass('nessuna')).toBe(true);
  });

  it('più di 5 giorni: classe "ok" e testo "N giorni"', () => {
    const { badge } = render(new Date(2026, 2, 20));
    expect(badge.text()).toBe('10 giorni');
    expect(badge.hasClass('ok')).toBe(true);
  });

  it('esattamente 6 giorni è ancora "ok"', () => {
    const { badge } = render(new Date(2026, 2, 16));
    expect(badge.hasClass('ok')).toBe(true);
    expect(badge.hasClass('in-scadenza')).toBe(false);
  });

  it('5 giorni o meno: "in-scadenza"', () => {
    const { badge } = render(new Date(2026, 2, 15));
    expect(badge.text()).toBe('Scade tra 5 giorni');
    expect(badge.hasClass('in-scadenza')).toBe(true);
  });

  it('1 giorno usa il singolare', () => {
    expect(render(new Date(2026, 2, 11)).badge.text()).toBe('Scade tra 1 giorno');
  });

  it('oggi: "Scade oggi"', () => {
    const { badge } = render(new Date(2026, 2, 10));
    expect(badge.text()).toBe('Scade oggi');
    expect(badge.hasClass('in-scadenza')).toBe(true);
  });

  it('scaduta: classe "scaduta" con singolare/plurale', () => {
    const ieri = render(new Date(2026, 2, 9));
    expect(ieri.badge.text()).toBe('Scaduta da 1 giorno');
    expect(ieri.badge.hasClass('scaduta')).toBe(true);
    expect(render(new Date(2026, 2, 3)).badge.text()).toBe('Scaduta da 7 giorni');
  });

  it('si aggiorna quando cambia la scadenza (watch)', () => {
    const { scope, badge } = render(new Date(2026, 2, 20));
    expect(badge.hasClass('ok')).toBe(true);
    scope.s = new Date(2026, 2, 1);
    scope.$digest();
    expect(badge.hasClass('scaduta')).toBe(true);
    expect(badge.hasClass('ok')).toBe(false);
  });
});

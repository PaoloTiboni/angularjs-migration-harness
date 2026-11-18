const contratto = require('../contracts/scadenza-badge.cases.json');

const toDate = (a) => (a ? new Date(a[0], a[1], a[2]) : null);

describe('direttiva scadenzaBadge', () => {
  let $compile;
  let $rootScope;
  let oggi;

  beforeEach(() => {
    oggi = toDate(contratto.oggi);
    angular.mock.module('pratiche', ($provide) => {
      $provide.value('Orologio', { oggi: () => new Date(oggi.getTime()) });
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

  describe('contratto condiviso con la versione Angular', () => {
    contratto.casi.forEach((caso) => {
      it(caso.nome, () => {
        const { badge } = render(toDate(caso.scadenza));
        expect(badge.text()).toBe(caso.testo);
        expect(badge.hasClass(caso.classe)).toBe(true);
        expect(badge.hasClass('badge')).toBe(true);
      });
    });

    it('le classi di stato sono mutuamente esclusive', () => {
      const STATI = ['nessuna', 'ok', 'in-scadenza', 'scaduta'];
      contratto.casi.forEach((caso) => {
        const { badge } = render(toDate(caso.scadenza));
        const attive = STATI.filter((c) => badge.hasClass(c));
        expect(attive).toEqual([caso.classe]);
      });
    });
  });

  describe('comportamento specifico della direttiva legacy', () => {
    it('si aggiorna quando cambia la scadenza (watch)', () => {
      const { scope, badge } = render(new Date(2026, 2, 20));
      expect(badge.hasClass('ok')).toBe(true);
      scope.s = new Date(2026, 2, 1);
      scope.$digest();
      expect(badge.hasClass('scaduta')).toBe(true);
      expect(badge.hasClass('ok')).toBe(false);
    });

    it('torna a "nessuna" se la scadenza viene azzerata', () => {
      const { scope, badge } = render(new Date(2026, 2, 20));
      scope.s = null;
      scope.$digest();
      expect(badge.text()).toBe('—');
      expect(badge.hasClass('nessuna')).toBe(true);
    });

    it('QUIRK: non ricalcola se cambia solo l\'ora (legge Orologio solo al cambio di scadenza)', () => {
      const { scope, badge } = render(new Date(2026, 2, 20));
      expect(badge.text()).toBe('10 giorni');
      oggi = new Date(2026, 2, 19); // passano 9 giorni
      scope.$digest();
      expect(badge.text()).toBe('10 giorni');
    });
  });
});

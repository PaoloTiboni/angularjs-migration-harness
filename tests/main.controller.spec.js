describe('MainController', () => {
  let $scope;
  let $timeout;
  let Pratiche;
  const CF_OK = 'RSSMRA80A01H501U';
  const dati = (extra) => Object.assign(
    { oggetto: 'Richiesta', richiedente: 'Mario Rossi', codiceFiscale: CF_OK },
    extra
  );

  beforeEach(() => {
    angular.mock.module('pratiche', ($provide) => {
      $provide.value('Orologio', { oggi: () => new Date(2026, 2, 2) });
    });
    angular.mock.inject(($controller, $rootScope, _$timeout_, PraticheService) => {
      Pratiche = PraticheService;
      Pratiche.reset();
      $timeout = _$timeout_;
      $scope = $rootScope.$new();
      $controller('MainController', { $scope });
    });
  });

  it('stato iniziale: nessuna pratica, nessuna selezione, contatori a zero', () => {
    expect($scope.pratiche).toEqual([]);
    expect($scope.selezionata).toBeNull();
    expect($scope.messaggio).toBeNull();
    expect($scope.contatori.BOZZA).toBe(0);
  });

  describe('salva', () => {
    it('crea la pratica, aggiorna lista e contatori e mostra un messaggio ok', () => {
      $scope.salva(dati());
      expect($scope.pratiche).toHaveLength(1);
      expect($scope.contatori.BOZZA).toBe(1);
      expect($scope.messaggio).toEqual({ tipo: 'ok', testo: 'Pratica 1 creata' });
    });

    it('la lista è un nuovo array a ogni salvataggio (serve al binding one-way del componente)', () => {
      const prima = $scope.pratiche;
      $scope.salva(dati());
      expect($scope.pratiche).not.toBe(prima);
    });

    it('con dati non validi mostra un messaggio di errore e non crea nulla', () => {
      $scope.salva({});
      expect($scope.pratiche).toHaveLength(0);
      expect($scope.messaggio).toEqual({ tipo: 'errore', testo: 'Dati non validi' });
    });

    it('il messaggio sparisce dopo 3 secondi', () => {
      $scope.salva(dati());
      $timeout.flush(2999);
      expect($scope.messaggio).not.toBeNull();
      $timeout.flush(1);
      expect($scope.messaggio).toBeNull();
    });
  });

  describe('selezione e avanzamento', () => {
    beforeEach(() => {
      $scope.salva(dati());
      $timeout.flush();
      $scope.seleziona($scope.pratiche[0]);
    });

    it('azioniDisponibili riflette le transizioni dello stato corrente', () => {
      expect($scope.azioniDisponibili()).toEqual(['PROTOCOLLATA', 'ANNULLATA']);
    });

    it('azioniDisponibili è vuoto senza selezione', () => {
      $scope.seleziona(null);
      expect($scope.azioniDisponibili()).toEqual([]);
    });

    it('avanza cambia stato, aggiorna i contatori e mostra il messaggio', () => {
      $scope.avanza('PROTOCOLLATA');
      expect($scope.selezionata.stato).toBe('PROTOCOLLATA');
      expect($scope.contatori.PROTOCOLLATA).toBe(1);
      expect($scope.contatori.BOZZA).toBe(0);
      expect($scope.messaggio).toEqual({ tipo: 'ok', testo: 'Stato aggiornato a PROTOCOLLATA' });
    });

    it('avanza con transizione non consentita mostra l\'errore e lascia lo stato', () => {
      $scope.avanza('APPROVATA');
      expect($scope.selezionata.stato).toBe('BOZZA');
      expect($scope.messaggio.tipo).toBe('errore');
      expect($scope.messaggio.testo).toBe('Transizione non consentita: BOZZA -> APPROVATA');
    });

    it('avanza senza selezione non fa nulla', () => {
      $scope.seleziona(null);
      $scope.avanza('PROTOCOLLATA');
      expect($scope.messaggio).toBeNull();
      expect($scope.contatori.PROTOCOLLATA).toBe(0);
    });
  });
});

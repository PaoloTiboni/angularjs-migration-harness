describe('filtro statoLabel', () => {
  let statoLabel;

  beforeEach(() => {
    angular.mock.module('pratiche');
    angular.mock.inject(($filter) => {
      statoLabel = $filter('statoLabel');
    });
  });

  it('traduce tutti gli stati noti', () => {
    expect(statoLabel('BOZZA')).toBe('Bozza');
    expect(statoLabel('PROTOCOLLATA')).toBe('Protocollata');
    expect(statoLabel('IN_ISTRUTTORIA')).toBe('In istruttoria');
    expect(statoLabel('APPROVATA')).toBe('Approvata');
    expect(statoLabel('RESPINTA')).toBe('Respinta');
    expect(statoLabel('ANNULLATA')).toBe('Annullata');
  });

  it('restituisce stringa vuota per valori falsy', () => {
    expect(statoLabel(undefined)).toBe('');
    expect(statoLabel(null)).toBe('');
    expect(statoLabel('')).toBe('');
  });

  it('restituisce il valore originale per stati sconosciuti', () => {
    expect(statoLabel('FOO')).toBe('FOO');
  });

  it('QUIRK (bug latente, non corretto): per chiavi di Object.prototype restituisce la funzione ereditata', () => {
    // ETICHETTE[stato] || stato: 'constructor' trova Object.prototype.constructor (truthy)
    expect(typeof statoLabel('constructor')).toBe('function');
    expect(typeof statoLabel('toString')).toBe('function');
  });
});

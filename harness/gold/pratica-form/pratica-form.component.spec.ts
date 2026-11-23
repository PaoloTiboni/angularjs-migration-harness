import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PraticaFormComponent } from './pratica-form.component';

// Gold spec portato dal componente AngularJS praticaForm.
// Interagisce solo via DOM e API pubblica (output "salva").

const CF_OK = 'RSSMRA80A01H501U';

describe('PraticaFormComponent (gold, portato da AngularJS)', () => {
  let fixture: ComponentFixture<PraticaFormComponent>;
  let salvati: unknown[];

  const root = () => fixture.nativeElement as HTMLElement;
  const input = (name: string) => root().querySelector('input[name="' + name + '"]') as HTMLInputElement;
  const errori = () => root().querySelectorAll('.errore');
  const testo = (sel: string) => root().querySelector(sel)?.textContent?.trim();

  async function stabile() {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function scrivi(name: string, valore: string) {
    input(name).value = valore;
    input(name).dispatchEvent(new Event('input'));
    await stabile();
  }

  async function invia() {
    (root().querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    await stabile();
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [PraticaFormComponent] });
    fixture = TestBed.createComponent(PraticaFormComponent);
    salvati = [];
    fixture.componentInstance.salva.subscribe((d: unknown) => salvati.push(d));
    await stabile();
  });

  it('all\'inizio non mostra errori', () => {
    expect(errori()).toHaveLength(0);
  });

  it('inviando il form vuoto mostra gli errori e non emette', async () => {
    await invia();
    expect(testo('.errore-oggetto')).toBe('Oggetto obbligatorio');
    expect(testo('.errore-richiedente')).toBe('Richiedente obbligatorio');
    expect(testo('.errore-cf')).toBe('Codice fiscale obbligatorio');
    expect(salvati).toHaveLength(0);
  });

  it('segnala un codice fiscale non valido', async () => {
    await scrivi('oggetto', 'Titolo');
    await scrivi('richiedente', 'Mario Rossi');
    await scrivi('codiceFiscale', 'ABC');
    await invia();
    expect(errori()).toHaveLength(1);
    expect(testo('.errore-cf')).toBe('Codice fiscale non valido');
    expect(salvati).toHaveLength(0);
  });

  it('con dati validi emette una copia dei dati e azzera il form', async () => {
    await scrivi('oggetto', 'Titolo');
    await scrivi('richiedente', 'Mario Rossi');
    await scrivi('codiceFiscale', CF_OK);
    await invia();

    expect(salvati).toEqual([{ oggetto: 'Titolo', richiedente: 'Mario Rossi', codiceFiscale: CF_OK }]);
    expect(input('oggetto').value).toBe('');
    expect(input('richiedente').value).toBe('');
    expect(input('codiceFiscale').value).toBe('');
    expect(errori()).toHaveLength(0);
  });

  it('dopo un errore e una correzione gli errori spariscono', async () => {
    await invia();
    expect(errori().length).toBeGreaterThan(0);
    await scrivi('oggetto', 'Titolo');
    await scrivi('richiedente', 'Mario Rossi');
    await scrivi('codiceFiscale', CF_OK);
    await invia();
    expect(errori()).toHaveLength(0);
    expect(salvati).toHaveLength(1);
  });

  it('gli errori compaiono solo dopo il primo tentativo di invio, non mentre si scrive', async () => {
    await scrivi('oggetto', 'x');
    expect(errori()).toHaveLength(0);
  });

  it('TRAPPOLA ng-trim: gli spazi ai bordi digitati dall\'utente vengono tolti prima di validare ed emettere', async () => {
    await scrivi('oggetto', '  Titolo  ');
    await scrivi('richiedente', ' Mario Rossi ');
    await scrivi('codiceFiscale', '  ' + CF_OK + '  ');
    await invia();
    expect(errori()).toHaveLength(0);
    expect(salvati).toEqual([{ oggetto: 'Titolo', richiedente: 'Mario Rossi', codiceFiscale: CF_OK }]);
  });
});

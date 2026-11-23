import { ComponentFixture, TestBed, fakeAsync, flush, flushMicrotasks, tick } from '@angular/core/testing';

import { Orologio } from '../services/orologio.service';
import { PaginaPraticheComponent } from './pagina-pratiche.component';

// Gold spec portato da MainController + index.html (tests/main.controller.spec.js e tests/main.page.spec.js).
// Contratto: API pubblica del componente + DOM. Le proprietà possono essere valori semplici o signal.

const CF_OK = 'RSSMRA80A01H501U';
const dati = (extra: Record<string, unknown> = {}) =>
  ({ oggetto: 'Richiesta', richiedente: 'Mario Rossi', codiceFiscale: CF_OK, ...extra }) as never;

/* eslint-disable @typescript-eslint/no-explicit-any */
const leggi = (c: any, chiave: string) => (typeof c[chiave] === 'function' ? c[chiave]() : c[chiave]);

describe('PaginaPraticheComponent (gold, portato da MainController + index.html)', () => {
  let fixture: ComponentFixture<PaginaPraticheComponent>;

  const comp = () => fixture.componentInstance as any;
  const root = () => fixture.nativeElement as HTMLElement;
  const $ = (sel: string) => root().querySelector(sel) as HTMLElement | null;
  const $$ = (sel: string) => Array.from(root().querySelectorAll(sel)) as HTMLElement[];
  const bottoni = () => $$('.dettaglio button').map((b) => b.textContent?.trim());

  // NB: dentro fakeAsync il tempo è sotto controllo. fixture.whenStable() aspetterebbe anche il timer
  // da 3 secondi dei messaggi, facendoli sparire prima delle asserzioni.
  function stabile() {
    fixture.detectChanges();
    flushMicrotasks(); // le scritture asincrone di ngModel
    fixture.detectChanges();
  }

  function scrivi(name: string, valore: string) {
    const input = $('input[name="' + name + '"]') as HTMLInputElement;
    input.value = valore;
    input.dispatchEvent(new Event('input'));
    stabile();
  }

  function creaDaForm(oggetto = 'Richiesta contributo') {
    scrivi('oggetto', oggetto);
    scrivi('richiedente', 'Mario Rossi');
    scrivi('codiceFiscale', CF_OK);
    $('form')!.dispatchEvent(new Event('submit'));
    stabile();
  }

  /** Test in fakeAsync; a fine test si svuotano i timer rimasti (i messaggi da 3s). */
  const prova = (nome: string, fn: () => void) =>
    it(
      nome,
      fakeAsync(() => {
        fn();
        flush();
      }),
    );

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [PaginaPraticheComponent],
      providers: [{ provide: Orologio, useValue: { oggi: () => new Date(2026, 2, 2) } }],
    });
    fixture = TestBed.createComponent(PaginaPraticheComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  describe('stato iniziale', () => {
    it('nessun messaggio, nessun dettaglio, lista vuota', () => {
      expect($('.messaggio')).toBeNull();
      expect($('.dettaglio')).toBeNull();
      expect($('p.vuoto')?.textContent?.trim()).toBe('Nessuna pratica');
    });

    it('espone selezionata null, messaggio null e contatori a zero', () => {
      expect(leggi(comp(), 'selezionata')).toBeNull();
      expect(leggi(comp(), 'messaggio')).toBeNull();
      expect(leggi(comp(), 'contatori').BOZZA).toBe(0);
    });
  });

  describe('salva', () => {
    prova('compilando il form compare la pratica in lista, il messaggio ok e il contatore sale', () => {
      creaDaForm('Richiesta contributo');
      expect($$('li')).toHaveLength(1);
      expect($('li .oggetto')?.textContent?.trim()).toBe('Richiesta contributo');
      expect($('li .stato')?.textContent?.trim()).toBe('Bozza');
      expect($('.messaggio')?.textContent?.trim()).toBe('Pratica 1 creata');
      expect($('.messaggio')?.classList.contains('msg-ok')).toBe(true);
      expect($('.messaggio')?.classList.contains('msg-errore')).toBe(false);
      expect(leggi(comp(), 'contatori').BOZZA).toBe(1);
    });

    prova('più pratiche create di seguito compaiono tutte (la lista riceve un nuovo array a ogni salvataggio)', () => {
      creaDaForm('Prima');
      creaDaForm('Seconda');
      expect($$('li')).toHaveLength(2);
      expect($$('li .oggetto').map((e) => e.textContent?.trim())).toEqual(['Prima', 'Seconda']);
    });

    prova('il form invalido non crea nulla e non mostra messaggi di pagina', () => {
      $('form')!.dispatchEvent(new Event('submit'));
      stabile();
      expect($$('li')).toHaveLength(0);
      expect($('.messaggio')).toBeNull();
      expect($$('.errore').length).toBeGreaterThan(0);
    });

    prova('salva con dati non validi (chiamata diretta) mostra un messaggio di errore e non crea nulla', () => {
      comp().salva({});
      stabile();
      expect($('.messaggio')?.textContent?.trim()).toBe('Dati non validi');
      expect($('.messaggio')?.classList.contains('msg-errore')).toBe(true);
      expect($$('li')).toHaveLength(0);
      expect(leggi(comp(), 'messaggio')).toEqual({ tipo: 'errore', testo: 'Dati non validi' });
    });
  });

  describe('selezione e avanzamento', () => {
    /** Crea una pratica dal form e la seleziona. Da chiamare dentro un test fakeAsync. */
    function conSelezione() {
      creaDaForm('Richiesta contributo');
      ($$('li')[0] as HTMLElement).click();
      stabile();
    }

    prova('il click su una riga mostra il dettaglio con le azioni possibili (etichette leggibili)', () => {
      conSelezione();
      expect($('.dettaglio h2')?.textContent?.trim()).toBe('Richiesta contributo');
      expect(bottoni()).toEqual(['Protocollata', 'Annullata']);
      expect(comp().azioniDisponibili()).toEqual(['PROTOCOLLATA', 'ANNULLATA']);
    });

    prova('avanzare aggiorna lista, protocollo, bottoni e messaggio (con il codice, non l\'etichetta)', () => {
      conSelezione();
      ($$('.dettaglio button')[0] as HTMLElement).click();
      stabile();
      expect($('li .stato')?.textContent?.trim()).toBe('Protocollata');
      expect($('li .protocollo')?.textContent?.trim()).toBe('2026/0001');
      expect(bottoni()).toEqual(['In istruttoria', 'Annullata']);
      expect($('.messaggio')?.textContent?.trim()).toBe('Stato aggiornato a PROTOCOLLATA');
      expect(leggi(comp(), 'contatori')).toMatchObject({ BOZZA: 0, PROTOCOLLATA: 1 });
    });

    prova('una transizione non consentita mostra l\'errore e lascia lo stato', () => {
      conSelezione();
      comp().avanza('APPROVATA');
      stabile();
      expect($('.messaggio')?.textContent?.trim()).toBe('Transizione non consentita: BOZZA -> APPROVATA');
      expect($('.messaggio')?.classList.contains('msg-errore')).toBe(true);
      expect($('li .stato')?.textContent?.trim()).toBe('Bozza');
    });

    prova('avanza senza selezione non fa nulla (nemmeno un messaggio)', () => {
      conSelezione();
      comp().seleziona(null);
      stabile();
      expect($('.dettaglio')).toBeNull();
      comp().avanza('PROTOCOLLATA');
      stabile();
      expect(leggi(comp(), 'contatori').PROTOCOLLATA).toBe(0);
      expect($('.messaggio')?.textContent?.trim()).toBe('Pratica 1 creata'); // quello di prima, non uno nuovo
    });

    prova('azioniDisponibili è vuoto senza selezione', () => {
      conSelezione();
      comp().seleziona(null);
      expect(comp().azioniDisponibili()).toEqual([]);
    });
  });

  describe('timer dei messaggi', () => {
    prova('nel DOM il messaggio resta per 3 secondi e poi sparisce', () => {
      creaDaForm();
      tick(2999);
      fixture.detectChanges();
      expect($('.messaggio')).not.toBeNull();
      tick(1);
      fixture.detectChanges();
      expect($('.messaggio')).toBeNull();
    });

    it('il messaggio sparisce dopo esattamente 3 secondi', fakeAsync(() => {
      comp().salva(dati());
      expect(leggi(comp(), 'messaggio')).toEqual({ tipo: 'ok', testo: 'Pratica 1 creata' });
      tick(2999);
      expect(leggi(comp(), 'messaggio')).not.toBeNull();
      tick(1);
      expect(leggi(comp(), 'messaggio')).toBeNull();
      flush();
    }));

    it('QUIRK preservato: i timer non si annullano; il primo cancella in anticipo il secondo messaggio', fakeAsync(() => {
      comp().salva(dati());
      tick(2000);
      comp().salva(dati());
      expect(leggi(comp(), 'messaggio')).toEqual({ tipo: 'ok', testo: 'Pratica 2 creata' });
      tick(1000); // t=3000: scade il timer del PRIMO messaggio
      expect(leggi(comp(), 'messaggio')).toBeNull(); // il secondo ha vissuto solo 1 secondo
      tick(2000); // scade il timer del secondo: nessun effetto visibile
      expect(leggi(comp(), 'messaggio')).toBeNull();
      flush();
    }));
  });
});

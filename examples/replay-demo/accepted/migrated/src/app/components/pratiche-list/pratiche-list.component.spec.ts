import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Orologio } from '../../services/orologio.service';
import { PraticheListComponent } from './pratiche-list.component';

// Gold spec portato dal componente AngularJS praticheList.
// Interagisce solo via DOM e API pubblica (input "pratiche", output "seleziona").

const P = (id: number, oggetto: string, richiedente: string, stato: string, extra: Record<string, unknown> = {}) => ({
  id,
  oggetto,
  richiedente,
  stato,
  numeroProtocollo: null,
  scadenza: null,
  ...extra,
});

const LISTA = () => [
  P(1, 'Contributo affitto', 'Mario Rossi', 'BOZZA'),
  P(2, 'Permesso edilizio', 'Anna Verdi', 'PROTOCOLLATA', {
    numeroProtocollo: '2026/0001',
    scadenza: new Date(2026, 2, 13),
  }),
  P(3, 'Passo carraio', 'Luca Bianchi', 'APPROVATA'),
];

describe('PraticheListComponent (gold, portato da AngularJS)', () => {
  let fixture: ComponentFixture<PraticheListComponent>;
  let lista: ReturnType<typeof LISTA>;
  let selezionate: unknown[];

  const root = () => fixture.nativeElement as HTMLElement;
  const righe = () => Array.from(root().querySelectorAll('li'));
  const testo = (el: Element | null | undefined, sel: string) => el?.querySelector(sel)?.textContent?.trim();

  async function stabile() {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function scrivi(sel: string, valore: string, evento: 'input' | 'change') {
    const el = root().querySelector(sel) as HTMLInputElement | HTMLSelectElement;
    el.value = valore;
    el.dispatchEvent(new Event(evento));
    await stabile();
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [PraticheListComponent],
      providers: [{ provide: Orologio, useValue: { oggi: () => new Date(2026, 2, 10) } }],
    });
    fixture = TestBed.createComponent(PraticheListComponent);
    lista = LISTA();
    selezionate = [];
    fixture.componentRef.setInput('pratiche', lista);
    fixture.componentInstance.seleziona.subscribe((p: unknown) => selezionate.push(p));
    await stabile();
  });

  it('mostra tutte le pratiche con oggetto, richiedente e stato leggibile', () => {
    expect(righe()).toHaveLength(3);
    const prima = righe()[0];
    expect(testo(prima, '.oggetto')).toBe('Contributo affitto');
    expect(testo(prima, '.richiedente')).toBe('Mario Rossi');
    expect(testo(prima, '.stato')).toBe('Bozza');
    expect(prima.querySelector('.stato')?.classList.contains('stato-BOZZA')).toBe(true);
  });

  it('mostra il protocollo oppure un trattino', () => {
    expect(testo(righe()[0], '.protocollo')).toBe('—');
    expect(testo(righe()[1], '.protocollo')).toBe('2026/0001');
  });

  it('include il badge di scadenza', () => {
    expect(testo(righe()[1], 'scadenza-badge')).toBe('Scade tra 3 giorni');
    expect(testo(righe()[0], 'scadenza-badge')).toBe('—');
  });

  it('filtra per testo (oggetto o richiedente)', async () => {
    await scrivi('input.filtro-testo', 'verdi', 'input');
    expect(righe()).toHaveLength(1);
    expect(testo(righe()[0], '.oggetto')).toBe('Permesso edilizio');
  });

  it('filtra per stato', async () => {
    await scrivi('select.filtro-stato', 'APPROVATA', 'change');
    expect(righe()).toHaveLength(1);
    expect(testo(righe()[0], '.oggetto')).toBe('Passo carraio');
  });

  it('mostra "Nessuna pratica" quando il filtro non trova nulla', async () => {
    await scrivi('input.filtro-testo', 'zzz', 'input');
    expect(righe()).toHaveLength(0);
    expect(testo(root(), 'p.vuoto')).toBe('Nessuna pratica');
    expect(root().querySelector('ul.elenco')).toBeNull();
  });

  it('"Azzera" ripristina i filtri e la lista completa', async () => {
    await scrivi('input.filtro-testo', 'verdi', 'input');
    (root().querySelector('button.reset') as HTMLButtonElement).click();
    await stabile();
    expect(righe()).toHaveLength(3);
    expect((root().querySelector('input.filtro-testo') as HTMLInputElement).value).toBe('');
    expect((root().querySelector('select.filtro-stato') as HTMLSelectElement).value).toBe('');
  });

  it('"Azzera" ripristina anche il filtro per stato', async () => {
    await scrivi('select.filtro-stato', 'BOZZA', 'change');
    expect(righe()).toHaveLength(1);
    (root().querySelector('button.reset') as HTMLButtonElement).click();
    await stabile();
    expect(righe()).toHaveLength(3);
    expect((root().querySelector('select.filtro-stato') as HTMLSelectElement).value).toBe('');
  });

  it('il testo di ricerca viene ripulito dagli spazi ai bordi', async () => {
    await scrivi('input.filtro-testo', '  verdi  ', 'input');
    expect(righe()).toHaveLength(1);
    expect(testo(righe()[0], '.oggetto')).toBe('Permesso edilizio');
  });

  it('il click su una riga emette "seleziona" con la pratica', () => {
    (righe()[1] as HTMLElement).click();
    expect(selezionate).toHaveLength(1);
    expect((selezionate[0] as { id: number }).id).toBe(2);
  });

  it('si aggiorna quando l\'input "pratiche" cambia riferimento', async () => {
    fixture.componentRef.setInput('pratiche', lista.concat([P(4, 'Nuova', 'Zeta', 'BOZZA')]));
    await stabile();
    expect(righe()).toHaveLength(4);
  });

  it('QUIRK preservato: NON si aggiorna se si muta l\'array in place', async () => {
    lista.push(P(4, 'Nuova', 'Zeta', 'BOZZA'));
    await stabile();
    expect(righe()).toHaveLength(3);
  });

  it('il filtro attivo viene riapplicato quando arriva una nuova lista', async () => {
    await scrivi('input.filtro-testo', 'verdi', 'input');
    fixture.componentRef.setInput('pratiche', lista.concat([P(4, 'Altro permesso', 'Anna Verdi', 'BOZZA')]));
    await stabile();
    expect(righe()).toHaveLength(2);
  });

  it('il filtro stato e il filtro testo si combinano', async () => {
    await scrivi('input.filtro-testo', 'verdi', 'input');
    await scrivi('select.filtro-stato', 'BOZZA', 'change');
    expect(righe()).toHaveLength(0);
  });
});

import { ComponentFixture, TestBed } from '@angular/core/testing';

import contratto from '../../../../../contracts/scadenza-badge.cases.json';
import { Orologio } from '../../services/orologio.service';
import { ScadenzaBadgeComponent } from './scadenza-badge.component';

const toDate = (a: number[] | null): Date | null => (a ? new Date(a[0], a[1], a[2]) : null);

describe('ScadenzaBadgeComponent', () => {
  let oggi: Date;
  let fixture: ComponentFixture<ScadenzaBadgeComponent>;

  beforeEach(() => {
    oggi = toDate(contratto.oggi) as Date;
    TestBed.configureTestingModule({
      imports: [ScadenzaBadgeComponent],
      providers: [{ provide: Orologio, useValue: { oggi: () => new Date(oggi.getTime()) } }],
    });
    fixture = TestBed.createComponent(ScadenzaBadgeComponent);
  });

  function render(scadenza: Date | null): HTMLElement {
    fixture.componentRef.setInput('scadenza', scadenza);
    fixture.detectChanges();
    return fixture.nativeElement.querySelector('span') as HTMLElement;
  }

  describe('contratto condiviso con la versione AngularJS', () => {
    contratto.casi.forEach((caso) => {
      it(caso.nome, () => {
        const badge = render(toDate(caso.scadenza));
        expect(badge.textContent?.trim()).toBe(caso.testo);
        expect(badge.classList.contains(caso.classe)).toBe(true);
        expect(badge.classList.contains('badge')).toBe(true);
      });
    });

    it('le classi di stato sono mutuamente esclusive', () => {
      const STATI = ['nessuna', 'ok', 'in-scadenza', 'scaduta'];
      contratto.casi.forEach((caso) => {
        const f = TestBed.createComponent(ScadenzaBadgeComponent);
        f.componentRef.setInput('scadenza', toDate(caso.scadenza));
        f.detectChanges();
        const badge = f.nativeElement.querySelector('span') as HTMLElement;
        expect(STATI.filter((c) => badge.classList.contains(c))).toEqual([caso.classe]);
      });
    });
  });

  describe('comportamento equivalente alla direttiva legacy', () => {
    it('si aggiorna quando cambia la scadenza', () => {
      const badge = render(new Date(2026, 2, 20));
      expect(badge.classList.contains('ok')).toBe(true);
      fixture.componentRef.setInput('scadenza', new Date(2026, 2, 1));
      fixture.detectChanges();
      expect(badge.classList.contains('scaduta')).toBe(true);
      expect(badge.classList.contains('ok')).toBe(false);
    });

    it('torna a "nessuna" se la scadenza viene azzerata', () => {
      const badge = render(new Date(2026, 2, 20));
      fixture.componentRef.setInput('scadenza', null);
      fixture.detectChanges();
      expect(badge.textContent?.trim()).toBe('—');
      expect(badge.classList.contains('nessuna')).toBe(true);
    });

    it('QUIRK preservato: non ricalcola se cambia solo l\'ora', () => {
      const badge = render(new Date(2026, 2, 20));
      expect(badge.textContent?.trim()).toBe('10 giorni');
      oggi = new Date(2026, 2, 19);
      fixture.detectChanges();
      expect(badge.textContent?.trim()).toBe('10 giorni');
    });

    it('senza input (default) mostra "nessuna"', () => {
      fixture.detectChanges();
      const badge = fixture.nativeElement.querySelector('span') as HTMLElement;
      expect(badge.textContent?.trim()).toBe('—');
    });
  });
});

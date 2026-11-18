import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { StatoLabelPipe } from './stato-label.pipe';

@Component({
  selector: 'test-host',
  standalone: true,
  imports: [StatoLabelPipe],
  template: `<span>{{ stato | statoLabel }}</span>`,
})
class HostComponent {
  stato: string | null | undefined = 'IN_ISTRUTTORIA';
}

describe('StatoLabelPipe (gold, portato dal filtro AngularJS statoLabel)', () => {
  const pipe = new StatoLabelPipe();

  it('traduce tutti gli stati noti', () => {
    expect(pipe.transform('BOZZA')).toBe('Bozza');
    expect(pipe.transform('PROTOCOLLATA')).toBe('Protocollata');
    expect(pipe.transform('IN_ISTRUTTORIA')).toBe('In istruttoria');
    expect(pipe.transform('APPROVATA')).toBe('Approvata');
    expect(pipe.transform('RESPINTA')).toBe('Respinta');
    expect(pipe.transform('ANNULLATA')).toBe('Annullata');
  });

  it('restituisce stringa vuota per valori falsy', () => {
    expect(pipe.transform(undefined)).toBe('');
    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform('')).toBe('');
  });

  it('restituisce il valore originale per stati sconosciuti', () => {
    expect(pipe.transform('FOO')).toBe('FOO');
  });

  it('è utilizzabile nei template con il nome "statoLabel"', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('span').textContent).toBe('In istruttoria');
    fixture.componentInstance.stato = undefined;
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('span').textContent).toBe('');
  });
});

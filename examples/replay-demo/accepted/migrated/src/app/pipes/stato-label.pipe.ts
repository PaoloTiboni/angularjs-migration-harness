import { Pipe, PipeTransform } from '@angular/core';

const ETICHETTE: Record<string, string> = {
  BOZZA: 'Bozza',
  PROTOCOLLATA: 'Protocollata',
  IN_ISTRUTTORIA: 'In istruttoria',
  APPROVATA: 'Approvata',
  RESPINTA: 'Respinta',
  ANNULLATA: 'Annullata',
};

/** Trasforma il codice di stato in etichetta leggibile (porting del filtro AngularJS statoLabel). */
@Pipe({ name: 'statoLabel', standalone: true })
export class StatoLabelPipe implements PipeTransform {
  transform(stato: string | null | undefined): string {
    if (!stato) {
      return '';
    }
    // `||` e non `??`: preserva esattamente il comportamento del filtro legacy
    return ETICHETTE[stato] || stato;
  }
}

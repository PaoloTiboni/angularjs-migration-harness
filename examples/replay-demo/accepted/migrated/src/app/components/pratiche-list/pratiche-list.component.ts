import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { StatoLabelPipe } from '../../pipes/stato-label.pipe';
import type { Pratica } from '../../services/pratiche.service';
import { ScadenzaBadgeComponent } from '../scadenza-badge/scadenza-badge.component';

/** Lista con filtro testuale e per stato (porting di praticheList). */
@Component({
  selector: 'pratiche-list',
  standalone: true,
  imports: [FormsModule, StatoLabelPipe, ScadenzaBadgeComponent],
  template: `
    <div class="pratiche-list">
      <div class="filtri">
        <input type="text" class="filtro-testo" placeholder="Cerca..." [ngModel]="testo" (ngModelChange)="cambiaTesto($event)">
        <select class="filtro-stato" [ngModel]="stato" (ngModelChange)="cambiaStato($event)">
          <option value="">Tutti gli stati</option>
          <option value="BOZZA">Bozza</option>
          <option value="PROTOCOLLATA">Protocollata</option>
          <option value="IN_ISTRUTTORIA">In istruttoria</option>
          <option value="APPROVATA">Approvata</option>
          <option value="RESPINTA">Respinta</option>
          <option value="ANNULLATA">Annullata</option>
        </select>
        <button type="button" class="reset" (click)="resetFiltri()">Azzera</button>
      </div>

      @if (visibili.length === 0) {
        <p class="vuoto">Nessuna pratica</p>
      } @else {
        <ul class="elenco">
          @for (p of visibili; track p.id) {
            <li class="riga" (click)="selezionaRiga(p)">
              <span class="oggetto">{{ p.oggetto }}</span>
              <span class="richiedente">{{ p.richiedente }}</span>
              <span class="stato" [class]="'stato-' + p.stato">{{ p.stato | statoLabel }}</span>
              <span class="protocollo">{{ p.numeroProtocollo || '—' }}</span>
              <scadenza-badge [scadenza]="p.scadenza" />
            </li>
          }
        </ul>
      }
    </div>
  `,
})
export class PraticheListComponent implements OnChanges {
  @Input() pratiche: Pratica[] | null | undefined = [];
  @Output() seleziona = new EventEmitter<Pratica>();

  testo = '';
  stato = '';
  visibili: Pratica[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['pratiche']) {
      this.filtra();
    }
  }

  cambiaTesto(valore: string): void {
    this.testo = valore;
    this.filtra();
  }

  cambiaStato(valore: string): void {
    this.stato = valore;
    this.filtra();
  }

  selezionaRiga(pratica: Pratica): void {
    this.seleziona.emit(pratica);
  }

  resetFiltri(): void {
    this.testo = '';
    this.stato = '';
    this.filtra();
  }

  private calcola(): Pratica[] {
    const testo = this.testo.trim().toLowerCase();
    return (this.pratiche || []).filter((p) => {
      if (this.stato && p.stato !== this.stato) {
        return false;
      }
      if (testo && (p.oggetto + ' ' + p.richiedente).toLowerCase().indexOf(testo) === -1) {
        return false;
      }
      return true;
    });
  }

  private filtra(): void {
    this.visibili = this.calcola();
  }
}

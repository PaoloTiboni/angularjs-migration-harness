import { Component, computed, inject, input } from '@angular/core';

import { Orologio } from '../../services/orologio.service';
import { ScadenzeService } from '../../services/scadenze.service';

interface VistaBadge {
  classe: 'nessuna' | 'scaduta' | 'in-scadenza' | 'ok';
  testo: string;
}

/**
 * <scadenza-badge [scadenza]="p.scadenza" />
 *
 * Comportamento preservato dalla direttiva AngularJS, incluso il quirk: "oggi" viene
 * letto solo quando cambia `scadenza` (non è un signal), esattamente come il vecchio $watch.
 */
@Component({
  selector: 'scadenza-badge',
  standalone: true,
  template: `<span class="badge" [class]="vista().classe">{{ vista().testo }}</span>`,
})
export class ScadenzaBadgeComponent {
  private readonly scadenze = inject(ScadenzeService);
  private readonly orologio = inject(Orologio);

  readonly scadenza = input<Date | null | undefined>(null);

  readonly vista = computed<VistaBadge>(() => {
    const scadenza = this.scadenza();
    if (!scadenza) {
      return { classe: 'nessuna', testo: '—' };
    }
    const giorni = this.scadenze.giorniRimanenti(scadenza, this.orologio.oggi());
    if (giorni < 0) {
      const n = Math.abs(giorni);
      return { classe: 'scaduta', testo: 'Scaduta da ' + n + (n === 1 ? ' giorno' : ' giorni') };
    }
    if (giorni <= 5) {
      return {
        classe: 'in-scadenza',
        testo: giorni === 0 ? 'Scade oggi' : 'Scade tra ' + giorni + (giorni === 1 ? ' giorno' : ' giorni'),
      };
    }
    return { classe: 'ok', testo: giorni + ' giorni' };
  });
}

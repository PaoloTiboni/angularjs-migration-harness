import { Injectable } from '@angular/core';

/**
 * Calcolo scadenze in giorni lavorativi italiani.
 * Esclude sabato, domenica, festività nazionali fisse e Pasquetta.
 */
@Injectable({ providedIn: 'root' })
export class ScadenzeService {
  /** [mese0, giorno] */
  private static readonly FESTIVITA_FISSE: ReadonlyArray<readonly [number, number]> = [
    [0, 1], // Capodanno
    [0, 6], // Epifania
    [3, 25], // Liberazione
    [4, 1], // Festa del lavoro
    [5, 2], // Festa della Repubblica
    [7, 15], // Ferragosto
    [10, 1], // Ognissanti
    [11, 8], // Immacolata
    [11, 25], // Natale
    [11, 26], // Santo Stefano
  ];

  /** Algoritmo di Meeus/Jones/Butcher per la domenica di Pasqua. */
  private pasqua(anno: number): Date {
    const a = anno % 19;
    const b = Math.floor(anno / 100);
    const c = anno % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const mese = Math.floor((h + l - 7 * m + 114) / 31) - 1; // 0-based
    const giorno = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(anno, mese, giorno);
  }

  eFestivo(data: Date): boolean {
    const m = data.getMonth();
    const g = data.getDate();
    if (ScadenzeService.FESTIVITA_FISSE.some(([fm, fg]) => fm === m && fg === g)) {
      return true;
    }
    const p = this.pasqua(data.getFullYear());
    const pasquetta = new Date(p.getFullYear(), p.getMonth(), p.getDate() + 1);
    return pasquetta.getMonth() === m && pasquetta.getDate() === g;
  }

  eLavorativo(data: Date): boolean {
    const dow = data.getDay();
    if (dow === 0 || dow === 6) {
      return false;
    }
    return !this.eFestivo(data);
  }

  aggiungiGiorniLavorativi(data: Date, n: number): Date {
    let corrente = new Date(data.getFullYear(), data.getMonth(), data.getDate());
    let rimasti = n;
    while (rimasti > 0) {
      corrente = new Date(corrente.getFullYear(), corrente.getMonth(), corrente.getDate() + 1);
      if (this.eLavorativo(corrente)) {
        rimasti--;
      }
    }
    return corrente;
  }

  /** Differenza in giorni di calendario (scadenza - oggi); negativa se scaduta. */
  giorniRimanenti(scadenza: Date, oggi: Date): number {
    const MS = 24 * 60 * 60 * 1000;
    const a = Date.UTC(scadenza.getFullYear(), scadenza.getMonth(), scadenza.getDate());
    const b = Date.UTC(oggi.getFullYear(), oggi.getMonth(), oggi.getDate());
    return Math.round((a - b) / MS);
  }
}

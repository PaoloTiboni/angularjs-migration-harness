import { Injectable } from '@angular/core';

/** Wrapper sull'ora corrente: si sostituisce nei test. */
@Injectable({ providedIn: 'root' })
export class Orologio {
  oggi(): Date {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
}

/* Le schede.

   Prima le tre rotazioni erano scritte nel codice e basta: l'app sapeva
   aprire solo quelle, e 27 dei 48 esercizi del catalogo non erano
   raggiungibili in nessun modo. Ora le schede sono dati, stanno
   nell'archivio del telefono e si possono creare, cambiare e riordinare.

   `allenamenti.js` resta come **semenza**: sono le tre schede di partenza,
   copiate nell'archivio al primo avvio. Da lì in poi comanda l'archivio. */

import {ALLENAMENTI} from './allenamenti.js';
import {PER_ID} from './esercizi.js';
import * as archivio from './archivio.js';

export function schedeDiPartenza(){
  return ALLENAMENTI.map(a => ({
    id: a.id, nome: a.nome,
    nucleo: a.nucleo.slice(), opzionali: a.opzionali.slice()
  }));
}

/* Un identificativo che non collide con A, B, C né con i precedenti. */
export function nuovoId(schede){
  let n = 1, id;
  do { id = 'S' + n++; } while (schede.some(s => s.id === id));
  return id;
}

export function schedaVuota(schede){
  return {id: nuovoId(schede), nome: 'Nuova scheda', nucleo: [], opzionali: []};
}

/* Toglie i riferimenti a esercizi che non esistono più: senza questo, una
   scheda vecchia farebbe esplodere la sessione su un `undefined`. */
function ripulisci(s){
  return {
    id: s.id,
    nome: s.nome || 'Senza nome',
    nucleo: (s.nucleo || []).filter(id => PER_ID[id]),
    opzionali: (s.opzionali || []).filter(id => PER_ID[id])
  };
}

export async function leggiSchede(){
  const salvate = await archivio.leggiStato('schede', null);
  if (!Array.isArray(salvate) || !salvate.length){
    const partenza = schedeDiPartenza();
    await archivio.scriviStato('schede', partenza);
    return partenza;
  }
  return salvate.map(ripulisci);
}

export function scriviSchede(schede){
  return archivio.scriviStato('schede', schede.map(ripulisci));
}

/* ------------------------------------------------------------------
   Aiuti per l'editor
------------------------------------------------------------------ */

/* Quali categorie copre il nucleo. Non blocca niente — è una scheda tua e
   la fai come vuoi — ma dirtelo costa zero. */
export const CATEGORIE = ['spinta', 'tirata', 'gambe', 'core'];

export function copertura(scheda){
  const dentro = new Set(scheda.nucleo.map(id => PER_ID[id] && PER_ID[id].categoria));
  return CATEGORIE.map(c => ({categoria: c, coperta: dentro.has(c)}));
}

export function mancanti(scheda){
  return copertura(scheda).filter(c => !c.coperta).map(c => c.categoria);
}

/* Gli esercizi che possono sostituire questo: stesso gruppo, escluso sé
   stesso e quelli già presenti nella sessione. */
export function alternative(esercizioId, giaDentro = []){
  const e = PER_ID[esercizioId];
  if (!e) return [];
  const fuori = new Set([esercizioId, ...giaDentro]);
  return Object.values(PER_ID)
    .filter(x => x.gruppo === e.gruppo && !fuori.has(x.id));
}

export function durataStimata(scheda){
  const n = scheda.nucleo.length, o = scheda.opzionali.length;
  return {corta: Math.round(n * 10), lunga: Math.round((n + o) * 10)};
}

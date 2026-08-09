/* Le schede: liste di esercizi che scegli tu.

   Sono passate per tre forme. Prima erano scritte nel codice (e 27 esercizi su
   48 non erano raggiungibili). Poi sono diventate combinazioni di gruppi, con
   gli esercizi scelti da una regola. Ora sono la cosa più semplice: gli
   esercizi che vuoi, nell'ordine che vuoi.

   Si parte **senza nessuna scheda**: le fai tu. */

import {ESERCIZI, PER_ID} from './esercizi.js';
import * as archivio from './archivio.js';

export function schedeDiPartenza(){ return []; }

export function nuovoId(schede){
  let n = 1, id;
  do { id = 'S' + n++; } while (schede.some(s => s.id === id));
  return id;
}

export function schedaVuota(schede){
  return {id: nuovoId(schede), nome: '', esercizi: []};
}

/* Le schede vecchie avevano altre forme: `nucleo`+`opzionali` (liste di
   esercizi) oppure `gruppi`. Le prime si recuperano, le seconde no — non
   contengono esercizi, solo l'idea di quali gruppi toccare. */
export function migra(s){
  let ids = null;
  if (Array.isArray(s.esercizi)) ids = s.esercizi;
  else if (Array.isArray(s.nucleo) || Array.isArray(s.opzionali))
    ids = [...(s.nucleo || []), ...(s.opzionali || [])];
  if (!ids) return null;
  const puliti = ids.filter(id => PER_ID[id]);
  if (!puliti.length) return null;
  return {id: s.id, nome: s.nome || 'Senza nome', esercizi: puliti};
}

export async function leggiSchede(){
  const salvate = await archivio.leggiStato('schede', null);
  if (!Array.isArray(salvate)) return schedeDiPartenza();
  const migrate = salvate.map(migra).filter(Boolean);
  if (JSON.stringify(migrate) !== JSON.stringify(salvate))
    await archivio.scriviStato('schede', migrate);
  return migrate;
}

export function scriviSchede(schede){
  return archivio.scriviStato('schede', schede.map(migra).filter(Boolean));
}

/* ------------------------------------------------------------------
   Conti e aiuti
------------------------------------------------------------------ */

/* Un esercizio a una gamba o un braccio richiede il doppio del tempo:
   ogni serie si fa due volte. */
export function minutiScheda(ids){
  return ids.reduce((m, id) => {
    const e = PER_ID[id];
    return m + (e ? (e.unilaterale ? 12 : 7) : 0);
  }, 0);
}

/* Le sezioni del catalogo toccate da una scheda, per scriverle sotto al nome. */
export function gruppiToccati(ids){
  const visti = [];
  for (const id of ids){
    const e = PER_ID[id];
    if (!e) continue;
    const corto = e.gruppo.split('—')[0].trim().replace(/^(Spinta|Tirata) (orizzontale|verticale)$/, '$1 $2');
    if (!visti.includes(corto)) visti.push(corto);
  }
  return visti;
}

/* Le alternative per il pulsante «cambia esercizio»: stessa sezione del
   catalogo, escluso sé stesso e quelli già presenti nella sessione. */
export function alternative(esercizioId, giaDentro = []){
  const e = PER_ID[esercizioId];
  if (!e) return [];
  const fuori = new Set([esercizioId, ...giaDentro]);
  return ESERCIZI.filter(x => x.gruppo === e.gruppo && !fuori.has(x.id));
}

/* Le sezioni del catalogo, nell'ordine in cui stanno in `esercizi.js`. */
export function sezioni(){
  const q = {};
  for (const e of ESERCIZI) (q[e.gruppo] ||= []).push(e);
  return Object.entries(q).map(([nome, lista]) => ({nome, lista}));
}

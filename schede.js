/* Le schede.

   Non sono più liste di esercizi: sono **combinazioni di gruppi**. Tu dici
   «oggi completo» oppure «oggi solo sopra», e gli esercizi li compone
   `comporre.js` scegliendo, per ogni schema, quello che non fai da più tempo.

   È il cambio che toglie di mezzo il difetto vero: prima gli esercizi delle
   schede li avevo scelti io e sembravano casuali — perché lo erano. */

import {GRUPPI, PER_GRUPPO, COMPLETO, gruppoDi, quantiEsercizi, minutiStimati} from './gruppi.js';
import {PER_ID} from './esercizi.js';
import * as archivio from './archivio.js';

export function schedeDiPartenza(){
  return [
    {id:'completo', nome:'Completo',      gruppi: COMPLETO.slice()},
    {id:'sopra',    nome:'Solo sopra',    gruppi: ['petto','dorso','spalle','braccia']},
    {id:'gambe',    nome:'Gambe e core',  gruppi: ['gambe','core']}
  ];
}

export function nuovoId(schede){
  let n = 1, id;
  do { id = 'S' + n++; } while (schede.some(s => s.id === id));
  return id;
}

export function schedaVuota(schede){
  return {id: nuovoId(schede), nome: 'Nuova scheda', gruppi: []};
}

/* Le schede della versione precedente contenevano liste di esercizi
   (`nucleo` e `opzionali`). Non si buttano: si deducono i gruppi da quegli
   esercizi, così chi aveva già fatto le sue schede non riparte da zero. */
export function migra(s){
  if (Array.isArray(s.gruppi)) {
    return {id: s.id, nome: s.nome || 'Senza nome',
            gruppi: s.gruppi.filter(g => PER_GRUPPO[g])};
  }
  const vecchi = [...(s.nucleo || []), ...(s.opzionali || [])];
  const dedotti = [];
  for (const id of vecchi){
    const e = PER_ID[id];
    if (!e) continue;
    const g = gruppoDi(e);
    if (!dedotti.includes(g)) dedotti.push(g);
  }
  return {id: s.id, nome: s.nome || 'Senza nome', gruppi: dedotti};
}

export async function leggiSchede(){
  const salvate = await archivio.leggiStato('schede', null);
  if (!Array.isArray(salvate) || !salvate.length){
    const partenza = schedeDiPartenza();
    await archivio.scriviStato('schede', partenza);
    return partenza;
  }
  const migrate = salvate.map(migra);
  /* se una migrazione ha cambiato qualcosa, si riscrive una volta sola */
  if (JSON.stringify(migrate) !== JSON.stringify(salvate))
    await archivio.scriviStato('schede', migrate);
  return migrate;
}

export function scriviSchede(schede){
  return archivio.scriviStato('schede', schede.map(migra));
}

/* ------------------------------------------------------------------
   Aiuti per l'interfaccia
------------------------------------------------------------------ */
export const CATEGORIE = ['petto', 'dorso', 'gambe', 'core'];

export function mancanti(scheda){
  return CATEGORIE.filter(c => !scheda.gruppi.includes(c));
}

export function descrizione(scheda){
  if (!scheda.gruppi.length) return 'nessun gruppo scelto';
  const nomi = GRUPPI.filter(g => scheda.gruppi.includes(g.id)).map(g => g.nome.toLowerCase());
  return nomi.join(', ');
}

export function riassunto(scheda){
  return {
    esercizi: quantiEsercizi(scheda.gruppi),
    minuti: minutiStimati(scheda.gruppi)
  };
}

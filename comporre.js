/* La regola che compone la sessione.

   Prima gli esercizi delle schede li avevo scelti io, uno per uno, e infatti
   sembravano casuali: erano casuali. Adesso non li sceglie nessuno.

   Tu dici quali gruppi vuoi allenare; per ogni schema di quei gruppi l'app
   prende **l'esercizio che non fai da più tempo**. Quelli mai fatti vengono
   prima di tutti. Così il catalogo da 48 gira da solo, e la varietà non è una
   decisione ma una conseguenza.

   Niente DOM qui dentro: si prova con node. */

import {PER_GRUPPO, PER_ID, schemaDi, esercizioDelloSchema} from './gruppi.js';

/* Quanti esercizi girano per ogni schema.

   Non tutti quelli disponibili: il petto ne ha dieci, e ruotandoli tutti
   faresti la panca piana una volta ogni dieci sessioni. La doppia
   progressione vuole l'opposto — che un esercizio torni abbastanza spesso da
   poterci accumulare ripetizioni sopra. Con tre, ognuno torna ogni tre
   sessioni: circa una volta a settimana al tuo ritmo, che è quanto serve per
   progredire avendo comunque varietà.

   Gli altri restano raggiungibili: li scegli a mano dal catalogo, oppure li
   metti fra i preferiti e prendono il posto di questi. */
export const ROTAZIONE = 3;

/* Chi gira davvero, per uno schema: i preferiti se ne hai messi, altrimenti
   i primi tre in ordine di catalogo — che è ordinato per importanza, dai
   fondamentali alle rifiniture. */
export function giostra(schema, preferiti = [], dascartare = []){
  const tutti = esercizioDelloSchema(schema).filter(e => !dascartare.includes(e.id));
  const scelti = tutti.filter(e => preferiti.includes(e.id));
  if (scelti.length) return scelti;
  const base = tutti.slice(0, ROTAZIONE);
  return base.length ? base : esercizioDelloSchema(schema).slice(0, ROTAZIONE);
}

/* Quando ho fatto l'ultima volta ogni esercizio. Le sessioni arrivano dalla
   più vecchia alla più recente. Chi non compare non ha data: viene prima. */
export function ultimaVolta(sessioni){
  const q = {};
  for (const s of sessioni)
    for (const e of (s.esercizi || [])) q[e.id] = s.data;
  return q;
}

function menoRecente(candidati, quando){
  let scelto = null;
  for (const e of candidati){
    const d = quando[e.id] || '';                   /* mai fatto = stringa vuota = il più vecchio */
    if (!scelto || d < (quando[scelto.id] || '')) scelto = e;
  }
  return scelto;
}

/* Le gambe alternano ginocchio e anca: si prende lo schema il cui esercizio
   più recente è più vecchio, cioè quello trascurato da più tempo. */
function schemaAlternato(schemi, quando, preferiti, dascartare){
  let migliore = schemi[0], suoTempo = null;
  for (const s of schemi){
    const lista = giostra(s, preferiti, dascartare);
    if (!lista.length) continue;
    /* il più recente dentro lo schema: quanto tempo fa ho toccato questo schema */
    let recente = '';
    for (const e of lista){
      const d = quando[e.id] || '';
      if (d > recente) recente = d;
    }
    if (suoTempo === null || recente < suoTempo){ suoTempo = recente; migliore = s; }
  }
  return migliore;
}

/* Restituisce gli id degli esercizi, nell'ordine in cui vanno fatti.
   `dascartare` sono quelli messi da parte, `giaDentro` quelli già scelti
   (serve quando si aggiunge un gruppo a sessione iniziata). */
export function componi(gruppi, sessioni, opzioni = {}){
  const quando = ultimaVolta(sessioni);
  const preferiti = opzioni.preferiti || [];
  const dascartare = opzioni.dascartare || [];
  const presi = new Set(opzioni.giaDentro || []);
  const fuori = [];

  /* L'ordine è quello dei gruppi in GRUPPI, non quello in cui li hai toccati:
     una sessione comincia dal lavoro pesante e finisce con le rifiniture. */
  const ordinati = Object.keys(PER_GRUPPO).filter(id => gruppi.includes(id));

  for (const idGruppo of ordinati){
    const g = PER_GRUPPO[idGruppo];
    const schemi = g.alterna
      ? [schemaAlternato(g.schemi, quando, preferiti, dascartare)]
      : g.schemi;
    for (const s of schemi){
      const candidati = giostra(s, preferiti, dascartare).filter(e => !presi.has(e.id));
      if (!candidati.length) continue;
      const scelto = menoRecente(candidati, quando);
      if (scelto){ fuori.push(scelto.id); presi.add(scelto.id); }
    }
  }
  return fuori;
}

/* I gruppi che restano fuori da una selezione: è quello che l'app propone
   quando ti chiede «hai ancora tempo?». */
export function gruppiRimasti(gruppi){
  return Object.keys(PER_GRUPPO).filter(id => !gruppi.includes(id));
}

/* Le alternative allo stesso schema, per il pulsante «cambia esercizio».
   Stesso lavoro, non solo stesso gruppo: al posto di una tirata verticale si
   propone un'altra tirata verticale, non un rematore. Le più trascurate per
   prime, così cambiare esercizio aiuta comunque la rotazione. */
export function alternativeSchema(esercizioId, sessioni, giaDentro = []){
  const e = PER_ID[esercizioId];
  if (!e) return [];
  const quando = ultimaVolta(sessioni);
  const fuori = new Set([esercizioId, ...giaDentro]);
  return esercizioDelloSchema(schemaDi(e))
    .filter(x => !fuori.has(x.id))
    .sort((a, b) => (quando[a.id] || '').localeCompare(quando[b.id] || ''));
}

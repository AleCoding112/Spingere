/* Il motore della progressione.
   Nessun DOM, nessuna data di sistema letta qui dentro: tutto arriva come
   argomento, così `test.mjs` può verificarlo senza far finta di essere un
   browser. È l'unico file dove sta la logica che decide i carichi. */

/* I gradini veri dei manubri di casa. Il salto da 14 a 18,5 è del 32%,
   quello da 3 a 8,5 del 183%: è la ragione per cui si progredisce a
   ripetizioni e non a peso. */
export const GRADINI = [3, 8.5, 14, 18.5, 24];

/* Per gli esercizi a corpo libero zavorrabile si parte dal corpo nudo
   e si aggiunge un manubrio stretto fra i piedi. */
export const GRADINI_ZAVORRA = [0, ...GRADINI];

/* Un valore di partenza qualunque, non quello di nessuno: serve solo a far
   girare i conti finché il peso vero non viene impostato dal telefono, dove
   resta. Non metterci un dato personale — questo file finisce su un
   repository pubblico, e la cronologia di git non si ripulisce da sola. */
export const PESO_DI_PARTENZA = 75;

export function gradini(carico){
  if (carico === 'manubri') return GRADINI;
  if (carico === 'zavorra') return GRADINI_ZAVORRA;
  return [];
}

export function prossimoGradino(carico, peso){
  const g = gradini(carico);
  const i = g.indexOf(peso);
  if (i === -1 || i === g.length - 1) return null;
  return g[i + 1];
}

export function gradinoPrecedente(carico, peso){
  const g = gradini(carico);
  const i = g.indexOf(peso);
  return i > 0 ? g[i - 1] : null;
}

export function pesoSuggerito(esercizio){
  if (esercizio.carico === 'manubri') return 14;   // il gradino di mezzo
  if (esercizio.carico === 'zavorra') return 0;    // solo il corpo
  return null;                                     // corpo libero e basta
}

export function giorniTra(da, a){
  const g = 24 * 60 * 60 * 1000;
  return Math.round((new Date(a + 'T00:00') - new Date(da + 'T00:00')) / g);
}

/* Il carico da mettere sul grafico. Per i manubri è il peso di un manubrio,
   quello che imposti sull'impugnatura. Per il corpo libero sei tu, più
   l'eventuale zavorra: senza il peso corporeo il grafico ti mostrerebbe
   fermo mentre stai progredendo. */
export function caricoTotale(esercizio, peso, pesoCorporeo){
  if (esercizio.carico === 'manubri') return peso;
  if (esercizio.carico === 'zavorra') return pesoCorporeo + (peso || 0);
  return pesoCorporeo;
}

/* Un solo numero che riassume una sessione, e che sale sia quando aggiungi
   ripetizioni sia quando sali di manubrio.

   Serve perché il carico da solo, con cinque gradini in tutto, disegna una
   scala a gradoni: fra 14 e 18,5 kg possono passare due mesi in cui il
   grafico è una riga piatta mentre tu vai da 9 a 12 ripetizioni. Piatto vuol
   dire fermo, e tu non sei fermo.

   Non è un massimale e non pretende di esserlo: è la formula di Epley usata
   come indice, carico per (1 + ripetizioni/30). */
export function indiceProgresso(esercizio, peso, ripetizioni, pesoCorporeo){
  const c = caricoTotale(esercizio, peso, pesoCorporeo);
  return Math.round(c * (1 + ripetizioni / 30) * 10) / 10;
}

/* Come si scrive un carico, in un posto solo.
   Stava sparso in tre punti dell'interfaccia, ed è per questo che sulle
   flessioni compariva «Record: 75 kg × 18»: il peso corporeo veniva trattato
   come se fosse un manubrio. A corpo libero il carico non si scrive — si
   scrivono le ripetizioni. */
export function numero(n){
  if (n === null || n === undefined) return '–';
  return Number.isInteger(n) ? String(n) : String(n).replace('.', ',');
}

export function etichettaPrestazione(esercizio, peso, ripetizioni){
  if (esercizio.carico === 'manubri') return numero(peso) + ' kg × ' + ripetizioni;
  if (esercizio.carico === 'zavorra' && peso > 0) return '+' + numero(peso) + ' kg × ' + ripetizioni;
  return ripetizioni + ' ripetizioni';
}

const SFORZI = ['facile', 'giusta', 'limite'];
export const ETICHETTA_SFORZO = {facile:'Facile', giusta:'Giusta', limite:'Al limite'};

function fasciaChiusa(esercizio, serie){
  return serie.length > 0 && serie.every(r => r >= esercizio.fascia[1]);
}

/* Il record: prima conta il carico, a parità conta il numero di ripetizioni. */
export function record(esercizio, storico, pesoCorporeo){
  let best = null;
  for (const s of storico){
    const c = caricoTotale(esercizio, s.peso, pesoCorporeo);
    const r = Math.max(...s.serie);
    if (!best || c > best.carico || (c === best.carico && r > best.ripetizioni))
      best = {carico:c, peso:s.peso, ripetizioni:r, data:s.data};
  }
  return best;
}

/* Quante sessioni di fila hanno visto salire il carico. Serve solo a dirlo. */
export function saliteDiFila(esercizio, storico, pesoCorporeo){
  let n = 0;
  for (let i = 0; i < storico.length - 1; i++){
    const a = caricoTotale(esercizio, storico[i].peso, pesoCorporeo);
    const b = caricoTotale(esercizio, storico[i+1].peso, pesoCorporeo);
    if (a > b) n++; else break;
  }
  return n;
}

/* ------------------------------------------------------------------
   La prescrizione di oggi.
   `storico` sono le prestazioni passate di QUESTO esercizio, dalla più
   recente alla più vecchia: {data:'2026-08-08', peso, serie:[10,10,9], sforzo}
------------------------------------------------------------------ */
export function prescrizione(esercizio, storico, oggi, pesoCorporeo = PESO_DI_PARTENZA){
  const fascia = esercizio.fascia;
  const base = {esercizio, fascia, serie: 3, sale: false, rientro: false, giorni: null};

  if (!storico.length){
    return {...base,
      peso: pesoSuggerito(esercizio),
      bersaglio: fascia[0],
      ultima: null,
      primaVolta: true,
      messaggio: 'Prima volta. Scegli un peso che ti lasci due ripetizioni in canna.'};
  }

  const u = storico[0];
  const giorni = giorniTra(u.data, oggi);
  const rientro = giorni > 14;
  const chiusa = fasciaChiusa(esercizio, u.serie);
  const precedente = storico[1];
  const facileDueVolte = u.sforzo === 'facile' && precedente &&
                         precedente.sforzo === 'facile' && precedente.peso === u.peso;

  let sale = false, motivo = '';
  if (chiusa && u.sforzo === 'limite'){
    motivo = 'Fascia chiusa, ma eri al limite: stesso peso ancora una volta, poi si sale.';
  } else if (chiusa){
    sale = true; motivo = 'Fascia chiusa su tutte le serie. Si sale di manubrio.';
  } else if (facileDueVolte){
    sale = true; motivo = 'Due volte «facile» di fila: sali adesso, non aspettare la fascia.';
  }

  let peso = u.peso, bersaglio;
  let alTetto = false;

  if (sale){
    const su = prossimoGradino(esercizio.carico, u.peso);
    if (su === null){
      sale = false; alTetto = true;
      bersaglio = Math.max(...u.serie) + 1;
      motivo = esercizio.carico === 'manubri'
        ? 'Sei sui 24 kg, l\'ultimo gradino: da qui si cresce solo di ripetizioni.'
        : 'Hai chiuso la fascia: è ora di passare a una variante più difficile.';
    } else {
      peso = su;
      bersaglio = fascia[0];
    }
  } else {
    bersaglio = Math.min(fascia[1], u.serie[0] + 1);
  }

  /* Il rientro non taglia niente e non rimprovera nessuno. */
  let messaggio = motivo || `L'ultima volta ${u.serie.join('-')}. Oggi ${bersaglio}.`;
  if (rientro){
    messaggio = sale
      ? `${giorni} giorni di pausa, ma il salto te l'eri guadagnato: è tuo. Se non regge, si torna giù senza drammi.`
      : `${giorni} giorni di pausa. Riprendiamo da qui.`;
  }

  return {...base,
    peso, bersaglio, sale, alTetto, rientro, giorni,
    ultima: u,
    primaVolta: false,
    record: record(esercizio, storico, pesoCorporeo),
    salite: saliteDiFila(esercizio, storico, pesoCorporeo),
    messaggio};
}

/* Il prossimo allenamento della rotazione. Nessun calendario: conta solo
   quale è stato l'ultimo, non quando.
   Se l'ultimo è stato cancellato dalle schede, `findIndex` torna -1 e si
   riparte dalla prima: è il comportamento giusto, non un caso limite. */
export function prossimoAllenamento(allenamenti, ultimoId){
  if (!allenamenti.length) return null;
  const i = allenamenti.findIndex(a => a.id === ultimoId);
  return allenamenti[(i + 1) % allenamenti.length];
}

export const SFORZI_VALIDI = SFORZI;

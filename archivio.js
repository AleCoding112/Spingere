/* Tutto quello che viene salvato sta qui, e sta solo su questo telefono.
   Nessun server, nessun account. Il prezzo è che se cancelli l'icona dalla
   schermata home o resetti l'iPhone, lo storico se ne va con lui: per questo
   c'è `esporta()`. */

const NOME = 'spingere';
const VERSIONE = 1;
let db = null;

export function apri(){
  if (db) return Promise.resolve(db);
  return new Promise((ok, no) => {
    if (!self.indexedDB) return no(new Error('Questo browser non sa salvare niente in locale.'));
    const r = indexedDB.open(NOME, VERSIONE);
    r.onupgradeneeded = () => {
      const d = r.result;
      if (!d.objectStoreNames.contains('sessioni'))
        d.createObjectStore('sessioni', {keyPath:'id', autoIncrement:true});
      if (!d.objectStoreNames.contains('stato'))
        d.createObjectStore('stato', {keyPath:'chiave'});
    };
    r.onsuccess = () => { db = r.result; ok(db); };
    r.onerror = () => no(r.error);
  });
}

function transazione(nome, modo, lavoro){
  return apri().then(d => new Promise((ok, no) => {
    const t = d.transaction(nome, modo);
    const richiesta = lavoro(t.objectStore(nome));
    t.oncomplete = () => ok(richiesta ? richiesta.result : undefined);
    t.onerror = () => no(t.error);
    t.onabort = () => no(t.error);
  }));
}

export function salvaSessione(sessione){
  return transazione('sessioni', 'readwrite', s => s.add(sessione));
}

export function cancellaSessione(id){
  return transazione('sessioni', 'readwrite', s => s.delete(id));
}

/* Serve a correggere un numero digitato male. Senza questo un errore di
   battitura resta per sempre e falsa la progressione di quell'esercizio. */
export function aggiornaSessione(sessione){
  return transazione('sessioni', 'readwrite', s => s.put(sessione));
}

/* Dalla più vecchia alla più recente. */
export function tutteLeSessioni(){
  return transazione('sessioni', 'readonly', s => s.getAll())
    .then(v => (v || []).sort((a, b) => a.data.localeCompare(b.data)));
}

export function leggiStato(chiave, predefinito){
  return transazione('stato', 'readonly', s => s.get(chiave))
    .then(v => (v === undefined || v === null) ? predefinito : v.valore);
}

export function scriviStato(chiave, valore){
  return transazione('stato', 'readwrite', s => s.put({chiave, valore}));
}

/* ------------------------------------------------------------------
   Lo storico di un singolo esercizio, dal più recente al più vecchio:
   è esattamente la forma che si aspetta `prescrizione()` in motore.js.
------------------------------------------------------------------ */
export function storicoEsercizio(sessioni, esercizioId){
  const fuori = [];
  for (const s of sessioni){
    const e = (s.esercizi || []).find(x => x.id === esercizioId);
    if (e && e.serie && e.serie.length)
      fuori.push({data: s.data, peso: e.peso, serie: e.serie, sforzo: e.sforzo});
  }
  return fuori.reverse();
}

/* ------------------------------------------------------------------
   Backup. Un file solo, leggibile, che contiene tutto.
------------------------------------------------------------------ */
export async function esporta(){
  const sessioni = await tutteLeSessioni();
  const pesoCorporeo = await leggiStato('pesoCorporeo', null);
  const ultimoAllenamento = await leggiStato('ultimoAllenamento', null);
  const schede = await leggiStato('schede', null);
  return JSON.stringify({
    app: 'Spingere', versione: VERSIONE,
    esportato: new Date().toISOString(),
    pesoCorporeo, ultimoAllenamento, schede, sessioni
  }, null, 1);
}

export async function importa(testo){
  const dati = JSON.parse(testo);
  if (!dati || !Array.isArray(dati.sessioni))
    throw new Error('Questo file non è un backup di Spingere.');
  const d = await apri();
  await new Promise((ok, no) => {
    const t = d.transaction(['sessioni','stato'], 'readwrite');
    const s = t.objectStore('sessioni');
    s.clear();
    for (const sess of dati.sessioni){ const {id, ...resto} = sess; s.add(resto); }
    const stato = t.objectStore('stato');
    if (dati.pesoCorporeo != null) stato.put({chiave:'pesoCorporeo', valore:dati.pesoCorporeo});
    if (dati.ultimoAllenamento) stato.put({chiave:'ultimoAllenamento', valore:dati.ultimoAllenamento});
    if (Array.isArray(dati.schede) && dati.schede.length) stato.put({chiave:'schede', valore:dati.schede});
    t.oncomplete = ok; t.onerror = () => no(t.error);
  });
  return dati.sessioni.length;
}

/* Sull'iPhone installata dalla schermata home il collegamento di scaricamento
   spesso non fa niente: la via che funziona è il foglio di condivisione, che
   sa salvare su File o mandare dove vuoi. Torna false se l'hai annullato,
   così la data dell'ultimo backup non viene segnata a vuoto. */
export async function scaricaBackup(testo, nomeFile){
  const file = new File([testo], nomeFile, {type: 'application/json'});
  if (navigator.canShare && navigator.canShare({files: [file]})){
    try { await navigator.share({files: [file]}); return true; }
    catch (e){
      if (e.name === 'AbortError') return false;
      /* condivisione rotta: si ripiega sul collegamento */
    }
  }
  const url = URL.createObjectURL(new Blob([testo], {type:'application/json'}));
  const a = document.createElement('a');
  a.href = url; a.download = nomeFile;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

/* La data di oggi come '2026-08-08', in ora locale: `toISOString` darebbe
   il fuso di Greenwich e alle undici di sera scriverebbe il giorno dopo. */
export function oggi(d = new Date()){
  const p = n => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth()+1) + '-' + p(d.getDate());
}

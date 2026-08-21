/* L'interfaccia.
   La logica dei carichi sta in motore.js, le schede in schede.js.
   Qui si disegna e si raccolgono i tocchi. */

import {ESERCIZI, PER_ID, figura} from './esercizi.js';
import {prescrizione, prossimoAllenamento, gradinoPrecedente, prossimoGradino,
        indiceProgresso, pesoSuggerito, etichettaPrestazione, numero, recupero,
        record, ETICHETTA_SFORZO, PESO_DI_PARTENZA} from './motore.js';
import * as sched from './schede.js';
import * as archivio from './archivio.js';

const app = document.getElementById('app');
const SESSIONI_PRIMA_DEL_BACKUP = 6;

let sessioni = [], schede = [];
let pesoCorporeo = PESO_DI_PARTENZA, pesoImpostato = false;
let ultimoBackup = null, ultimaScheda = null;

let vista = 'casa', tab = 'casa';
let dettaglio = null, bozza = null, filtro = '';
let aperte = new Set();          /* sezioni del catalogo aperte */
let guardata = null;             /* sessione aperta nel diario */
let sess = null, riposo = null, correzione = null, inCorso = null;

/* ------------------------------------------------------------------ */
const scampa = t => String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
const fig = e => figura(e.disegno);
const gg = d => d.slice(8,10) + '/' + d.slice(5,7);
const senzaAccenti = t => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
const plur = (n, uno, tanti) => n + ' ' + (n === 1 ? uno : tanti);

function pulisciRiposo(){ if (riposo && riposo.id) clearInterval(riposo.id); riposo = null; }

/* ------------------------------------------------------------------
   La sessione in corso, salvata su disco: iOS chiude le web app in secondo
   piano senza avvisare, e l'allenamento si perdeva.
------------------------------------------------------------------ */
function salvaInCorso(){
  if (!sess || !sess.lista) return;
  const c = sess.corrente;
  archivio.scriviStato('sessioneInCorso', {
    schedaId: sess.schedaId, nome: sess.nome, data: sess.data, iniziata: sess.iniziata,
    lista: sess.lista, indice: sess.indice, esercizi: sess.esercizi,
    corrente: c ? {id: c.id, peso: c.peso, ripetizioni: c.ripetizioni,
                   serie: c.serie, chiudi: c.chiudi, ancora: c.ancora} : null
  }).catch(() => {});
}
function scordaInCorso(){
  sess = null; inCorso = null;
  return archivio.scriviStato('sessioneInCorso', null).catch(() => {});
}
function riprendi(){
  const s = inCorso;
  sess = {schedaId: s.schedaId, nome: s.nome, data: s.data, iniziata: s.iniziata || Date.now(),
          lista: s.lista, indice: s.indice, esercizi: s.esercizi || [],
          corrente: null, cambiaIndice: null};
  inCorso = null;
  if (s.corrente && sess.lista[sess.indice]){
    preparaEsercizio();
    const c = sess.corrente, v = s.corrente;
    if (c.id === v.id){
      c.peso = v.peso; c.ripetizioni = v.ripetizioni;
      c.serie = v.serie || []; c.chiudi = !!v.chiudi; c.ancora = !!v.ancora;
    }
  }
  tieniAcceso();
  vai('sessione');
}

/* Lo schermo non si spegne durante l'allenamento.
   iOS rilascia il blocco quando l'app va in secondo piano: senza azzerare
   `veglia` al rilascio, al ritorno sembrerebbe ancora attivo e non verrebbe
   mai richiesto di nuovo — e lo schermo ricomincerebbe a spegnersi. */
let veglia = null;
async function tieniAcceso(){
  try {
    if ('wakeLock' in navigator && !veglia){
      veglia = await navigator.wakeLock.request('screen');
      veglia.addEventListener('release', () => { veglia = null; });
    }
  }
  catch (e){ /* niente da fare: pazienza */ }
}
function lasciaSpegnere(){ if (veglia){ veglia.release().catch(() => {}); veglia = null; } }
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && sess) tieniAcceso();
});

async function ricarica(){
  sessioni = await archivio.tutteLeSessioni();
  schede = await sched.leggiSchede();
  ultimoBackup = await archivio.leggiStato('ultimoBackup', null);
  ultimaScheda = await archivio.leggiStato('ultimaScheda', null);
  inCorso = await archivio.leggiStato('sessioneInCorso', null);
  if (inCorso && (!inCorso.lista || !inCorso.lista.length)) inCorso = null;
  const p = await archivio.leggiStato('pesoCorporeo', null);
  pesoImpostato = p != null;
  pesoCorporeo = pesoImpostato ? p : PESO_DI_PARTENZA;
}

async function avvia(){
  try { await ricarica(); }
  catch (e){
    app.innerHTML = '<div class="contenuto"><p class="vuoto">Non riesco ad aprire l\'archivio su ' +
      'questo telefono, quindi non potrei salvare niente.<br><br>' + scampa(e.message) + '</p></div>';
    return;
  }
  disegna();
}

const VISTE = {
  casa: vistaCasa, anteprima: vistaAnteprima, sessione: vistaSessione, fine: vistaFine,
  schede: vistaSchede, scheda: vistaScheda, scelta: vistaScelta,
  esercizi: vistaEsercizi, esercizio: vistaEsercizio, aggiunta: vistaAggiunta,
  diario: vistaDiario, sessioneVista: vistaSessioneVista, correzione: vistaCorrezione,
  impostazioni: vistaImpostazioni
};
const SENZA_BARRA = new Set(['sessione','fine','anteprima','scelta','correzione','sessioneVista','aggiunta']);

let ultimaVista = null;
function disegna(){
  const prima = app.querySelector('.contenuto');
  const dove = (prima && vista === ultimaVista) ? prima.scrollTop : 0;
  app.innerHTML = '<section class="schermata' + (SENZA_BARRA.has(vista) ? ' senza-barra' : '') + '">' +
    (VISTE[vista] || vistaCasa)() + '</section>' + (SENZA_BARRA.has(vista) ? '' : barraNav());
  collega();
  const c = app.querySelector('.contenuto');
  if (c) c.scrollTop = dove;
  ultimaVista = vista;
  if (sess) salvaInCorso();
}
function vai(dove, nuovaTab){ vista = dove; if (nuovaTab) tab = nuovaTab; disegna(); }

/* ================= pezzi comuni ================= */
const ICONE = {
  casa: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  schede: '<rect x="3" y="4" width="18" height="6" rx="2"/><rect x="3" y="14" width="18" height="6" rx="2"/>',
  esercizi: '<rect x="3" y="3" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="2"/>' +
            '<rect x="3" y="13.5" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2"/>',
  impostazioni: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2.4"/><circle cx="8" cy="17" r="2.4"/>'
};
function barraNav(){
  return '<nav class="barra-nav">' +
    [['casa','Casa'],['schede','Schede'],['esercizi','Esercizi'],['impostazioni','Impostazioni']]
    .map(([id, nome]) =>
      '<button data-tab="' + id + '" class="' + (tab === id ? 'attiva' : '') + '"' +
      (tab === id ? ' aria-current="page"' : '') + '><svg viewBox="0 0 24 24" fill="none" ' +
      'stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ' +
      'aria-hidden="true">' + ICONE[id] + '</svg><span>' + nome + '</span></button>').join('') + '</nav>';
}
function testata(titolo, occhio, indietro){
  return '<div class="testata">' +
    (indietro ? '<button class="indietro" data-va="' + indietro + '">‹ Indietro</button>' : '') +
    (occhio ? '<p class="occhio">' + scampa(occhio) + '</p>' : '') +
    '<h1>' + scampa(titolo) + '</h1></div>';
}
function voceEsercizio(e){
  return '<div class="voce"><span class="fig">' + fig(e) + '</span>' +
    '<span class="n">' + scampa(e.n) + '</span>' +
    '<span class="d mono">' + e.fascia[0] + '-' + e.fascia[1] + '</span></div>';
}
function nomeScheda(s){ return s.nome || 'Scheda senza nome'; }

/* ================= CASA ================= */
function prossimaScheda(){
  if (!schede.length) return null;
  return prossimoAllenamento(schede, ultimaScheda);
}

function vistaCasa(){
  const s = prossimaScheda();
  const ultime = sessioni.slice(-3).reverse();
  const daBackup = ultimoBackup ? sessioni.filter(x => x.data > ultimoBackup).length : sessioni.length;

  return testata('Oggi', 'Spingere') +
    '<div class="contenuto">' +

      (inCorso
        ? '<div class="carta"><div class="intestazione-carta">' +
            '<span class="quanto">Allenamento lasciato a metà</span>' +
            '<span class="quali">' + scampa(inCorso.nome) + ' · ' + gg(inCorso.data) + ' · ' +
              plur(inCorso.esercizi ? inCorso.esercizi.length : 0, 'esercizio fatto', 'esercizi fatti') +
            '</span></div><div class="riga-azioni">' +
            '<button class="azione pieno" data-riprendi style="flex:1">Riprendi</button>' +
            '<button class="azione" data-butta>Butta via</button></div></div>'
        : '') +

      (s
        ? '<div class="carta"><div class="intestazione-carta">' +
            '<span class="quanto">' + scampa(nomeScheda(s)) + '</span>' +
            '<span class="quali">' + plur(s.esercizi.length, 'esercizio', 'esercizi') + ' · circa ' +
              sched.minutiScheda(s.esercizi) + ' minuti</span></div>' +
          '<div class="elenco">' + s.esercizi.map(id => voceEsercizio(PER_ID[id])).join('') + '</div></div>' +
          (schede.length > 1
            ? '<button class="azione" data-va="schede" style="width:100%;margin-bottom:var(--s3)">' +
              'Fanne un\'altra</button>' : '')
        : '<div class="carta"><div class="intestazione-carta">' +
            '<span class="quanto">Non hai ancora nessuna scheda</span>' +
            '<span class="quali">Una scheda è la lista degli esercizi che vuoi fare, nell\'ordine che ' +
            'vuoi. Falla una volta e la ritrovi qui ogni volta.</span></div></div>') +

      (pesoImpostato ? '' :
        '<button class="carta carta-riga" data-va="impostazioni">' +
          '<span class="testo"><span class="t">Manca il tuo peso corporeo</span>' +
          '<span class="s">Serve ai grafici di trazioni, dip e flessioni, dove il carico sei tu.</span>' +
          '</span><span class="freccia">›</span></button>') +

      (daBackup >= SESSIONI_PRIMA_DEL_BACKUP
        ? '<button class="carta carta-riga" data-va="impostazioni">' +
            '<span class="testo"><span class="t">' + plur(daBackup, 'sessione', 'sessioni') +
            ' senza backup</span><span class="s">Lo storico sta solo qui: se perdi il telefono lo ' +
            'perdi con lui.</span></span><span class="freccia">›</span></button>' : '') +

      (ultime.length
        ? '<p class="sezione">Ultimi allenamenti</p>' + ultime.map(cartaSessione).join('') +
          '<button class="azione" data-va="diario" style="width:100%;margin-top:var(--s2)">' +
            'Tutto il diario</button>'
        : '') +
    '</div>' +
    '<div class="fondo-pagina">' +
      (s ? '<button class="grosso" data-inizia="' + s.id + '">Comincia</button>'
         : '<button class="grosso" data-nuova>Crea la prima scheda</button>') +
    '</div>';
}

function cartaSessione(s){
  return '<button class="carta carta-riga stretta" data-sessione="' + s.id + '">' +
    '<span class="testo"><span class="t">' + scampa(s.nomeScheda || 'Allenamento') + '</span>' +
    '<span class="s">' + gg(s.data) + ' · ' + plur(s.esercizi.length, 'esercizio', 'esercizi') +
      ' · ' + (s.durataMin || 0) + ' min</span></span><span class="freccia">›</span></button>';
}

/* ================= SCHEDE ================= */
function vistaSchede(){
  return testata('Schede', schede.length ? plur(schede.length, 'scheda', 'schede') : null) +
    '<div class="contenuto">' +
      (schede.length
        ? schede.map(s =>
            '<div class="carta"><div class="carta-riga"><span class="testo">' +
              '<span class="t">' + scampa(nomeScheda(s)) + '</span>' +
              '<span class="s">' + plur(s.esercizi.length, 'esercizio', 'esercizi') + ' · ' +
                sched.minutiScheda(s.esercizi) + ' min · ' +
                scampa(sched.gruppiToccati(s.esercizi).join(', ').toLowerCase() || '—') +
              '</span></span></div><div class="riga-azioni" style="margin-top:var(--s3)">' +
              (s.esercizi.length
                ? '<button class="azione pieno" data-fai="' + s.id + '" style="flex:1">Fai questa</button>'
                : '') +
              '<button class="azione" data-modifica="' + s.id + '">Modifica</button>' +
              '<button class="azione" data-copia="' + s.id + '">Duplica</button>' +
            '</div></div>').join('')
        : '<p class="vuoto">Nessuna scheda. Falla tu: scegli gli esercizi che vuoi, ' +
          'nell\'ordine che vuoi.</p>') +
    '</div>' +
    '<div class="fondo-pagina"><button class="grosso" data-nuova>Nuova scheda</button></div>';
}

function vistaScheda(){
  const s = bozza;
  const righe = s.esercizi.map((id, i) => {
    const e = PER_ID[id];
    if (!e) return '';
    return '<div class="voce"><span class="fig">' + fig(e) + '</span>' +
      '<span class="n">' + scampa(e.n) + '</span>' +
      '<button class="mini" data-su="' + i + '"' + (i === 0 ? ' disabled' : '') +
        ' aria-label="Sposta su">↑</button>' +
      '<button class="mini" data-giu="' + i + '"' + (i === s.esercizi.length-1 ? ' disabled' : '') +
        ' aria-label="Sposta giù">↓</button>' +
      '<button class="mini via" data-togli="' + i + '" aria-label="Togli">✕</button></div>';
  }).join('');

  return testata('Scheda', null, 'schede') +
    '<div class="contenuto">' +
      '<div class="carta"><div class="campo" style="margin:0"><span class="eti">Nome</span>' +
        '<div class="riga"><input id="nome-scheda" type="text" value="' + scampa(s.nome) +
        '" maxlength="30" placeholder="Per esempio: Sopra" autocomplete="off"></div></div></div>' +

      '<div class="carta">' +
        '<div class="intestazione-carta"><span class="quanto">' +
          plur(s.esercizi.length, 'esercizio', 'esercizi') + ' · circa ' +
          sched.minutiScheda(s.esercizi) + ' minuti</span>' +
          '<span class="quali">Si fanno in quest\'ordine. Le frecce li spostano.</span></div>' +
        (righe ? '<div class="elenco">' + righe + '</div>'
               : '<p class="vuoto" style="padding:var(--s3) 0">Ancora nessun esercizio.</p>') +
        '<button class="azione" data-aggiungi style="width:100%;margin-top:var(--s3)">' +
          'Aggiungi esercizi</button>' +
      '</div>' +

      (schede.some(x => x.id === s.id)
        ? '<button class="azione rossa" data-elimina style="width:100%">Elimina questa scheda</button>'
        : '') +
    '</div>' +
    '<div class="fondo-pagina"><button class="grosso" data-salva-scheda>Salva</button></div>';
}

/* ================= CATALOGO A SEZIONI ================= */
/* Quarantotto esercizi di fila erano dodici schermate di scorrimento. Ora le
   sezioni partono chiuse; cercando si aprono da sole, perché a quel punto
   quello che conta è il risultato, non la struttura. */
function sezioniEsercizi(modo, dentro){
  const q = senzaAccenti(filtro.trim());
  const fuori = [];
  for (const sez of sched.sezioni()){
    const lista = q ? sez.lista.filter(e => senzaAccenti(e.n + ' ' + e.gruppo).includes(q)) : sez.lista;
    if (!lista.length) continue;
    const apri = q ? true : aperte.has(sez.nome);
    fuori.push(
      '<button class="sezione-testa' + (apri ? ' aperta' : '') + '" data-sezione="' +
        scampa(sez.nome) + '" aria-expanded="' + apri + '">' +
        '<span class="freccia-sez">›</span><span class="nome-sez">' + scampa(sez.nome) + '</span>' +
        '<span class="conta-sez mono">' + lista.length + '</span></button>' +
      (apri ? '<div class="sezione-corpo">' + lista.map(e => rigaEsercizio(e, modo, dentro)).join('') +
              '</div>' : '')
    );
  }
  return fuori.length ? fuori.join('') :
    '<p class="vuoto">Nessun esercizio con «' + scampa(filtro) + '».</p>';
}

function rigaEsercizio(e, modo, dentro){
  if (modo === 'aggiungi'){
    return '<button class="riga-scelta" data-aggiungi-questo="' + e.id + '">' +
      '<span class="fig">' + fig(e) + '</span>' +
      '<span><span class="titolo">' + scampa(e.n) + '</span>' +
      '<span class="sotto mono">' + e.fascia[0] + '-' + e.fascia[1] +
        (e.unilaterale ? '/lato' : '') + '</span></span><span class="segno">+</span></button>';
  }
  if (modo === 'scegli'){
    const c = dentro.includes(e.id);
    return '<button class="riga-scelta" data-scegli="' + e.id + '" aria-pressed="' + c + '">' +
      '<span class="fig">' + fig(e) + '</span>' +
      '<span><span class="titolo">' + scampa(e.n) + '</span>' +
      '<span class="sotto mono">' + e.fascia[0] + '-' + e.fascia[1] +
        (e.unilaterale ? '/lato' : '') + '</span></span>' +
      '<span class="segno">' + (c ? '✓' : '+') + '</span></button>';
  }
  const st = archivio.storicoEsercizio(sessioni, e.id);
  return '<button class="riga-scelta" data-apri="' + e.id + '">' +
    '<span class="fig">' + fig(e) + '</span>' +
    '<span><span class="titolo">' + scampa(e.n) + '</span>' +
    '<span class="sotto mono">' + (st.length
      ? plur(st.length, 'sessione', 'sessioni') + ' · ' +
        etichettaPrestazione(e, st[0].peso, Math.max(...st[0].serie))
      : 'mai fatto · ' + e.fascia[0] + '-' + e.fascia[1]) + '</span></span>' +
    '<span class="freccia">›</span></button>';
}

function vistaEsercizi(){
  return testata('Esercizi', ESERCIZI.length + ' nel catalogo') +
    '<div class="cerca"><input id="cerca" type="search" placeholder="Cerca" value="' +
      scampa(filtro) + '" autocomplete="off" enterkeyhint="search"></div>' +
    '<div class="contenuto"><div id="lista">' + sezioniEsercizi('apri') + '</div></div>';
}

function vistaScelta(){
  return testata('Aggiungi esercizi') +
    '<div class="cerca"><input id="cerca" type="search" placeholder="Cerca" value="' +
      scampa(filtro) + '" autocomplete="off" enterkeyhint="search"></div>' +
    '<div class="contenuto"><div id="lista">' + sezioniEsercizi('scegli', bozza.esercizi) + '</div></div>' +
    '<div class="fondo-pagina"><button class="grosso" id="fatto" data-va="scheda">Fatto · ' +
      plur(bozza.esercizi.length, 'scelto', 'scelti') + '</button></div>';
}

/* Aggiungere un esercizio a sessione gia iniziata: stesso catalogo a sezioni,
   ma toccarne uno lo mette in coda e riparte da li. */
function vistaAggiunta(){
  return testata('Aggiungi un esercizio', 'alla sessione di oggi') +
    '<div class="cerca"><input id="cerca" type="search" placeholder="Cerca" value="' +
      scampa(filtro) + '" autocomplete="off" enterkeyhint="search"></div>' +
    '<div class="contenuto"><div id="lista">' + sezioniEsercizi('aggiungi') + '</div></div>' +
    '<div class="fondo-pagina"><button class="grosso quieto" data-torna-fine>Lascia stare</button></div>';
}

/* ================= DETTAGLIO ESERCIZIO ================= */
function vistaEsercizio(){
  const e = PER_ID[dettaglio];
  const st = archivio.storicoEsercizio(sessioni, e.id).slice().reverse();
  const punti = st.map(s => ({data: s.data, peso: s.peso, rip: Math.max(...s.serie),
    valore: indiceProgresso(e, s.peso, Math.max(...s.serie), pesoCorporeo)}));
  const righe = st.slice().reverse().map(s =>
    '<tr><td class="mono">' + gg(s.data) + '</td><td class="mono">' + caricoScritto(e, s.peso) +
    '</td><td class="mono">' + s.serie.join('-') + '</td></tr>').join('');
  const dove = schede.filter(s => s.esercizi.includes(e.id));

  return testata(e.n, null, 'esercizi') +
    '<div class="contenuto">' +
      '<div class="carta"><div class="figurone" style="max-width:180px">' + fig(e) + '</div>' +
        '<p class="sottotitolo" style="text-align:center">' + (e.nota ? scampa(e.nota) + ' · ' : '') +
        'fascia ' + e.fascia[0] + '-' + e.fascia[1] + (e.unilaterale ? ' per lato' : '') +
        ' · ' + recupero(e) + 's di recupero</p></div>' +

      (punti.length
        ? '<div class="carta"><div class="titolo-carta">Progresso</div>' + grafico(punti, e) +
          '<table class="tabella"><thead><tr><th>Giorno</th><th>Carico</th><th>Serie</th></tr></thead>' +
          '<tbody>' + righe + '</tbody></table></div>'
        : '<div class="carta"><p class="sottotitolo" style="margin:0">Non l\'hai ancora mai fatto.</p></div>') +

      '<div class="carta stretta"><div class="carta-riga"><span class="testo">' +
        '<span class="t">' + (dove.length ? 'In ' + dove.map(s => scampa(nomeScheda(s))).join(', ')
                                          : 'In nessuna scheda') + '</span>' +
        '<span class="s">Le schede si cambiano dalla scheda stessa.</span></span></div></div>' +
    '</div>' +
    '<div class="fondo-pagina"><button class="grosso quieto" data-solo="' + e.id +
      '">Fai adesso, da solo</button></div>';
}

function caricoScritto(e, peso){
  if (e.carico === 'corpo' || (e.carico === 'zavorra' && !peso)) return 'corpo';
  return numero(peso) + ' kg';
}

/* ================= SESSIONE ================= */
function iniziaSessione(schedaId, nome, lista){
  sess = {schedaId, nome, data: archivio.oggi(), iniziata: Date.now(),
          lista: lista.slice(), indice: 0, esercizi: [], corrente: null, cambiaIndice: null};
  tieniAcceso();
  vai('anteprima');
}

function preparaEsercizio(){
  const id = sess.lista[sess.indice];
  const e = PER_ID[id];
  const p = prescrizione(e, archivio.storicoEsercizio(sessioni, id), sess.data, pesoCorporeo);
  sess.corrente = {id, esercizio: e, pres: p,
    peso: p.peso === null ? pesoSuggerito(e) : p.peso,
    ripetizioni: p.bersaglio, serie: [], chiudi: false, ancora: false};
}

function vistaAnteprima(){
  if (sess.cambiaIndice !== null) return vistaCambia();
  return testata('Prima di cominciare', scampa(sess.nome), 'casa') +
    '<div class="contenuto">' +
      '<p class="sottotitolo" style="margin-bottom:var(--s4)">Tocca un esercizio per cambiarlo solo ' +
        'per oggi. La scheda resta com\'è.</p>' +
      sess.lista.map((id, i) => {
        const e = PER_ID[id];
        return '<button class="carta carta-riga stretta" data-cambia="' + i + '">' +
          '<span class="fig" style="width:44px;height:44px;flex:none">' + fig(e) + '</span>' +
          '<span class="testo"><span class="t">' + scampa(e.n) + '</span>' +
          '<span class="s">' + e.fascia[0] + '-' + e.fascia[1] + (e.unilaterale ? ' per lato' : '') +
            ' · ' + recupero(e) + 's</span></span><span class="freccia">⇄</span></button>';
      }).join('') +
    '</div>' +
    '<div class="fondo-pagina"><button class="grosso" data-parti>Inizia</button></div>';
}

function vistaCambia(){
  const i = sess.cambiaIndice;
  const attuale = PER_ID[sess.lista[i]];
  const alt = sched.alternative(attuale.id, sess.lista);
  return testata('Al posto di', scampa(attuale.n)) +
    '<div class="contenuto">' +
      (alt.length ? alt.map(x =>
        '<button class="carta carta-riga stretta" data-conalternativa="' + x.id + '">' +
          '<span class="fig" style="width:44px;height:44px;flex:none">' + fig(x) + '</span>' +
          '<span class="testo"><span class="t">' + scampa(x.n) + '</span>' +
          '<span class="s">' + x.fascia[0] + '-' + x.fascia[1] +
            (x.unilaterale ? ' per lato' : '') + '</span></span>' +
          '<span class="freccia">›</span></button>').join('')
        : '<p class="vuoto">Non ci sono altri esercizi di questo gruppo fuori dalla scheda.</p>') +
    '</div>' +
    '<div class="fondo-pagina"><button class="grosso quieto" data-annulla-cambio>Lascia com\'era</button></div>';
}

function vistaSessione(){
  if (sess.cambiaIndice !== null) return vistaCambia();
  const c = sess.corrente;
  if (!c) return vistaFinito();

  const e = c.esercizio, p = c.pres;
  const tacche = sess.lista.map((_, i) =>
    '<i class="' + (i < sess.indice ? 'fatto' : i === sess.indice ? 'ora' : '') + '"></i>').join('');
  const mostraSforzo = (c.serie.length >= 3 && !c.ancora) || c.chiudi;

  return '<div class="cima"><button data-esci>Esci</button>' +
      '<span class="passo mono">' + (sess.indice+1) + ' di ' + sess.lista.length +
        ' · <span id="minuti">' + Math.max(0, Math.round((Date.now() - sess.iniziata) / 60000)) +
        '</span> min</span></div>' +
    '<div class="avanzamento">' + tacche + '</div>' +
    '<div class="contenuto" style="padding-bottom:var(--s4)">' +
      '<div class="figurone">' + fig(e) + '</div>' +
      '<h2 class="nome-esercizio">' + scampa(e.n) + '</h2>' +
      '<p class="sottotitolo">' + (e.nota ? scampa(e.nota) + ' · ' : '') +
        'fascia ' + e.fascia[0] + '-' + e.fascia[1] + (e.unilaterale ? ' per lato' : '') + '</p>' +
      '<p class="messaggio' + (p.sale || p.rientro ? ' acceso' : '') + '">' + scampa(p.messaggio) +
        (p.record ? ' Record: ' + etichettaPrestazione(e, p.record.peso, p.record.ripetizioni) + '.' : '') +
        (p.salite >= 2 ? ' ' + p.salite + ' salite di fila.' : '') + '</p>' +
      '<div class="minori"><button data-sostituisci>Cambia esercizio</button>' +
        '<button data-salta>Salta</button></div>' +
    '</div>' +
    '<div class="comandi">' + (riposo ? riquadroRiposo() : '') +
      pannelloPeso(e, c) + pannelloSerie(c) +
      (mostraSforzo ? pannelloSforzo() : pannelloConta(c)) + '</div>';
}

function pannelloPeso(e, c){
  if (e.carico === 'corpo') return '<div class="peso"><span class="corpo">A corpo libero</span></div>';
  const giu = gradinoPrecedente(e.carico, c.peso), su = prossimoGradino(e.carico, c.peso);
  const eti = e.carico === 'zavorra'
    ? (c.peso === 0 ? 'solo il corpo' : 'zavorra fra i piedi')
    : (e.manubri === 2 ? 'per manubrio' : 'un manubrio');
  return '<div class="peso">' +
    '<button class="gradino" data-peso="giu"' + (giu === null ? ' disabled' : '') + '>−</button>' +
    '<span class="valore"><span class="kg mono' + (c.pres.sale ? ' sale' : '') + '">' + numero(c.peso) +
      '</span><span class="unita">kg · ' + eti + '</span></span>' +
    '<button class="gradino" data-peso="su"' + (su === null ? ' disabled' : '') + '>+</button></div>';
}

function pannelloSerie(c){
  let out = '';
  for (let i = 0; i < Math.max(3, c.serie.length); i++){
    const fatta = c.serie[i] !== undefined, viva = !fatta && i === c.serie.length;
    out += '<div class="casella' + (fatta ? '' : viva ? ' viva' : ' vuota') + '">' +
      '<span class="n mono">' + (fatta ? c.serie[i] : viva ? c.ripetizioni : '–') + '</span>' +
      '<span class="e">serie ' + (i+1) + '</span></div>';
  }
  return '<div class="serie">' + out + '</div>';
}

function pannelloConta(c){
  return '<div class="conta">' +
      '<button class="salto" data-rip="-5">−5</button>' +
      '<button class="gradino" data-rip="-1">−</button>' +
      '<span class="quanti mono">' + c.ripetizioni + '</span>' +
      '<button class="gradino" data-rip="1">+</button>' +
      '<button class="salto" data-rip="5">+5</button></div>' +
    '<button class="grosso" data-serie>Serie ' + (c.serie.length + 1) + ' fatta</button>' +
    (c.serie.length >= 1
      ? '<button class="sotto-grosso" data-chiudi>Chiudo qui, ' +
        plur(c.serie.length, 'serie', 'serie') + '</button>' : '');
}

function pannelloSforzo(){
  return '<p class="sottotitolo" style="margin:0 0 var(--s2)">Com\'è andata l\'ultima serie?</p>' +
    '<div class="sforzo">' + ['facile','giusta','limite'].map(s =>
      '<button data-sforzo="' + s + '">' + ETICHETTA_SFORZO[s] + '</button>').join('') + '</div>' +
    '<button class="sotto-grosso" data-ancora>Ne faccio un\'altra</button>';
}

/* Il bip di fine recupero. In secondo piano iOS non fa suonare niente, ma a
   schermo acceso si può: il contesto audio però nasce solo dentro un tocco,
   quindi lo si prepara sui pulsanti della sessione. Con la suoneria spenta
   resta muto — è un di più, non una promessa. */
let audio = null;
function preparaAudio(){
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
  } catch (e){ audio = null; }
}
function bip(){
  if (!audio || audio.state !== 'running' || document.visibilityState !== 'visible') return;
  try {
    const t = audio.currentTime;
    for (const [freq, dopo] of [[880, 0], [880, .18], [1175, .36]]){
      const o = audio.createOscillator(), g = audio.createGain();
      o.type = 'sine'; o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t + dopo);
      g.gain.exponentialRampToValueAtTime(0.4, t + dopo + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dopo + 0.15);
      o.connect(g).connect(audio.destination);
      o.start(t + dopo); o.stop(t + dopo + 0.16);
    }
  } catch (e){ /* il bip è un di più */ }
}

/* Il recupero si legge dall'orologio, non contando all'indietro: iOS congela
   i timer quando l'app va in secondo piano, e al ritorno il conto era fermo
   a dove l'avevi lasciato. */
function restaRiposo(){
  return Math.max(0, Math.ceil((riposo.fine - Date.now()) / 1000));
}
function riquadroRiposo(){
  const r = 21, giro = 2 * Math.PI * r, resta = restaRiposo();
  return '<div class="recupero"><svg viewBox="0 0 50 50" aria-hidden="true">' +
      '<circle class="anello" cx="25" cy="25" r="' + r + '"/>' +
      '<circle class="quota" cx="25" cy="25" r="' + r + '" stroke-dasharray="' + giro.toFixed(1) +
      '" stroke-dashoffset="' + (giro - giro * (resta / riposo.totale)).toFixed(1) + '"/></svg>' +
    '<div><div class="tempo mono" id="tempo">' + resta + 's</div>' +
      '<div class="avviso">Alla fine fa un bip — ma solo con l\'app davanti.</div></div>' +
    '<button class="salta" data-salta-riposo>Salta</button></div>';
}
function avviaRiposo(secondi){
  pulisciRiposo();
  riposo = {fine: Date.now() + secondi * 1000, totale: secondi, id: null};
  riposo.id = setInterval(() => {
    const resta = restaRiposo();
    if (resta <= 0){ pulisciRiposo(); bip(); disegna(); return; }
    const t = document.getElementById('tempo'), q = document.querySelector('.recupero .quota');
    if (!t){ pulisciRiposo(); return; }
    t.textContent = resta + 's';
    const min = document.getElementById('minuti');
    if (min && sess && sess.iniziata)
      min.textContent = Math.max(0, Math.round((Date.now() - sess.iniziata) / 60000));
    if (q){
      const giro = 2 * Math.PI * 21;
      q.setAttribute('stroke-dashoffset', (giro - giro * (resta / riposo.totale)).toFixed(1));
    }
  }, 500);
}

/* `pausaDopo`: il recupero da far correre sull'esercizio successivo. Prima il
   timer partiva solo fra le serie, e fra un esercizio e l'altro si ripartiva
   a freddo o si perdeva tempo a occhio. */
function avanti(pausaDopo){
  pulisciRiposo();
  sess.indice++;
  if (sess.indice < sess.lista.length){
    preparaEsercizio();
    if (pausaDopo) avviaRiposo(pausaDopo);
    disegna(); return;
  }
  sess.corrente = null;
  disegna();
}

/* La frase non è più scritta fissa: «il grosso è fatto» dopo un esercizio solo
   era una presa in giro. */
function vistaFinito(){
  const n = sess.esercizi.length;
  const parola = n === 0
    ? 'Non hai registrato niente.'
    : n === 1
      ? 'Un esercizio fatto. Se vuoi puoi aggiungerne un altro, se no si chiude qui.'
      : n < 4
        ? plur(n, 'esercizio fatto', 'esercizi fatti') + '. Puoi aggiungerne un altro o chiudere.'
        : 'Fatti tutti e ' + n + '. Puoi aggiungerne uno o chiudere qui.';
  return testata(n >= 4 ? 'Scheda finita' : 'Finito?', null) +
    '<div class="contenuto"><p class="messaggio">' + parola + '</p></div>' +
    '<div class="fondo-pagina">' +
      '<button class="grosso quieto" data-aggiungi-uno>Aggiungi un esercizio</button>' +
      '<div style="height:var(--s2)"></div>' +
      '<button class="grosso" data-basta>Chiudi e salva</button></div>';
}

async function concludi(){
  pulisciRiposo(); lasciaSpegnere();
  const durata = Math.round((Date.now() - sess.iniziata) / 60000);
  const fatte = sess.esercizi, nome = sess.nome, schedaId = sess.schedaId;
  if (fatte.length){
    await archivio.salvaSessione({data: sess.data, nomeScheda: nome, durataMin: durata, esercizi: fatte});
    if (schedaId){ ultimaScheda = schedaId; await archivio.scriviStato('ultimaScheda', schedaId); }
  }
  await scordaInCorso();
  sess = {esercizi: fatte, nome};
  await ricarica();
  vai('fine');
}

function vistaFine(){
  const fatte = sess ? sess.esercizi : [];
  if (!fatte.length)
    return testata('Niente da salvare') + '<div class="contenuto"><p class="messaggio">' +
      'Non hai completato nessuna serie.</p></div>' +
      '<div class="fondo-pagina"><button class="grosso" data-va="casa">Torna a casa</button></div>';

  /* I record battuti oggi si dicono: era il punto di tutta l'app. */
  const battuti = fatte.filter(x => {
    const e = PER_ID[x.id];
    if (!e) return false;
    const prima = archivio.storicoEsercizio(sessioni, x.id).filter(s => s.data !== sess.data);
    const r = record(e, prima, pesoCorporeo);
    if (!r) return false;
    const oggi = indiceProgresso(e, x.peso, Math.max(...x.serie), pesoCorporeo);
    return oggi > indiceProgresso(e, r.peso, r.ripetizioni, pesoCorporeo);
  });

  return testata('Fatto.', scampa(sess.nome) + ' registrato') +
    '<div class="contenuto"><div class="carta">' +
      '<table class="tabella"><thead><tr><th>Esercizio</th><th>Carico</th><th>Serie</th></tr></thead>' +
      '<tbody>' + fatte.map(x => {
        const e = PER_ID[x.id];
        return '<tr><td>' + scampa(e.n) + '</td><td class="mono">' + caricoScritto(e, x.peso) +
          '</td><td class="mono">' + x.serie.join('-') + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      (battuti.length
        ? '<p class="messaggio acceso">' + (battuti.length === 1
            ? 'Record battuto: ' + scampa(PER_ID[battuti[0].id].n) + '.'
            : plur(battuti.length, 'record battuto', 'record battuti') + ': ' +
              battuti.map(x => scampa(PER_ID[x.id].n)).join(', ') + '.') + '</p>'
        : '') +
    '</div>' +
    '<div class="fondo-pagina"><button class="grosso" data-va="casa">Chiudi</button></div>';
}

/* ================= DIARIO ================= */
function vistaDiario(){
  return testata('Diario', plur(sessioni.length, 'sessione', 'sessioni'), 'casa') +
    '<div class="contenuto">' +
      (sessioni.length
        ? sessioni.slice().reverse().map(cartaSessione).join('')
        : '<p class="vuoto">Ancora nessun allenamento.</p>') +
    '</div>';
}

/* Prima toccando una sessione si finiva dritti nella schermata di modifica,
   coi campi numerici aperti. Un diario serve prima di tutto a guardare. */
function vistaSessioneVista(){
  const s = guardata;
  return testata(scampa(s.nomeScheda || 'Allenamento'),
                 gg(s.data) + ' · ' + (s.durataMin || 0) + ' minuti', 'diario') +
    '<div class="contenuto">' +
      s.esercizi.map(x => {
        const e = PER_ID[x.id];
        if (!e) return '';
        return '<div class="carta stretta"><div class="carta-riga">' +
          '<span class="fig" style="width:44px;height:44px;flex:none">' + fig(e) + '</span>' +
          '<span class="testo"><span class="t">' + scampa(e.n) + '</span>' +
          '<span class="s mono">' + caricoScritto(e, x.peso) + ' · ' + x.serie.join(' · ') +
            (x.sforzo ? ' · ' + ETICHETTA_SFORZO[x.sforzo].toLowerCase() : '') +
          '</span></span></div></div>';
      }).join('') +
      '<button class="azione" data-correggi style="width:100%;margin-top:var(--s3)">' +
        'Correggi i numeri</button>' +
    '</div>';
}

function vistaCorrezione(){
  const s = correzione;
  return testata('Correggi', gg(s.data) + ' · ' + scampa(s.nomeScheda || 'Allenamento'), 'diario') +
    '<div class="contenuto">' +
      '<p class="sottotitolo" style="margin-bottom:var(--s4)">Cambia quello che avevi digitato male: ' +
        'la correzione rientra subito nella progressione di quell\'esercizio.</p>' +
      s.esercizi.map((x, i) => {
        const e = PER_ID[x.id];
        if (!e) return '';
        return '<div class="carta"><div class="titolo-carta">' + scampa(e.n) + '</div>' +
          '<div class="campo" style="margin:0"><div class="riga">' +
            (e.carico === 'corpo' ? '' :
              '<input type="number" step="0.5" min="0" max="40" data-cpeso="' + i + '" value="' +
              (x.peso == null ? '' : x.peso) + '" aria-label="carico">') +
            x.serie.map((r, j) => '<input type="number" step="1" min="0" max="99" data-cserie="' +
              i + ':' + j + '" value="' + r + '" aria-label="serie ' + (j+1) + '">').join('') +
          '</div></div></div>';
      }).join('') +
      '<button class="azione rossa" data-cancella-sessione style="width:100%;margin-top:var(--s3)">' +
        'Cancella tutta la sessione</button>' +
    '</div>' +
    '<div class="fondo-pagina"><button class="grosso" data-salva-correzione>Salva</button></div>';
}

/* ================= GRAFICO ================= */
function grafico(punti, e){
  const L = 320, A = 180, sx = 14, dx = 14, su = 20, giu = 24;
  if (!punti.length) return '';
  if (punti.length === 1)
    return '<p class="messaggio">Una sola sessione: ' + etichettaPrestazione(e, punti[0].peso, punti[0].rip) +
      '. Serve una seconda per vedere una curva.</p>';
  const vals = punti.map(p => p.valore);
  let min = Math.min(...vals), max = Math.max(...vals);
  if (min === max){ min -= 1; max += 1; }
  const m = (max - min) * 0.18; min -= m; max += m;
  const X = i => sx + (L - sx - dx) * (i / (punti.length - 1));
  const Y = v => su + (A - su - giu) * (1 - (v - min) / (max - min));
  const d = punti.map((p, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(p.valore).toFixed(1)).join(' ');
  let griglia = '';
  for (const q of [0, .5, 1]){
    const y = Y(min + (max-min)*q);
    griglia += '<line class="griglia" x1="' + sx + '" y1="' + y.toFixed(1) + '" x2="' + (L-dx) +
      '" y2="' + y.toFixed(1) + '"/>';
  }
  const cerchi = punti.map((p, i) => '<circle class="punto" cx="' + X(i).toFixed(1) + '" cy="' +
    Y(p.valore).toFixed(1) + '" r="' + (i === punti.length-1 ? 4.5 : 2.6) + '"/>').join('');
  const u = punti[punti.length-1], uy = Y(u.valore), alto = uy < su + 16;
  const testo = etichettaPrestazione(e, u.peso, u.rip);
  return '<svg class="grafico" viewBox="0 0 ' + L + ' ' + A + '" role="img" aria-label="Progresso su ' +
    punti.length + ' sessioni. Ultima: ' + scampa(testo) + '">' + griglia +
    '<path class="area" d="' + d + ' L' + X(punti.length-1).toFixed(1) + ' ' + (A-giu) + ' L' + sx +
      ' ' + (A-giu) + ' Z"/><path class="linea" d="' + d + '"/>' + cerchi +
    '<text x="' + (L-dx) + '" y="' + (alto ? uy+16 : uy-11).toFixed(1) + '" text-anchor="end" ' +
      'style="fill:var(--testo);font-size:11px">' + scampa(testo) + '</text>' +
    '<text x="' + sx + '" y="' + (A-8) + '">' + gg(punti[0].data) + '</text>' +
    '<text x="' + (L-dx) + '" y="' + (A-8) + '" text-anchor="end">' + gg(u.data) + '</text></svg>';
}

/* ================= IMPOSTAZIONI ================= */
function vistaImpostazioni(){
  const daBackup = ultimoBackup ? sessioni.filter(s => s.data > ultimoBackup).length : sessioni.length;
  return testata('Impostazioni') +
    '<div class="contenuto">' +
      '<div class="carta"><div class="campo" style="margin:0"><span class="eti">Peso corporeo</span>' +
        '<p class="spiega">Serve agli esercizi a corpo libero — trazioni, dip, flessioni — dove il ' +
        'carico sei tu. Senza, il grafico ti mostra fermo mentre progredisci.</p>' +
        '<div class="riga"><input id="peso-corpo" type="number" inputmode="decimal" step="0.5" ' +
          'min="30" max="200" value="' + (pesoImpostato ? pesoCorporeo : '') + '" placeholder="' +
          PESO_DI_PARTENZA + '"><button class="azione" data-salva-peso>Salva</button></div>' +
      '</div></div>' +

      '<div class="carta"><div class="campo" style="margin:0"><span class="eti">Backup</span>' +
        '<p class="spiega">Lo storico sta solo su questo telefono. Se cancelli l\'icona dalla ' +
        'schermata home o resetti l\'iPhone se ne va con lui.' +
        (ultimoBackup ? ' Ultimo backup: ' + gg(ultimoBackup) + ', ' +
          plur(daBackup, 'sessione fa', 'sessioni fa') + '.' : ' Non ne hai mai fatto uno.') + '</p>' +
        '<div class="riga"><button class="azione pieno" data-esporta>Esporta</button>' +
        '<button class="azione" data-importa>Ripristina da file</button></div>' +
        '<input id="file-backup" type="file" accept="application/json,.json" hidden></div></div>' +

      '<div class="carta"><div class="campo" style="margin:0"><span class="eti">Diario</span>' +
        '<p class="spiega">' + plur(sessioni.length, 'sessione registrata', 'sessioni registrate') +
        '. Da lì si guardano e si correggono.</p>' +
        '<div class="riga"><button class="azione" data-va="diario">Apri il diario</button></div>' +
      '</div></div>' +
    '</div>';
}

/* ================= COLLEGAMENTI ================= */
function collega(){
  const q = s => app.querySelector(s);
  const tutti = (s, f) => app.querySelectorAll(s).forEach(f);

  /* Abbandonare una sessione mai iniziata (indietro dall'anteprima) deve anche
     cancellarla dal disco: `disegna` l'aveva già salvata, e alla prossima
     apertura compariva un «allenamento lasciato a metà» fantasma. */
  const abbandona = () => {
    if (sess && sess.lista) scordaInCorso(); else sess = null;
    pulisciRiposo(); lasciaSpegnere();
  };
  tutti('[data-tab]', b => b.onclick = () => {
    abbandona(); filtro = '';
    vai(b.dataset.tab, b.dataset.tab);
  });
  tutti('[data-va]', b => b.onclick = () => {
    const d = b.dataset.va;
    if (d === 'casa') abbandona();
    vai(d, ['casa','schede','esercizi','impostazioni'].includes(d) ? d : tab);
  });

  /* --- casa --- */
  const rip = q('[data-riprendi]');
  if (rip) rip.onclick = () => { preparaAudio(); riprendi(); };
  const butta = q('[data-butta]');
  if (butta) butta.onclick = async () => {
    if (!confirm('Butto via l\'allenamento lasciato a metà?')) return;
    await scordaInCorso(); disegna();
  };
  const inizia = q('[data-inizia]');
  if (inizia) inizia.onclick = () => {
    const s = schede.find(x => x.id === inizia.dataset.inizia);
    if (s) iniziaSessione(s.id, nomeScheda(s), s.esercizi);
  };

  /* --- schede --- */
  tutti('[data-fai]', b => b.onclick = () => {
    const s = schede.find(x => x.id === b.dataset.fai);
    if (s) iniziaSessione(s.id, nomeScheda(s), s.esercizi);
  });
  tutti('[data-modifica]', b => b.onclick = () => {
    bozza = JSON.parse(JSON.stringify(schede.find(x => x.id === b.dataset.modifica)));
    vai('scheda', 'schede');
  });
  tutti('[data-copia]', b => b.onclick = async () => {
    const s = schede.find(x => x.id === b.dataset.copia);
    schede.push({id: sched.nuovoId(schede), nome: nomeScheda(s) + ' (copia)', esercizi: s.esercizi.slice()});
    await sched.scriviSchede(schede); await ricarica(); disegna();
  });
  const nuova = q('[data-nuova]');
  if (nuova) nuova.onclick = () => { bozza = sched.schedaVuota(schede); vai('scheda', 'schede'); };

  const nome = q('#nome-scheda');
  if (nome) nome.oninput = () => { bozza.nome = nome.value; };
  const agg = q('[data-aggiungi]');
  if (agg) agg.onclick = () => { if (nome) bozza.nome = nome.value; filtro = ''; vai('scelta'); };
  tutti('[data-togli]', b => b.onclick = () => { bozza.esercizi.splice(+b.dataset.togli, 1); disegna(); });
  tutti('[data-su]', b => b.onclick = () => {
    const i = +b.dataset.su, a = bozza.esercizi; [a[i-1], a[i]] = [a[i], a[i-1]]; disegna();
  });
  tutti('[data-giu]', b => b.onclick = () => {
    const i = +b.dataset.giu, a = bozza.esercizi; [a[i+1], a[i]] = [a[i], a[i+1]]; disegna();
  });
  const salvaS = q('[data-salva-scheda]');
  if (salvaS) salvaS.onclick = async () => {
    if (nome) bozza.nome = nome.value.trim();
    if (!bozza.esercizi.length){ alert('Metti almeno un esercizio.'); return; }
    if (!bozza.nome) bozza.nome = 'Scheda ' + (schede.length + 1);
    const i = schede.findIndex(x => x.id === bozza.id);
    if (i === -1) schede.push(bozza); else schede[i] = bozza;
    await sched.scriviSchede(schede); await ricarica(); vai('schede', 'schede');
  };
  const elim = q('[data-elimina]');
  if (elim) elim.onclick = async () => {
    if (!confirm('Elimino «' + nomeScheda(bozza) + '»? Le sessioni registrate restano.')) return;
    schede = schede.filter(x => x.id !== bozza.id);
    await sched.scriviSchede(schede); await ricarica(); vai('schede', 'schede');
  };

  /* --- catalogo: sezioni che si aprono --- */
  tutti('[data-sezione]', b => b.onclick = () => {
    const n = b.dataset.sezione;
    if (aperte.has(n)) aperte.delete(n); else aperte.add(n);
    aggiornaLista();
  });
  tutti('[data-scegli]', b => b.onclick = () => {
    const id = b.dataset.scegli;
    const i = bozza.esercizi.indexOf(id);
    if (i === -1) bozza.esercizi.push(id); else bozza.esercizi.splice(i, 1);
    aggiornaLista();
  });
  tutti('[data-apri]', b => b.onclick = () => { dettaglio = b.dataset.apri; vai('esercizio'); });

  const cerca = q('#cerca');
  if (cerca) cerca.oninput = () => { filtro = cerca.value; aggiornaLista(); };

  const solo = q('[data-solo]');
  if (solo) solo.onclick = () => {
    const e = PER_ID[solo.dataset.solo];
    iniziaSessione(null, e.n, [e.id]);
  };

  /* --- anteprima e sessione --- */
  tutti('[data-cambia]', b => b.onclick = () => { sess.cambiaIndice = +b.dataset.cambia; disegna(); });
  tutti('[data-conalternativa]', b => b.onclick = () => {
    sess.lista[sess.cambiaIndice] = b.dataset.conalternativa;
    sess.cambiaIndice = null;
    if (sess.corrente) preparaEsercizio();
    disegna();
  });
  const annulla = q('[data-annulla-cambio]');
  if (annulla) annulla.onclick = () => { sess.cambiaIndice = null; disegna(); };
  const parti = q('[data-parti]');
  if (parti) parti.onclick = () => { preparaAudio(); sess.indice = 0; preparaEsercizio(); vai('sessione'); };

  const esci = q('[data-esci]');
  if (esci) esci.onclick = () => {
    if (sess.esercizi.length){ if (!confirm('Esci e salvi quello che hai già fatto?')) return; concludi(); }
    else { if (!confirm('Esci senza salvare niente?')) return;
           pulisciRiposo(); lasciaSpegnere(); scordaInCorso(); vai('casa','casa'); }
  };
  tutti('[data-peso]', b => b.onclick = () => {
    const c = sess.corrente;
    const n = b.dataset.peso === 'su' ? prossimoGradino(c.esercizio.carico, c.peso)
                                      : gradinoPrecedente(c.esercizio.carico, c.peso);
    if (n !== null){ c.peso = n; c.pres = {...c.pres, sale:false}; disegna(); }
  });
  tutti('[data-rip]', b => b.onclick = () => {
    const c = sess.corrente;
    c.ripetizioni = Math.max(1, c.ripetizioni + Number(b.dataset.rip));
    const quanti = q('.conta .quanti'), viva = q('.serie .casella.viva .n');
    if (quanti) quanti.textContent = c.ripetizioni;
    if (viva) viva.textContent = c.ripetizioni;
    salvaInCorso();
  });
  const serie = q('[data-serie]');
  if (serie) serie.onclick = () => {
    preparaAudio();
    const c = sess.corrente;
    c.serie.push(c.ripetizioni); c.chiudi = false; c.ancora = false;
    if (c.serie.length < 3) avviaRiposo(recupero(c.esercizio)); else pulisciRiposo();
    disegna();
  };
  const chiudi = q('[data-chiudi]');
  if (chiudi) chiudi.onclick = () => { sess.corrente.chiudi = true; pulisciRiposo(); disegna(); };
  const ancora = q('[data-ancora]');
  if (ancora) ancora.onclick = () => {
    preparaAudio();
    sess.corrente.ancora = true; sess.corrente.chiudi = false;
    avviaRiposo(recupero(sess.corrente.esercizio)); disegna();
  };
  tutti('[data-sforzo]', b => b.onclick = () => {
    const c = sess.corrente;
    if (c.serie.length)
      sess.esercizi.push({id: c.id, peso: c.peso, serie: c.serie.slice(), sforzo: b.dataset.sforzo});
    avanti(recupero(c.esercizio));
  });
  /* Saltare o cambiare esercizio butta via le serie già registrate lì: se ce
     ne sono, prima si chiede. Un tocco sbagliato non deve costare lavoro. */
  const salta = q('[data-salta]');
  if (salta) salta.onclick = () => {
    const c = sess.corrente;
    if (c.serie.length &&
        !confirm('Hai già registrato ' + plur(c.serie.length, 'serie', 'serie') + ': le butto via?')) return;
    c.serie = []; avanti();
  };
  const sost = q('[data-sostituisci]');
  if (sost) sost.onclick = () => {
    const c = sess.corrente;
    if (c.serie.length &&
        !confirm('Cambiando esercizio perdi le serie già fatte qui. Continuo?')) return;
    sess.cambiaIndice = sess.indice; disegna();
  };
  const saltaR = q('[data-salta-riposo]');
  if (saltaR) saltaR.onclick = () => { pulisciRiposo(); disegna(); };

  const uno = q('[data-aggiungi-uno]');
  if (uno) uno.onclick = () => { filtro = ''; vai('aggiunta'); };
  tutti('[data-aggiungi-questo]', b => b.onclick = () => {
    sess.lista.push(b.dataset.aggiungiQuesto);
    preparaEsercizio();
    vai('sessione');
  });
  const tornaFine = q('[data-torna-fine]');
  if (tornaFine) tornaFine.onclick = () => vai('sessione');
  const basta = q('[data-basta]');
  if (basta) basta.onclick = concludi;

  /* --- diario --- */
  tutti('[data-sessione]', b => b.onclick = () => {
    guardata = sessioni.find(s => String(s.id) === b.dataset.sessione);
    vai('sessioneVista');
  });
  const corr = q('[data-correggi]');
  if (corr) corr.onclick = () => { correzione = JSON.parse(JSON.stringify(guardata)); vai('correzione'); };
  tutti('[data-cserie]', i => i.onchange = () => {
    const [a, b] = i.dataset.cserie.split(':');
    const v = parseInt(i.value, 10);
    if (isFinite(v) && v >= 0) correzione.esercizi[+a].serie[+b] = v;
  });
  tutti('[data-cpeso]', i => i.onchange = () => {
    const v = parseFloat(i.value);
    if (isFinite(v) && v >= 0) correzione.esercizi[+i.dataset.cpeso].peso = v;
  });
  const salvaC = q('[data-salva-correzione]');
  if (salvaC) salvaC.onclick = async () => {
    await archivio.aggiornaSessione(correzione); await ricarica(); vai('diario');
  };
  const cancS = q('[data-cancella-sessione]');
  if (cancS) cancS.onclick = async () => {
    if (!confirm('Cancello la sessione del ' + gg(correzione.data) + '? Non si torna indietro.')) return;
    await archivio.cancellaSessione(correzione.id); await ricarica(); vai('diario');
  };

  /* --- impostazioni --- */
  const salvaP = q('[data-salva-peso]');
  if (salvaP) salvaP.onclick = async () => {
    const v = parseFloat(q('#peso-corpo').value);
    if (!isFinite(v) || v < 30 || v > 200){ alert('Un peso fra 30 e 200 kg.'); return; }
    pesoCorporeo = v; pesoImpostato = true;
    await archivio.scriviStato('pesoCorporeo', v);
    salvaP.textContent = 'Salvato';
    setTimeout(() => { if (salvaP.isConnected) salvaP.textContent = 'Salva'; }, 1600);
  };
  const esporta = q('[data-esporta]');
  if (esporta) esporta.onclick = async () => {
    const uscito = await archivio.scaricaBackup(await archivio.esporta(),
                                               'spingere-' + archivio.oggi() + '.json');
    if (!uscito) return;   /* annullato: il backup non è uscito davvero */
    ultimoBackup = archivio.oggi();
    await archivio.scriviStato('ultimoBackup', ultimoBackup);
    disegna();
  };
  const importa = q('[data-importa]');
  if (importa) importa.onclick = () => q('#file-backup').click();
  const file = q('#file-backup');
  if (file) file.onchange = async () => {
    const f = file.files[0];
    if (!f) return;
    if (!confirm('Il ripristino cancella lo storico attuale e mette al suo posto quello del file. Procedo?')) return;
    try { const n = await archivio.importa(await f.text()); await ricarica();
          alert('Ripristinate ' + n + ' sessioni.'); disegna(); }
    catch (e){ alert('Non ci sono riuscito: ' + e.message); }
  };
}

/* Cercando o aprendo una sezione si aggiorna solo l'elenco: ridisegnare tutta
   la schermata farebbe perdere il fuoco al campo e chiuderebbe la tastiera. */
function aggiornaLista(){
  const lista = app.querySelector('#lista');
  if (!lista){ disegna(); return; }
  lista.innerHTML = vista === 'scelta' ? sezioniEsercizi('scegli', bozza.esercizi)
                  : vista === 'aggiunta' ? sezioniEsercizi('aggiungi')
                  : sezioniEsercizi('apri');
  collega();
  const fatto = app.querySelector('#fatto');
  if (fatto) fatto.textContent = 'Fatto · ' + plur(bozza.esercizi.length, 'scelto', 'scelti');
}

avvia();

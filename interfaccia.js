/* L'interfaccia.
   La logica dei carichi sta in motore.js, la composizione della sessione in
   comporre.js, i gruppi in gruppi.js. Qui si disegna e si raccolgono i tocchi. */

import {ESERCIZI, PER_ID, figura} from './esercizi.js';
import {GRUPPI, PER_GRUPPO, COMPLETO, nomeGruppo, quantiEsercizi, minutiStimati} from './gruppi.js';
import {componi, gruppiRimasti, alternativeSchema} from './comporre.js';
import {prescrizione, gradinoPrecedente, prossimoGradino, indiceProgresso, pesoSuggerito,
        etichettaPrestazione, numero, recupero, ETICHETTA_SFORZO, PESO_DI_PARTENZA} from './motore.js';
import * as sched from './schede.js';
import * as archivio from './archivio.js';

const app = document.getElementById('app');
const SESSIONI_PRIMA_DEL_BACKUP = 6;

let sessioni = [], schede = [], preferiti = [], daparte = [];
let pesoCorporeo = PESO_DI_PARTENZA, pesoImpostato = false;
let ultimoBackup = null;

let vista = 'casa', tab = 'casa';
let dettaglio = null, ritorno = 'esercizi', bozza = null, filtro = '';
let scelta = [];          /* gruppi spuntati nella schermata di scelta */
let sess = null, riposo = null, correzione = null;

/* ------------------------------------------------------------------ */
const scampa = t => String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
const fig = e => figura(e.disegno);
const gg = d => d.slice(8,10) + '/' + d.slice(5,7);
const senzaAccenti = t => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');

function pulisciRiposo(){ if (riposo && riposo.id) clearInterval(riposo.id); riposo = null; }

async function ricarica(){
  sessioni = await archivio.tutteLeSessioni();
  schede = await sched.leggiSchede();
  preferiti = await archivio.leggiStato('preferiti', []);
  daparte = await archivio.leggiStato('daparte', []);
  ultimoBackup = await archivio.leggiStato('ultimoBackup', null);
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
  casa: vistaCasa, gruppi: vistaGruppi, anteprima: vistaAnteprima,
  sessione: vistaSessione, fine: vistaFine,
  schede: vistaSchede, scheda: vistaScheda,
  esercizi: vistaEsercizi, esercizio: vistaEsercizio,
  diario: vistaDiario, correzione: vistaCorrezione,
  impostazioni: vistaImpostazioni
};
const SENZA_BARRA = new Set(['sessione', 'fine', 'anteprima', 'gruppi', 'correzione']);

function disegna(){
  const dentro = (VISTE[vista] || vistaCasa)();
  app.innerHTML = '<section class="schermata' + (SENZA_BARRA.has(vista) ? ' senza-barra' : '') + '">' +
    dentro + '</section>' + (SENZA_BARRA.has(vista) ? '' : barraNav());
  collega();
  const c = app.querySelector('.contenuto');
  if (c) c.scrollTop = 0;
}
function vai(dove, nuovaTab){
  vista = dove;
  if (nuovaTab) tab = nuovaTab;
  disegna();
}

/* ================= pezzi comuni ================= */
const ICONE = {
  casa: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  schede: '<rect x="3" y="4" width="18" height="6" rx="2"/><rect x="3" y="14" width="18" height="6" rx="2"/>',
  esercizi: '<rect x="3" y="3" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="2"/>' +
            '<rect x="3" y="13.5" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2"/>',
  impostazioni: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2.4"/><circle cx="8" cy="17" r="2.4"/>'
};

function barraNav(){
  const voci = [['casa','Casa'], ['schede','Schede'], ['esercizi','Esercizi'], ['impostazioni','Impostazioni']];
  return '<nav class="barra-nav">' + voci.map(([id, nome]) =>
    '<button data-tab="' + id + '" class="' + (tab === id ? 'attiva' : '') + '"' +
      (tab === id ? ' aria-current="page"' : '') + '>' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONE[id] + '</svg>' +
    '<span>' + nome + '</span></button>').join('') + '</nav>';
}

function testata(titolo, occhio, indietro){
  return '<div class="testata">' +
    (indietro ? '<button class="indietro" data-va="' + indietro + '">‹ Indietro</button>' : '') +
    (occhio ? '<p class="occhio">' + scampa(occhio) + '</p>' : '') +
    '<h1>' + scampa(titolo) + '</h1></div>';
}

function voceEsercizio(e, extra){
  return '<div class="voce"><span class="fig">' + fig(e) + '</span>' +
    '<span class="n">' + scampa(e.n) + '</span>' +
    '<span class="d mono">' + (extra || (e.fascia[0] + '-' + e.fascia[1])) + '</span></div>';
}

/* ================= CASA ================= */
function laMiaSelezione(){
  const s = schede.find(x => x.id === 'completo') || schede[0];
  return s ? s.gruppi : COMPLETO;
}

function sessioniDaBackup(){
  if (!ultimoBackup) return sessioni.length;
  return sessioni.filter(s => s.data > ultimoBackup).length;
}

function vistaCasa(){
  const gruppi = laMiaSelezione();
  const lista = componi(gruppi, sessioni, {preferiti, dascartare: daparte});
  const ultime = sessioni.slice(-3).reverse();
  const daBackup = sessioniDaBackup();

  return testata('Oggi', 'Spingere') +
    '<div class="contenuto">' +

      '<div class="carta">' +
        '<div class="intestazione-carta">' +
          '<span class="quanto mono">' + lista.length + ' esercizi · ' + minutiStimati(gruppi) + ' min</span>' +
          '<span class="quali">' + scampa(gruppi.map(nomeGruppo).join(' · ')) + '</span>' +
        '</div>' +
        '<div class="elenco">' + lista.map(id => voceEsercizio(PER_ID[id])).join('') + '</div>' +
      '</div>' +

      '<div class="riga-azioni" style="margin-bottom:var(--s5)">' +
        '<button class="azione" data-scegli-gruppi style="flex:1">Cambia i gruppi di oggi</button>' +
      '</div>' +

      (pesoImpostato ? '' :
        '<button class="carta carta-riga" data-va="impostazioni">' +
          '<span class="testo"><span class="t">Manca il tuo peso corporeo</span>' +
          '<span class="s">Serve ai grafici di trazioni, dip e flessioni, dove il carico sei tu. ' +
          'Resta su questo telefono.</span></span><span class="freccia">›</span></button>') +

      (daBackup >= SESSIONI_PRIMA_DEL_BACKUP ?
        '<button class="carta carta-riga" data-va="impostazioni">' +
          '<span class="testo"><span class="t">' + daBackup + ' sessioni senza backup</span>' +
          '<span class="s">Lo storico sta solo qui. Se perdi il telefono lo perdi con lui: ' +
          'scarica un file.</span></span><span class="freccia">›</span></button>' : '') +

      (ultime.length
        ? '<p class="sezione">Ultimi allenamenti</p>' +
          ultime.map(s =>
            '<button class="carta carta-riga stretta" data-sessione="' + s.id + '">' +
              '<span class="testo"><span class="t">' + scampa(s.nomeScheda || 'Allenamento') + '</span>' +
              '<span class="s">' + gg(s.data) + ' · ' + s.esercizi.length + ' esercizi · ' +
                (s.durataMin || 0) + ' min</span></span><span class="freccia">›</span></button>').join('') +
          '<button class="azione" data-va="diario" style="width:100%;margin-top:var(--s2)">' +
            'Tutto il diario</button>'
        : '') +
    '</div>' +
    '<div class="fondo-pagina"><button class="grosso" data-inizia>Comincia</button></div>';
}

/* ================= SCELTA DEI GRUPPI ================= */
function vistaGruppi(){
  const q = quantiEsercizi(scelta), m = minutiStimati(scelta);
  return testata('Cosa alleni oggi', null, 'casa') +
    '<div class="contenuto">' +
      '<p class="sottotitolo" style="margin-bottom:var(--s4)">Per ogni gruppo l\'app sceglie ' +
        'l\'esercizio che non fai da più tempo. Il dorso ne porta due — una tirata verticale e una ' +
        'orizzontale sono due lavori diversi.</p>' +
      '<div class="griglia-gruppi">' + GRUPPI.map(g => {
        const dentro = scelta.includes(g.id);
        const n = g.alterna ? 1 : g.schemi.length;
        return '<button class="gruppo-scelta" data-gruppo="' + g.id + '" aria-pressed="' + dentro + '">' +
          '<span class="g">' + g.nome + '</span>' +
          '<span class="q">' + n + (n === 1 ? ' esercizio' : ' esercizi') + '</span></button>';
      }).join('') + '</div>' +
      '<div class="carta" style="margin-top:var(--s4)">' +
        '<div class="carta-riga"><span class="testo">' +
        '<span class="t">' + q + (q === 1 ? ' esercizio' : ' esercizi') + ' · circa ' + m + ' minuti</span>' +
        '<span class="s">' + (scelta.length ? scampa(scelta.map(nomeGruppo).join(', ')) :
          'Non hai scelto niente.') + '</span></span></div></div>' +
      '<button class="azione" data-salva-selezione style="width:100%;margin-top:var(--s3)">' +
        'Salva come scheda</button>' +
    '</div>' +
    '<div class="fondo-pagina"><button class="grosso" data-conferma-gruppi>Vedi gli esercizi</button></div>';
}

/* ================= ANTEPRIMA ================= */
function vistaAnteprima(){
  if (sess.cambiaIndice !== null) return vistaCambia();
  return testata('La sessione di oggi', null, 'casa') +
    '<div class="contenuto">' +
      '<p class="sottotitolo" style="margin-bottom:var(--s4)">Tocca un esercizio per cambiarlo. ' +
        'Le alternative sono dello stesso schema: al posto di una tirata verticale un\'altra tirata ' +
        'verticale, non un rematore.</p>' +
      sess.lista.map((id, i) => {
        const e = PER_ID[id];
        return '<button class="carta carta-riga stretta" data-cambia="' + i + '">' +
          '<span class="fig" style="width:44px;height:44px;flex:none">' + fig(e) + '</span>' +
          '<span class="testo"><span class="t">' + scampa(e.n) + '</span>' +
          '<span class="s">' + e.fascia[0] + '-' + e.fascia[1] +
            (e.unilaterale ? ' per lato' : '') + ' · ' + recupero(e) + 's di recupero</span></span>' +
          '<span class="freccia">⇄</span></button>';
      }).join('') +
    '</div>' +
    '<div class="fondo-pagina"><button class="grosso" data-parti>Inizia</button></div>';
}

function vistaCambia(){
  const i = sess.cambiaIndice;
  const attuale = PER_ID[sess.lista[i]];
  const alt = alternativeSchema(attuale.id, sessioni, sess.lista);
  return testata('Al posto di', scampa(attuale.n), null) +
    '<div class="contenuto">' +
      (alt.length ? alt.map(x =>
        '<button class="carta carta-riga stretta" data-conalternativa="' + x.id + '">' +
          '<span class="fig" style="width:44px;height:44px;flex:none">' + fig(x) + '</span>' +
          '<span class="testo"><span class="t">' + scampa(x.n) + '</span>' +
          '<span class="s">' + x.fascia[0] + '-' + x.fascia[1] + (x.unilaterale ? ' per lato' : '') +
          '</span></span><span class="freccia">›</span></button>').join('')
        : '<p class="vuoto">Non ci sono altri esercizi per questo schema.</p>') +
    '</div>' +
    '<div class="fondo-pagina"><button class="grosso quieto" data-annulla-cambio>Lascia com\'era</button></div>';
}

/* ================= SESSIONE ================= */
function iniziaSessione(gruppi, nome, lista){
  sess = {
    gruppi: gruppi.slice(), nome,
    data: archivio.oggi(), iniziata: Date.now(),
    lista: lista.slice(), indice: 0, esercizi: [], corrente: null,
    cambiaIndice: null
  };
  vai('anteprima');
}

function preparaEsercizio(){
  const id = sess.lista[sess.indice];
  const e = PER_ID[id];
  const p = prescrizione(e, archivio.storicoEsercizio(sessioni, id), sess.data, pesoCorporeo);
  sess.corrente = {
    id, esercizio: e, pres: p,
    peso: p.peso === null ? pesoSuggerito(e) : p.peso,
    ripetizioni: p.bersaglio,
    serie: [], chiudi: false, ancora: false, cambia: false
  };
}

function vistaSessione(){
  if (sess.cambiaIndice !== null) return vistaCambia();
  const c = sess.corrente;
  if (!c) return vistaAncoraTempo();
  if (c.cambia){ sess.cambiaIndice = sess.indice; return vistaCambia(); }

  const e = c.esercizio, p = c.pres;
  const tacche = sess.lista.map((_, i) =>
    '<i class="' + (i < sess.indice ? 'fatto' : i === sess.indice ? 'ora' : '') + '"></i>').join('');
  const mostraSforzo = (c.serie.length >= 3 && !c.ancora) || c.chiudi;

  return '<div class="cima"><button data-esci>Esci</button>' +
      '<span class="passo mono">' + (sess.indice+1) + ' di ' + sess.lista.length + '</span></div>' +
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
    '<div class="comandi">' +
      (riposo ? riquadroRiposo() : '') +
      pannelloPeso(e, c) + pannelloSerie(c) +
      (mostraSforzo ? pannelloSforzo(c) : pannelloConta(c)) +
    '</div>';
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

/* Tutto su una riga sola: −5 − numero + +5. Prima erano due righe e il
   pannello si mangiava lo schermo, coprendo il messaggio dell'esercizio. */
function pannelloConta(c){
  return '<div class="conta">' +
      '<button class="salto" data-rip="-5">−5</button>' +
      '<button class="gradino" data-rip="-1">−</button>' +
      '<span class="quanti mono">' + c.ripetizioni + '</span>' +
      '<button class="gradino" data-rip="1">+</button>' +
      '<button class="salto" data-rip="5">+5</button></div>' +
    '<button class="grosso" data-serie>Serie ' + (c.serie.length + 1) + ' fatta</button>' +
    (c.serie.length >= 1 ? '<button class="sotto-grosso" data-chiudi>Chiudo qui, ' +
      c.serie.length + ' serie</button>' : '');
}

function pannelloSforzo(c){
  return '<p class="sottotitolo" style="margin:0 0 var(--s2)">Com\'è andata l\'ultima serie?</p>' +
    '<div class="sforzo">' + ['facile','giusta','limite'].map(s =>
      '<button data-sforzo="' + s + '">' + ETICHETTA_SFORZO[s] + '</button>').join('') + '</div>' +
    '<button class="sotto-grosso" data-ancora>Ne faccio un\'altra</button>';
}

function riquadroRiposo(){
  const r = 21, giro = 2 * Math.PI * r;
  const quota = giro * (riposo.resta / riposo.totale);
  return '<div class="recupero"><svg viewBox="0 0 50 50" aria-hidden="true">' +
      '<circle class="anello" cx="25" cy="25" r="' + r + '"/>' +
      '<circle class="quota" cx="25" cy="25" r="' + r + '" stroke-dasharray="' + giro.toFixed(1) +
      '" stroke-dashoffset="' + (giro - quota).toFixed(1) + '"/></svg>' +
    '<div><div class="tempo mono" id="tempo">' + riposo.resta + 's</div>' +
      '<div class="avviso">Non suona: a schermo spento iOS ferma l\'app.</div></div>' +
    '<button class="salta" data-salta-riposo>Salta</button></div>';
}

function avviaRiposo(secondi){
  pulisciRiposo();
  riposo = {resta: secondi, totale: secondi, id: null};
  riposo.id = setInterval(() => {
    riposo.resta--;
    if (riposo.resta <= 0){ pulisciRiposo(); disegna(); return; }
    const t = document.getElementById('tempo'), q = document.querySelector('.recupero .quota');
    if (!t){ pulisciRiposo(); return; }
    t.textContent = riposo.resta + 's';
    if (q){
      const giro = 2 * Math.PI * 21;
      q.setAttribute('stroke-dashoffset', (giro - giro * (riposo.resta / riposo.totale)).toFixed(1));
    }
  }, 1000);
}

function avanti(){
  pulisciRiposo();
  sess.indice++;
  if (sess.indice < sess.lista.length){ preparaEsercizio(); disegna(); return; }
  sess.corrente = null;
  disegna();
}

function vistaAncoraTempo(){
  const rimasti = gruppiRimasti(sess.gruppi);
  return testata('Hai ancora tempo?', 'Fatto ' + sess.esercizi.length + ' esercizi') +
    '<div class="contenuto">' +
      '<p class="sottotitolo" style="margin-bottom:var(--s4)">Il grosso è fatto. Se aggiungi un ' +
        'gruppo l\'app compone altri esercizi; se no, chiudi qui.</p>' +
      (rimasti.length
        ? '<div class="griglia-gruppi">' + rimasti.map(id =>
            '<button class="gruppo-scelta" data-aggiungi-gruppo="' + id + '">' +
            '<span class="g">' + nomeGruppo(id) + '</span>' +
            '<span class="q">+' + minutiStimati([id]) + ' min</span></button>').join('') + '</div>'
        : '<p class="vuoto">Hai già allenato tutto.</p>') +
    '</div>' +
    '<div class="fondo-pagina"><button class="grosso" data-basta>Ho finito</button></div>';
}

async function concludi(){
  pulisciRiposo();
  const durata = Math.round((Date.now() - sess.iniziata) / 60000);
  if (sess.esercizi.length){
    await archivio.salvaSessione({
      data: sess.data, nomeScheda: sess.nome, gruppi: sess.gruppi,
      durataMin: durata, esercizi: sess.esercizi
    });
    await ricarica();
  }
  vai('fine');
}

function vistaFine(){
  const fatte = sess ? sess.esercizi : [];
  if (!fatte.length)
    return testata('Niente da salvare') + '<div class="contenuto"><p class="messaggio">' +
      'Non hai completato nessuna serie.</p></div>' +
      '<div class="fondo-pagina"><button class="grosso" data-va="casa">Torna a casa</button></div>';

  const righe = fatte.map(x => {
    const e = PER_ID[x.id];
    return '<tr><td>' + scampa(e.n) + '</td><td class="mono">' +
      (e.carico === 'corpo' || (e.carico === 'zavorra' && !x.peso) ? 'corpo' : numero(x.peso) + ' kg') +
      '</td><td class="mono">' + x.serie.join('-') + '</td></tr>';
  }).join('');
  return testata('Fatto.', scampa(sess.nome) + ' registrato') +
    '<div class="contenuto"><div class="carta">' +
      '<table class="tabella"><thead><tr><th>Esercizio</th><th>Carico</th><th>Serie</th></tr></thead>' +
      '<tbody>' + righe + '</tbody></table></div>' +
      '<p class="messaggio">La prossima volta l\'app cambierà gli esercizi da sola: a ogni schema ' +
        'tocca quello che non fai da più tempo.</p></div>' +
    '<div class="fondo-pagina"><button class="grosso" data-va="casa">Chiudi</button></div>';
}

/* ================= SCHEDE ================= */
function vistaSchede(){
  return testata('Schede', 'Combinazioni di gruppi') +
    '<div class="contenuto">' +
      '<p class="sottotitolo" style="margin-bottom:var(--s4)">Una scheda non è una lista di esercizi ' +
        'ma di gruppi: gli esercizi li sceglie l\'app, prendendo ogni volta quelli che non fai da più ' +
        'tempo.</p>' +
      schede.map(s => {
        const r = sched.riassunto(s);
        return '<div class="carta">' +
          '<div class="carta-riga"><span class="testo">' +
            '<span class="t">' + scampa(s.nome) + '</span>' +
            '<span class="s">' + scampa(sched.descrizione(s)) + ' · ' + r.esercizi +
              ' esercizi · ' + r.minuti + ' min</span></span></div>' +
          '<div class="riga-azioni" style="margin-top:var(--s3)">' +
            '<button class="azione pieno" data-fai="' + s.id + '" style="flex:1">Fai questa</button>' +
            '<button class="azione" data-modifica="' + s.id + '">Modifica</button>' +
          '</div></div>';
      }).join('') +
    '</div>' +
    '<div class="fondo-pagina"><button class="grosso quieto" data-nuova>Nuova scheda</button></div>';
}

function vistaScheda(){
  const s = bozza, r = sched.riassunto(s), manca = sched.mancanti(s);
  return testata('Modifica scheda', null, 'schede') +
    '<div class="contenuto">' +
      '<div class="carta"><div class="campo" style="margin:0">' +
        '<span class="eti">Nome</span>' +
        '<div class="riga"><input id="nome-scheda" type="text" value="' + scampa(s.nome) +
          '" maxlength="30" autocomplete="off"></div></div></div>' +
      '<p class="sezione">Gruppi</p>' +
      '<div class="griglia-gruppi">' + GRUPPI.map(g =>
        '<button class="gruppo-scelta" data-gruppo-bozza="' + g.id + '" aria-pressed="' +
        s.gruppi.includes(g.id) + '"><span class="g">' + g.nome + '</span>' +
        '<span class="q">' + (g.alterna ? 1 : g.schemi.length) + ' esercizi</span></button>').join('') +
      '</div>' +
      '<div class="carta" style="margin-top:var(--s4)"><div class="carta-riga"><span class="testo">' +
        '<span class="t">' + r.esercizi + ' esercizi · ' + r.minuti + ' minuti</span>' +
        '<span class="s">' + (manca.length
          ? 'Fuori: ' + manca.map(nomeGruppo).join(', ').toLowerCase() + '. È una tua scheda e la fai ' +
            'come vuoi, ma se la usi sempre quel lavoro non lo fa nessuno.'
          : 'Copre petto, dorso, gambe e core.') + '</span></span></div></div>' +
      (schede.length > 1 && schede.some(x => x.id === s.id)
        ? '<button class="azione rossa" data-elimina style="width:100%;margin-top:var(--s3)">' +
          'Elimina questa scheda</button>' : '') +
    '</div>' +
    '<div class="fondo-pagina"><button class="grosso" data-salva-scheda>Salva</button></div>';
}

/* ================= ESERCIZI ================= */
function vistaEsercizi(){
  const q = senzaAccenti(filtro.trim());
  const gruppi = {};
  for (const e of ESERCIZI){
    if (q && !senzaAccenti(e.n + ' ' + e.gruppo).includes(q)) continue;
    (gruppi[e.gruppo] ||= []).push(e);
  }
  const corpo = Object.keys(gruppi).length
    ? Object.entries(gruppi).map(([g, lista]) =>
        '<p class="sezione">' + scampa(g) + '</p>' + lista.map(e => {
          const st = archivio.storicoEsercizio(sessioni, e.id);
          const sotto = st.length
            ? st.length + (st.length === 1 ? ' sessione · ' : ' sessioni · ') +
              etichettaPrestazione(e, st[0].peso, Math.max(...st[0].serie))
            : 'mai fatto · fascia ' + e.fascia[0] + '-' + e.fascia[1];
          return '<button class="carta carta-riga stretta" data-apri="' + e.id + '">' +
            '<span class="fig" style="width:44px;height:44px;flex:none">' + fig(e) + '</span>' +
            '<span class="testo"><span class="t">' + scampa(e.n) +
              (preferiti.includes(e.id) ? ' <span class="pillola">preferito</span>' : '') +
              (daparte.includes(e.id) ? ' <span class="pillola">da parte</span>' : '') + '</span>' +
            '<span class="s mono">' + sotto + '</span></span>' +
            '<span class="freccia">›</span></button>';
        }).join('')).join('')
    : '<p class="vuoto">Nessun esercizio con «' + scampa(filtro) + '».</p>';

  return testata('Esercizi', ESERCIZI.length + ' nel catalogo') +
    '<div class="cerca"><input id="cerca" type="search" placeholder="Cerca" value="' +
      scampa(filtro) + '" autocomplete="off"></div>' +
    '<div class="contenuto">' + corpo + '</div>';
}

function vistaEsercizio(){
  const e = PER_ID[dettaglio];
  const st = archivio.storicoEsercizio(sessioni, e.id).slice().reverse();
  const punti = st.map(s => ({
    data: s.data, valore: indiceProgresso(e, s.peso, Math.max(...s.serie), pesoCorporeo),
    peso: s.peso, rip: Math.max(...s.serie)
  }));
  const righe = st.slice().reverse().map(s =>
    '<tr><td class="mono">' + gg(s.data) + '</td><td class="mono">' +
    (e.carico === 'corpo' || (e.carico === 'zavorra' && !s.peso) ? 'corpo' : numero(s.peso) + ' kg') +
    '</td><td class="mono">' + s.serie.join('-') + '</td></tr>').join('');

  const inRotazione = componi(COMPLETO, [], {preferiti, dascartare: daparte}).includes(e.id);

  return testata(e.n, null, 'esercizi') +
    '<div class="contenuto">' +
      '<div class="carta"><div class="figurone" style="max-width:190px">' + fig(e) + '</div>' +
        '<p class="sottotitolo" style="text-align:center">' + (e.nota ? scampa(e.nota) + ' · ' : '') +
        'fascia ' + e.fascia[0] + '-' + e.fascia[1] + (e.unilaterale ? ' per lato' : '') +
        ' · ' + recupero(e) + 's di recupero</p></div>' +

      (punti.length
        ? '<div class="carta"><div class="titolo-carta">Progresso</div>' + grafico(punti, e) +
          '<table class="tabella"><thead><tr><th>Giorno</th><th>Carico</th><th>Serie</th></tr></thead>' +
          '<tbody>' + righe + '</tbody></table></div>'
        : '<div class="carta"><p class="s" style="color:var(--muto);font-size:13.5px;line-height:1.5">' +
          'Non l\'hai ancora mai fatto. ' + (inRotazione
            ? 'È fra quelli che girano: prima o poi te lo propone da solo.'
            : 'Non è fra quelli che girano — puoi farlo adesso, o metterlo fra i preferiti.') +
          '</p></div>') +

      '<div class="riga-azioni">' +
        '<button class="azione" data-preferito="' + e.id + '" style="flex:1">' +
          (preferiti.includes(e.id) ? 'Togli dai preferiti' : 'Metti fra i preferiti') + '</button>' +
        '<button class="azione" data-daparte="' + e.id + '" style="flex:1">' +
          (daparte.includes(e.id) ? 'Rimetti in giro' : 'Mettilo da parte') + '</button>' +
      '</div>' +
      '<p class="sottotitolo">I preferiti prendono il posto degli altri nella rotazione del loro ' +
        'schema. Quelli da parte non vengono più proposti.</p>' +
    '</div>' +
    '<div class="fondo-pagina"><button class="grosso quieto" data-solo="' + e.id + '">' +
      'Fai adesso, da solo</button></div>';
}

/* ================= DIARIO ================= */
function vistaDiario(){
  const righe = sessioni.slice().reverse().map(s =>
    '<button class="carta carta-riga stretta" data-sessione="' + s.id + '">' +
      '<span class="testo"><span class="t">' + scampa(s.nomeScheda || 'Allenamento') + '</span>' +
      '<span class="s">' + gg(s.data) + ' · ' + s.esercizi.length + ' esercizi · ' +
        (s.durataMin || 0) + ' min</span></span><span class="freccia">›</span></button>').join('');
  return testata('Diario', sessioni.length + (sessioni.length === 1 ? ' sessione' : ' sessioni'), 'casa') +
    '<div class="contenuto">' + (righe || '<p class="vuoto">Ancora nessun allenamento.</p>') + '</div>';
}

function vistaCorrezione(){
  const s = correzione;
  return testata('Correggi', gg(s.data) + ' · ' + scampa(s.nomeScheda || 'Allenamento'), 'diario') +
    '<div class="contenuto">' +
      '<p class="sottotitolo" style="margin-bottom:var(--s4)">Cambia quello che avevi digitato male. ' +
        'Ogni correzione rientra subito nella progressione di quell\'esercizio.</p>' +
      s.esercizi.map((x, i) => {
        const e = PER_ID[x.id];
        if (!e) return '';
        return '<div class="carta"><div class="titolo-carta">' + scampa(e.n) + '</div>' +
          '<div class="campo" style="margin:0"><div class="riga">' +
            (e.carico === 'corpo' ? '' :
              '<input type="number" step="0.5" min="0" max="40" data-cpeso="' + i +
              '" value="' + (x.peso == null ? '' : x.peso) + '" aria-label="carico">') +
            x.serie.map((r, j) =>
              '<input type="number" step="1" min="0" max="99" data-cserie="' + i + ':' + j +
              '" value="' + r + '" aria-label="serie ' + (j+1) + '">').join('') +
          '</div></div></div>';
      }).join('') +
      '<button class="azione rossa" data-cancella-sessione style="width:100%;margin-top:var(--s3)">' +
        'Cancella tutta la sessione</button>' +
    '</div>' +
    '<div class="fondo-pagina"><button class="grosso" data-salva-correzione>Salva le correzioni</button></div>';
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
  const area = d + ' L' + X(punti.length-1).toFixed(1) + ' ' + (A-giu) + ' L' + sx + ' ' + (A-giu) + ' Z';
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
    '<path class="area" d="' + area + '"/><path class="linea" d="' + d + '"/>' + cerchi +
    '<text x="' + (L-dx) + '" y="' + (alto ? uy+16 : uy-11).toFixed(1) + '" text-anchor="end" ' +
      'style="fill:var(--testo);font-size:11px">' + scampa(testo) + '</text>' +
    '<text x="' + sx + '" y="' + (A-8) + '">' + gg(punti[0].data) + '</text>' +
    '<text x="' + (L-dx) + '" y="' + (A-8) + '" text-anchor="end">' + gg(u.data) + '</text></svg>';
}

/* ================= IMPOSTAZIONI ================= */
function vistaImpostazioni(){
  const daBackup = sessioniDaBackup();
  return testata('Impostazioni') +
    '<div class="contenuto">' +
      '<div class="carta"><div class="campo" style="margin:0">' +
        '<span class="eti">Peso corporeo</span>' +
        '<p class="spiega">Serve agli esercizi a corpo libero — trazioni, dip, flessioni — dove il ' +
        'carico sei tu. Senza, il grafico ti mostra fermo mentre progredisci.</p>' +
        '<div class="riga"><input id="peso-corpo" type="number" inputmode="decimal" step="0.5" ' +
          'min="30" max="200" value="' + (pesoImpostato ? pesoCorporeo : '') + '" placeholder="' +
          PESO_DI_PARTENZA + '"><button class="azione" data-salva-peso>Salva</button></div>' +
      '</div></div>' +

      '<div class="carta"><div class="campo" style="margin:0">' +
        '<span class="eti">Backup</span>' +
        '<p class="spiega">Lo storico sta solo su questo telefono. Se cancelli l\'icona dalla ' +
        'schermata home o resetti l\'iPhone se ne va con lui, e non si recupera.' +
        (ultimoBackup ? ' Ultimo backup: ' + gg(ultimoBackup) + ', ' + daBackup +
          (daBackup === 1 ? ' sessione fa.' : ' sessioni fa.') : ' Non ne hai mai fatto uno.') + '</p>' +
        '<div class="riga"><button class="azione pieno" data-esporta>Esporta</button>' +
        '<button class="azione" data-importa>Ripristina da file</button></div>' +
        '<input id="file-backup" type="file" accept="application/json,.json" hidden>' +
      '</div></div>' +

      '<div class="carta"><div class="campo" style="margin:0">' +
        '<span class="eti">Diario</span>' +
        '<p class="spiega">' + sessioni.length +
          (sessioni.length === 1 ? ' sessione registrata.' : ' sessioni registrate.') +
          ' Da lì si correggono i numeri sbagliati.</p>' +
        '<div class="riga"><button class="azione" data-va="diario">Apri il diario</button></div>' +
      '</div></div>' +
    '</div>';
}

/* ================= COLLEGAMENTI ================= */
function collega(){
  const q = s => app.querySelector(s);
  const tutti = (s, f) => app.querySelectorAll(s).forEach(f);
  const root = document.body;
  root.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => {
    sess = null; pulisciRiposo(); filtro = '';
    vai(b.dataset.tab, b.dataset.tab);
  });

  tutti('[data-va]', b => b.onclick = () => {
    const d = b.dataset.va;
    if (d === 'casa'){ sess = null; pulisciRiposo(); }
    vai(d, ['casa','schede','esercizi','impostazioni'].includes(d) ? d : tab);
  });

  /* --- casa --- */
  const inizia = q('[data-inizia]');
  if (inizia) inizia.onclick = () => {
    const g = laMiaSelezione();
    iniziaSessione(g, 'Completo', componi(g, sessioni, {preferiti, dascartare: daparte}));
  };
  const sceGr = q('[data-scegli-gruppi]');
  if (sceGr) sceGr.onclick = () => { scelta = laMiaSelezione().slice(); vai('gruppi'); };

  tutti('[data-gruppo]', b => b.onclick = () => {
    const id = b.dataset.gruppo;
    scelta = scelta.includes(id) ? scelta.filter(x => x !== id) : [...scelta, id];
    disegna();
  });
  const conf = q('[data-conferma-gruppi]');
  if (conf) conf.onclick = () => {
    if (!scelta.length){ alert('Scegli almeno un gruppo.'); return; }
    iniziaSessione(scelta, scelta.map(nomeGruppo).join(' · '),
      componi(scelta, sessioni, {preferiti, dascartare: daparte}));
  };
  const salvaSel = q('[data-salva-selezione]');
  if (salvaSel) salvaSel.onclick = async () => {
    if (!scelta.length){ alert('Scegli almeno un gruppo.'); return; }
    bozza = {...sched.schedaVuota(schede), gruppi: scelta.slice()};
    vai('scheda', 'schede');
  };

  /* --- anteprima --- */
  tutti('[data-cambia]', b => b.onclick = () => { sess.cambiaIndice = +b.dataset.cambia; disegna(); });
  tutti('[data-conalternativa]', b => b.onclick = () => {
    sess.lista[sess.cambiaIndice] = b.dataset.conalternativa;
    sess.cambiaIndice = null;
    if (sess.corrente) preparaEsercizio();
    disegna();
  });
  const annulla = q('[data-annulla-cambio]');
  if (annulla) annulla.onclick = () => {
    sess.cambiaIndice = null;
    if (sess.corrente) sess.corrente.cambia = false;
    disegna();
  };
  const parti = q('[data-parti]');
  if (parti) parti.onclick = () => { sess.indice = 0; preparaEsercizio(); vai('sessione'); };

  /* --- sessione --- */
  const esci = q('[data-esci]');
  if (esci) esci.onclick = () => {
    if (sess.esercizi.length){ if (!confirm('Esci e salvi quello che hai già fatto?')) return; concludi(); }
    else { if (!confirm('Esci senza salvare niente?')) return; sess = null; pulisciRiposo(); vai('casa','casa'); }
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
    disegna();
  });
  const serie = q('[data-serie]');
  if (serie) serie.onclick = () => {
    const c = sess.corrente;
    c.serie.push(c.ripetizioni); c.chiudi = false; c.ancora = false;
    if (c.serie.length < 3) avviaRiposo(recupero(c.esercizio)); else pulisciRiposo();
    disegna();
  };
  const chiudi = q('[data-chiudi]');
  if (chiudi) chiudi.onclick = () => { sess.corrente.chiudi = true; pulisciRiposo(); disegna(); };
  const ancora = q('[data-ancora]');
  if (ancora) ancora.onclick = () => {
    sess.corrente.ancora = true; sess.corrente.chiudi = false;
    avviaRiposo(recupero(sess.corrente.esercizio)); disegna();
  };
  tutti('[data-sforzo]', b => b.onclick = () => {
    const c = sess.corrente;
    if (c.serie.length)
      sess.esercizi.push({id: c.id, peso: c.peso, serie: c.serie.slice(), sforzo: b.dataset.sforzo});
    avanti();
  });
  const salta = q('[data-salta]');
  if (salta) salta.onclick = () => { sess.corrente.serie = []; avanti(); };
  const sost = q('[data-sostituisci]');
  if (sost) sost.onclick = () => { sess.cambiaIndice = sess.indice; disegna(); };
  const saltaR = q('[data-salta-riposo]');
  if (saltaR) saltaR.onclick = () => { pulisciRiposo(); disegna(); };

  tutti('[data-aggiungi-gruppo]', b => b.onclick = () => {
    const g = b.dataset.aggiungiGruppo;
    const nuovi = componi([g], sessioni, {preferiti, dascartare: daparte, giaDentro: sess.lista});
    if (!nuovi.length){ alert('Non trovo altri esercizi per questo gruppo.'); return; }
    sess.gruppi.push(g);
    sess.lista.push(...nuovi);
    preparaEsercizio();
    vai('sessione');
  });
  const basta = q('[data-basta]');
  if (basta) basta.onclick = concludi;

  /* --- schede --- */
  tutti('[data-fai]', b => b.onclick = () => {
    const s = schede.find(x => x.id === b.dataset.fai);
    if (!s || !s.gruppi.length){ alert('Questa scheda non ha nessun gruppo.'); return; }
    iniziaSessione(s.gruppi, s.nome, componi(s.gruppi, sessioni, {preferiti, dascartare: daparte}));
  });
  tutti('[data-modifica]', b => b.onclick = () => {
    bozza = JSON.parse(JSON.stringify(schede.find(x => x.id === b.dataset.modifica)));
    vai('scheda', 'schede');
  });
  const nuova = q('[data-nuova]');
  if (nuova) nuova.onclick = () => { bozza = sched.schedaVuota(schede); vai('scheda', 'schede'); };
  const nome = q('#nome-scheda');
  if (nome) nome.oninput = () => { bozza.nome = nome.value; };
  tutti('[data-gruppo-bozza]', b => b.onclick = () => {
    if (nome) bozza.nome = nome.value;
    const id = b.dataset.gruppoBozza;
    bozza.gruppi = bozza.gruppi.includes(id) ? bozza.gruppi.filter(x => x !== id) : [...bozza.gruppi, id];
    disegna();
  });
  const salvaS = q('[data-salva-scheda]');
  if (salvaS) salvaS.onclick = async () => {
    if (nome) bozza.nome = nome.value.trim() || 'Senza nome';
    if (!bozza.gruppi.length){ alert('Scegli almeno un gruppo.'); return; }
    const i = schede.findIndex(x => x.id === bozza.id);
    if (i === -1) schede.push(bozza); else schede[i] = bozza;
    await sched.scriviSchede(schede);
    await ricarica();
    vai('schede', 'schede');
  };
  const elim = q('[data-elimina]');
  if (elim) elim.onclick = async () => {
    if (!confirm('Elimino «' + bozza.nome + '»? Le sessioni registrate restano.')) return;
    schede = schede.filter(x => x.id !== bozza.id);
    await sched.scriviSchede(schede);
    await ricarica();
    vai('schede', 'schede');
  };

  /* --- esercizi --- */
  const cerca = q('#cerca');
  if (cerca) cerca.oninput = () => {
    filtro = cerca.value;
    const dove = cerca.selectionStart;
    disegna();
    const n = app.querySelector('#cerca');
    if (n){ n.focus(); try { n.setSelectionRange(dove, dove); } catch(e){} }
  };
  tutti('[data-apri]', b => b.onclick = () => { dettaglio = b.dataset.apri; ritorno = 'esercizi'; vai('esercizio'); });
  const solo = q('[data-solo]');
  if (solo) solo.onclick = () => {
    const e = PER_ID[solo.dataset.solo];
    iniziaSessione([], e.n, [e.id]);
  };
  tutti('[data-preferito]', b => b.onclick = async () => {
    const id = b.dataset.preferito;
    preferiti = preferiti.includes(id) ? preferiti.filter(x => x !== id) : [...preferiti, id];
    daparte = daparte.filter(x => x !== id);
    await archivio.scriviStato('preferiti', preferiti);
    await archivio.scriviStato('daparte', daparte);
    disegna();
  });
  tutti('[data-daparte]', b => b.onclick = async () => {
    const id = b.dataset.daparte;
    daparte = daparte.includes(id) ? daparte.filter(x => x !== id) : [...daparte, id];
    preferiti = preferiti.filter(x => x !== id);
    await archivio.scriviStato('daparte', daparte);
    await archivio.scriviStato('preferiti', preferiti);
    disegna();
  });

  /* --- diario e correzioni --- */
  tutti('[data-sessione]', b => b.onclick = () => {
    correzione = JSON.parse(JSON.stringify(sessioni.find(s => String(s.id) === b.dataset.sessione)));
    vai('correzione');
  });
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
    await archivio.aggiornaSessione(correzione);
    await ricarica();
    vai('diario');
  };
  const cancS = q('[data-cancella-sessione]');
  if (cancS) cancS.onclick = async () => {
    if (!confirm('Cancello tutta la sessione del ' + gg(correzione.data) + '? Non si torna indietro.')) return;
    await archivio.cancellaSessione(correzione.id);
    await ricarica();
    vai('diario');
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
    archivio.scaricaBackup(await archivio.esporta(), 'spingere-' + archivio.oggi() + '.json');
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
    try {
      const n = await archivio.importa(await f.text());
      await ricarica(); alert('Ripristinate ' + n + ' sessioni.'); disegna();
    } catch (e){ alert('Non ci sono riuscito: ' + e.message); }
  };
}

avvia();

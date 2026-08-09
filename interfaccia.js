/* L'interfaccia. Tutta la logica dei carichi sta in motore.js, le schede in
   schede.js: qui si disegna e si raccolgono tre tocchi per serie. */

import {ESERCIZI, PER_ID, figura} from './esercizi.js';
import {prescrizione, prossimoAllenamento, gradini, prossimoGradino,
        gradinoPrecedente, caricoTotale, indiceProgresso, pesoSuggerito,
        etichettaPrestazione, numero, ETICHETTA_SFORZO, PESO_DI_PARTENZA} from './motore.js';
import * as sched from './schede.js';
import * as archivio from './archivio.js';

const app = document.getElementById('app');
const RECUPERO = 90;

let sessioni = [];
let schede = [];
let pesoCorporeo = PESO_DI_PARTENZA;
let pesoImpostato = false;
let ultimoAllenamento = null;

let vista = 'casa';
let dettaglio = null;    /* esercizio aperto */
let ritorno = 'casa';    /* dove torna il dettaglio */
let bozza = null;        /* scheda in modifica */
let sceltaPer = null;    /* 'nucleo' | 'opzionali' */
let filtro = '';
let sess = null;
let riposo = null;

/* ------------------------------------------------------------------ */
const scampa = t => String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
const fig = e => figura(e.disegno);
const gg = d => d.slice(8,10) + '/' + d.slice(5,7);
const senzaAccenti = t => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');

function pulisciRiposo(){
  if (riposo && riposo.id) clearInterval(riposo.id);
  riposo = null;
}

async function ricarica(){
  sessioni = await archivio.tutteLeSessioni();
  schede = await sched.leggiSchede();
  const p = await archivio.leggiStato('pesoCorporeo', null);
  pesoImpostato = p != null;
  pesoCorporeo = pesoImpostato ? p : PESO_DI_PARTENZA;
  ultimoAllenamento = await archivio.leggiStato('ultimoAllenamento', null);
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
  casa: vistaCasa, schede: vistaSchede, scheda: vistaScheda, scelta: vistaScelta,
  catalogo: vistaCatalogo, esercizio: vistaEsercizio,
  sessione: vistaSessione, fine: vistaFine, impostazioni: vistaImpostazioni
};

function disegna(){
  app.innerHTML = (VISTE[vista] || vistaCasa)();
  collega();
}

function vai(dove){ vista = dove; disegna(); }

function marchio(){
  return '<svg width="24" height="24" viewBox="0 0 26 26" aria-hidden="true"><g fill="currentColor">' +
    '<rect x="1" y="18" width="3" height="7"/><rect x="6" y="14" width="3" height="11"/>' +
    '<rect x="11" y="10" width="3" height="15"/><rect x="16" y="6" width="3" height="19"/>' +
    '<rect x="21" y="1" width="3" height="24"/></g></svg>';
}

function cima(indietro, titolo){
  return '<div class="cima">' +
    (indietro ? '<button data-va="' + indietro + '">‹ Indietro</button>' : '<span></span>') +
    '<span class="passo mono">' + scampa(titolo) + '</span></div>';
}

/* ================================================================
   CASA — il centro dell'app
================================================================ */
function schedaDiOggi(){
  return prossimoAllenamento(schede, ultimoAllenamento);
}

function vociEsercizi(ids, classe){
  return ids.map(id => {
    const e = PER_ID[id];
    if (!e) return '';
    return '<li class="' + (classe || '') + '"><span class="fig">' + fig(e) + '</span>' +
      scampa(e.n) + '<span class="fascia mono">' + e.fascia[0] + '-' + e.fascia[1] + '</span></li>';
  }).join('');
}

function vistaCasa(){
  const s = schedaDiOggi();
  const ultima = sessioni[sessioni.length - 1];

  const corpo = s && s.nucleo.length
    ? '<p class="occhiello">Il prossimo allenamento</p>' +
      '<h1 class="titolone">' + scampa(s.nome) + '</h1>' +
      '<ul class="elenco-esercizi">' + vociEsercizi(s.nucleo) + '</ul>'
    : '<p class="occhiello">Nessuna scheda pronta</p>' +
      '<h1 class="titolone">Costruisci la prima.</h1>' +
      '<p class="messaggio">Le schede sono le tue liste di esercizi. Ne bastano tre per far girare ' +
      'una rotazione, ma puoi averne quante vuoi.</p>';

  return '<section class="schermata viva">' +
    '<div class="contenuto" style="padding-top:calc(34px + env(safe-area-inset-top))">' +
      '<div class="marchio">' + marchio() + '<span>Spingere</span></div>' +
      corpo +
      (ultima ? '<p class="messaggio">Ultima volta: ' + scampa(ultima.nomeScheda || ultima.allenamento) +
        ', il ' + gg(ultima.data) + '.</p>' : '') +
      (pesoImpostato ? '' :
        '<p class="messaggio acceso">Manca il tuo peso corporeo. Serve ai grafici di trazioni, dip e ' +
        'flessioni, dove il carico sei tu — finché non lo metti quelle curve usano ' + PESO_DI_PARTENZA +
        ' kg e sono sballate. È in Impostazioni, e resta su questo telefono.</p>') +

      '<div class="strade">' +
        strada('schede', 'Le tue schede', schede.length + (schede.length === 1 ? ' scheda' : ' schede') +
               ' · scegline una fuori turno') +
        strada('catalogo', 'Esercizi e storico', ESERCIZI.length + ' esercizi, con le curve di chi hai già fatto') +
        strada('impostazioni', 'Impostazioni', 'Peso corporeo, rotazione, backup') +
      '</div>' +
      '<div style="height:24px"></div>' +
    '</div>' +
    (s && s.nucleo.length
      ? '<div class="fondo-pagina"><button class="grosso" data-inizia="' + s.id + '">Comincia</button></div>'
      : '<div class="fondo-pagina"><button class="grosso" data-nuova>Crea una scheda</button></div>') +
  '</section>';
}

function strada(dove, titolo, sotto){
  return '<button class="strada" data-va="' + dove + '">' +
    '<span><span class="titolo">' + titolo + '</span>' +
    '<span class="sotto">' + sotto + '</span></span>' +
    '<span class="freccia">›</span></button>';
}

/* ================================================================
   SCHEDE
================================================================ */
function vistaSchede(){
  const righe = schede.map(s => {
    const d = sched.durataStimata(s);
    const manca = sched.mancanti(s);
    const prossima = schedaDiOggi() && schedaDiOggi().id === s.id;
    return '<div class="scheda-riga">' +
      '<button class="scheda-apri" data-fai="' + s.id + '">' +
        '<span class="titolo">' + scampa(s.nome) + (prossima ? ' <span class="turno">di turno</span>' : '') + '</span>' +
        '<span class="sotto mono">' + s.nucleo.length + ' + ' + s.opzionali.length + ' esercizi · ' +
          d.corta + '-' + d.lunga + ' min' +
          (manca.length ? ' · manca ' + manca.join(', ') : '') + '</span>' +
      '</button>' +
      '<button class="scheda-modifica" data-modifica="' + s.id + '" aria-label="Modifica ' +
        scampa(s.nome) + '">Modifica</button>' +
    '</div>';
  }).join('');

  return '<section class="schermata viva">' +
    cima('casa', 'schede') +
    '<div class="contenuto">' +
      '<h1 class="titolone" style="font-size:38px;margin-bottom:8px">Le tue schede</h1>' +
      '<p class="sottotitolo" style="margin-bottom:16px">Girano in ordine: finita una, tocca alla ' +
        'successiva. Toccane una per farla adesso, fuori turno.</p>' +
      (righe || '<p class="vuoto">Nessuna scheda.</p>') +
      '<div style="height:20px"></div>' +
    '</div>' +
    '<div class="fondo-pagina"><button class="grosso quieto" data-nuova>Nuova scheda</button></div>' +
  '</section>';
}

/* ---------------- editor ---------------- */
function vistaScheda(){
  const s = bozza;
  const manca = sched.mancanti(s);
  const d = sched.durataStimata(s);
  const esistente = schede.some(x => x.id === s.id);

  return '<section class="schermata viva">' +
    cima('schede', 'modifica') +
    '<div class="contenuto">' +
      '<div class="campo" style="border-top:0;padding-top:0">' +
        '<span class="eti">Nome</span>' +
        '<div class="riga"><input id="nome-scheda" type="text" value="' + scampa(s.nome) +
          '" maxlength="30" autocomplete="off"></div></div>' +

      blocco('Nucleo', 'Si fa sempre.', s.nucleo, 'nucleo') +
      blocco('Opzionali', 'L\'app li propone solo dopo il nucleo, se hai tempo.', s.opzionali, 'opzionali') +

      '<p class="messaggio' + (manca.length ? '' : ' acceso') + '">' +
        (manca.length
          ? 'Il nucleo non tocca: <b>' + manca.join(', ') + '</b>. È una tua scheda e la fai come vuoi — ' +
            'ma se questa è una delle tre della rotazione, quel lavoro non lo fa nessun altro giorno.'
          : 'Il nucleo tocca spinta, tirata, gambe e core.') +
        ' Durata stimata ' + d.corta + '-' + d.lunga + ' minuti.</p>' +

      (esistente && schede.length > 1
        ? '<button data-elimina style="margin-top:18px;color:var(--muto);font-size:13px;min-height:44px">' +
          'Elimina questa scheda</button>' : '') +
      '<div style="height:20px"></div>' +
    '</div>' +
    '<div class="fondo-pagina"><button class="grosso" data-salva-scheda>Salva</button></div>' +
  '</section>';
}

function blocco(titolo, spiega, ids, quale){
  const righe = ids.map((id, i) => {
    const e = PER_ID[id];
    if (!e) return '';
    return '<div class="voce">' +
      '<span class="fig">' + fig(e) + '</span>' +
      '<span class="nome-voce">' + scampa(e.n) + '</span>' +
      '<button class="mini" data-su="' + quale + ':' + i + '"' + (i === 0 ? ' disabled' : '') +
        ' aria-label="Sposta su">↑</button>' +
      '<button class="mini" data-giu="' + quale + ':' + i + '"' + (i === ids.length-1 ? ' disabled' : '') +
        ' aria-label="Sposta giù">↓</button>' +
      '<button class="mini via" data-togli="' + quale + ':' + i + '" aria-label="Togli">✕</button>' +
    '</div>';
  }).join('');
  return '<div class="campo"><span class="eti">' + titolo + '</span>' +
    '<p class="spiega">' + spiega + '</p>' +
    (righe || '<p class="vuoto" style="padding:14px 0">Ancora nessuno.</p>') +
    '<div class="riga"><button class="azione" data-aggiungi="' + quale + '">Aggiungi esercizi</button></div>' +
  '</div>';
}

/* ---------------- scelta esercizi ---------------- */
function vistaScelta(){
  const dentro = new Set([...bozza.nucleo, ...bozza.opzionali]);
  const q = senzaAccenti(filtro.trim());
  const gruppi = {};
  for (const e of ESERCIZI){
    if (q && !senzaAccenti(e.n + ' ' + e.gruppo).includes(q)) continue;
    (gruppi[e.gruppo] ||= []).push(e);
  }

  const corpo = Object.keys(gruppi).length
    ? Object.entries(gruppi).map(([g, lista]) =>
        '<div class="gruppo-titolo">' + scampa(g) + '</div>' +
        lista.map(e => {
          const c = dentro.has(e.id);
          return '<button class="riga-scelta" data-scegli="' + e.id + '" aria-pressed="' + c + '">' +
            '<span class="fig">' + fig(e) + '</span>' +
            '<span><span class="titolo">' + scampa(e.n) + '</span>' +
            '<span class="sotto mono">' + e.fascia[0] + '-' + e.fascia[1] +
              (e.unilaterale ? '/lato' : '') + '</span></span>' +
            '<span class="segno">' + (c ? '✓' : '+') + '</span></button>';
        }).join('')
      ).join('')
    : '<p class="vuoto">Nessun esercizio con «' + scampa(filtro) + '».</p>';

  return '<section class="schermata viva">' +
    cima('scheda', sceltaPer === 'nucleo' ? 'nucleo' : 'opzionali') +
    '<div class="cerca"><input id="cerca" type="search" placeholder="Cerca fra ' + ESERCIZI.length +
      ' esercizi" value="' + scampa(filtro) + '" autocomplete="off"></div>' +
    '<div class="contenuto">' + corpo + '<div style="height:20px"></div></div>' +
    '<div class="fondo-pagina"><button class="grosso" data-va="scheda">Fatto</button></div>' +
  '</section>';
}

/* ================================================================
   CATALOGO — tutti gli esercizi, con lo storico di quelli fatti
================================================================ */
function contaSessioni(id){
  return sessioni.reduce((n, s) => n + ((s.esercizi || []).some(e => e.id === id) ? 1 : 0), 0);
}

function vistaCatalogo(){
  const q = senzaAccenti(filtro.trim());
  const gruppi = {};
  for (const e of ESERCIZI){
    if (q && !senzaAccenti(e.n + ' ' + e.gruppo).includes(q)) continue;
    (gruppi[e.gruppo] ||= []).push(e);
  }

  const corpo = Object.keys(gruppi).length
    ? Object.entries(gruppi).map(([g, lista]) =>
        '<div class="gruppo-titolo">' + scampa(g) + '</div>' +
        lista.map(e => {
          const n = contaSessioni(e.id);
          const st = archivio.storicoEsercizio(sessioni, e.id);
          const sotto = n
            ? n + (n === 1 ? ' sessione · ' : ' sessioni · ') +
              etichettaPrestazione(e, st[0].peso, Math.max(...st[0].serie))
            : 'mai fatto · fascia ' + e.fascia[0] + '-' + e.fascia[1];
          return '<button class="riga-storico" data-apri="' + e.id + '">' +
            '<span class="fig">' + fig(e) + '</span>' +
            '<span><span class="titolo">' + scampa(e.n) + '</span>' +
            '<span class="sotto mono">' + sotto + '</span></span>' +
            '<span class="freccia">›</span></button>';
        }).join('')
      ).join('')
    : '<p class="vuoto">Nessun esercizio con «' + scampa(filtro) + '».</p>';

  return '<section class="schermata viva">' +
    cima('casa', 'catalogo') +
    '<div class="cerca"><input id="cerca" type="search" placeholder="Cerca fra ' + ESERCIZI.length +
      ' esercizi" value="' + scampa(filtro) + '" autocomplete="off"></div>' +
    '<div class="contenuto">' + corpo + '<div style="height:24px"></div></div>' +
  '</section>';
}

/* ---------------- dettaglio esercizio ---------------- */
function vistaEsercizio(){
  const e = PER_ID[dettaglio];
  const st = archivio.storicoEsercizio(sessioni, e.id).slice().reverse();
  const punti = st.map(s => ({
    data: s.data,
    valore: indiceProgresso(e, s.peso, Math.max(...s.serie), pesoCorporeo),
    peso: s.peso, rip: Math.max(...s.serie), serie: s.serie
  }));

  const righe = st.slice().reverse().map(s =>
    '<tr><td class="mono">' + gg(s.data) + '</td>' +
    '<td class="mono">' + (e.carico === 'corpo' ? 'corpo' :
        (e.carico === 'zavorra' && !s.peso ? 'corpo' : numero(s.peso) + ' kg')) + '</td>' +
    '<td class="mono">' + s.serie.join('-') + '</td></tr>').join('');

  const corpoLibero = e.carico !== 'manubri';
  const spiega = 'La curva mette insieme carico e ripetizioni, così sale anche quando il manubrio ' +
    'resta lo stesso e tu fai una ripetizione in più. Non è un massimale: i numeri veri sono qui sotto.' +
    (corpoLibero ? ' Qui il carico sei tu, quindi conta anche il tuo peso corporeo (' +
      numero(pesoCorporeo) + ' kg).' : '');

  const inSchede = schede.filter(s => s.nucleo.includes(e.id) || s.opzionali.includes(e.id));

  return '<section class="schermata viva">' +
    cima(ritorno, punti.length ? punti.length + (punti.length === 1 ? ' sessione' : ' sessioni') : 'mai fatto') +
    '<div class="contenuto">' +
      '<div class="figurone">' + fig(e) + '</div>' +
      '<h1 class="titolone" style="font-size:28px;margin-bottom:6px">' + scampa(e.n) + '</h1>' +
      '<p class="sottotitolo">' + (e.nota ? scampa(e.nota) + ' · ' : '') +
        'fascia ' + e.fascia[0] + '-' + e.fascia[1] + (e.unilaterale ? ' per lato' : '') + '</p>' +
      (inSchede.length
        ? '<p class="sottotitolo">In: ' + inSchede.map(s => scampa(s.nome)).join(', ') + '</p>'
        : '<p class="sottotitolo">Non è in nessuna scheda.</p>') +
      (punti.length
        ? grafico(punti, e) + '<p class="sottotitolo" style="margin-bottom:18px">' + spiega + '</p>' +
          '<table class="tabella"><thead><tr><th>Giorno</th><th>Carico</th><th>Serie</th></tr></thead>' +
          '<tbody>' + righe + '</tbody></table>'
        : '<p class="messaggio">Non l\'hai ancora mai fatto. Puoi farlo adesso da solo, oppure ' +
          'metterlo in una scheda.</p>') +
      '<div style="height:20px"></div>' +
    '</div>' +
    '<div class="fondo-pagina"><button class="grosso quieto" data-solo="' + e.id + '">Fai adesso, da solo</button></div>' +
  '</section>';
}

/* ================================================================
   SESSIONE
================================================================ */
function iniziaSessione(scheda, estemporanea){
  sess = {
    scheda: {id: scheda.id, nome: scheda.nome,
             nucleo: scheda.nucleo.slice(), opzionali: scheda.opzionali.slice()},
    estemporanea: !!estemporanea,
    data: archivio.oggi(),
    iniziata: Date.now(),
    fase: 'nucleo',
    indice: 0,
    esercizi: [],
    corrente: null
  };
  preparaEsercizio();
  vai('sessione');
}

function listaFase(){
  return sess.fase === 'nucleo' ? sess.scheda.nucleo : sess.scheda.opzionali;
}

function preparaEsercizio(){
  const id = listaFase()[sess.indice];
  const e = PER_ID[id];
  const storico = archivio.storicoEsercizio(sessioni, id);
  const p = prescrizione(e, storico, sess.data, pesoCorporeo);
  sess.corrente = {
    id, esercizio: e, pres: p,
    peso: p.peso === null ? pesoSuggerito(e) : p.peso,
    ripetizioni: p.bersaglio,
    serie: [], sforzo: null, chiudi: false, ancora: false, cambia: false
  };
}

function vistaSessione(){
  const c = sess.corrente;
  if (!c) return vistaProponiOpzionali();
  if (c.cambia) return vistaSostituisci();

  const e = c.esercizio, p = c.pres, lista = listaFase();
  const tacche = lista.map((_, i) =>
    '<i class="' + (i < sess.indice ? 'fatto' : i === sess.indice ? 'ora' : '') + '"></i>').join('');

  /* Tre serie sono il consueto, non un obbligo: si può chiudere prima
     (`chiudi`) o andarci oltre (`ancora`). Prima il 3 era cablato in tre
     punti del codice e non c'era modo di scostarsene. */
  const mostraSforzo = (c.serie.length >= 3 && !c.ancora) || c.chiudi;

  return '<section class="schermata viva">' +
    '<div class="cima">' +
      '<button data-esci>Esci</button>' +
      '<span class="passo mono">' + scampa(sess.scheda.nome) + ' · ' +
        (sess.fase === 'nucleo' ? '' : 'extra ') + (sess.indice+1) + '/' + lista.length + '</span>' +
    '</div>' +
    '<div class="avanzamento">' + tacche + '</div>' +
    '<div class="contenuto">' +
      '<div class="figurone">' + fig(e) + '</div>' +
      '<h2 class="nome-esercizio">' + scampa(e.n) + '</h2>' +
      '<p class="sottotitolo">' + (e.nota ? scampa(e.nota) + ' · ' : '') +
        'fascia ' + e.fascia[0] + '-' + e.fascia[1] + (e.unilaterale ? ' per lato' : '') + '</p>' +
      '<p class="messaggio' + (p.sale || p.rientro ? ' acceso' : '') + '">' + scampa(p.messaggio) +
        (p.record ? ' Record: ' + etichettaPrestazione(e, p.record.peso, p.record.ripetizioni) + '.' : '') +
        (p.salite >= 2 ? ' ' + p.salite + ' salite di fila.' : '') + '</p>' +
      '<div class="bersaglio"><span class="num mono">' + c.ripetizioni + '</span>' +
        '<span class="eti">ripetizioni oggi' + (e.unilaterale ? ', per lato' : '') + '</span></div>' +
      '<div class="minori">' +
        '<button data-sostituisci>Cambia esercizio</button>' +
        '<button data-salta>Salta</button>' +
      '</div>' +
      '<div style="height:20px"></div>' +
    '</div>' +
    '<div class="fondo-pagina">' +
      (riposo ? riquadroRiposo() : '') +
      pannelloPeso(e, c) +
      pannelloSerie(c) +
      (mostraSforzo ? pannelloSforzo(c) : pannelloConta(c)) +
    '</div>' +
  '</section>';
}

function vistaSostituisci(){
  const c = sess.corrente;
  const dentro = [...sess.scheda.nucleo, ...sess.scheda.opzionali];
  const alt = sched.alternative(c.id, dentro);
  const righe = alt.length
    ? alt.map(x => '<button class="riga-storico" data-concui="' + x.id + '">' +
        '<span class="fig">' + fig(x) + '</span>' +
        '<span><span class="titolo">' + scampa(x.n) + '</span>' +
        '<span class="sotto mono">' + x.fascia[0] + '-' + x.fascia[1] +
          (x.unilaterale ? '/lato' : '') + '</span></span>' +
        '<span class="freccia">›</span></button>').join('')
    : '<p class="vuoto">Non ci sono altri esercizi di questo gruppo fuori dalla scheda.</p>';

  return '<section class="schermata viva">' +
    '<div class="cima"><button data-annulla-cambio>‹ Torna</button>' +
      '<span class="passo mono">cambia</span></div>' +
    '<div class="contenuto">' +
      '<h1 class="titolone" style="font-size:30px;margin-bottom:6px">Al posto di</h1>' +
      '<p class="sottotitolo" style="margin-bottom:16px">' + scampa(c.esercizio.n) +
        ' — stesso gruppo, stesso lavoro.</p>' + righe +
      '<p class="messaggio">Vale solo per oggi: la scheda resta com\'è.</p>' +
      '<div style="height:20px"></div>' +
    '</div>' +
  '</section>';
}

function pannelloPeso(e, c){
  if (e.carico === 'corpo')
    return '<div class="peso"><span class="corpo">A corpo libero</span></div>';
  const giu = gradinoPrecedente(e.carico, c.peso);
  const su = prossimoGradino(e.carico, c.peso);
  const eti = e.carico === 'zavorra'
    ? (c.peso === 0 ? 'solo il corpo' : 'zavorra fra i piedi')
    : (e.manubri === 2 ? 'per manubrio' : 'un manubrio');
  return '<div class="peso">' +
    '<button class="gradino" data-peso="giu"' + (giu === null ? ' disabled' : '') + '>−</button>' +
    '<span class="valore"><span class="kg mono' + (c.pres.sale ? ' sale' : '') + '">' +
      numero(c.peso) + '</span><span class="unita">kg · ' + eti + '</span></span>' +
    '<button class="gradino" data-peso="su"' + (su === null ? ' disabled' : '') + '>+</button>' +
  '</div>';
}

/* Tre caselle di consueto, ma se ne fai di più compaiono: il 3 non è più
   cablato, è solo il minimo che si mostra. */
function pannelloSerie(c){
  let out = '';
  for (let i = 0; i < Math.max(3, c.serie.length); i++){
    const fatta = c.serie[i] !== undefined;
    const viva = !fatta && i === c.serie.length;
    out += '<div class="casella' + (fatta ? '' : viva ? ' viva' : ' vuota') + '">' +
      '<span class="n mono">' + (fatta ? c.serie[i] : viva ? c.ripetizioni : '–') + '</span>' +
      '<span class="e">serie ' + (i+1) + '</span></div>';
  }
  return '<div class="serie">' + out + '</div>';
}

function pannelloConta(c){
  return '<div class="conta">' +
      '<button class="gradino" data-rip="giu">−</button>' +
      '<span class="quanti mono">' + c.ripetizioni + '</span>' +
      '<button class="gradino" data-rip="su">+</button>' +
    '</div>' +
    '<button class="grosso" data-serie>Serie ' + (c.serie.length + 1) + ' fatta</button>' +
    (c.serie.length >= 1
      ? '<button class="sotto-grosso" data-chiudi>Chiudo qui, ' + c.serie.length +
        (c.serie.length === 1 ? ' serie' : ' serie') + '</button>' : '');
}

function pannelloSforzo(c){
  const b = ['facile','giusta','limite'].map(s =>
    '<button data-sforzo="' + s + '"' + (c.sforzo === s ? ' class="scelto"' : '') + '>' +
    ETICHETTA_SFORZO[s] + '</button>').join('');
  return '<p class="sottotitolo" style="margin:0 0 10px">Com\'è andata l\'ultima serie?</p>' +
    '<div class="sforzo">' + b + '</div>' +
    '<button class="sotto-grosso" data-ancora>Ne faccio un\'altra</button>';
}

function riquadroRiposo(){
  const r = 22, giro = 2 * Math.PI * r;
  const quota = giro * (riposo.resta / RECUPERO);
  return '<div class="recupero">' +
    '<svg viewBox="0 0 52 52" aria-hidden="true">' +
      '<circle class="anello" cx="26" cy="26" r="' + r + '"/>' +
      '<circle class="quota" cx="26" cy="26" r="' + r + '" stroke-dasharray="' + giro.toFixed(1) +
        '" stroke-dashoffset="' + (giro - quota).toFixed(1) + '"/></svg>' +
    '<div><div class="tempo mono" id="tempo">' + riposo.resta + 's</div>' +
      '<div class="avviso">Non suona: a schermo spento iOS ferma l\'app.</div></div>' +
    '<button class="salta" data-salta-riposo>Salta</button>' +
  '</div>';
}

function avviaRiposo(){
  pulisciRiposo();
  riposo = {resta: RECUPERO, id: null};
  riposo.id = setInterval(() => {
    riposo.resta--;
    if (riposo.resta <= 0){ pulisciRiposo(); disegna(); return; }
    const t = document.getElementById('tempo');
    const q = document.querySelector('.recupero .quota');
    if (!t){ pulisciRiposo(); return; }
    t.textContent = riposo.resta + 's';
    if (q){
      const giro = 2 * Math.PI * 22;
      q.setAttribute('stroke-dashoffset', (giro - giro * (riposo.resta / RECUPERO)).toFixed(1));
    }
  }, 1000);
}

function chiudiEsercizio(sforzo){
  const c = sess.corrente;
  if (c.serie.length)
    sess.esercizi.push({id: c.id, nome: c.esercizio.n, peso: c.peso, serie: c.serie.slice(), sforzo});
  avanti();
}

function avanti(){
  pulisciRiposo();
  sess.indice++;
  if (sess.indice < listaFase().length){ preparaEsercizio(); disegna(); return; }
  if (sess.fase === 'nucleo' && sess.scheda.opzionali.length){ sess.corrente = null; disegna(); return; }
  concludi();
}

function vistaProponiOpzionali(){
  return '<section class="schermata viva">' +
    '<div class="cima"><button data-esci>Esci</button><span class="passo mono">nucleo finito</span></div>' +
    '<div class="contenuto">' +
      '<p class="occhiello">Nucleo finito</p>' +
      '<h1 class="titolone">Hai ancora tempo?</h1>' +
      '<ul class="elenco-esercizi">' + vociEsercizi(sess.scheda.opzionali) + '</ul>' +
      '<p class="messaggio">Il grosso è fatto. Questi aggiungono una ventina di minuti: se li salti ' +
        'non perdi niente di importante.</p>' +
      '<div style="height:20px"></div>' +
    '</div>' +
    '<div class="fondo-pagina">' +
      '<button class="grosso" data-extra>Sì, continuo</button>' +
      '<div style="height:10px"></div>' +
      '<button class="grosso quieto" data-basta>Ho finito</button>' +
    '</div>' +
  '</section>';
}

async function concludi(){
  pulisciRiposo();
  const durata = Math.round((Date.now() - sess.iniziata) / 60000);
  if (sess.esercizi.length){
    await archivio.salvaSessione({
      data: sess.data,
      allenamento: sess.scheda.id,
      nomeScheda: sess.scheda.nome,
      durataMin: durata,
      esercizi: sess.esercizi
    });
    /* Un esercizio fatto da solo non fa avanzare la rotazione. */
    if (!sess.estemporanea){
      await archivio.scriviStato('ultimoAllenamento', sess.scheda.id);
    }
    await ricarica();
  }
  vai('fine');
}

function vistaFine(){
  const fatte = sess ? sess.esercizi : [];
  if (!fatte.length){
    return '<section class="schermata viva"><div class="contenuto" style="padding-top:60px">' +
      '<h1 class="titolone">Niente da salvare.</h1>' +
      '<p class="messaggio">Non hai completato nessuna serie, quindi la rotazione resta dov\'era.</p>' +
      '</div><div class="fondo-pagina"><button class="grosso" data-va="casa">Torna a casa</button></div></section>';
  }
  const righe = fatte.map(x => {
    const e = PER_ID[x.id];
    return '<tr><td>' + scampa(e.n) + '</td><td class="mono">' +
      (e.carico === 'corpo' || (e.carico === 'zavorra' && !x.peso) ? 'corpo' : numero(x.peso) + ' kg') +
      '</td><td class="mono">' + x.serie.join('-') + '</td></tr>';
  }).join('');
  const poi = prossimoAllenamento(schede, ultimoAllenamento);
  return '<section class="schermata viva">' +
    '<div class="contenuto" style="padding-top:calc(40px + env(safe-area-inset-top))">' +
      '<p class="occhiello">' + scampa(sess.scheda.nome) + ' registrato</p>' +
      '<h1 class="titolone">Fatto.</h1>' +
      '<table class="tabella"><thead><tr><th>Esercizio</th><th>Carico</th><th>Serie</th></tr></thead>' +
      '<tbody>' + righe + '</tbody></table>' +
      '<p class="messaggio">' + (sess.estemporanea
        ? 'Era fuori rotazione, quindi il turno non è cambiato: la prossima resta ' +
          scampa(poi ? poi.nome.toLowerCase() : '—') + '.'
        : 'La prossima sarà ' + scampa(poi ? poi.nome.toLowerCase() : '—') +
          '. Quando torni, che sia domani o fra due settimane.') + '</p>' +
      '<div style="height:20px"></div>' +
    '</div>' +
    '<div class="fondo-pagina"><button class="grosso" data-va="casa">Chiudi</button></div>' +
  '</section>';
}

/* ================================================================
   GRAFICO
   Una serie sola: niente legenda, il titolo la nomina già. L'asse
   verticale non porta numeri di proposito — l'indice è una scala
   relativa, e stamparne i decimali darebbe una precisione che non ha.
================================================================ */
function grafico(punti, e){
  const L = 320, A = 190, sx = 14, dx = 14, su = 20, giu = 24;
  if (!punti.length) return '';
  if (punti.length === 1)
    return '<p class="messaggio" style="margin:18px 0">Una sola sessione: ' +
      etichettaPrestazione(e, punti[0].peso, punti[0].rip) +
      '. Serve una seconda per vedere una curva.</p>';

  const vals = punti.map(p => p.valore);
  let min = Math.min(...vals), max = Math.max(...vals);
  if (min === max){ min -= 1; max += 1; }
  const margine = (max - min) * 0.18;
  min -= margine; max += margine;

  const X = i => sx + (L - sx - dx) * (i / (punti.length - 1));
  const Y = v => su + (A - su - giu) * (1 - (v - min) / (max - min));

  const d = punti.map((p, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(p.valore).toFixed(1)).join(' ');
  const area = d + ' L' + X(punti.length-1).toFixed(1) + ' ' + (A - giu) + ' L' + sx + ' ' + (A - giu) + ' Z';

  let griglia = '';
  for (const q of [0, 0.5, 1]){
    const y = Y(min + (max - min) * q);
    griglia += '<line class="griglia" x1="' + sx + '" y1="' + y.toFixed(1) +
      '" x2="' + (L-dx) + '" y2="' + y.toFixed(1) + '"/>';
  }
  const cerchi = punti.map((p, i) =>
    '<circle class="punto" cx="' + X(i).toFixed(1) + '" cy="' + Y(p.valore).toFixed(1) + '" r="' +
    (i === punti.length-1 ? 4.5 : 2.6) + '"/>').join('');

  const ultimo = punti[punti.length-1];
  const uy = Y(ultimo.valore);
  const alto = uy < su + 16;
  const testo = etichettaPrestazione(e, ultimo.peso, ultimo.rip);
  const eti = '<text x="' + (L - dx).toFixed(1) + '" y="' + (alto ? uy + 16 : uy - 11).toFixed(1) +
    '" text-anchor="end" style="fill:var(--testo);font-size:11px">' + scampa(testo) + '</text>';

  return '<svg class="grafico" viewBox="0 0 ' + L + ' ' + A + '" role="img" ' +
    'aria-label="Progresso su ' + punti.length + ' sessioni, ' +
    (vals[vals.length-1] >= vals[0] ? 'in salita' : 'in calo') + '. Ultima: ' + scampa(testo) + '">' +
    griglia + '<path class="area" d="' + area + '"/>' +
    '<path class="linea" d="' + d + '"/>' + cerchi + eti +
    '<text x="' + sx + '" y="' + (A-8) + '">' + gg(punti[0].data) + '</text>' +
    '<text x="' + (L-dx) + '" y="' + (A-8) + '" text-anchor="end">' + gg(punti[punti.length-1].data) + '</text>' +
  '</svg>';
}

/* ================================================================
   IMPOSTAZIONI
================================================================ */
function vistaImpostazioni(){
  const p = schedaDiOggi();
  return '<section class="schermata viva">' +
    cima('casa', 'impostazioni') +
    '<div class="contenuto">' +
      '<h1 class="titolone" style="font-size:38px;margin-bottom:10px">Impostazioni</h1>' +

      '<div class="campo"><span class="eti">Peso corporeo</span>' +
        '<p class="spiega">Serve agli esercizi a corpo libero — trazioni, dip, flessioni — dove il ' +
        'carico sei tu. Senza, il grafico ti mostrerebbe fermo mentre progredisci. Aggiornalo quando ' +
        'ti va: nessuno te lo chiederà.</p>' +
        '<div class="riga"><input id="peso-corpo" type="number" inputmode="decimal" step="0.5" ' +
          'min="30" max="200" value="' + (pesoImpostato ? pesoCorporeo : '') +
          '" placeholder="' + PESO_DI_PARTENZA + '">' +
          '<button class="azione" data-salva-peso>Salva</button></div></div>' +

      '<div class="campo"><span class="eti">Rotazione</span>' +
        '<p class="spiega">La prossima è <b>' + scampa(p ? p.nome.toLowerCase() : 'nessuna') +
        '</b>. Non c\'è nessun calendario: conta solo quale è stata l\'ultima.</p>' +
        '<div class="riga riga-avvolge">' + schede.map(s =>
          '<button class="azione" data-forza="' + s.id + '">Riparti da ' + scampa(s.nome) + '</button>').join('') +
        '</div></div>' +

      '<div class="campo"><span class="eti">Backup</span>' +
        '<p class="spiega">Lo storico sta solo su questo telefono. Se cancelli l\'icona dalla schermata ' +
        'home o resetti l\'iPhone, se ne va con lui e non si recupera. Scarica un file ogni tanto.</p>' +
        '<div class="riga"><button class="azione" data-esporta>Esporta backup</button>' +
        '<button class="azione" data-importa>Ripristina da file</button></div>' +
        '<input id="file-backup" type="file" accept="application/json,.json" hidden></div>' +

      '<p class="sottotitolo" style="margin-top:22px">' + sessioni.length +
        (sessioni.length === 1 ? ' sessione registrata.' : ' sessioni registrate.') + '</p>' +
      '<div style="height:30px"></div>' +
    '</div>' +
  '</section>';
}

/* ================================================================
   COLLEGAMENTI
================================================================ */
function collega(){
  const q = s => app.querySelector(s);
  const tutti = (s, f) => app.querySelectorAll(s).forEach(f);

  tutti('[data-va]', b => b.onclick = () => {
    const dove = b.dataset.va;
    if (dove === 'casa'){ sess = null; pulisciRiposo(); }
    if (dove === 'catalogo') filtro = '';
    vai(dove);
  });

  /* --- casa --- */
  const inizia = q('[data-inizia]');
  if (inizia) inizia.onclick = () => {
    const s = schede.find(x => x.id === inizia.dataset.inizia);
    if (s) iniziaSessione(s, false);
  };

  /* --- schede --- */
  tutti('[data-fai]', b => b.onclick = () => {
    const s = schede.find(x => x.id === b.dataset.fai);
    if (s && s.nucleo.length) iniziaSessione(s, false);
    else alert('Questa scheda non ha ancora nessun esercizio nel nucleo.');
  });
  tutti('[data-modifica]', b => b.onclick = () => {
    const s = schede.find(x => x.id === b.dataset.modifica);
    bozza = JSON.parse(JSON.stringify(s));
    vai('scheda');
  });
  const nuova = q('[data-nuova]');
  if (nuova) nuova.onclick = () => { bozza = sched.schedaVuota(schede); vai('scheda'); };

  /* --- editor --- */
  const nome = q('#nome-scheda');
  if (nome) nome.oninput = () => { bozza.nome = nome.value; };

  tutti('[data-aggiungi]', b => b.onclick = () => {
    if (nome) bozza.nome = nome.value;
    sceltaPer = b.dataset.aggiungi; filtro = ''; vai('scelta');
  });
  tutti('[data-togli]', b => b.onclick = () => {
    const [quale, i] = b.dataset.togli.split(':');
    bozza[quale].splice(+i, 1); disegna();
  });
  tutti('[data-su]', b => b.onclick = () => {
    const [quale, i] = b.dataset.su.split(':'); const n = +i;
    const a = bozza[quale]; [a[n-1], a[n]] = [a[n], a[n-1]]; disegna();
  });
  tutti('[data-giu]', b => b.onclick = () => {
    const [quale, i] = b.dataset.giu.split(':'); const n = +i;
    const a = bozza[quale]; [a[n+1], a[n]] = [a[n], a[n+1]]; disegna();
  });

  const salvaScheda = q('[data-salva-scheda]');
  if (salvaScheda) salvaScheda.onclick = async () => {
    if (nome) bozza.nome = nome.value.trim() || 'Senza nome';
    if (!bozza.nucleo.length){ alert('Metti almeno un esercizio nel nucleo.'); return; }
    const i = schede.findIndex(x => x.id === bozza.id);
    if (i === -1) schede.push(bozza); else schede[i] = bozza;
    await sched.scriviSchede(schede);
    await ricarica();
    vai('schede');
  };

  const elimina = q('[data-elimina]');
  if (elimina) elimina.onclick = async () => {
    if (!confirm('Elimino «' + bozza.nome + '»? Le sessioni già registrate restano.')) return;
    schede = schede.filter(x => x.id !== bozza.id);
    await sched.scriviSchede(schede);
    await ricarica();
    vai('schede');
  };

  /* --- scelta esercizi --- */
  tutti('[data-scegli]', b => b.onclick = () => {
    const id = b.dataset.scegli;
    const dentroNucleo = bozza.nucleo.indexOf(id), dentroOpz = bozza.opzionali.indexOf(id);
    if (dentroNucleo !== -1) bozza.nucleo.splice(dentroNucleo, 1);
    else if (dentroOpz !== -1) bozza.opzionali.splice(dentroOpz, 1);
    else bozza[sceltaPer].push(id);
    disegna();
  });

  const cerca = q('#cerca');
  if (cerca) cerca.oninput = () => {
    filtro = cerca.value;
    const dove = cerca.selectionStart;
    disegna();
    const nuovo = app.querySelector('#cerca');
    if (nuovo){ nuovo.focus(); try { nuovo.setSelectionRange(dove, dove); } catch(e){} }
  };

  /* --- catalogo --- */
  tutti('[data-apri]', b => b.onclick = () => {
    dettaglio = b.dataset.apri; ritorno = vista; vai('esercizio');
  });
  const solo = q('[data-solo]');
  if (solo) solo.onclick = () => {
    const e = PER_ID[solo.dataset.solo];
    iniziaSessione({id: 'solo-' + e.id, nome: e.n, nucleo: [e.id], opzionali: []}, true);
  };

  /* --- sessione --- */
  const esci = q('[data-esci]');
  if (esci) esci.onclick = () => {
    if (sess && sess.esercizi.length){
      if (!confirm('Esci e salvi quello che hai già fatto?')) return;
      concludi();
    } else {
      if (!confirm('Esci senza salvare niente?')) return;
      sess = null; pulisciRiposo(); vai('casa');
    }
  };

  tutti('[data-peso]', b => b.onclick = () => {
    const c = sess.corrente;
    const nuovo = b.dataset.peso === 'su'
      ? prossimoGradino(c.esercizio.carico, c.peso)
      : gradinoPrecedente(c.esercizio.carico, c.peso);
    if (nuovo !== null){ c.peso = nuovo; c.pres = {...c.pres, sale:false}; disegna(); }
  });

  tutti('[data-rip]', b => b.onclick = () => {
    const c = sess.corrente;
    c.ripetizioni = Math.max(1, c.ripetizioni + (b.dataset.rip === 'su' ? 1 : -1));
    disegna();
  });

  const serie = q('[data-serie]');
  if (serie) serie.onclick = () => {
    const c = sess.corrente;
    c.serie.push(c.ripetizioni);
    c.chiudi = false; c.ancora = false;
    if (c.serie.length < 3) avviaRiposo(); else pulisciRiposo();
    disegna();
  };

  const chiudi = q('[data-chiudi]');
  if (chiudi) chiudi.onclick = () => { sess.corrente.chiudi = true; pulisciRiposo(); disegna(); };
  const ancora = q('[data-ancora]');
  if (ancora) ancora.onclick = () => { sess.corrente.ancora = true; sess.corrente.chiudi = false; avviaRiposo(); disegna(); };

  tutti('[data-sforzo]', b => b.onclick = () => chiudiEsercizio(b.dataset.sforzo));

  const salta = q('[data-salta]');
  if (salta) salta.onclick = () => { sess.corrente.serie = []; avanti(); };

  const sostituisci = q('[data-sostituisci]');
  if (sostituisci) sostituisci.onclick = () => { sess.corrente.cambia = true; disegna(); };
  const annulla = q('[data-annulla-cambio]');
  if (annulla) annulla.onclick = () => { sess.corrente.cambia = false; disegna(); };
  tutti('[data-concui]', b => b.onclick = () => {
    listaFase()[sess.indice] = b.dataset.concui;
    preparaEsercizio();
    disegna();
  });

  const saltaRiposo = q('[data-salta-riposo]');
  if (saltaRiposo) saltaRiposo.onclick = () => { pulisciRiposo(); disegna(); };

  const extra = q('[data-extra]');
  if (extra) extra.onclick = () => { sess.fase = 'opzionali'; sess.indice = 0; preparaEsercizio(); disegna(); };
  const basta = q('[data-basta]');
  if (basta) basta.onclick = concludi;

  /* --- impostazioni --- */
  const salvaPeso = q('[data-salva-peso]');
  if (salvaPeso) salvaPeso.onclick = async () => {
    const v = parseFloat(q('#peso-corpo').value);
    if (!isFinite(v) || v < 30 || v > 200){ alert('Un peso fra 30 e 200 kg.'); return; }
    pesoCorporeo = v; pesoImpostato = true;
    await archivio.scriviStato('pesoCorporeo', v);
    salvaPeso.textContent = 'Salvato';
    setTimeout(() => { if (salvaPeso.isConnected) salvaPeso.textContent = 'Salva'; }, 1600);
  };

  tutti('[data-forza]', b => b.onclick = async () => {
    const i = schede.findIndex(s => s.id === b.dataset.forza);
    const prima = schede[(i - 1 + schede.length) % schede.length].id;
    ultimoAllenamento = prima;
    await archivio.scriviStato('ultimoAllenamento', prima);
    disegna();
  });

  const esporta = q('[data-esporta]');
  if (esporta) esporta.onclick = async () => {
    archivio.scaricaBackup(await archivio.esporta(), 'spingere-' + archivio.oggi() + '.json');
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
      await ricarica();
      alert('Ripristinate ' + n + ' sessioni.');
      disegna();
    } catch (e){ alert('Non ci sono riuscito: ' + e.message); }
  };
}

avvia();

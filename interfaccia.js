/* L'interfaccia. Tutta la logica dei carichi sta in motore.js: qui si disegna
   e si raccolgono tre tocchi per serie, non uno di più. */

import {ESERCIZI, PER_ID, figura} from './esercizi.js';
import {ALLENAMENTI} from './allenamenti.js';
import {prescrizione, prossimoAllenamento, gradini, prossimoGradino,
        gradinoPrecedente, caricoTotale, indiceProgresso, pesoSuggerito,
        ETICHETTA_SFORZO, PESO_DI_PARTENZA} from './motore.js';
import * as archivio from './archivio.js';

const app = document.getElementById('app');
const RECUPERO = 90;

let sessioni = [];
let pesoCorporeo = PESO_DI_PARTENZA;
let pesoImpostato = false;   /* finché è falso, l'app te lo chiede */
let ultimoAllenamento = null;
let vista = 'avvio';
let dettaglio = null;      /* esercizio aperto nello storico */
let sess = null;           /* la sessione in corso */
let riposo = null;         /* {resta, id} */

/* ------------------------------------------------------------------ */
const scampa = t => String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
const fig = e => figura(e.disegno);
const gg = d => d.slice(8,10) + '/' + d.slice(5,7);

function pulisciRiposo(){
  if (riposo && riposo.id) clearInterval(riposo.id);
  riposo = null;
}

async function avvia(){
  try {
    sessioni = await archivio.tutteLeSessioni();
    const p = await archivio.leggiStato('pesoCorporeo', null);
    pesoImpostato = p != null;
    if (pesoImpostato) pesoCorporeo = p;
    ultimoAllenamento = await archivio.leggiStato('ultimoAllenamento', null);
  } catch (e){
    app.innerHTML = '<div class="contenuto"><p class="vuoto">Non riesco ad aprire l\'archivio su ' +
      'questo telefono, quindi non potrei salvare niente.<br><br>' + scampa(e.message) + '</p></div>';
    return;
  }
  disegna();
}

function disegna(){
  if (vista === 'avvio') app.innerHTML = vistaAvvio();
  else if (vista === 'sessione') app.innerHTML = vistaSessione();
  else if (vista === 'fine') app.innerHTML = vistaFine();
  else if (vista === 'storico') app.innerHTML = vistaStorico();
  else if (vista === 'esercizio') app.innerHTML = vistaEsercizio();
  else if (vista === 'impostazioni') app.innerHTML = vistaImpostazioni();
  collega();
}

/* ================================================================
   AVVIO
================================================================ */
function allenamentoDiOggi(){
  return prossimoAllenamento(ALLENAMENTI, ultimoAllenamento);
}

function vistaAvvio(){
  const a = allenamentoDiOggi();
  const ultima = sessioni[sessioni.length - 1];
  const voci = a.nucleo.map(id => {
    const e = PER_ID[id];
    return '<li><span class="fig">' + fig(e) + '</span>' + scampa(e.n) +
           '<span class="fascia mono">' + e.fascia[0] + '-' + e.fascia[1] + '</span></li>';
  }).join('');

  return '<section class="schermata viva">' +
    '<div class="contenuto" style="padding-top:calc(34px + env(safe-area-inset-top))">' +
      '<div class="marchio">' + marchio() + '<span>Spingere</span></div>' +
      '<p class="occhiello">Il prossimo allenamento</p>' +
      '<h1 class="titolone">' + scampa(a.nome) + '</h1>' +
      '<ul class="elenco-esercizi">' + voci + '</ul>' +
      '<p class="messaggio">' + (ultima
          ? 'Ultima volta: ' + scampa(ultima.allenamento) + ', il ' + gg(ultima.data) + '.'
          : 'Non hai ancora registrato niente. Si comincia da qui.') +
        ' Dopo il nucleo l\'app ti chiede se hai tempo per altri tre.</p>' +
      (pesoImpostato ? '' :
        '<p class="messaggio acceso">Manca il tuo peso corporeo. Serve solo ai grafici di trazioni, ' +
        'dip e flessioni, dove il carico sei tu — finché non lo metti, quelle curve usano ' +
        PESO_DI_PARTENZA + ' kg e sono sballate. Lo trovi in Impostazioni, e resta su questo telefono.</p>') +
      '<div class="righe-secondarie">' +
        '<button data-va="storico">Storico</button>' +
        '<button data-va="impostazioni">Impostazioni</button>' +
      '</div>' +
      '<div style="height:24px"></div>' +
    '</div>' +
    '<div class="fondo-pagina"><button class="grosso" data-inizia>Comincia</button></div>' +
  '</section>';
}

function marchio(){
  return '<svg width="24" height="24" viewBox="0 0 26 26" aria-hidden="true"><g fill="currentColor">' +
    '<rect x="1" y="18" width="3" height="7"/><rect x="6" y="14" width="3" height="11"/>' +
    '<rect x="11" y="10" width="3" height="15"/><rect x="16" y="6" width="3" height="19"/>' +
    '<rect x="21" y="1" width="3" height="24"/></g></svg>';
}

/* ================================================================
   SESSIONE
================================================================ */
function iniziaSessione(){
  const a = allenamentoDiOggi();
  sess = {
    allenamento: a.id,
    data: archivio.oggi(),
    iniziata: Date.now(),
    fase: 'nucleo',
    indice: 0,
    esercizi: [],
    corrente: null
  };
  preparaEsercizio();
  vista = 'sessione';
  disegna();
}

function listaFase(){
  const a = ALLENAMENTI.find(x => x.id === sess.allenamento);
  return sess.fase === 'nucleo' ? a.nucleo : a.opzionali;
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
    serie: [],
    sforzo: null
  };
}

function vistaSessione(){
  const c = sess.corrente;
  if (!c) return vistaProponiOpzionali();
  const e = c.esercizio, p = c.pres;
  const lista = listaFase();

  const tacche = lista.map((_, i) =>
    '<i class="' + (i < sess.indice ? 'fatto' : i === sess.indice ? 'ora' : '') + '"></i>').join('');

  const conclusa = c.serie.length >= 3;

  return '<section class="schermata viva">' +
    '<div class="cima">' +
      '<button data-esci>Esci</button>' +
      '<span class="passo mono">' + sess.allenamento + ' · ' +
        (sess.fase === 'nucleo' ? 'nucleo' : 'extra') + ' ' + (sess.indice+1) + '/' + lista.length + '</span>' +
    '</div>' +
    '<div class="avanzamento">' + tacche + '</div>' +
    '<div class="contenuto">' +
      '<div class="figurone">' + fig(e) + '</div>' +
      '<h2 class="nome-esercizio">' + scampa(e.n) + '</h2>' +
      '<p class="sottotitolo">' + (e.nota ? scampa(e.nota) + ' · ' : '') +
        'fascia ' + e.fascia[0] + '-' + e.fascia[1] + (e.unilaterale ? ' per lato' : '') + '</p>' +
      '<p class="messaggio' + (p.sale || p.rientro ? ' acceso' : '') + '">' + scampa(p.messaggio) +
        (p.record ? ' Record: ' + numero(p.record.carico) + ' kg × ' + p.record.ripetizioni + '.' : '') +
        (p.salite >= 2 ? ' ' + p.salite + ' salite di fila.' : '') +
      '</p>' +
      '<div class="bersaglio"><span class="num mono">' + c.ripetizioni + '</span>' +
        '<span class="eti">ripetizioni oggi' + (e.unilaterale ? ', per lato' : '') + '</span></div>' +
      '<button data-salta style="margin-top:18px;color:var(--muto);font-size:13px;min-height:44px">' +
        'Salta questo esercizio</button>' +
      '<div style="height:20px"></div>' +
    '</div>' +
    '<div class="fondo-pagina">' +
      (riposo ? riquadroRiposo() : '') +
      pannelloPeso(e, c) +
      pannelloSerie(c) +
      (conclusa ? pannelloSforzo(c) : pannelloConta(c)) +
    '</div>' +
  '</section>';
}

function numero(n){
  return Number.isInteger(n) ? String(n) : String(n).replace('.', ',');
}

function pannelloPeso(e, c){
  if (e.carico === 'corpo')
    return '<div class="peso"><span class="corpo">A corpo libero</span></div>';
  const g = gradini(e.carico);
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

function pannelloSerie(c){
  let out = '';
  for (let i = 0; i < 3; i++){
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
    '<button class="grosso" data-serie>Serie ' + (c.serie.length + 1) + ' fatta</button>';
}

function pannelloSforzo(c){
  const b = ['facile','giusta','limite'].map(s =>
    '<button data-sforzo="' + s + '"' + (c.sforzo === s ? ' class="scelto"' : '') + '>' +
    ETICHETTA_SFORZO[s] + '</button>').join('');
  return '<p class="sottotitolo" style="margin:0 0 10px">Com\'è andata l\'ultima serie?</p>' +
    '<div class="sforzo">' + b + '</div>';
}

function riquadroRiposo(){
  const r = 22, giro = 2 * Math.PI * r;
  const quota = giro * (riposo.resta / RECUPERO);
  return '<div class="recupero">' +
    '<svg viewBox="0 0 52 52" aria-hidden="true">' +
      '<circle class="anello" cx="26" cy="26" r="' + r + '"/>' +
      '<circle class="quota" cx="26" cy="26" r="' + r + '" stroke-dasharray="' + giro.toFixed(1) +
        '" stroke-dashoffset="' + (giro - quota).toFixed(1) + '"/>' +
    '</svg>' +
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
    sess.esercizi.push({id: c.id, peso: c.peso, serie: c.serie.slice(), sforzo});
  avanti();
}

function avanti(){
  pulisciRiposo();
  sess.indice++;
  if (sess.indice < listaFase().length){ preparaEsercizio(); disegna(); return; }
  if (sess.fase === 'nucleo'){ sess.corrente = null; disegna(); return; }
  concludi();
}

function vistaProponiOpzionali(){
  const a = ALLENAMENTI.find(x => x.id === sess.allenamento);
  const voci = a.opzionali.map(id => {
    const e = PER_ID[id];
    return '<li><span class="fig">' + fig(e) + '</span>' + scampa(e.n) +
      '<span class="fascia mono">' + e.fascia[0] + '-' + e.fascia[1] + '</span></li>';
  }).join('');
  return '<section class="schermata viva">' +
    '<div class="cima"><button data-esci>Esci</button><span class="passo mono">nucleo finito</span></div>' +
    '<div class="contenuto">' +
      '<p class="occhiello">Nucleo finito</p>' +
      '<h1 class="titolone">Hai ancora tempo?</h1>' +
      '<ul class="elenco-esercizi">' + voci + '</ul>' +
      '<p class="messaggio">Il grosso è fatto. Questi tre aggiungono una ventina di minuti: ' +
        'se li salti non perdi niente di importante.</p>' +
      '<div style="height:20px"></div>' +
    '</div>' +
    '<div class="fondo-pagina">' +
      '<button class="grosso" data-extra>Sì, continuo</button>' +
      '<div style="height:10px"></div>' +
      '<button class="grosso quieto" data-basta>Ho finito</button>' +
    '</div>' +
  '</section>';
}

function passaAgliOpzionali(){
  sess.fase = 'opzionali';
  sess.indice = 0;
  preparaEsercizio();
  disegna();
}

async function concludi(){
  pulisciRiposo();
  const durata = Math.round((Date.now() - sess.iniziata) / 60000);
  if (sess.esercizi.length){
    const record = {
      data: sess.data, allenamento: sess.allenamento,
      durataMin: durata, esercizi: sess.esercizi
    };
    await archivio.salvaSessione(record);
    await archivio.scriviStato('ultimoAllenamento', sess.allenamento);
    ultimoAllenamento = sess.allenamento;
    sessioni = await archivio.tutteLeSessioni();
  }
  vista = 'fine';
  disegna();
}

function vistaFine(){
  const fatte = sess ? sess.esercizi : [];
  if (!fatte.length){
    return '<section class="schermata viva"><div class="contenuto" style="padding-top:60px">' +
      '<h1 class="titolone">Niente da salvare.</h1>' +
      '<p class="messaggio">Non hai completato nessuna serie, quindi la rotazione resta dov\'era.</p>' +
      '</div><div class="fondo-pagina"><button class="grosso" data-va="avvio">Torna all\'inizio</button></div></section>';
  }
  const righe = fatte.map(x => {
    const e = PER_ID[x.id];
    return '<tr><td>' + scampa(e.n) + '</td><td class="mono">' +
      (e.carico === 'corpo' ? 'corpo' : numero(x.peso) + ' kg') + '</td>' +
      '<td class="mono">' + x.serie.join('-') + '</td></tr>';
  }).join('');
  return '<section class="schermata viva">' +
    '<div class="contenuto" style="padding-top:calc(40px + env(safe-area-inset-top))">' +
      '<p class="occhiello">Allenamento ' + sess.allenamento + ' registrato</p>' +
      '<h1 class="titolone">Fatto.</h1>' +
      '<table class="tabella"><thead><tr><th>Esercizio</th><th>Carico</th><th>Serie</th></tr></thead>' +
      '<tbody>' + righe + '</tbody></table>' +
      '<p class="messaggio">Il prossimo sarà ' +
        prossimoAllenamento(ALLENAMENTI, sess.allenamento).nome.toLowerCase() +
        '. Quando torni, che sia domani o fra due settimane.</p>' +
      '<div style="height:20px"></div>' +
    '</div>' +
    '<div class="fondo-pagina"><button class="grosso" data-va="avvio">Chiudi</button></div>' +
  '</section>';
}

/* ================================================================
   STORICO
================================================================ */
function esercizioConStorico(){
  const visti = new Map();
  for (const s of sessioni)
    for (const e of s.esercizi || []) visti.set(e.id, (visti.get(e.id) || 0) + 1);
  return [...visti.entries()]
    .filter(([id]) => PER_ID[id])
    .map(([id, n]) => ({e: PER_ID[id], n}))
    .sort((a, b) => b.n - a.n);
}

function vistaStorico(){
  const voci = esercizioConStorico();
  const corpo = voci.length
    ? voci.map(v => {
        const st = archivio.storicoEsercizio(sessioni, v.e.id);
        const u = st[0];
        return '<button class="riga-storico" data-apri="' + v.e.id + '">' +
          '<span class="fig">' + fig(v.e) + '</span>' +
          '<span><span class="titolo">' + scampa(v.e.n) + '</span>' +
          '<span class="sotto mono">' + v.n + (v.n === 1 ? ' sessione' : ' sessioni') + ' · ultima ' +
            (v.e.carico === 'corpo' ? u.serie.join('-') : numero(u.peso) + ' kg × ' + u.serie.join('-')) +
          '</span></span><span class="freccia">›</span></button>';
      }).join('')
    : '<p class="vuoto">Ancora niente. Dopo il primo allenamento qui trovi una curva per ogni esercizio.</p>';

  return '<section class="schermata viva">' +
    '<div class="cima"><button data-va="avvio">‹ Indietro</button><span class="passo mono">storico</span></div>' +
    '<div class="contenuto">' +
      '<h1 class="titolone" style="font-size:38px;margin-bottom:16px">Storico</h1>' + corpo +
      '<div style="height:30px"></div>' +
    '</div>' +
  '</section>';
}

function vistaEsercizio(){
  const e = PER_ID[dettaglio];
  const st = archivio.storicoEsercizio(sessioni, e.id).slice().reverse();  /* dal vecchio al nuovo */
  const punti = st.map(s => ({
    data: s.data,
    valore: indiceProgresso(e, s.peso, Math.max(...s.serie), pesoCorporeo),
    peso: s.peso,
    rip: Math.max(...s.serie),
    serie: s.serie
  }));

  const righe = st.slice().reverse().map(s =>
    '<tr><td class="mono">' + gg(s.data) + '</td>' +
    '<td class="mono">' + numero(caricoTotale(e, s.peso, pesoCorporeo)) + ' kg</td>' +
    '<td class="mono">' + s.serie.join('-') + '</td></tr>').join('');

  const corpo = e.carico !== 'manubri';
  const spiega = 'La curva mette insieme carico e ripetizioni, così sale anche quando ' +
    'il manubrio resta lo stesso e tu fai una ripetizione in più. Non è un massimale: ' +
    'i numeri veri sono qui sotto.' +
    (corpo ? ' Su questo esercizio il carico sei tu, quindi conta anche il tuo peso corporeo (' +
      numero(pesoCorporeo) + ' kg).' : '');

  return '<section class="schermata viva">' +
    '<div class="cima"><button data-va="storico">‹ Storico</button><span class="passo mono">' +
      punti.length + (punti.length === 1 ? ' sessione' : ' sessioni') + '</span></div>' +
    '<div class="contenuto">' +
      '<h1 class="titolone" style="font-size:30px;margin-bottom:6px">' + scampa(e.n) + '</h1>' +
      '<p class="sottotitolo">Progresso nel tempo · fascia ' + e.fascia[0] + '-' + e.fascia[1] + '</p>' +
      grafico(punti, e) +
      '<p class="sottotitolo" style="margin-bottom:18px">' + spiega + '</p>' +
      '<table class="tabella"><thead><tr><th>Giorno</th><th>Carico</th><th>Serie</th></tr></thead>' +
      '<tbody>' + righe + '</tbody></table>' +
      '<div style="height:30px"></div>' +
    '</div>' +
  '</section>';
}

/* Una serie sola: niente legenda, il titolo la nomina già.
   L'asse verticale non porta numeri di proposito — l'indice è una scala
   relativa, e stamparne i decimali darebbe una precisione che non ha.
   Quello che conta è la forma della curva; i numeri veri sono nella tabella.
   L'ultimo punto è l'unico etichettato, e con il dato vero. */
function etichettaPunto(e, p){
  if (e.carico === 'manubri') return numero(p.peso) + ' kg × ' + p.rip;
  if (e.carico === 'zavorra' && p.peso > 0) return '+' + numero(p.peso) + ' kg × ' + p.rip;
  return p.rip + ' ripetizioni';
}

function grafico(punti, e){
  const L = 320, A = 190, sx = 14, dx = 14, su = 20, giu = 24;
  if (!punti.length) return '<p class="vuoto">Nessun dato.</p>';
  if (punti.length === 1)
    return '<p class="messaggio" style="margin:18px 0">Una sola sessione: ' +
      etichettaPunto(e, punti[0]) + '. Serve una seconda per vedere una curva.</p>';

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
  const alto = uy < su + 16;                      /* se sfiora il bordo, l'etichetta va sotto */
  const eti = '<text x="' + (L - dx).toFixed(1) + '" y="' + (alto ? uy + 16 : uy - 11).toFixed(1) +
    '" text-anchor="end" style="fill:var(--testo);font-size:11px">' +
    scampa(etichettaPunto(e, ultimo)) + '</text>';

  const su_giu = vals[vals.length-1] >= vals[0] ? 'in salita' : 'in calo';
  return '<svg class="grafico" viewBox="0 0 ' + L + ' ' + A + '" role="img" ' +
    'aria-label="Progresso su ' + punti.length + ' sessioni, ' + su_giu +
    '. Ultima: ' + scampa(etichettaPunto(e, ultimo)) + '">' +
    griglia +
    '<path class="area" d="' + area + '"/>' +
    '<path class="linea" d="' + d + '"/>' + cerchi + eti +
    '<text x="' + sx + '" y="' + (A-8) + '">' + gg(punti[0].data) + '</text>' +
    '<text x="' + (L-dx) + '" y="' + (A-8) + '" text-anchor="end">' + gg(punti[punti.length-1].data) + '</text>' +
  '</svg>';
}

/* ================================================================
   IMPOSTAZIONI
================================================================ */
function vistaImpostazioni(){
  return '<section class="schermata viva">' +
    '<div class="cima"><button data-va="avvio">‹ Indietro</button><span class="passo mono">impostazioni</span></div>' +
    '<div class="contenuto">' +
      '<h1 class="titolone" style="font-size:38px;margin-bottom:10px">Impostazioni</h1>' +

      '<div class="campo"><span class="eti">Peso corporeo</span>' +
        '<p class="spiega">Serve solo agli esercizi a corpo libero — trazioni, dip, flessioni — dove ' +
        'il carico sei tu. Senza questo numero il grafico ti mostrerebbe fermo mentre stai progredendo. ' +
        'Aggiornalo quando ti va: nessuno te lo chiederà.</p>' +
        '<div class="riga"><input id="peso-corpo" type="number" inputmode="decimal" step="0.5" ' +
          'min="30" max="200" value="' + pesoCorporeo + '">' +
          '<button class="azione" data-salva-peso>Salva</button></div></div>' +

      '<div class="campo"><span class="eti">Rotazione</span>' +
        '<p class="spiega">Il prossimo allenamento è <b>' + allenamentoDiOggi().nome.toLowerCase() +
        '</b>. Non c\'è nessun calendario: conta solo quale è stato l\'ultimo.</p>' +
        '<div class="riga">' + ALLENAMENTI.map(a =>
          '<button class="azione" data-forza="' + a.id + '">Riparti da ' + a.id + '</button>').join('') +
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
    if (dove === 'avvio'){ sess = null; pulisciRiposo(); }
    vista = dove; disegna();
  });

  const inizia = q('[data-inizia]');
  if (inizia) inizia.onclick = iniziaSessione;

  const esci = q('[data-esci]');
  if (esci) esci.onclick = () => {
    if (sess && sess.esercizi.length){
      if (!confirm('Esci e salvi quello che hai già fatto?')) return;
      concludi();
    } else {
      if (!confirm('Esci senza salvare niente?')) return;
      sess = null; pulisciRiposo(); vista = 'avvio'; disegna();
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
    if (c.serie.length < 3) avviaRiposo(); else pulisciRiposo();
    disegna();
  };

  tutti('[data-sforzo]', b => b.onclick = () => chiudiEsercizio(b.dataset.sforzo));

  const salta = q('[data-salta]');
  if (salta) salta.onclick = () => { sess.corrente.serie = []; avanti(); };

  const saltaRiposo = q('[data-salta-riposo]');
  if (saltaRiposo) saltaRiposo.onclick = () => { pulisciRiposo(); disegna(); };

  const extra = q('[data-extra]');
  if (extra) extra.onclick = passaAgliOpzionali;
  const basta = q('[data-basta]');
  if (basta) basta.onclick = concludi;

  tutti('[data-apri]', b => b.onclick = () => { dettaglio = b.dataset.apri; vista = 'esercizio'; disegna(); });

  const salvaPeso = q('[data-salva-peso]');
  if (salvaPeso) salvaPeso.onclick = async () => {
    const v = parseFloat(q('#peso-corpo').value);
    if (!isFinite(v) || v < 30 || v > 200){ alert('Un peso fra 30 e 200 kg.'); return; }
    pesoCorporeo = v;
    pesoImpostato = true;
    await archivio.scriviStato('pesoCorporeo', v);
    salvaPeso.textContent = 'Salvato';
    setTimeout(() => { if (salvaPeso.isConnected) salvaPeso.textContent = 'Salva'; }, 1600);
  };

  tutti('[data-forza]', b => b.onclick = async () => {
    const id = b.dataset.forza;
    const i = ALLENAMENTI.findIndex(a => a.id === id);
    const prima = ALLENAMENTI[(i - 1 + ALLENAMENTI.length) % ALLENAMENTI.length].id;
    ultimoAllenamento = prima;
    await archivio.scriviStato('ultimoAllenamento', prima);
    disegna();
  });

  const esporta = q('[data-esporta]');
  if (esporta) esporta.onclick = async () => {
    const testo = await archivio.esporta();
    archivio.scaricaBackup(testo, 'spingere-' + archivio.oggi() + '.json');
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
      sessioni = await archivio.tutteLeSessioni();
      const pc = await archivio.leggiStato('pesoCorporeo', null);
      pesoImpostato = pc != null;
      pesoCorporeo = pesoImpostato ? pc : PESO_DI_PARTENZA;
      ultimoAllenamento = await archivio.leggiStato('ultimoAllenamento', null);
      alert('Ripristinate ' + n + ' sessioni.');
      disegna();
    } catch (e){ alert('Non ci sono riuscito: ' + e.message); }
  };
}

avvia();

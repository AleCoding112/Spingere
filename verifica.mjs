/* Controlli d'integrità. Devono essere tutti verdi prima di pubblicare.
   `node verifica.mjs` */

import {readFileSync, existsSync, readdirSync} from 'node:fs';
import {ESERCIZI, PER_ID, catena, OSSA, figura} from './esercizi.js';
import {gradini} from './motore.js';
import {schedeDiPartenza, migra, alternative, sezioni} from './schede.js';

let ok = 0; const rotti = [];
const controlla = (nome, fn) => {
  try { const m = fn(); ok++; if (m) console.log('  · ' + nome + ' — ' + m); }
  catch (e){ rotti.push(nome + ': ' + e.message); }
};
const pretendi = (c, m) => { if (!c) throw new Error(m); };
const dist = (a, b) => Math.hypot(a[0]-b[0], a[1]-b[1]);

/* Solo quello che ha davvero in casa. */
const ATTREZZI_VERI = new Set([
  'pavimento', 'pancaC', 'pancaB', 'pancaSx', 'pancaDx', 'inclinata', 'schienale',
  'barra', 'barraBassa', 'parallele', 'sediaRomana', 'fermapiedi'
]);
const CARICHI_VERI = new Set(['manubri', 'corpo', 'zavorra']);

controlla('il catalogo ha 48 esercizi con identificativi unici', () => {
  pretendi(ESERCIZI.length === 48, 'sono ' + ESERCIZI.length);
  const visti = new Set();
  for (const e of ESERCIZI){
    pretendi(!visti.has(e.id), 'identificativo doppio: ' + e.id);
    visti.add(e.id);
  }
  return ESERCIZI.length + ' esercizi';
});

controlla('ogni esercizio è descritto per intero', () => {
  for (const e of ESERCIZI){
    pretendi(e.n && e.gruppo && e.categoria, e.id + ' senza nome o gruppo');
    pretendi(CARICHI_VERI.has(e.carico), e.id + ' ha un carico ignoto: ' + e.carico);
    pretendi(Array.isArray(e.fascia) && e.fascia[0] > 0 && e.fascia[1] > e.fascia[0],
      e.id + ' ha una fascia storta: ' + JSON.stringify(e.fascia));
    pretendi(e.disegno && e.disegno.bacino && e.disegno.petto, e.id + ' senza illustrazione');
  }
});

controlla('nessun esercizio usa attrezzi che non ha in casa', () => {
  for (const e of ESERCIZI)
    for (const a of (e.disegno.a || []))
      pretendi(ATTREZZI_VERI.has(a), e.id + ' pretende «' + a + '»');
});

controlla('nessuno chiede di appendersi a braccia distese (il soffitto)', () => {
  for (const e of ESERCIZI){
    if (!(e.disegno.a || []).includes('barra')) continue;
    for (const c of [e.disegno.cavigliaV, e.disegno.cavigliaL]){
      if (!c) continue;
      pretendi(c[1] < 50, e.id + ': alla barra le gambe devono restare piegate, caviglia a y=' + c[1]);
    }
  }
});

controlla('le ossa delle figure non si allungano mai', () => {
  for (const e of ESERCIZI){
    const d = e.disegno;
    const tronco = dist(d.bacino, d.petto);
    pretendi(Math.abs(tronco - 14) < 1.2, e.id + ': tronco lungo ' + tronco.toFixed(1));
    if (d.capo){
      const collo = dist(d.petto, d.capo);
      pretendi(Math.abs(collo - OSSA.collo) < 1.2, e.id + ': collo lungo ' + collo.toFixed(1));
    }
    const arti = [
      ['braccio vicino', d.petto, d.manoV, OSSA.braccio, OSSA.avambraccio],
      ['braccio lontano', d.petto, d.manoL, OSSA.braccio, OSSA.avambraccio],
      ['gamba vicina', d.bacino, d.cavigliaV, OSSA.coscia, OSSA.tibia],
      ['gamba lontana', d.bacino, d.cavigliaL, OSSA.coscia, OSSA.tibia]
    ];
    for (const [che, a, b, l1, l2] of arti){
      if (!b) continue;
      const c = catena(a, b, l1, l2, 1);
      pretendi(Math.abs(dist(c[0], c[1]) - l1) < 0.3 && Math.abs(dist(c[1], c[2]) - l2) < 0.3,
        e.id + ' — ' + che + ': osso deformato');
      pretendi(dist(c[2], b) < 1.5,
        e.id + ' — ' + che + ': posizione irraggiungibile, manca ' + dist(c[2], b).toFixed(1));
    }
  }
});

controlla('ogni figura si disegna senza buchi e resta nel riquadro', () => {
  for (const e of ESERCIZI){
    const s = figura(e.disegno);
    pretendi(!/undefined|NaN/.test(s), e.id + ': coordinata non valida');
    const z = e.disegno.zoom || 1;
    const [cx, cy] = e.disegno.centro || [32, 44];
    for (const m of s.matchAll(/points="([^"]+)"/g))
      for (const p of m[1].split(' ')){
        let [x, y] = p.split(',').map(Number);
        x = cx + (x-cx)*z; y = cy + (y-cy)*z;
        pretendi(x > -2 && x < 66 && y > -2 && y < 66, e.id + ': esce dal riquadro (' + p + ')');
      }
  }
});

/* Gli attributi HTML sono minuscoli sempre: `data-conCui` nel markup diventa
   `data-concui` nel DOM, quindi `dataset.conCui` è `undefined` e il pulsante
   non fa niente — mentre il selettore continua a trovarlo, così sembra tutto
   a posto. È già successo una volta, sulla sostituzione degli esercizi. */
controlla('nessun attributo data- con una maiuscola', () => {
  const js = readFileSync('interfaccia.js', 'utf8');
  const storti = [...js.matchAll(/data-[a-z]*[A-Z][a-zA-Z-]*/g)].map(m => m[0]);
  pretendi(storti.length === 0, 'trovati: ' + [...new Set(storti)].join(', '));
});

/* `height:100%` vale solo se ce l'hanno anche tutti i contenitori sopra:
   basta un anello mancante e la schermata diventa più alta dello schermo.
   Col corpo fissato, quello che finisce sotto il bordo non si raggiunge più. */
controlla('la catena delle altezze non ha anelli mancanti', () => {
  const css = readFileSync('stile.css', 'utf8');
  if (!/\.schermata\{[^}]*height:100%/.test(css)) return;   /* non usa le percentuali */
  for (const sel of ['html,body', '#app'])
    pretendi(new RegExp(sel.replace('#','#') + '\\{[^}]*height:100%').test(css),
      sel + ' non ha height:100%, quindi la percentuale sotto non si calcola');
});

/* Sotto i 16 px, toccando un campo iOS ingrandisce tutta la pagina e non la
   rimpicciolisce più: l'app sembra rotta e non c'è modo di tornare indietro. */
controlla('nessun campo di testo sotto i 16 px', () => {
  const css = readFileSync('stile.css', 'utf8');
  const piccoli = [];
  for (const m of css.matchAll(/input[^{]*\{([^}]*)\}/g)){
    const f = /font-size:\s*([\d.]+)px/.exec(m[1]);
    if (f && parseFloat(f[1]) < 16) piccoli.push(f[1] + 'px');
  }
  pretendi(piccoli.length === 0, 'trovati campi a ' + piccoli.join(', '));
});

/* Sull'iPhone la barra gesti sta sotto la barra di navigazione: se non si
   somma il suo spazio, l'ultima riga di ogni elenco resta coperta. */
controlla('la barra in basso riserva anche lo spazio della barra gesti', () => {
  const css = readFileSync('stile.css', 'utf8');
  pretendi(/padding-bottom:calc\(var\(--barra\)\s*\+\s*env\(safe-area-inset-bottom\)\)/.test(css),
    'la schermata non somma env(safe-area-inset-bottom) alla barra');
});

/* Il colore dichiarato deve essere quello vero: è quello che iOS usa per la
   schermata di avvio e per lo sfondo dietro l'app. */
controlla('il colore dichiarato è quello del fondo', () => {
  const css = readFileSync('stile.css', 'utf8');
  const fondo = /--fondo:\s*(#[0-9A-Fa-f]{6})/.exec(css)[1].toLowerCase();
  const html = readFileSync('index.html', 'utf8');
  const meta = /name="theme-color" content="(#[0-9A-Fa-f]{6})"/.exec(html)[1].toLowerCase();
  const man = JSON.parse(readFileSync('manifest.json', 'utf8'));
  pretendi(meta === fondo, 'index.html dice ' + meta + ' ma il fondo è ' + fondo);
  pretendi(man.background_color.toLowerCase() === fondo, 'il manifest dice ' + man.background_color);
});

/* Le figure sono a tratto: se il foglio di stile non dichiara stroke e
   fill:none, l'SVG usa il riempimento nero e diventa una macchia. */
controlla('il foglio di stile veste le figure a tratto', () => {
  const css = readFileSync('stile.css', 'utf8');
  for (const c of ['.attrezzo', '.corpo', '.lontano', '.peso']){
    const i = css.indexOf(c + '{');
    pretendi(i !== -1, 'stile.css non definisce ' + c);
    const blocco = css.slice(i, css.indexOf('}', i));
    pretendi(/stroke\s*:/.test(blocco), c + ' non ha stroke');
    pretendi(/fill\s*:\s*none/.test(blocco), c + ' non ha fill:none: verrebbe una macchia nera');
  }
});

controlla('si parte senza nessuna scheda: le fa lui', () => {
  pretendi(schedeDiPartenza().length === 0, 'ne sono previste ' + schedeDiPartenza().length);
});

/* Il difetto che ha reso necessario tutto il lavoro sulle schede: nella prima
   versione l'app sapeva aprire solo tre rotazioni scritte nel codice, e 27
   esercizi su 48 non erano raggiungibili in nessun modo. */
controlla('ogni esercizio del catalogo è raggiungibile dall\'app', () => {
  const js = readFileSync('interfaccia.js', 'utf8');
  pretendi(/vistaEsercizi/.test(js), 'manca la schermata del catalogo');
  pretendi(/data-solo=/.test(js), 'manca il modo di farne uno da solo');
  pretendi(/data-scegli=/.test(js), 'manca il modo di metterlo in una scheda');
  const dentro = sezioni().reduce((n, s) => n + s.lista.length, 0);
  pretendi(dentro === ESERCIZI.length,
    'le sezioni ne coprono ' + dentro + ' su ' + ESERCIZI.length);
  return ESERCIZI.length + ' esercizi, tutti in una sezione';
});

/* Il catalogo è lungo: quarantotto voci di fila erano dodici schermate. */
controlla('il catalogo si apre a sezioni, non tutto insieme', () => {
  const js = readFileSync('interfaccia.js', 'utf8');
  pretendi(/data-sezione=/.test(js), 'le sezioni non si aprono e chiudono');
  pretendi(/aperte/.test(js), 'non c\'è memoria di quali sezioni sono aperte');
});

/* Un diario serve prima di tutto a guardare: prima toccando una sessione si
   finiva dritti nella schermata di modifica, coi campi numerici aperti. */
controlla('il diario ha una schermata di sola lettura', () => {
  const js = readFileSync('interfaccia.js', 'utf8');
  pretendi(/vistaSessioneVista/.test(js), 'manca la vista di lettura di una sessione');
  pretendi(/data-correggi/.test(js), 'da lì non si arriva alla correzione');
});

/* Ogni scheda deve poter tornare indietro: senza barra di navigazione e senza
   il gesto del browser, una schermata senza uscita è una trappola. */
controlla('nessuna schermata resta senza uscita', () => {
  const js = readFileSync('interfaccia.js', 'utf8');
  const senzaBarra = /const SENZA_BARRA = new Set\(\[([^\]]*)\]/.exec(js)[1]
    .split(',').map(s => s.trim().replace(/'/g, '')).filter(Boolean);
  const consentite = new Set(['sessione', 'fine', 'anteprima', 'correzione', 'scelta', 'aggiunta',
                              'sessioneVista']);
  for (const v of senzaBarra)
    pretendi(consentite.has(v), 'la vista «' + v + '» non ha né barra né un\'uscita dichiarata');
  return senzaBarra.length + ' schermate a tutto schermo';
});

controlla('il carico si può sempre far salire di un gradino', () => {
  for (const e of ESERCIZI){
    const g = gradini(e.carico);
    if (e.carico === 'corpo') { pretendi(g.length === 0, e.id + ': il corpo libero non ha gradini'); continue; }
    pretendi(g.length >= 5, e.id + ': troppi pochi gradini');
  }
});

controlla('nessun riferimento a risorse esterne (è la garanzia dell\'offline)', () => {
  const sospetti = [];
  for (const f of readdirSync('.')){
    if (!/\.(html|css|js|mjs|json)$/.test(f)) continue;
    const t = readFileSync(f, 'utf8');
    for (const m of t.matchAll(/(https?:)?\/\/[a-z0-9.-]+\.[a-z]{2,}/gi)){
      const riga = t.slice(0, m.index).split('\n').length;
      if (/^\s*(\/\/|\*)/.test(t.split('\n')[riga-1] || '')) continue;   /* è un commento */
      sospetti.push(f + ':' + riga + ' ' + m[0]);
    }
  }
  pretendi(sospetti.length === 0, 'trovati: ' + sospetti.join(', '));
});

controlla('il service worker mette in cache tutti i file che esistono', () => {
  const sw = readFileSync('sw.js', 'utf8');
  const elenco = sw.slice(sw.indexOf('const ROBA'), sw.indexOf('];', sw.indexOf('const ROBA')));
  const file = [...elenco.matchAll(/'([^']+)'/g)].map(m => m[1]).filter(f => f !== './');
  for (const f of file) pretendi(existsSync(f), 'la cache elenca «' + f + '», che non esiste');

  const daAvere = ['index.html','stile.css','interfaccia.js','esercizi.js',
                   'schede.js','motore.js','archivio.js','manifest.json'];
  for (const f of daAvere) pretendi(file.includes(f), f + ' non è nella cache: offline non funzionerebbe');
  return file.length + ' file in cache';
});

/* Questo progetto finisce su un repository pubblico e la cronologia di git non
   si ripulisce da sola: nessun dato personale deve entrare nei file. */
controlla('nessun dato personale nel codice', () => {
  const trovati = [];
  for (const f of readdirSync('.')){
    if (!/\.(html|css|js|mjs|json|md)$/.test(f)) continue;
    const righe = readFileSync(f, 'utf8').split('\n');
    righe.forEach((r, i) => {
      if (/pesoCorporeo\s*[=:,]\s*(6[5-9]|[7-9]\d|1\d\d)\b/.test(r))
        trovati.push(f + ':' + (i+1) + ' un peso corporeo scritto nel codice');
    });
  }
  pretendi(trovati.length === 0, trovati.join('; '));
});

controlla('le icone dichiarate nel manifest esistono', () => {
  const m = JSON.parse(readFileSync('manifest.json', 'utf8'));
  for (const i of m.icons) pretendi(existsSync(i.src), 'manca ' + i.src);
});

console.log('\nVerifica: ' + ok + ' controlli passati, ' + rotti.length + ' falliti.');
if (rotti.length){
  rotti.forEach(r => console.log('  ✗ ' + r));
  process.exit(1);
}
console.log('Tutto verde.\n');

/* Controlli d'integrità. Devono essere tutti verdi prima di pubblicare.
   `node verifica.mjs` */

import {readFileSync, existsSync, readdirSync} from 'node:fs';
import {ESERCIZI, PER_ID, catena, OSSA, figura} from './esercizi.js';
import {ALLENAMENTI} from './allenamenti.js';
import {gradini} from './motore.js';
import {orfani, COMPLETO, PER_GRUPPO, schemaDi} from './gruppi.js';
import {componi} from './comporre.js';
import {schedeDiPartenza} from './schede.js';

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

controlla('le schede di partenza sono combinazioni di gruppi valide', () => {
  for (const s of schedeDiPartenza()){
    pretendi(s.gruppi.length, s.id + ' non ha nessun gruppo');
    for (const g of s.gruppi) pretendi(PER_GRUPPO[g], s.id + ' cerca il gruppo «' + g + '»');
  }
});

/* Il difetto che ha reso necessario tutto il lavoro sulle schede: prima
   l'app sapeva aprire solo le tre rotazioni scritte nel codice, e 27
   esercizi su 48 non erano raggiungibili in nessun modo. */
controlla('ogni esercizio del catalogo è raggiungibile dall\'app', () => {
  const js = readFileSync('interfaccia.js', 'utf8');
  pretendi(/vistaEsercizi/.test(js), 'manca la schermata del catalogo');
  pretendi(/data-solo=/.test(js), 'manca il modo di fare un esercizio da solo');
  pretendi(/data-preferito=/.test(js), 'manca il modo di portarlo nella rotazione');
});

/* Ogni esercizio deve appartenere a un gruppo e a uno schema, altrimenti
   non verrebbe mai proposto da nessuna composizione: sarebbe morto. */
controlla('nessun esercizio resta fuori dai gruppi', () => {
  const senzaCasa = orfani();
  pretendi(senzaCasa.length === 0, 'orfani: ' + senzaCasa.map(e => e.id).join(', '));
  return ESERCIZI.length + ' esercizi tutti collocati';
});

controlla('il completo esce di sei esercizi, con due spinte e due tirate', () => {
  const lista = componi(COMPLETO, []).map(id => PER_ID[id]);
  pretendi(lista.length === 6, 'sono ' + lista.length);
  const s = lista.map(e => schemaDi(e));
  for (const serve of ['petto', 'verticale', 'orizzontale', 'spalle', 'core'])
    pretendi(s.includes(serve), 'manca lo schema «' + serve + '»');
  pretendi(s.some(x => x === 'ginocchio' || x === 'anca'), 'manca il lavoro di gambe');
});

controlla('la rotazione fa tornare ogni esercizio abbastanza spesso', () => {
  let sessioni = [];
  for (let i = 1; i <= 6; i++){
    const ids = componi(COMPLETO, sessioni);
    sessioni.push({data: '2026-08-' + String(i).padStart(2,'0'),
                   esercizi: ids.map(id => ({id, peso: 10, serie: [10,10,10]}))});
  }
  const conta = {};
  for (const s of sessioni) for (const e of s.esercizi) conta[e.id] = (conta[e.id] || 0) + 1;
  const max = Math.max(...Object.values(conta));
  pretendi(max >= 2, 'in sei sessioni nessun esercizio torna: la progressione non accumulerebbe');
  return 'ogni esercizio torna fino a ' + max + ' volte su sei sessioni';
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
                   'allenamenti.js','schede.js','gruppi.js','comporre.js','motore.js','archivio.js','manifest.json'];
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

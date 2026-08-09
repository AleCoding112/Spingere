/* Controlli d'integrità. Devono essere tutti verdi prima di pubblicare.
   `node verifica.mjs` */

import {readFileSync, existsSync, readdirSync} from 'node:fs';
import {ESERCIZI, PER_ID, catena, OSSA, figura} from './esercizi.js';
import {ALLENAMENTI} from './allenamenti.js';
import {gradini} from './motore.js';

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

controlla('gli allenamenti puntano a esercizi che esistono', () => {
  for (const a of ALLENAMENTI){
    const tutti = [...a.nucleo, ...a.opzionali];
    for (const id of tutti) pretendi(PER_ID[id], a.id + ' cerca «' + id + '», che non c\'è');
    pretendi(new Set(tutti).size === tutti.length, a.id + ' ripete un esercizio');
  }
});

controlla('ogni allenamento tocca spinta, tirata, gambe e core', () => {
  for (const a of ALLENAMENTI){
    const c = new Set(a.nucleo.map(id => PER_ID[id].categoria));
    for (const serve of ['spinta', 'tirata', 'gambe', 'core'])
      pretendi(c.has(serve), a.id + ' non ha niente per «' + serve + '»');
  }
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
                   'allenamenti.js','motore.js','archivio.js','manifest.json'];
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

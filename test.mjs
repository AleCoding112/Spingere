/* Test del motore. Solo logica dei carichi: niente browser, niente DOM.
   Si lancia con `node test.mjs`. */

import {prescrizione, prossimoGradino, gradinoPrecedente, caricoTotale,
        indiceProgresso, record, saliteDiFila, prossimoAllenamento, giorniTra, recupero,
        GRADINI, GRADINI_ZAVORRA} from './motore.js';
import {etichettaPrestazione} from './motore.js';
import {schedeDiPartenza, nuovoId, migra} from './schede.js';
import {COMPLETO, quantiEsercizi, schemaDi} from './gruppi.js';
import {componi, gruppiRimasti, alternativeSchema, ROTAZIONE} from './comporre.js';
import {PER_ID} from './esercizi.js';
import {ALLENAMENTI} from './allenamenti.js';

let passati = 0, falliti = [];
function prova(nome, fn){
  try { fn(); passati++; }
  catch (e){ falliti.push(nome + ' → ' + e.message); }
}
function uguale(a, b, che){
  const x = JSON.stringify(a), y = JSON.stringify(b);
  if (x !== y) throw new Error((che || '') + ' atteso ' + y + ', ottenuto ' + x);
}
function vero(c, che){ if (!c) throw new Error(che || 'atteso vero'); }

const panca   = PER_ID['panca-piana-manubri'];        // manubri, fascia 8-12
const alzate  = PER_ID['alzate-laterali'];            // manubri, fascia 12-20
const trazio  = PER_ID['trazioni-presa-prona'];       // zavorra, fascia 6-12
const flex    = PER_ID['flessioni-terra'];            // corpo libero, 12-20
const bulgaro = PER_ID['affondo-bulgaro-piede-posteriore-panca'];  // unilaterale

const OGGI = '2026-08-20';
const s = (data, peso, serie, sforzo) => ({data, peso, serie, sforzo});

/* ---------- i gradini ---------- */
prova('i gradini sono quelli veri di casa', () => {
  uguale(GRADINI, [3, 8.5, 14, 18.5, 24]);
  uguale(GRADINI_ZAVORRA[0], 0, 'la zavorra parte dal corpo nudo:');
});
prova('si sale di un gradino alla volta', () => {
  uguale(prossimoGradino('manubri', 14), 18.5);
  uguale(gradinoPrecedente('manubri', 14), 8.5);
});
prova('sopra i 24 kg non c\'è più niente', () => {
  uguale(prossimoGradino('manubri', 24), null);
  uguale(gradinoPrecedente('manubri', 3), null);
});

/* ---------- prima volta ---------- */
prova('la prima volta non inventa un carico', () => {
  const p = prescrizione(panca, [], OGGI);
  vero(p.primaVolta, 'deve dichiararsi prima volta');
  uguale(p.bersaglio, 8, 'si parte dal minimo della fascia:');
  uguale(p.sale, false);
});

/* ---------- doppia progressione ---------- */
prova('fascia chiusa su tutte le serie: si sale di manubrio', () => {
  const p = prescrizione(panca, [s('2026-08-18', 14, [12,12,12], 'giusta')], OGGI);
  vero(p.sale, 'doveva salire');
  uguale(p.peso, 18.5);
  uguale(p.bersaglio, 8, 'ripartendo dal minimo della fascia:');
});
prova('fascia non chiusa: stesso peso, una ripetizione in più', () => {
  const p = prescrizione(panca, [s('2026-08-18', 14, [10,10,9], 'giusta')], OGGI);
  uguale(p.sale, false);
  uguale(p.peso, 14);
  uguale(p.bersaglio, 11);
});
prova('una serie sotto la fascia basta a non far salire', () => {
  const p = prescrizione(panca, [s('2026-08-18', 14, [12,12,11], 'giusta')], OGGI);
  uguale(p.sale, false, 'la terza serie non ha chiuso:');
  uguale(p.peso, 14);
});
prova('il bersaglio non supera mai il tetto della fascia', () => {
  const p = prescrizione(panca, [s('2026-08-18', 14, [12,11,10], 'giusta')], OGGI);
  uguale(p.bersaglio, 12, 'la fascia arriva a 12:');
});

/* ---------- lo sforzo corregge ---------- */
prova('fascia chiusa ma «al limite»: si rimanda', () => {
  const p = prescrizione(panca, [s('2026-08-18', 14, [12,12,12], 'limite')], OGGI);
  uguale(p.sale, false, 'era al limite, non deve salire:');
  uguale(p.peso, 14);
});
prova('due «facile» di fila anticipano la salita', () => {
  const p = prescrizione(panca, [
    s('2026-08-18', 14, [10,10,10], 'facile'),
    s('2026-08-14', 14, [9,9,9],   'facile')
  ], OGGI);
  vero(p.sale, 'due volte facile devono bastare');
  uguale(p.peso, 18.5);
});
prova('due «facile» a pesi diversi non contano', () => {
  const p = prescrizione(panca, [
    s('2026-08-18', 14,  [10,10,10], 'facile'),
    s('2026-08-14', 8.5, [9,9,9],    'facile')
  ], OGGI);
  uguale(p.sale, false, 'il peso era cambiato in mezzo:');
});

/* ---------- il tetto dei 24 kg ---------- */
prova('a 24 kg non si sale più: si cresce di ripetizioni', () => {
  const p = prescrizione(panca, [s('2026-08-18', 24, [12,12,12], 'giusta')], OGGI);
  uguale(p.sale, false);
  vero(p.alTetto, 'deve segnalare il tetto');
  uguale(p.peso, 24);
  uguale(p.bersaglio, 13, 'oltre la fascia:');
});

/* ---------- muscoli piccoli ---------- */
prova('gli isolamenti usano la loro fascia alta', () => {
  uguale(alzate.fascia, [12,20]);
  const p = prescrizione(alzate, [s('2026-08-18', 3, [20,20,20], 'giusta')], OGGI);
  vero(p.sale, 'chiusa a 20 deve salire');
  uguale(p.peso, 8.5, 'il salto è brutale ma è l\'unico che esiste:');
  uguale(p.bersaglio, 12);
});

/* ---------- corpo libero e zavorra ---------- */
prova('il corpo libero zavorrabile parte da zero e poi prende il manubrio', () => {
  const p = prescrizione(trazio, [s('2026-08-18', 0, [12,12,12], 'giusta')], OGGI);
  vero(p.sale);
  uguale(p.peso, 3, 'il primo manubrio fra i piedi:');
});
prova('il corpo libero non zavorrabile non chiede pesi', () => {
  const p = prescrizione(flex, [s('2026-08-18', null, [20,20,20], 'giusta')], OGGI);
  uguale(p.sale, false, 'non c\'è niente da aggiungere:');
  vero(p.alTetto, 'deve dire di passare a una variante più dura');
});
prova('il grafico somma peso corporeo e zavorra', () => {
  uguale(caricoTotale(trazio, 3, 75), 78);
  uguale(caricoTotale(flex, null, 75), 75);
  uguale(caricoTotale(panca, 18.5, 75), 18.5, 'per i manubri conta il manubrio:');
});
prova('cambiando peso corporeo il grafico del corpo libero si sposta', () => {
  uguale(caricoTotale(trazio, 3, 79) - caricoTotale(trazio, 3, 75), 4);
});

/* ---------- l'indice del grafico ----------
   Nasce per un difetto vero: con cinque gradini di manubrio il carico da solo
   resta piatto per settimane mentre le ripetizioni salgono. */
prova('a parità di manubrio l\'indice sale se salgono le ripetizioni', () => {
  const a = indiceProgresso(panca, 14, 9, 75);
  const b = indiceProgresso(panca, 14, 12, 75);
  vero(b > a, 'da 9 a 12 ripetizioni l\'indice deve salire: ' + a + ' → ' + b);
});
prova('salire di manubrio non fa scendere l\'indice, anche ripartendo dal minimo', () => {
  const prima = indiceProgresso(panca, 14, 12, 75);     /* fascia chiusa */
  const dopo  = indiceProgresso(panca, 18.5, 8, 75);    /* nuovo gradino, minimo */
  vero(dopo > prima, 'il salto deve premiare, non punire: ' + prima + ' → ' + dopo);
});
prova('l\'indice tiene conto del peso corporeo sul corpo libero', () => {
  vero(indiceProgresso(trazio, 0, 10, 79) > indiceProgresso(trazio, 0, 10, 75));
});
prova('l\'indice non è un massimale ma resta ordinabile', () => {
  uguale(indiceProgresso(panca, 14, 0, 75), 14, 'a zero ripetizioni vale il carico:');
});

/* ---------- pause ---------- */
prova('una pausa lunga non taglia i carichi', () => {
  const p = prescrizione(panca, [s('2026-07-10', 18.5, [10,10,9], 'giusta')], OGGI);
  vero(p.rientro, 'deve accorgersi della pausa');
  uguale(p.peso, 18.5, 'il peso resta quello di prima:');
  vero(p.giorni > 14);
  vero(!/salta|meno|riduc/i.test(p.messaggio), 'niente consigli di fare meno');
});
prova('una pausa lunga non cancella la salita guadagnata', () => {
  const p = prescrizione(panca, [s('2026-07-10', 14, [12,12,12], 'giusta')], OGGI);
  vero(p.sale, 'la fascia era chiusa: il salto è suo');
  uguale(p.peso, 18.5);
});
prova('due giorni di pausa non sono un rientro', () => {
  const p = prescrizione(panca, [s('2026-08-18', 14, [10,10,10], 'giusta')], OGGI);
  uguale(p.rientro, false);
  uguale(p.giorni, 2);
});
prova('i giorni si contano bene anche a cavallo di un mese', () => {
  uguale(giorniTra('2026-07-31', '2026-08-02'), 2);
});

/* ---------- record e salite ---------- */
prova('il record guarda prima il carico, poi le ripetizioni', () => {
  const st = [s('2026-08-18', 18.5, [9,9,8], 'giusta'), s('2026-08-14', 14, [12,12,12], 'giusta')];
  uguale(record(panca, st, 75).carico, 18.5);
  uguale(record(panca, st, 75).ripetizioni, 9);
});
prova('conta le salite di fila', () => {
  const st = [s('2026-08-18', 18.5, [8,8,8], 'giusta'),
              s('2026-08-15', 14,   [12,12,12], 'giusta'),
              s('2026-08-12', 8.5,  [12,12,12], 'giusta')];
  uguale(saliteDiFila(panca, st, 75), 2);
});

/* ---------- unilaterali ---------- */
prova('gli esercizi a un lato si registrano una volta sola', () => {
  vero(bulgaro.unilaterale, 'il bulgaro è unilaterale');
  const p = prescrizione(bulgaro, [s('2026-08-18', 14, [10,10,9], 'giusta')], OGGI);
  uguale(p.serie, 3, 'tre serie, non sei:');
});

/* ---------- rotazione ---------- */
prova('la rotazione gira e non guarda il calendario', () => {
  uguale(prossimoAllenamento(ALLENAMENTI, 'A').id, 'B');
  uguale(prossimoAllenamento(ALLENAMENTI, 'C').id, 'A');
  uguale(prossimoAllenamento(ALLENAMENTI, null).id, 'A', 'la prima volta si parte da A:');
});
prova('se cancelli la scheda che era di turno, si riparte dalla prima', () => {
  uguale(prossimoAllenamento(ALLENAMENTI, 'sparita').id, 'A');
  uguale(prossimoAllenamento([], 'A'), null, 'senza schede non c\'è un prossimo:');
});

/* ---------- come si scrive un carico ----------
   Il difetto vero: sulle flessioni compariva «Record: 75 kg × 18», perché il
   peso corporeo veniva scritto come se fosse un manubrio. */
prova('a corpo libero si scrivono le ripetizioni, non i chili', () => {
  uguale(etichettaPrestazione(flex, null, 18), '18 ripetizioni');
  uguale(etichettaPrestazione(trazio, 0, 8), '8 ripetizioni', 'zavorra a zero è corpo libero:');
});
prova('con la zavorra si scrive quanto hai aggiunto', () => {
  uguale(etichettaPrestazione(trazio, 3, 8), '+3 kg × 8');
});
prova('con i manubri si scrive il manubrio', () => {
  uguale(etichettaPrestazione(panca, 18.5, 8), '18,5 kg × 8', 'con la virgola, non il punto:');
});

/* ---------- schede: ora sono combinazioni di gruppi ---------- */
prova('le schede di partenza sono gruppi, non liste di esercizi', () => {
  const s = schedeDiPartenza();
  vero(s.every(x => Array.isArray(x.gruppi)), 'ognuna deve avere i gruppi');
  uguale(s[0].gruppi, COMPLETO, 'la prima è il completo:');
});
prova('un identificativo nuovo non calpesta quelli che ci sono', () => {
  const s = schedeDiPartenza();
  uguale(s.some(x => x.id === nuovoId(s)), false);
  uguale(nuovoId([...s, {id:'S1'}]), 'S2', 'salta quelli già presi:');
});
prova('le vecchie schede a liste di esercizi si migrano in gruppi', () => {
  const vecchia = {id:'A', nome:'Allenamento A',
    nucleo:['panca-piana-manubri','trazioni-presa-prona','affondi-statici'],
    opzionali:['curl-martello']};
  uguale(migra(vecchia).gruppi, ['petto','dorso','gambe','braccia']);
});
prova('migrare una scheda già a gruppi non la tocca', () => {
  uguale(migra({id:'x', nome:'X', gruppi:['petto','core']}).gruppi, ['petto','core']);
});

/* ---------- la composizione della sessione ---------- */
prova('il completo dà sei esercizi', () => {
  uguale(componi(COMPLETO, []).length, 6);
  uguale(quantiEsercizi(COMPLETO), 6, 'e il conto lo sa in anticipo:');
});
prova('il dorso ne porta sempre due: verticale e orizzontale', () => {
  const s = componi(['dorso'], []).map(id => schemaDi(PER_ID[id]));
  uguale(s.sort(), ['orizzontale','verticale']);
});
prova('sceglie l\'esercizio che non fai da più tempo', () => {
  const primo = componi(['petto'], [])[0];
  const dopo = componi(['petto'], [{data:'2026-08-01', esercizi:[{id:primo, serie:[10]}]}])[0];
  vero(dopo !== primo, 'il secondo giro non ripete il primo');
});
prova('le gambe alternano ginocchio e anca', () => {
  const a = componi(['gambe'], [])[0];
  const s1 = {data:'2026-08-01', esercizi:[{id:a, serie:[10]}]};
  const b = componi(['gambe'], [s1])[0];
  vero(schemaDi(PER_ID[a]) !== schemaDi(PER_ID[b]),
    'due sessioni di fila non possono essere lo stesso schema');
});
prova('la rotazione è stretta: un esercizio torna, non sparisce per dieci sessioni', () => {
  let sess = [];
  for (let i = 1; i <= 4; i++){
    const ids = componi(['petto'], sess);
    sess.push({data:'2026-08-0' + i, esercizi: ids.map(id => ({id, serie:[10]}))});
  }
  const usati = sess.flatMap(s => s.esercizi.map(e => e.id));
  uguale(new Set(usati).size, ROTAZIONE, 'girano ' + ROTAZIONE + ' esercizi, non tutto il catalogo:');
});
prova('un esercizio messo da parte non viene più proposto', () => {
  const normale = componi(['petto'], [])[0];
  const dopo = componi(['petto'], [], {dascartare:[normale]})[0];
  vero(dopo !== normale);
});
prova('un preferito prende il posto degli altri nel suo schema', () => {
  const scelto = 'flessioni-diamante';   /* tricipiti, fuori dai primi tre */
  uguale(componi(['braccia'], [], {preferiti:[scelto]}).includes(scelto), true);
});
prova('le alternative sono dello stesso schema, non solo dello stesso gruppo', () => {
  const alt = alternativeSchema('trazioni-presa-prona', []);
  vero(alt.length > 0);
  vero(alt.every(x => schemaDi(x) === 'verticale'), 'una tirata verticale si cambia con un\'altra');
  vero(!alt.some(x => x.id === 'trazioni-presa-prona'), 'non propone sé stesso');
});
prova('i gruppi rimasti sono quelli non ancora scelti', () => {
  vero(!gruppiRimasti(COMPLETO).includes('petto'));
  vero(gruppiRimasti(COMPLETO).includes('braccia'));
});

/* ---------- recupero ---------- */
prova('il recupero cambia col tipo di esercizio', () => {
  uguale(recupero(alzate), 60, 'un isolamento ad alte ripetizioni:');
  uguale(recupero(trazio), 120, 'trazioni zavorrabili:');
  uguale(recupero(panca), 90, 'la panca sta in mezzo:');
});

/* ---------- esito ---------- */
console.log('\nTest del motore: ' + passati + ' passati, ' + falliti.length + ' falliti.');
if (falliti.length){
  falliti.forEach(f => console.log('  ✗ ' + f));
  process.exit(1);
}
console.log('Tutto verde.\n');

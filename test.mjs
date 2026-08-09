/* Test del motore. Solo logica dei carichi: niente browser, niente DOM.
   Si lancia con `node test.mjs`. */

import {prescrizione, prossimoGradino, gradinoPrecedente, caricoTotale,
        indiceProgresso, record, saliteDiFila, prossimoAllenamento, giorniTra, recupero,
        GRADINI, GRADINI_ZAVORRA} from './motore.js';
import {etichettaPrestazione} from './motore.js';
import {schedeDiPartenza, nuovoId, migra, alternative, minutiScheda, sezioni} from './schede.js';
import {PER_ID, ESERCIZI} from './esercizi.js';

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

/* ---------- rotazione fra le schede ---------- */
const finte = [{id:'A', nome:'A', esercizi:['panca-piana-manubri']},
               {id:'B', nome:'B', esercizi:['trazioni-presa-prona']},
               {id:'C', nome:'C', esercizi:['affondi-statici']}];
prova('le schede girano in ordine e non guardano il calendario', () => {
  uguale(prossimoAllenamento(finte, 'A').id, 'B');
  uguale(prossimoAllenamento(finte, 'C').id, 'A');
  uguale(prossimoAllenamento(finte, null).id, 'A', 'la prima volta si parte dalla prima:');
});
prova('se cancelli la scheda che era di turno, si riparte dalla prima', () => {
  uguale(prossimoAllenamento(finte, 'sparita').id, 'A');
  uguale(prossimoAllenamento([], 'A'), null, 'senza schede non c\'è un prossimo:');
});

/* ---------- come si scrive un carico ---------- */
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

/* ---------- schede: liste di esercizi scelti da lui ---------- */
prova('si parte senza nessuna scheda: le fa lui', () => {
  uguale(schedeDiPartenza(), []);
});
prova('un identificativo nuovo non calpesta quelli che ci sono', () => {
  uguale(nuovoId([{id:'S1'},{id:'S2'}]), 'S3');
});
prova('le vecchie schede a nucleo e opzionali si recuperano', () => {
  const vecchia = {id:'A', nome:'Allenamento A',
    nucleo:['panca-piana-manubri','trazioni-presa-prona'], opzionali:['curl-martello']};
  uguale(migra(vecchia).esercizi,
    ['panca-piana-manubri','trazioni-presa-prona','curl-martello']);
});
prova('le schede a soli gruppi non si possono recuperare, e si buttano', () => {
  uguale(migra({id:'x', nome:'Completo', gruppi:['petto','dorso']}), null,
    'non contengono nessun esercizio:');
});
prova('gli esercizi spariti dal catalogo vengono tolti dalle schede', () => {
  uguale(migra({id:'x', nome:'X', esercizi:['panca-piana-manubri','inventato']}).esercizi,
    ['panca-piana-manubri']);
});
prova('una scheda rimasta senza esercizi non si tiene', () => {
  uguale(migra({id:'x', nome:'X', esercizi:['inventato']}), null);
});

/* ---------- conti e alternative ---------- */
prova('gli esercizi a un lato contano il doppio del tempo', () => {
  vero(bulgaro.unilaterale);
  uguale(minutiScheda([bulgaro.id]), 12);
  uguale(minutiScheda([panca.id]), 7);
  uguale(minutiScheda([panca.id, bulgaro.id]), 19);
});
prova('le alternative sono della stessa sezione, e non ripetono quelle in scheda', () => {
  const alt = alternative('panca-piana-manubri', ['croci-panca-piana']);
  vero(alt.length > 0, 'qualcosa deve esserci');
  vero(alt.every(x => x.gruppo === panca.gruppo), 'tutte della stessa sezione');
  vero(!alt.some(x => x.id === 'panca-piana-manubri'), 'non propone sé stesso');
  vero(!alt.some(x => x.id === 'croci-panca-piana'), 'non propone quello che è già dentro');
});
prova('le sezioni del catalogo coprono tutti gli esercizi', () => {
  const dentro = sezioni().reduce((n, s) => n + s.lista.length, 0);
  uguale(dentro, ESERCIZI.length);
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

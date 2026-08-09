/* I gruppi muscolari come li pensi tu, non come è ordinato il catalogo.

   Il catalogo ha nove sezioni (spinta orizzontale, tirata verticale…) che
   servono a chi lo compila. Quando l'app ti chiede cosa alleni oggi, però,
   le parole giuste sono petto, dorso, spalle, braccia, gambe, core.

   Ogni gruppo si apre in uno o più **schemi**, e ogni schema porta un
   esercizio nella sessione. È per questo che «dorso» ne vale due: una tirata
   verticale e una orizzontale sono due lavori diversi, non due varianti. */

import {ESERCIZI, PER_ID} from './esercizi.js';

export const GRUPPI = [
  {id:'petto',  nome:'Petto',        schemi:['petto'],                    sempre:true},
  {id:'dorso',  nome:'Dorso',        schemi:['verticale','orizzontale'],  sempre:true},
  {id:'spalle', nome:'Spalle',       schemi:['spalle'],                   sempre:true},
  {id:'gambe',  nome:'Gambe',        schemi:['ginocchio','anca'],         alterna:true, sempre:true},
  {id:'core',   nome:'Core',         schemi:['core'],                     sempre:true},
  {id:'braccia',nome:'Braccia',      schemi:['bicipiti','tricipiti']},
  {id:'fiato',  nome:'Corpo intero', schemi:['fiato']}
];

export const PER_GRUPPO = Object.fromEntries(GRUPPI.map(g => [g.id, g]));

/* Il completo: sei esercizi, due spinte e due tirate in pari, gambe e core.
   Non è una preferenza — è quello che esce selezionando tutto ciò che va
   allenato a ogni sessione quando ti alleni a giorni variabili. */
export const COMPLETO = GRUPPI.filter(g => g.sempre).map(g => g.id);

/* Dalla sezione del catalogo al gruppo e allo schema. */
const DA_SEZIONE = {
  'Spinta orizzontale — petto':            ['petto',  'petto'],
  'Spinta verticale — spalle':             ['spalle', 'spalle'],
  'Tirata verticale — dorso':              ['dorso',  'verticale'],
  'Tirata orizzontale — dorso':            ['dorso',  'orizzontale'],
  'Bicipiti':                              ['braccia','bicipiti'],
  'Tricipiti':                             ['braccia','tricipiti'],
  'Corpo intero':                          ['fiato',  'fiato'],
  'Core — quasi tutto alla sedia romana':  ['core',   'core']
};

/* Le gambe vanno divise a mano: la sezione del catalogo è una sola, ma
   spingere con il ginocchio e piegarsi sull'anca sono due lavori diversi, e
   con le tue leve lunghe è il secondo che rende di più. I polpacci stanno
   con il ginocchio perché sono l'unica cosa che si allena in piedi e dritti. */
const SCHEMA_GAMBE = {
  'affondo-bulgaro-piede-posteriore-panca': 'ginocchio',
  'affondi-statici':                        'ginocchio',
  'affondo-laterale':                       'ginocchio',
  'polpacci-gamba':                         'ginocchio',
  'stacco-rumeno-due-gambe':                'anca',
  'stacco-rumeno-gamba':                    'anca',
  'leg-curl-nordico':                       'anca'
};

export function gruppoDi(esercizio){
  if (esercizio.gruppo === 'Gambe') return 'gambe';
  const v = DA_SEZIONE[esercizio.gruppo];
  return v ? v[0] : 'fiato';
}

export function schemaDi(esercizio){
  if (esercizio.gruppo === 'Gambe') return SCHEMA_GAMBE[esercizio.id] || 'ginocchio';
  const v = DA_SEZIONE[esercizio.gruppo];
  return v ? v[1] : 'fiato';
}

export function esercizioDelloSchema(schema){
  return ESERCIZI.filter(e => schemaDi(e) === schema);
}

export function nomeGruppo(id){
  return PER_GRUPPO[id] ? PER_GRUPPO[id].nome : id;
}

/* Quanti esercizi porta una selezione di gruppi: serve a mostrare la durata
   prima ancora di comporre. Le gambe contano doppio in tempo perché sono
   quasi tutte a una gamba sola. */
export function quantiEsercizi(gruppi){
  return gruppi.reduce((n, id) => {
    const g = PER_GRUPPO[id];
    if (!g) return n;
    return n + (g.alterna ? 1 : g.schemi.length);
  }, 0);
}

export function minutiStimati(gruppi){
  let m = 0;
  for (const id of gruppi){
    const g = PER_GRUPPO[id];
    if (!g) continue;
    const n = g.alterna ? 1 : g.schemi.length;
    m += n * (id === 'gambe' ? 12 : 7);
  }
  return m;
}

/* Controllo d'integrità usato da verifica.mjs: nessun esercizio può restare
   fuori da un gruppo, altrimenti non verrebbe mai proposto da nessuno. */
export function orfani(){
  const schemiVeri = new Set(GRUPPI.flatMap(g => g.schemi));
  return ESERCIZI.filter(e => !PER_GRUPPO[gruppoDi(e)] || !schemiVeri.has(schemaDi(e)));
}

export {PER_ID};

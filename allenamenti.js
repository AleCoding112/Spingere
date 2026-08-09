/* Le tre rotazioni. Non è un calendario: A → B → C → A, qualunque giorno sia
   e quanti giorni siano passati. Sono tutte e tre full body, così anche una
   settimana con due soli allenamenti tocca tutto il corpo.

   Il nucleo si fa sempre. Gli opzionali l'app li propone solo dopo, e solo se
   c'è tempo: nucleo ≈ 40 minuti, tutto ≈ 70. */

export const ALLENAMENTI = [
  {
    id: 'A',
    nome: 'Allenamento A',
    nucleo: [
      'panca-piana-manubri',
      'trazioni-presa-prona',
      'affondo-bulgaro-piede-posteriore-panca',
      'sollevamento-ginocchia-sedia-romana'
    ],
    opzionali: [
      'alzate-laterali',
      'curl-martello',
      'polpacci-gamba'
    ]
  },
  {
    id: 'B',
    nome: 'Allenamento B',
    nucleo: [
      'lento-avanti-seduto',
      'rematore-braccio-mano-ginocchio-panca',
      'stacco-rumeno-gamba',
      'ruota-addominali-ginocchio'
    ],
    opzionali: [
      'croci-panca-inclinata',
      'estensioni-sopra-testa-manubrio',
      'alzate-posteriori-pancia-giu-panca-inclinata'
    ]
  },
  {
    id: 'C',
    nome: 'Allenamento C',
    /* Il dip è a busto inclinato, non dritto: quello dritto è un esercizio di
       tricipiti e lascerebbe C senza nessuna spinta per il petto. */
    nucleo: [
      'dip-parallele-busto-inclinato',
      'trazioni-presa-supina',
      'affondi-statici',
      'sollevamento-gambe-tese-sedia-romana'
    ],
    opzionali: [
      'curl-manubri-piedi',
      'pullover-manubrio',
      'tirate-mento'
    ]
  }
];

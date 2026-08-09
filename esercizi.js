/* Generato dal catalogo approvato: 48 esercizi.
   Il motore di disegno e le pose sono gli stessi della pagina di scelta. */

const OSSA = {collo:5.5, capo:4.3, braccio:9, avambraccio:8, coscia:12, tibia:11, piede:5};

function versoPunto(a, b, lung){
  const dx = b[0]-a[0], dy = b[1]-a[1], d = Math.hypot(dx,dy) || 1;
  return [b[0] + dx/d*lung, b[1] + dy/d*lung];
}
function traAB(a, b, lung){
  const dx = b[0]-a[0], dy = b[1]-a[1], d = Math.hypot(dx,dy) || 1;
  return [a[0] + dx/d*lung, a[1] + dy/d*lung];
}

/* due ossa da a fino a b: restituisce [a, giunto, b] */
function catena(a, b, l1, l2, lato){
  let dx = b[0]-a[0], dy = b[1]-a[1];
  let d = Math.hypot(dx,dy);
  let fine = [b[0], b[1]];
  const max = l1 + l2 - 0.01, min = Math.abs(l1-l2) + 0.01;
  if (d > max){ fine = [a[0]+dx/d*max, a[1]+dy/d*max]; d = max; }
  else if (d < min){
    if (d < 0.01){ dx = 1; dy = 0; d = 1; }
    fine = [a[0]+dx/d*min, a[1]+dy/d*min]; d = min;
  }
  const ux = (fine[0]-a[0])/d, uy = (fine[1]-a[1])/d;
  const t = (l1*l1 - l2*l2 + d*d) / (2*d);
  const h = Math.sqrt(Math.max(0, l1*l1 - t*t));
  return [[a[0],a[1]], [a[0] + ux*t - uy*h*lato, a[1] + uy*t + ux*h*lato], fine];
}

function via(punti){
  return '<polyline points="' + punti.map(function(p){
    return (Math.round(p[0]*10)/10) + ',' + (Math.round(p[1]*10)/10);
  }).join(' ') + '"/>';
}

function manubrio(x, y, rot){
  return '<g transform="translate(' + x + ',' + y + ') rotate(' + (rot||0) + ')">' +
    '<line x1="-3.5" y1="0" x2="3.5" y2="0"/>' +
    '<circle cx="-4.8" cy="0" r="2.3"/><circle cx="4.8" cy="0" r="2.3"/></g>';
}

/* attrezzi, alle altezze giuste: piano panca y=44, sbarre dip y=26/30 */
const ATTREZZI = {
  pavimento: '<line x1="2" y1="57" x2="62" y2="57"/>',
  pancaC:  '<rect x="8"  y="44" width="36" height="4" rx="1.5"/><line x1="13" y1="48" x2="13" y2="57"/><line x1="39" y1="48" x2="39" y2="57"/>',
  pancaB:  '<rect x="6"  y="44" width="42" height="4" rx="1.5"/><line x1="12" y1="48" x2="12" y2="57"/><line x1="43" y1="48" x2="43" y2="57"/>',
  pancaSx: '<rect x="2"  y="44" width="26" height="4" rx="1.5"/><line x1="7"  y1="48" x2="7"  y2="57"/><line x1="24" y1="48" x2="24" y2="57"/>',
  pancaDx: '<rect x="40" y="44" width="22" height="4" rx="1.5"/><line x1="45" y1="48" x2="45" y2="57"/><line x1="58" y1="48" x2="58" y2="57"/>',
  inclinata: '<rect x="10" y="44" width="18" height="4" rx="1.5"/>' +
             '<path d="M25 47 L44 28 L47 31 L28 50 Z"/>' +
             '<line x1="14" y1="48" x2="14" y2="57"/><line x1="27" y1="48" x2="27" y2="57"/><line x1="44" y1="33" x2="44" y2="57"/>',
  schienale: '<rect x="18" y="44" width="28" height="4" rx="1.5"/><rect x="18" y="26" width="4" height="18" rx="1.5"/>' +
             '<line x1="24" y1="48" x2="24" y2="57"/><line x1="42" y1="48" x2="42" y2="57"/>',
  barra: '<line x1="6" y1="3" x2="58" y2="3"/><line x1="8" y1="9" x2="56" y2="9"/>' +
         '<line x1="13" y1="9" x2="13" y2="57"/><line x1="51" y1="9" x2="51" y2="57"/>',
  barraBassa: '<line x1="8" y1="26" x2="56" y2="26"/><line x1="13" y1="26" x2="13" y2="57"/><line x1="51" y1="26" x2="51" y2="57"/>',
  parallele: '<line x1="26" y1="26" x2="54" y2="26"/><line x1="48" y1="26" x2="48" y2="57"/>' +
             '<line x1="30" y1="30" x2="58" y2="30"/><line x1="52" y1="30" x2="52" y2="57"/>',
  sediaRomana: '<line x1="14" y1="8" x2="14" y2="57"/><line x1="6" y1="57" x2="26" y2="57"/>' +
               '<rect x="15" y="24" width="4" height="18" rx="1.5"/>' +
               '<line x1="19" y1="33" x2="36" y2="33"/><line x1="19" y1="37" x2="33" y2="37"/>',
  fermapiedi: '<line x1="48" y1="50" x2="62" y2="50"/><line x1="51" y1="50" x2="51" y2="57"/><line x1="60" y1="50" x2="60" y2="57"/>'
};

function figura(p){
  const bac = p.bacino, pet = p.petto;
  const capo = p.capo || versoPunto(bac, pet, OSSA.collo);
  const verso = p.verso === undefined ? 1 : p.verso;
  const puntaPre = verso >= 0 ? 25 : 155;

  function piede(cav, ang){
    const a = (ang === undefined ? puntaPre : ang) * Math.PI/180;
    return [cav, [cav[0] + Math.cos(a)*OSSA.piede, cav[1] + Math.sin(a)*OSSA.piede]];
  }
  function arti(mano, cav, gom, gin, punta){
    let g = '';
    if (cav) g += via(catena(bac, cav, OSSA.coscia, OSSA.tibia, gin)) + via(piede(cav, punta));
    if (mano) g += via(catena(pet, mano, OSSA.braccio, OSSA.avambraccio, gom));
    return g;
  }

  let d = '';
  if (p.a && p.a.length) d += '<g class="attrezzo">' + p.a.map(function(k){return ATTREZZI[k];}).join('') + '</g>';
  d += '<g class="lontano">' + arti(p.manoL, p.cavigliaL, p.gomitoL || p.gomitoV || 1, p.ginocchioL || p.ginocchioV || 1, p.puntaL) + '</g>';
  d += '<g class="corpo">' + via([bac, pet]) + via([pet, traAB(pet, capo, OSSA.collo - OSSA.capo)]) +
       '<circle cx="' + capo[0] + '" cy="' + capo[1] + '" r="' + OSSA.capo + '"/>' +
       arti(p.manoV, p.cavigliaV, p.gomitoV || 1, p.ginocchioV || 1, p.puntaV) + '</g>';

  let carico = '';
  const rot = p.rotManubri || 0;
  if (p.manubri === 'due' && p.manoV && p.manoL) carico += manubrio(p.manoV[0], p.manoV[1], rot) + manubrio(p.manoL[0], p.manoL[1], rot);
  else if (p.manubri === 'uno' && p.manoV) carico += manubrio(p.manoV[0], p.manoV[1], rot);
  else if (p.manubri === 'mezzo' && p.manoV && p.manoL)
    carico += manubrio((p.manoV[0]+p.manoL[0])/2, (p.manoV[1]+p.manoL[1])/2, rot);
  if (p.ruota) carico += '<circle class="ruota" cx="' + p.ruota[0] + '" cy="' + p.ruota[1] + '" r="4.6"/>';
  if (p.presa){
    [p.manoV, p.manoL].forEach(function(m){
      if (!m) return;
      if (p.presa === 'sopra')  carico += '<line x1="' + m[0] + '" y1="' + (m[1]-3.5) + '" x2="' + m[0] + '" y2="' + m[1] + '"/>';
      if (p.presa === 'sotto')  carico += '<line x1="' + m[0] + '" y1="' + m[1] + '" x2="' + m[0] + '" y2="' + (m[1]+3.5) + '"/>';
      if (p.presa === 'neutra') carico += '<line x1="' + (m[0]-3) + '" y1="' + m[1] + '" x2="' + (m[0]+3) + '" y2="' + m[1] + '"/>';
    });
  }
  if (carico) d += '<g class="peso">' + carico + '</g>';

  if (p.zoom){
    const c = p.centro || [32, 44];
    d = '<g transform="translate(' + c[0] + ' ' + c[1] + ') scale(' + p.zoom + ') translate(' + (-c[0]) + ' ' + (-c[1]) + ')">' + d + '</g>';
  }
  return '<svg viewBox="0 0 64 64" aria-hidden="true">' + d + '</svg>';
}

export {figura, catena, OSSA};

export const ESERCIZI = [
  {id:"panca-piana-manubri", n:"Panca piana con manubri", gruppo:"Spinta orizzontale — petto", categoria:"spinta", fascia:[8,12], carico:"manubri", manubri:2,
   disegno:{"a":["pancaC","pavimento"],"bacino":[38,41],"petto":[24,41],"capo":[18.7,41],"manoV":[24,25],"manoL":[29,28],"gomitoV":1,"gomitoL":1,"cavigliaV":[48,55],"cavigliaL":[51,54],"ginocchioV":-1,"ginocchioL":-1,"manubri":"due"}},
  {id:"panca-inclinata-manubri", n:"Panca inclinata con manubri", gruppo:"Spinta orizzontale — petto", categoria:"spinta", fascia:[8,12], carico:"manubri", manubri:2,
   disegno:{"a":["inclinata","pavimento"],"bacino":[28,42],"petto":[40,34],"capo":[44.6,30.9],"verso":-1,"manoV":[44,18],"manoL":[48,21],"gomitoV":-1,"gomitoL":-1,"cavigliaV":[16,55],"cavigliaL":[13,54],"ginocchioV":1,"ginocchioL":1,"manubri":"due"}},
  {id:"distensioni-presa-stretta", n:"Distensioni con presa stretta", gruppo:"Spinta orizzontale — petto", categoria:"spinta", fascia:[8,12], carico:"manubri", manubri:2, nota:"gomiti stretti al busto",
   disegno:{"a":["pancaC","pavimento"],"bacino":[38,41],"petto":[24,41],"capo":[18.7,41],"manoV":[25,26],"manoL":[28,29],"gomitoV":1,"gomitoL":1,"cavigliaV":[48,55],"cavigliaL":[51,54],"ginocchioV":-1,"ginocchioL":-1,"manubri":"due"}},
  {id:"croci-panca-piana", n:"Croci su panca piana", gruppo:"Spinta orizzontale — petto", categoria:"spinta", fascia:[12,20], carico:"manubri", manubri:2,
   disegno:{"a":["pancaC","pavimento"],"bacino":[38,41],"petto":[24,41],"capo":[18.7,41],"manoV":[34,31],"manoL":[15,32],"gomitoV":-1,"gomitoL":1,"cavigliaV":[48,55],"cavigliaL":[51,54],"ginocchioV":-1,"ginocchioL":-1,"manubri":"due"}},
  {id:"croci-panca-inclinata", n:"Croci su panca inclinata", gruppo:"Spinta orizzontale — petto", categoria:"spinta", fascia:[12,20], carico:"manubri", manubri:2,
   disegno:{"a":["inclinata","pavimento"],"bacino":[28,42],"petto":[40,34],"capo":[44.6,30.9],"verso":-1,"manoV":[52,27],"manoL":[31,25],"gomitoV":1,"gomitoL":-1,"cavigliaV":[16,55],"cavigliaL":[13,54],"ginocchioV":1,"ginocchioL":1,"manubri":"due"}},
  {id:"pullover-manubrio", n:"Pullover con un manubrio", gruppo:"Spinta orizzontale — petto", categoria:"spinta", fascia:[10,15], carico:"manubri", manubri:1, nota:"un solo manubrio, due mani",
   disegno:{"a":["pancaC","pavimento"],"bacino":[38,41],"petto":[24,41],"capo":[18.7,41],"manoV":[10,33],"manoL":[12,35],"gomitoV":1,"gomitoL":1,"cavigliaV":[48,55],"cavigliaL":[51,54],"ginocchioV":-1,"ginocchioL":-1,"manubri":"mezzo"}},
  {id:"dip-parallele-busto-inclinato", n:"Dip alle parallele, busto inclinato", gruppo:"Spinta orizzontale — petto", categoria:"spinta", fascia:[8,15], carico:"zavorra", manubri:0,
   disegno:{"a":["parallele","pavimento"],"bacino":[32,33],"petto":[38,20],"capo":[40.3,15],"verso":-1,"manoV":[42,30],"manoL":[39,26],"gomitoV":-1,"gomitoL":-1,"cavigliaV":[24,43],"cavigliaL":[21,42],"ginocchioV":-1,"ginocchioL":-1,"puntaV":200,"puntaL":200}},
  {id:"flessioni-piedi-panca", n:"Flessioni con i piedi sulla panca", gruppo:"Spinta orizzontale — petto", categoria:"spinta", fascia:[12,20], carico:"corpo", manubri:0,
   disegno:{"a":["pancaDx","pavimento"],"bacino":[30,41],"petto":[16,40],"capo":[10.5,39.8],"verso":-1,"manoV":[15,57],"manoL":[18,56],"gomitoV":1,"gomitoL":1,"cavigliaV":[46,42],"cavigliaL":[49,42],"ginocchioV":-1,"ginocchioL":-1,"puntaV":25,"puntaL":25}},
  {id:"flessioni-mani-panca", n:"Flessioni con le mani sulla panca", gruppo:"Spinta orizzontale — petto", categoria:"spinta", fascia:[12,20], carico:"corpo", manubri:0,
   disegno:{"a":["pancaSx","pavimento"],"bacino":[31,39],"petto":[21,29],"capo":[15.9,27],"manoV":[20,44],"manoL":[23,45],"gomitoV":-1,"gomitoL":-1,"cavigliaV":[47,55],"cavigliaL":[50,54],"ginocchioV":-1,"ginocchioL":-1}},
  {id:"flessioni-terra", n:"Flessioni a terra", gruppo:"Spinta orizzontale — petto", categoria:"spinta", fascia:[12,20], carico:"corpo", manubri:0,
   disegno:{"a":["pavimento"],"bacino":[39,47],"petto":[26,41.5],"capo":[20.9,39.4],"verso":-1,"manoV":[24,57],"manoL":[27,56],"gomitoV":1,"gomitoL":1,"cavigliaV":[54,53],"cavigliaL":[57,52],"ginocchioV":-1,"ginocchioL":-1,"puntaV":200,"puntaL":200,"zoom":1.14,"centro":[36,47]}},
  {id:"lento-avanti-seduto", n:"Lento avanti seduto", gruppo:"Spinta verticale — spalle", categoria:"spinta", fascia:[8,12], carico:"manubri", manubri:2,
   disegno:{"a":["schienale","pavimento"],"bacino":[28,42],"petto":[28,28],"capo":[28,22.5],"manoV":[23,13],"manoL":[33,14],"gomitoV":1,"gomitoL":-1,"cavigliaV":[43,54],"cavigliaL":[46,53],"ginocchioV":-1,"ginocchioL":-1,"manubri":"due"}},
  {id:"arnold-press", n:"Arnold press", gruppo:"Spinta verticale — spalle", categoria:"spinta", fascia:[8,12], carico:"manubri", manubri:2, nota:"si parte con i palmi verso di te",
   disegno:{"a":["schienale","pavimento"],"bacino":[28,42],"petto":[28,28],"capo":[28,22.5],"manoV":[22,22],"manoL":[34,23],"gomitoV":1,"gomitoL":-1,"cavigliaV":[43,54],"cavigliaL":[46,53],"ginocchioV":-1,"ginocchioL":-1,"manubri":"due"}},
  {id:"alzate-laterali", n:"Alzate laterali", gruppo:"Spinta verticale — spalle", categoria:"spinta", fascia:[12,20], carico:"manubri", manubri:2,
   disegno:{"a":["pavimento"],"bacino":[32,29],"petto":[32,15],"capo":[32,9.5],"manoV":[48,18],"manoL":[16,18],"gomitoV":1,"gomitoL":-1,"cavigliaV":[36,51],"cavigliaL":[28,51],"ginocchioV":-1,"ginocchioL":1,"puntaV":55,"puntaL":125,"manubri":"due"}},
  {id:"alzate-frontali", n:"Alzate frontali", gruppo:"Spinta verticale — spalle", categoria:"spinta", fascia:[12,20], carico:"manubri", manubri:2,
   disegno:{"a":["pavimento"],"bacino":[30,29],"petto":[30,15],"capo":[30,9.5],"manoV":[46,15],"manoL":[43,22],"gomitoV":1,"gomitoL":1,"cavigliaV":[29,51],"cavigliaL":[26,51],"ginocchioV":-1,"ginocchioL":-1,"manubri":"due"}},
  {id:"tirate-mento", n:"Tirate al mento", gruppo:"Spinta verticale — spalle", categoria:"spinta", fascia:[12,20], carico:"manubri", manubri:2, nota:"gomiti sempre più alti delle mani",
   disegno:{"a":["pavimento"],"bacino":[32,29],"petto":[32,15],"capo":[32,9.5],"manoV":[36,20],"manoL":[28,20],"gomitoV":-1,"gomitoL":1,"cavigliaV":[36,51],"cavigliaL":[28,51],"ginocchioV":-1,"ginocchioL":1,"puntaV":55,"puntaL":125,"manubri":"due"}},
  {id:"alzate-posteriori-pancia-giu-panca-inclinata", n:"Alzate posteriori a pancia in giù sulla panca inclinata", gruppo:"Spinta verticale — spalle", categoria:"spinta", fascia:[12,20], carico:"manubri", manubri:2, nota:"il petto appoggiato toglie il carico dalla schiena",
   disegno:{"a":["inclinata","pavimento"],"bacino":[28,42],"petto":[40,34],"capo":[44.6,30.9],"verso":-1,"manoV":[32,48],"manoL":[50,46],"gomitoV":1,"gomitoL":-1,"cavigliaV":[16,55],"cavigliaL":[13,54],"ginocchioV":1,"ginocchioL":1,"manubri":"due"}},
  {id:"trazioni-presa-prona", n:"Trazioni presa prona", gruppo:"Tirata verticale — dorso", categoria:"tirata", fascia:[6,12], carico:"zavorra", manubri:0, nota:"palmi in avanti, gambe piegate",
   disegno:{"a":["barra"],"bacino":[32,36],"petto":[32,22],"capo":[32,16.5],"manoV":[40,9],"manoL":[24,9],"gomitoV":1,"gomitoL":-1,"cavigliaV":[28,44],"cavigliaL":[36,45],"ginocchioV":-1,"ginocchioL":1,"puntaV":200,"puntaL":340,"presa":"sopra"}},
  {id:"trazioni-presa-supina", n:"Trazioni presa supina", gruppo:"Tirata verticale — dorso", categoria:"tirata", fascia:[6,12], carico:"zavorra", manubri:0, nota:"palmi verso di te, più bicipite",
   disegno:{"a":["barra"],"bacino":[32,36],"petto":[32,22],"capo":[32,16.5],"manoV":[37,9],"manoL":[27,9],"gomitoV":1,"gomitoL":-1,"cavigliaV":[28,44],"cavigliaL":[36,45],"ginocchioV":-1,"ginocchioL":1,"puntaV":200,"puntaL":340,"presa":"sotto"}},
  {id:"trazioni-presa-neutra", n:"Trazioni presa neutra", gruppo:"Tirata verticale — dorso", categoria:"tirata", fascia:[6,12], carico:"zavorra", manubri:0, nota:"palmi affacciati, la più gentile con le spalle",
   disegno:{"a":["barra"],"bacino":[32,36],"petto":[32,22],"capo":[32,16.5],"manoV":[35,9],"manoL":[29,9],"gomitoV":1,"gomitoL":-1,"cavigliaV":[28,44],"cavigliaL":[36,45],"ginocchioV":-1,"ginocchioL":1,"puntaV":200,"puntaL":340,"presa":"neutra"}},
  {id:"trazioni-presa-larga", n:"Trazioni presa larga", gruppo:"Tirata verticale — dorso", categoria:"tirata", fascia:[6,12], carico:"zavorra", manubri:0, nota:"mani ben fuori dalle spalle",
   disegno:{"a":["barra"],"bacino":[32,36],"petto":[32,21],"capo":[32,15.5],"manoV":[44,9],"manoL":[20,9],"gomitoV":1,"gomitoL":-1,"cavigliaV":[28,44],"cavigliaL":[36,45],"ginocchioV":-1,"ginocchioL":1,"puntaV":200,"puntaL":340,"presa":"sopra"}},
  {id:"rematore-braccio-mano-ginocchio-panca", n:"Rematore a un braccio, mano e ginocchio sulla panca", gruppo:"Tirata orizzontale — dorso", categoria:"tirata", fascia:[8,12], carico:"manubri", manubri:1, unilaterale:true,
   disegno:{"a":["pancaB","pavimento"],"bacino":[40,32],"petto":[26,30],"capo":[20.6,28.8],"verso":-1,"manoV":[32,36],"manoL":[23,44],"gomitoV":-1,"gomitoL":1,"cavigliaV":[45,54],"cavigliaL":[52,44],"ginocchioV":-1,"ginocchioL":1,"puntaV":25,"puntaL":200,"manubri":"uno"}},
  {id:"rematore-due-manubri-busto-piegato", n:"Rematore con due manubri a busto piegato", gruppo:"Tirata orizzontale — dorso", categoria:"tirata", fascia:[8,12], carico:"manubri", manubri:2,
   disegno:{"a":["pavimento"],"bacino":[36,32],"petto":[22,29],"capo":[17.3,28],"verso":-1,"manoV":[26,38],"manoL":[30,39],"gomitoV":-1,"gomitoL":-1,"cavigliaV":[36,52],"cavigliaL":[33,52],"ginocchioV":1,"ginocchioL":1,"puntaV":155,"puntaL":155,"manubri":"due"}},
  {id:"rematore-pancia-giu-panca-inclinata", n:"Rematore a pancia in giù sulla panca inclinata", gruppo:"Tirata orizzontale — dorso", categoria:"tirata", fascia:[10,15], carico:"manubri", manubri:2,
   disegno:{"a":["inclinata","pavimento"],"bacino":[28,42],"petto":[40,34],"capo":[44.6,30.9],"verso":-1,"manoV":[44,42],"manoL":[40,45],"gomitoV":-1,"gomitoL":-1,"cavigliaV":[16,55],"cavigliaL":[13,54],"ginocchioV":1,"ginocchioL":1,"manubri":"due"}},
  {id:"rematore-australiano-sotto-barra", n:"Rematore australiano sotto la barra", gruppo:"Tirata orizzontale — dorso", categoria:"tirata", fascia:[10,20], carico:"corpo", manubri:0,
   disegno:{"a":["barraBassa","pavimento"],"bacino":[40,39],"petto":[28,32],"capo":[23.3,30.3],"verso":-1,"manoV":[28,26],"manoL":[31,26],"gomitoV":-1,"gomitoL":-1,"cavigliaV":[54,55],"cavigliaL":[51,54],"ginocchioV":-1,"ginocchioL":-1,"puntaV":300,"puntaL":300,"presa":"sopra"}},
  {id:"rematore-renegade", n:"Rematore renegade", gruppo:"Tirata orizzontale — dorso", categoria:"tirata", fascia:[8,12], carico:"manubri", manubri:2, unilaterale:true, nota:"in posizione di flessione, un braccio per volta",
   disegno:{"a":["pavimento"],"bacino":[39,47],"petto":[26,41.5],"capo":[20.9,39.4],"verso":-1,"manoV":[29,36],"manoL":[24,57],"gomitoV":-1,"gomitoL":1,"cavigliaV":[54,53],"cavigliaL":[57,52],"ginocchioV":-1,"ginocchioL":-1,"puntaV":200,"puntaL":200,"manubri":"due","zoom":1.14,"centro":[36,47]}},
  {id:"curl-manubri-piedi", n:"Curl con manubri in piedi", gruppo:"Bicipiti", categoria:"braccia", fascia:[10,15], carico:"manubri", manubri:2, nota:"presa supina, palmi in su",
   disegno:{"a":["pavimento"],"bacino":[32,29],"petto":[32,15],"capo":[32,9.5],"manoV":[38,19],"manoL":[26,19],"gomitoV":1,"gomitoL":-1,"cavigliaV":[36,51],"cavigliaL":[28,51],"ginocchioV":-1,"ginocchioL":1,"puntaV":55,"puntaL":125,"manubri":"due"}},
  {id:"curl-martello", n:"Curl a martello", gruppo:"Bicipiti", categoria:"braccia", fascia:[10,15], carico:"manubri", manubri:2, nota:"presa neutra, palmi affacciati",
   disegno:{"a":["pavimento"],"bacino":[32,29],"petto":[32,15],"capo":[32,9.5],"manoV":[38,19],"manoL":[26,19],"gomitoV":1,"gomitoL":-1,"cavigliaV":[36,51],"cavigliaL":[28,51],"ginocchioV":-1,"ginocchioL":1,"puntaV":55,"puntaL":125,"manubri":"due","rotManubri":90}},
  {id:"curl-inverso", n:"Curl inverso", gruppo:"Bicipiti", categoria:"braccia", fascia:[12,20], carico:"manubri", manubri:2, nota:"presa prona: prende avambraccio e brachiale",
   disegno:{"a":["pavimento"],"bacino":[32,29],"petto":[32,15],"capo":[32,9.5],"manoV":[39,23],"manoL":[25,23],"gomitoV":1,"gomitoL":-1,"cavigliaV":[36,51],"cavigliaL":[28,51],"ginocchioV":-1,"ginocchioL":1,"puntaV":55,"puntaL":125,"manubri":"due"}},
  {id:"curl-panca-inclinata", n:"Curl su panca inclinata", gruppo:"Bicipiti", categoria:"braccia", fascia:[10,15], carico:"manubri", manubri:2, nota:"braccia dietro il corpo: massimo allungamento",
   disegno:{"a":["inclinata","pavimento"],"bacino":[28,42],"petto":[40,34],"capo":[44.6,30.9],"verso":-1,"manoV":[38,50],"manoL":[42,49],"gomitoV":1,"gomitoL":1,"cavigliaV":[16,55],"cavigliaL":[13,54],"ginocchioV":1,"ginocchioL":1,"manubri":"due"}},
  {id:"curl-concentrato", n:"Curl concentrato", gruppo:"Bicipiti", categoria:"braccia", fascia:[12,20], carico:"manubri", manubri:1, unilaterale:true, nota:"gomito appoggiato all'interno coscia",
   disegno:{"a":["pancaB","pavimento"],"bacino":[26,42],"petto":[36,33],"capo":[39,28],"manoV":[44,34],"manoL":[30,46],"gomitoV":1,"gomitoL":1,"cavigliaV":[40,55],"cavigliaL":[34,55],"ginocchioV":-1,"ginocchioL":-1,"manubri":"uno"}},
  {id:"dip-parallele-busto-dritto", n:"Dip alle parallele, busto dritto", gruppo:"Tricipiti", categoria:"braccia", fascia:[8,15], carico:"zavorra", manubri:0,
   disegno:{"a":["parallele","pavimento"],"bacino":[34,34],"petto":[36,20],"capo":[36.8,14.6],"verso":-1,"manoV":[42,30],"manoL":[39,26],"gomitoV":-1,"gomitoL":-1,"cavigliaV":[26,44],"cavigliaL":[23,43],"ginocchioV":-1,"ginocchioL":-1,"puntaV":200,"puntaL":200}},
  {id:"estensioni-sopra-testa-manubrio", n:"Estensioni sopra la testa con un manubrio", gruppo:"Tricipiti", categoria:"braccia", fascia:[10,15], carico:"manubri", manubri:1, nota:"gomiti fermi, puntati in alto",
   disegno:{"a":["pavimento"],"bacino":[30,29],"petto":[30,15],"capo":[30,9.5],"manoV":[27,18],"manoL":[29,19],"gomitoV":1,"gomitoL":1,"cavigliaV":[29,51],"cavigliaL":[26,51],"ginocchioV":-1,"ginocchioL":-1,"manubri":"mezzo"}},
  {id:"estensioni-sdraiato-panca", n:"Estensioni sdraiato su panca", gruppo:"Tricipiti", categoria:"braccia", fascia:[10,15], carico:"manubri", manubri:2,
   disegno:{"a":["pancaC","pavimento"],"bacino":[38,41],"petto":[24,41],"capo":[18.7,41],"manoV":[20,30],"manoL":[23,31],"gomitoV":1,"gomitoL":1,"cavigliaV":[48,55],"cavigliaL":[51,54],"ginocchioV":-1,"ginocchioL":-1,"manubri":"due"}},
  {id:"kickback", n:"Kickback", gruppo:"Tricipiti", categoria:"braccia", fascia:[12,20], carico:"manubri", manubri:2,
   disegno:{"a":["pavimento"],"bacino":[36,32],"petto":[22,29],"capo":[17.3,28],"verso":-1,"manoV":[38,32],"manoL":[35,35],"gomitoV":1,"gomitoL":1,"cavigliaV":[36,52],"cavigliaL":[33,52],"ginocchioV":1,"ginocchioL":1,"puntaV":155,"puntaL":155,"manubri":"due"}},
  {id:"flessioni-diamante", n:"Flessioni diamante", gruppo:"Tricipiti", categoria:"braccia", fascia:[12,20], carico:"corpo", manubri:0, nota:"mani unite sotto il petto",
   disegno:{"a":["pavimento"],"bacino":[39,47],"petto":[26,41.5],"capo":[20.9,39.4],"verso":-1,"manoV":[25,57],"manoL":[27,56],"gomitoV":1,"gomitoL":1,"cavigliaV":[54,53],"cavigliaL":[57,52],"ginocchioV":-1,"ginocchioL":-1,"puntaV":200,"puntaL":200,"zoom":1.14,"centro":[36,47]}},
  {id:"affondo-bulgaro-piede-posteriore-panca", n:"Affondo bulgaro, piede posteriore sulla panca", gruppo:"Gambe", categoria:"gambe", fascia:[8,12], carico:"manubri", manubri:2, unilaterale:true,
   disegno:{"a":["pancaDx","pavimento"],"bacino":[26,34],"petto":[26,20],"capo":[26,14.5],"verso":-1,"manoV":[24,36],"manoL":[29,36],"gomitoV":1,"gomitoL":1,"cavigliaV":[18,53],"cavigliaL":[46,42],"ginocchioV":1,"ginocchioL":-1,"puntaV":155,"puntaL":25,"manubri":"due"}},
  {id:"stacco-rumeno-due-gambe", n:"Stacco rumeno a due gambe", gruppo:"Gambe", categoria:"gambe", fascia:[8,12], carico:"manubri", manubri:2,
   disegno:{"a":["pavimento"],"bacino":[36,32],"petto":[23,27],"capo":[18.3,25.2],"verso":-1,"manoV":[22,44],"manoL":[26,45],"gomitoV":1,"gomitoL":1,"cavigliaV":[37,52],"cavigliaL":[34,52],"ginocchioV":1,"ginocchioL":1,"puntaV":155,"puntaL":155,"manubri":"due"}},
  {id:"stacco-rumeno-gamba", n:"Stacco rumeno a una gamba", gruppo:"Gambe", categoria:"gambe", fascia:[10,15], carico:"manubri", manubri:2, unilaterale:true,
   disegno:{"a":["pavimento"],"bacino":[32,32],"petto":[19,28],"capo":[14.3,26.4],"verso":-1,"manoV":[18,44],"manoL":[22,45],"gomitoV":1,"gomitoL":1,"cavigliaV":[32,52],"cavigliaL":[52,32],"ginocchioV":1,"ginocchioL":-1,"puntaV":155,"puntaL":25,"manubri":"due"}},
  {id:"affondi-statici", n:"Affondi statici", gruppo:"Gambe", categoria:"gambe", fascia:[10,15], carico:"manubri", manubri:2, unilaterale:true,
   disegno:{"a":["pavimento"],"bacino":[30,38],"petto":[30,24],"capo":[30,18.5],"verso":-1,"manoV":[25,40],"manoL":[35,40],"gomitoV":1,"gomitoL":-1,"cavigliaV":[20,54],"cavigliaL":[42,54],"ginocchioV":1,"ginocchioL":-1,"puntaV":155,"puntaL":25,"manubri":"due"}},
  {id:"affondo-laterale", n:"Affondo laterale", gruppo:"Gambe", categoria:"gambe", fascia:[10,15], carico:"manubri", manubri:2, unilaterale:true, nota:"lavora anche gli adduttori, piano nuovo",
   disegno:{"a":["pavimento"],"bacino":[26,40],"petto":[26,26],"capo":[26,20.5],"manoV":[33,34],"manoL":[20,34],"gomitoV":1,"gomitoL":-1,"cavigliaV":[46,54],"cavigliaL":[16,54],"ginocchioV":-1,"ginocchioL":1,"puntaV":35,"puntaL":145,"manubri":"due"}},
  {id:"leg-curl-nordico", n:"Leg curl nordico", gruppo:"Gambe", categoria:"gambe", fascia:[6,10], carico:"corpo", manubri:0, nota:"piedi bloccati sotto un appoggio, si scende piano",
   disegno:{"a":["fermapiedi","pavimento"],"bacino":[41,45],"petto":[35,32],"capo":[32.5,27],"verso":-1,"manoV":[40,26],"manoL":[42,28],"gomitoV":-1,"gomitoL":-1,"cavigliaV":[56,54],"cavigliaL":[56,51],"ginocchioV":1,"ginocchioL":1,"puntaV":200,"puntaL":200}},
  {id:"polpacci-gamba", n:"Polpacci a una gamba", gruppo:"Gambe", categoria:"gambe", fascia:[15,25], carico:"manubri", manubri:1, unilaterale:true,
   disegno:{"a":["pavimento"],"bacino":[30,29],"petto":[30,15],"capo":[30,9.5],"manoV":[24,31],"manoL":[36,31],"gomitoV":1,"gomitoL":-1,"cavigliaV":[30,52],"cavigliaL":[38,44],"ginocchioV":-1,"ginocchioL":-1,"puntaV":60,"puntaL":70,"manubri":"uno"}},
  {id:"swing-manubrio", n:"Swing con manubrio", gruppo:"Corpo intero", categoria:"intero", fascia:[12,20], carico:"manubri", manubri:1, nota:"lo spingono i fianchi, non le braccia",
   disegno:{"a":["pavimento"],"bacino":[36,36],"petto":[24,29],"capo":[19.3,26.3],"verso":-1,"manoV":[38,22],"manoL":[36,25],"gomitoV":1,"gomitoL":1,"cavigliaV":[36,54],"cavigliaL":[33,54],"ginocchioV":1,"ginocchioL":1,"puntaV":155,"puntaL":155,"manubri":"mezzo","rotManubri":90}},
  {id:"thruster-accosciata-spinta", n:"Thruster, accosciata e spinta", gruppo:"Corpo intero", categoria:"intero", fascia:[8,15], carico:"manubri", manubri:2,
   disegno:{"a":["pavimento"],"bacino":[32,38],"petto":[32,24],"capo":[32,18.5],"manoV":[40,25],"manoL":[24,27],"gomitoV":1,"gomitoL":-1,"cavigliaV":[42,54],"cavigliaL":[22,54],"ginocchioV":-1,"ginocchioL":1,"puntaV":35,"puntaL":145,"manubri":"due"}},
  {id:"sollevamento-ginocchia-sedia-romana", n:"Sollevamento ginocchia alla sedia romana", gruppo:"Core — quasi tutto alla sedia romana", categoria:"core", fascia:[12,20], carico:"zavorra", manubri:0,
   disegno:{"a":["sediaRomana"],"bacino":[22,42],"petto":[22,28],"capo":[22,22.5],"manoV":[30,33],"manoL":[27,37],"gomitoV":1,"gomitoL":1,"cavigliaV":[36,53],"cavigliaL":[33,54],"ginocchioV":-1,"ginocchioL":-1,"puntaV":60,"puntaL":60}},
  {id:"sollevamento-gambe-tese-sedia-romana", n:"Sollevamento gambe tese alla sedia romana", gruppo:"Core — quasi tutto alla sedia romana", categoria:"core", fascia:[8,15], carico:"zavorra", manubri:0, nota:"le gambe arrivano a 90°",
   disegno:{"a":["sediaRomana"],"bacino":[22,42],"petto":[22,28],"capo":[22,22.5],"manoV":[30,33],"manoL":[27,37],"gomitoV":1,"gomitoL":1,"cavigliaV":[44,42],"cavigliaL":[44,45],"ginocchioV":-1,"ginocchioL":-1,"puntaV":340,"puntaL":340}},
  {id:"sollevamento-gambe-torsione", n:"Sollevamento gambe con torsione", gruppo:"Core — quasi tutto alla sedia romana", categoria:"core", fascia:[10,20], carico:"zavorra", manubri:0, unilaterale:true, nota:"alla sedia romana, per gli obliqui",
   disegno:{"a":["sediaRomana"],"bacino":[22,42],"petto":[22,28],"capo":[22,22.5],"manoV":[30,33],"manoL":[27,37],"gomitoV":1,"gomitoL":1,"cavigliaV":[42,34],"cavigliaL":[40,37],"ginocchioV":-1,"ginocchioL":-1,"puntaV":330,"puntaL":330}},
  {id:"ruota-addominali-ginocchio", n:"Ruota per addominali in ginocchio", gruppo:"Core — quasi tutto alla sedia romana", categoria:"core", fascia:[8,15], carico:"corpo", manubri:0,
   disegno:{"a":["pavimento"],"bacino":[42,45],"petto":[29,40],"capo":[23.9,38],"verso":-1,"manoV":[15,50],"manoL":[18,49],"gomitoV":1,"gomitoL":1,"cavigliaV":[54,55],"cavigliaL":[57,54],"ginocchioV":1,"ginocchioL":1,"puntaV":200,"puntaL":200,"ruota":[11,52]}}
];

export const PER_ID = Object.fromEntries(ESERCIZI.map(e => [e.id, e]));

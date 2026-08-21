# Spingere

App per la palestra di casa. Dice cosa fare oggi, registra quello che hai fatto e decide **quando è ora
di salire di manubrio**. Funziona senza rete, perché in palestra non prende.

---

## Metterla sul telefono

Serve un indirizzo **https**: da un file aperto a mano (`file://`) l'installazione sulla schermata home
non funziona e il service worker nemmeno.

1. Metti la cartella su un indirizzo https — il VPS, oppure GitHub Pages.
2. Aprila con **Safari** (non Chrome: su iPhone solo Safari sa installare le web app).
3. Condividi → **Aggiungi alla schermata Home**.
4. Apri l'icona una volta con la rete accesa: è il momento in cui scarica tutto.
5. Da lì in poi funziona in aereo. Provalo davvero prima di fidartene.

Per lavorarci sul computer basta un server locale, perché i moduli non si caricano da `file://`:

```
python3 -m http.server 8931
```

e poi `http://127.0.0.1:8931`.

## Prima di pubblicare

```
node test.mjs        # il motore della progressione
node verifica.mjs    # catalogo, gruppi, composizione, figure, offline
```

Devono essere **tutti e due verdi**. `verifica.mjs` controlla anche che nessun file punti a una risorsa
esterna: è quella la garanzia che offline funzioni davvero.

Quando cambi un file, **alza il numero in `sw.js`** (`const CACHE = 'spingere-5'`). Se non lo fai, il
telefono continua a servire la versione vecchia dalla cache e sembrerà che le modifiche non arrivino.

---

## Come è fatta

| File | Cosa fa |
|---|---|
| `motore.js` | La logica dei carichi. Nessun DOM, nessuna data letta dall'interno: tutto arriva come argomento, quindi è verificabile da solo. |
| `esercizi.js` | I 48 esercizi e le loro illustrazioni. **Generato** dal catalogo approvato: non modificarlo a mano. |
| `schede.js` | Le schede: liste di esercizi, i conti sui tempi, le alternative, le sezioni del catalogo. |
| `archivio.js` | IndexedDB, storico, backup. |
| `interfaccia.js` | Schermate e tocchi. |
| `stile.css` | Un'estetica sola, scura. |
| `sw.js` | La cache che rende l'app usabile senza rete. |

## Le decisioni che sembrano strane e non lo sono

**Non c'è nessun calendario.** L'app apre su «Oggi» con una sessione già pronta, e che siano passati due
giorni o tre settimane non cambia niente. Non compare mai un rimprovero: se ti alleni a giorni variabili,
un calendario ti farebbe solo sentire in ritardo.

**Una scheda è una lista di esercizi tuoi.** Li scegli dal catalogo, li ordini come vuoi, e quando fai
quella scheda escono quelli. Si parte **senza nessuna scheda**: la prima la fai tu.

Ci sono passate tre forme prima di arrivare qui. Erano scritte nel codice (e 27 esercizi su 48 non erano
raggiungibili in nessun modo). Poi sono diventate combinazioni di gruppi, con gli esercizi scelti da una
regola — che ruotava bene ma toglieva il controllo. Ora sono la cosa più semplice, e la scelta è tutta
tua. Le schede vecchie a `nucleo`/`opzionali` vengono recuperate; quelle a soli gruppi no, perché non
contengono nessun esercizio.

**Le schede girano in ordine.** Finita una, «Oggi» propone la successiva. Nessun calendario: che siano
passati due giorni o tre settimane non cambia niente.

**Tre serie sono il consueto, non un obbligo.** Puoi chiudere prima («Chiudo qui») o farne una in più
(«Ne faccio un'altra»).

**Puoi cambiare qualunque esercizio**, prima di iniziare dall'anteprima o durante la sessione: le
alternative sono della stessa sezione del catalogo. Vale solo per quel giorno, la scheda resta com'è. E a
scheda finita puoi aggiungerne uno al volo.

**Il catalogo si apre a sezioni.** Quarantotto voci di fila erano dodici schermate di scorrimento: ora le
nove sezioni partono chiuse, e cercando si aprono da sole.

**Il diario si guarda prima di correggerlo.** Toccando una sessione si vede cosa hai fatto; da lì, se
serve, si passa alla correzione dei numeri.

**Il recupero si legge dall'orologio, non contando all'indietro.** iOS congela i timer quando l'app va in
secondo piano, e al ritorno il conto restava fermo dov'era.

**Il recupero cambia col tipo:** 60 secondi sugli isolamenti, 120 sui pesanti e sugli unilaterali, 90 per
il resto. Novanta per tutto era comodo da scrivere ma sbagliato. E corre anche fra un esercizio e
l'altro, non solo fra le serie: finito uno, il timer parte sulla schermata del successivo.

**Dal diario si correggono gli errori.** Un numero digitato male falserebbe la progressione di quell'
esercizio per sempre: dal diario si riapre una sessione, si sistemano i numeri o si cancella tutta.

**Si progredisce a ripetizioni, non a peso.** I manubri hanno cinque gradini in tutto — 3, 8,5, 14, 18,5,
24 kg. Da 14 a 18,5 è un salto del 32%, da 3 a 8,5 del 183%. «Aggiungi un chilo a settimana» qui è
materialmente impossibile. Quindi: stessa fascia di ripetizioni finché non la chiudi su **tutte** le
serie, e solo allora il manubrio successivo, ripartendo dal minimo della fascia.

**Il tocco sullo sforzo serve a qualcosa.** «Al limite» rimanda la salita anche a fascia chiusa; due
«facile» di fila la anticipano anche senza. È l'unica cosa che l'app non può dedurre da sola.

**Dopo una pausa lunga i carichi non vengono tagliati.** L'app mostra l'ultimo dato pieno e dice
«riprendiamo da qui». Se avevi guadagnato un salto, il salto resta tuo.

**Il grafico non mostra il carico.** Mostrerebbe una scala a gradoni: fra 14 e 18,5 kg possono passare
settimane in cui la riga è piatta mentre tu vai da 9 a 12 ripetizioni. La curva mette insieme carico e
ripetizioni (`carico × (1 + rip/30)`), così sale anche quando il manubrio non cambia. Non è un massimale
e l'asse verticale non porta numeri apposta: i valori veri stanno nella tabella sotto.

**Il peso corporeo è l'unica cosa che l'app ti chiede fuori dalla sessione.** Su trazioni, dip e
flessioni il carico sei tu: senza quel numero il grafico ti mostrerebbe fermo mentre progredisci.

## Cosa cambia sul telefono, rispetto al computer

Una web app installata sulla schermata home si comporta diversamente da una pagina aperta al computer, e
qui c'è quello che è stato fatto per tenerne conto.

**Il guscio ha un'altezza fissa.** Il corpo della pagina è fissato e non scorre: a scorrere è solo il
contenuto dentro la schermata. Serve perché su iPhone la pagina intera rimbalza sotto le dita e la barra
in basso si stacca. Attenzione: `height:100%` funziona solo se **tutti** i contenitori sopra ce l'hanno —
basta un anello mancante (`#app`) e la schermata diventa più alta dello schermo, con la parte sotto
irraggiungibile. `verifica.mjs` lo controlla.

**Lo scorrimento si azzera solo cambiando schermata.** Prima lo azzeravo a ogni ridisegno, e in sessione
ogni tocco su «+» faceva saltare la pagina in cima.

**Le ripetizioni cambiano due numeri, non tutta la schermata.** Ridisegnare l'intera vista a ogni tocco
rifà anche l'illustrazione, e si vede scattare.

**La sessione in corso è salvata su disco a ogni ridisegno.** iOS chiude le web app in secondo piano
senza avvisare: bastava guardare un messaggio durante il recupero per tornare e trovare l'app ripartita
da capo. Ora la ritrovi in cima a «Oggi», con «Riprendi» e «Butta via».

**Lo schermo non si spegne durante l'allenamento** (Wake Lock). Se il telefono non lo permette — batteria
bassa, o versione vecchia — non succede niente.

**Nessun campo di testo sotto i 16 px:** sotto quella soglia iOS ingrandisce la pagina appena tocchi
dentro, e non la rimpicciolisce più.

**La barra in basso somma lo spazio della barra gesti** (`env(safe-area-inset-bottom)`): senza, l'ultima
riga di ogni elenco resta coperta.

## Due limiti da conoscere

**Il timer di recupero suona solo con l'app davanti.** A fine recupero fa un bip (se la suoneria è
accesa), ma su iPhone una web app in secondo piano viene congelata dal sistema: a schermo spento non
può emettere né suono né notifica. Se ti servono i 90 secondi cronometrati anche a telefono in tasca,
usa il timer nativo dell'iPhone in parallelo.

**Lo storico sta solo su questo telefono.** Se cancelli l'icona dalla schermata home o resetti l'iPhone,
se ne va con lui e non si recupera. In Impostazioni c'è **Esporta backup**: sull'iPhone apre il foglio
di condivisione (salvalo su File o mandatelo per messaggio), perché in modalità installata il normale
scaricamento di un file spesso non fa niente. Fallo ogni tanto.

---

## Cambiare gli esercizi

`esercizi.js` è generato. Per aggiungere o togliere un esercizio si parte dal catalogo illustrato e si
rigenera, altrimenti le due cose divergono.

Ogni esercizio deve stare in una sezione del catalogo: `verifica.mjs` controlla che le nove sezioni li
coprano tutti, perché un esercizio fuori da ogni sezione non sarebbe raggiungibile da nessuna schermata.

Le schede si fanno **dall'app**, non dal codice.

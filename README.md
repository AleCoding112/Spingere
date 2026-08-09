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
node verifica.mjs    # integrità di catalogo, allenamenti, figure, offline
```

Devono essere **tutti e due verdi**. `verifica.mjs` controlla anche che nessun file punti a una risorsa
esterna: è quella la garanzia che offline funzioni davvero.

Quando cambi un file, **alza il numero in `sw.js`** (`const CACHE = 'spingere-1'`). Se non lo fai, il
telefono continua a servire la versione vecchia dalla cache e sembrerà che le modifiche non arrivino.

---

## Come è fatta

| File | Cosa fa |
|---|---|
| `motore.js` | La logica dei carichi. Nessun DOM, nessuna data letta dall'interno: tutto arriva come argomento, quindi è verificabile da solo. |
| `esercizi.js` | I 48 esercizi e le loro illustrazioni. **Generato** dal catalogo approvato: non modificarlo a mano. |
| `schede.js` | Le schede: creazione, copertura, alternative per la sostituzione. |
| `allenamenti.js` | Le tre schede **di partenza**, copiate nell'archivio al primo avvio. Da lì in poi comanda l'archivio. |
| `archivio.js` | IndexedDB, storico, backup. |
| `interfaccia.js` | Schermate e tocchi. |
| `stile.css` | Un'estetica sola, scura. |
| `sw.js` | La cache che rende l'app usabile senza rete. |

## Le decisioni che sembrano strane e non lo sono

**Non c'è nessun calendario.** L'app conosce solo la *prossima* scheda: girano in ordine, e che siano
passati due giorni o tre settimane non cambia niente. Non compare mai un rimprovero. Se ti alleni a
giorni variabili, un calendario ti farebbe solo sentire in ritardo.

**Le schede sono dati, non codice.** Puoi crearne quante vuoi, cambiarle, riordinarle, eliminarle: la
rotazione è semplicemente il loro ordine. Puoi anche farne una fuori turno senza spostare il giro, e
fare un singolo esercizio da solo dal catalogo — quello non fa avanzare la rotazione, perché non è un
allenamento. Nella prima versione le tre rotazioni erano scritte nel codice, e **27 esercizi su 48 non
erano raggiungibili in nessun modo**: è il motivo per cui esiste tutta questa parte.

**Tre serie sono il consueto, non un obbligo.** Puoi chiudere prima («Chiudo qui») o farne una in più
(«Ne faccio un'altra»).

**Durante la sessione puoi cambiare esercizio.** Ti propone le alternative dello stesso gruppo che non
sono già nella scheda. Vale solo per quel giorno: la scheda resta com'è.

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

## Due limiti da conoscere

**Il timer di recupero non suona.** Su iPhone una web app in secondo piano viene congelata dal sistema:
a schermo spento non può emettere né suono né notifica. Il timer è un cerchio che scorre a schermo
acceso. Se ti servono i 90 secondi cronometrati sul serio, usa il timer nativo dell'iPhone in parallelo.

**Lo storico sta solo su questo telefono.** Se cancelli l'icona dalla schermata home o resetti l'iPhone,
se ne va con lui e non si recupera. In Impostazioni c'è **Esporta backup**: scarica un file ogni tanto.

---

## Cambiare gli esercizi

`esercizi.js` è generato. Per aggiungere o togliere un esercizio si parte dal catalogo illustrato e si
rigenera, altrimenti le due cose divergono.

Le schede si cambiano **dall'app**, non dal codice: `allenamenti.js` è solo la semenza del primo avvio.
`verifica.mjs` controlla che le schede di partenza coprano spinta, tirata, gambe e core e che nessuna
punti a un esercizio inesistente; le tue schede invece le fai come vuoi — l'editor ti dice cosa manca
senza impedirti niente.

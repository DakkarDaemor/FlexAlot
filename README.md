# FlexAlot – Traccia Ore Lavoro

PWA mobile-first per tenere traccia delle ore di ufficio e smart working mese per mese.

## Funzionalità

- **Calendario mensile** — visualizza ogni giorno lavorativo con il relativo tipo (ufficio, flex, ferie, festivo, malattia, congedo)
- **Smart working (Flex)** — registra le ore lavorate da remoto con step da 0,5h; il default è 4h la prima volta, poi ricorda l'ultimo valore usato
- **ROL** — tiene conto delle ore di permesso orario
- **Assenze** — ferie, festività aziendali, malattia e congedo, distinte dai giorni lavorativi
- **Festività nazionali italiane** — escluse automaticamente dal conteggio; opzionale la festa del patrono locale
- **Stats bar mensile** — totale ore lavorate, % ufficio, % flex, con avviso oltre la soglia configurabile
- **Impostazioni** — ore/giorno, soglia allerta flex, cap ROL, inizio settimana, tema (auto/chiaro/scuro), patrono
- **Tema chiaro e scuro** — segue il sistema o forzabile dalle impostazioni
- **Archivio** — storico di tutti i mesi passati con riepilogo statistiche
- **Esporta / Importa JSON** ed **esporta .ics** — backup dei dati e calendario importabile in Google/Apple Calendar
- **Sync opzionale tra dispositivi** — via Firebase + passphrase, senza account (vedi sotto); merge mese per mese, disattivata di default
- **Offline-first** — service worker incluso, funziona senza connessione
- **Installabile** — manifest PWA, aggiungibile alla home screen su Android e iOS
- **Versione visibile** — numero di build in fondo alle Impostazioni; toccalo per forzare il controllo aggiornamenti. La versione è stampata automaticamente a ogni commit (vedi sotto)

## Stack

Vanilla JS · CSS puro · localStorage · Service Worker · Web App Manifest

Nessuna dipendenza esterna, nessun framework, nessun build step.

## Avvio rapido

```bash
# Clona il repo
git clone https://github.com/TUO_USERNAME/flexalot.git
cd flexalot

# Attiva il hook che stampa la versione a ogni commit (una volta sola)
git config core.hooksPath scripts/hooks

# Servi i file statici (qualsiasi server HTTP va bene)
npx serve .
# oppure
python -m http.server 8080
```

Apri `http://localhost:8080` nel browser.

> Per testare il service worker e l'installazione PWA è necessario HTTPS o localhost.

## Struttura

```
flexalot/
├── index.html          # Shell dell'app, due viste: calendario e archivio
├── manifest.json       # Web App Manifest (PWA)
├── sw.js               # Service worker (cache-first); nome cache stampato dal hook
├── VERSION             # Parte "umana" della versione (MAJOR.MINOR.PATCH), da alzare a mano
├── css/
│   └── styles.css      # Stili (design system, modal, calendario)
├── js/
│   ├── config.js       # Preferenze locali del dispositivo (contratto, tema, patrono)
│   ├── version.js      # Versione + data di build — GENERATO dal hook, non modificare
│   ├── app.js          # Logica principale: rendering, modal, navigazione, impostazioni, export
│   ├── storage.js      # CRUD + merge su localStorage (chiave: flexalot_v1)
│   ├── sync.js         # Sincronizzazione cloud opzionale (Firebase, ES module)
│   └── holidays.js     # Festività nazionali italiane per anno (+ patrono)
├── scripts/
│   └── hooks/
│       └── pre-commit  # Stampa versione/build in version.js e sw.js a ogni commit
└── icons/
    ├── icon.svg        # Icona app
    ├── icon-192.png    # Icona PWA (maskable)
    └── icon-512.png    # Icona PWA (maskable)
```

## Come funziona

I **dati del calendario** stanno in `localStorage` alla chiave `flexalot_v1`:

```json
{
  "version": 2,
  "months": {
    "2025-06": {
      "closed": true,
      "closedAt": "2025-07-01T...",
      "updatedAt": 1751328000000,
      "days": {
        "2025-06-10": { "type": "flex", "flexH": 4, "rol": 0 },
        "2025-06-20": { "type": "ferie", "flexH": 0, "rol": 0 }
      }
    }
  }
}
```

`type` può essere `office` (implicito), `flex`, `ferie`, `festivo`, `malattia`, `congedo`.
`updatedAt` per mese serve al merge della sincronizzazione (vince il più recente).
I mesi passati vengono chiusi automaticamente all'apertura dell'app.

Le **preferenze** (ore/giorno, soglia flex, cap ROL, inizio settimana, tema, patrono,
ultimo valore Flex usato) stanno in chiavi separate (`flexalot_config_v1`,
`flexalot_last_flexH`): sono per-dispositivo e **non** vengono sincronizzate, così
ogni persona tiene le proprie. Si modificano dall'icona ingranaggio in alto a sinistra.

## Versione e aggiornamenti

Il numero di versione ha la forma `MAJOR.MINOR.PATCH+N`:

- la parte `MAJOR.MINOR.PATCH` sta nel file `VERSION` e si alza a mano quando serve;
- `+N` è il numero progressivo di commit ed è automatico.

Il hook `scripts/hooks/pre-commit` (attivato con `git config core.hooksPath scripts/hooks`)
a ogni commit rigenera `js/version.js` e aggiorna il nome cache in `sw.js`, poi li
aggiunge al commit. Così **non serve più bumpare `CACHE` a mano**: ogni commit
produce un nome cache nuovo e il service worker si reinstalla servendo i file
aggiornati.

La versione corrente è mostrata in fondo alle **Impostazioni**; toccandola l'app
forza il controllo aggiornamenti del service worker e ricarica.

## Sincronizzare i dati tra più dispositivi

Di base l'app è 100% locale: nessun dato lascia il dispositivo. In più è possibile
attivare una sincronizzazione cloud volutamente senza login: la passphrase che
scegli viene trasformata in un hash SHA-256 e usata come "etichetta" del tuo
documento su Firestore. Chi conosce la passphrase vede quei dati; non c'è verifica
d'identità né recupero password. Adatta a dati non sensibili come questo tracker.

Il merge avviene **mese per mese**: per ogni mese vince la versione con
`updatedAt` più recente. Al collegamento i dati locali e quelli cloud vengono
uniti (nessuno dei due sovrascrive ciecamente l'altro), poi il risultato è
ripropagato al cloud. Da lì ogni salvataggio viene inviato al cloud con un
piccolo ritardo (debounce ~1,5s); in locale funziona comunque offline e la
data dell'ultimo salvataggio cloud è mostrata nel pannello di sincronizzazione.

### 1. Crea il progetto Firebase (una volta sola)

1. [console.firebase.google.com](https://console.firebase.google.com) → **Aggiungi
   progetto** (gratuito).
2. **Build → Firestore Database → Crea database** → region vicina → modalità
   **produzione**.
3. Tab **Regole**, incolla e pubblica:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /flexalot_profiles/{profileId} {
         allow get, write: if true;
         allow list: if false;
       }
     }
   }
   ```

   (Si può leggere/scrivere solo conoscendo l'ID esatto del profilo — la passphrase
   giusta — ma non elencare tutti i profili.)

4. **Impostazioni progetto** → "Le tue app" → aggiungi un'**app Web** (`</>`) →
   copia l'oggetto di configurazione (`apiKey`, `authDomain`, `projectId`, ecc.).

### 2. Collega l'app a quel progetto

Apri `js/sync.js` e sostituisci i valori segnaposto `YOUR_...` in `firebaseConfig`
con quelli copiati. Il nome cache in `sw.js` viene aggiornato automaticamente dal
hook di pre-commit (vedi "Versione e aggiornamenti"), quindi non serve toccarlo a
mano quando modifichi un file in `ASSETS`.

### 3. Attiva la sincronizzazione

Nell'app, tocca l'icona ⟳ in alto a destra → inserisci una passphrase →
"Sincronizza". Ripeti la stessa passphrase sugli altri dispositivi. Per tornare al
solo locale su un dispositivo: stessa icona → "Disconnetti (solo locale)" (i dati
sul cloud restano intatti). Il pallino sull'icona indica lo stato: verde = attiva,
lampeggiante = salvataggio in corso, rosso = ultimo salvataggio non riuscito.

## Licenza

MIT

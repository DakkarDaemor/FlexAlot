# FlexAlot – Traccia Ore Lavoro

PWA mobile-first per tenere traccia delle ore di ufficio e smart working mese per mese.

## Funzionalità

- **Calendario mensile** — visualizza ogni giorno lavorativo con il relativo tipo (ufficio, flex, ferie, festivo)
- **Smart working (Flex)** — registra le ore lavorate da remoto con step da 0,5h
- **ROL** — tiene conto delle ore di permesso orario
- **Ferie e festivi** — giorni di ferie e festività aziendali distinti dai giorni lavorativi
- **Festività nazionali italiane** — escluse automaticamente dal conteggio
- **Stats bar mensile** — totale ore lavorate, % ufficio, % flex, con avviso se il flex supera il 40%
- **Archivio** — storico di tutti i mesi passati con riepilogo statistiche
- **Esporta / Importa JSON** — backup e ripristino dei dati in un clic
- **Sync opzionale tra dispositivi** — via Firebase + passphrase, senza account (vedi sotto); disattivata di default
- **Offline-first** — service worker incluso, funziona senza connessione
- **Installabile** — manifest PWA, aggiungibile alla home screen su Android e iOS

## Stack

Vanilla JS · CSS puro · localStorage · Service Worker · Web App Manifest

Nessuna dipendenza esterna, nessun framework, nessun build step.

## Avvio rapido

```bash
# Clona il repo
git clone https://github.com/TUO_USERNAME/flexalot.git
cd flexalot

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
├── sw.js               # Service worker (cache-first)
├── css/
│   └── styles.css      # Stili (design system, modal, calendario)
├── js/
│   ├── app.js          # Logica principale: rendering, modal, navigazione, sync
│   ├── storage.js      # CRUD su localStorage (chiave: flexalot_v1)
│   ├── sync.js         # Sincronizzazione cloud opzionale (Firebase, ES module)
│   └── holidays.js     # Festività nazionali italiane per anno
└── icons/
    └── icon.svg        # Icona app
```

## Come funziona

I dati vengono salvati in `localStorage` con la chiave `flexalot_v1`. La struttura è:

```json
{
  "months": {
    "2025-06": {
      "closed": true,
      "closedAt": "2025-07-01T...",
      "days": {
        "2025-06-10": { "type": "flex", "flexH": 4, "rol": 0 },
        "2025-06-20": { "type": "ferie", "flexH": 0, "rol": 0 }
      }
    }
  }
}
```

I mesi passati vengono chiusi automaticamente all'apertura dell'app.

## Sincronizzare i dati tra più dispositivi

Di base l'app è 100% locale: nessun dato lascia il dispositivo. In più è possibile
attivare una sincronizzazione cloud volutamente senza login: la passphrase che
scegli viene trasformata in un hash SHA-256 e usata come "etichetta" del tuo
documento su Firestore. Chi conosce la passphrase vede quei dati; non c'è verifica
d'identità né recupero password. Adatta a dati non sensibili come questo tracker.

La strategia di merge è *last-write-wins* sull'intero documento (`{ months: {...} }`):
al collegamento, se il profilo cloud è vuoto vengono caricati i dati locali,
altrimenti quelli cloud sostituiscono quelli locali sul dispositivo. Da lì ogni
salvataggio viene propagato anche al cloud (in locale funziona comunque offline).

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
con quelli copiati. Aumenta `CACHE` in `sw.js` (es. `flexalot-v10` → `v11`) e
ricarica i file sul repo.

### 3. Attiva la sincronizzazione

Nell'app, tocca l'icona ⟳ nella barra del titolo → inserisci una passphrase →
"Sincronizza". Ripeti la stessa passphrase sugli altri dispositivi. Per tornare al
solo locale su un dispositivo: stessa icona → "Disconnetti (solo locale)" (i dati
sul cloud restano intatti). Un pallino verde sull'icona indica che la sync è attiva.

## Licenza

MIT

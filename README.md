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
- **Esporta JSON** — backup dei dati in un clic
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
│   ├── app.js          # Logica principale: rendering, modal, navigazione
│   ├── storage.js      # CRUD su localStorage (chiave: flexalot_v1)
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

## Licenza

MIT

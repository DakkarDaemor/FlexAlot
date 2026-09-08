import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

// Configurazione del progetto Firebase (Console Firebase → Impostazioni progetto
// → Le tue app → Configurazione SDK). Finché resta ai valori "YOUR_..." la
// sincronizzazione è disattivata e l'app funziona solo in locale come prima.
const firebaseConfig = {
  apiKey: "AIzaSyC0EPByOCBmEuGJQ_3DKWcF-d5Wp3m156w",
  authDomain: "flexalot.firebaseapp.com",
  projectId: "flexalot",
  storageBucket: "flexalot.firebasestorage.app",
  messagingSenderId: "656064174528",
  appId: "1:656064174528:web:18c2794351a32a1b6e9025"
};

var PROFILE_HASH_KEY = "flexalot_profile_hash_v1";
var LAST_PUSH_KEY = "flexalot_sync_last";
var COLLECTION = "flexalot_profiles";

var configured = !!firebaseConfig.apiKey && firebaseConfig.apiKey.indexOf("YOUR_") !== 0;
var db = null;
if (configured) {
  try {
    db = getFirestore(initializeApp(firebaseConfig));
  } catch (e) {
    configured = false;
  }
}

var _state = "idle"; // idle | busy | error

function setState(s) {
  _state = s;
  try {
    window.dispatchEvent(new CustomEvent("flexalot-sync", { detail: { state: s } }));
  } catch (e) {}
}

async function sha256Hex(text) {
  var buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.prototype.map.call(new Uint8Array(buf), function (b) {
    return b.toString(16).padStart(2, "0");
  }).join("");
}

function getProfileHash() {
  return localStorage.getItem(PROFILE_HASH_KEY);
}

function normalize(data) {
  try {
    if (typeof Storage !== "undefined" && Storage && typeof Storage.normalize === "function") {
      return Storage.normalize(data);
    }
  } catch (e) {}
  return data && typeof data.months === "object" && data.months !== null
    ? data
    : { months: {} };
}

window.FlexAlotSync = {
  isConfigured: function () { return configured; },
  isConnected: function () { return !!getProfileHash(); },
  state: function () { return _state; },
  lastPush: function () {
    var v = parseInt(localStorage.getItem(LAST_PUSH_KEY), 10);
    return v > 0 ? v : null;
  },

  // Collega questo dispositivo a un profilo cloud identificato dalla passphrase
  // (hashata con SHA-256, mai inviata in chiaro) e restituisce i dati già
  // presenti sul cloud per quel profilo (null se il profilo è nuovo).
  connect: async function (passphrase) {
    if (!configured) throw new Error("Sync non configurata");
    localStorage.setItem(PROFILE_HASH_KEY, await sha256Hex(passphrase));
    return this.pull();
  },

  disconnect: function () {
    localStorage.removeItem(PROFILE_HASH_KEY);
    localStorage.removeItem(LAST_PUSH_KEY);
    setState("idle");
  },

  pull: async function () {
    var hash = getProfileHash();
    if (!hash || !configured) return null;
    setState("busy");
    try {
      var snap = await getDoc(doc(db, COLLECTION, hash));
      setState("idle");
      if (!snap.exists()) return null;
      return normalize(snap.data().data);
    } catch (e) {
      setState("error");
      throw e;
    }
  },

  push: async function (data) {
    var hash = getProfileHash();
    if (!hash || !configured) return;
    setState("busy");
    try {
      await setDoc(doc(db, COLLECTION, hash), {
        data: normalize(data),
        updatedAt: Date.now()
      });
      try { localStorage.setItem(LAST_PUSH_KEY, String(Date.now())); } catch (e) {}
      setState("idle");
    } catch (e) {
      // offline o errore di rete: i dati restano salvati in locale e verranno
      // ripropagati al prossimo salvataggio andato a buon fine
      setState("error");
    }
  }
};

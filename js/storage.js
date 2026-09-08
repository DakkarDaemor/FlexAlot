const Storage = (() => {
  const KEY = 'flexalot_v1';
  const SCHEMA = 2;

  const emptyMonth = () => ({ days: {}, closed: false, closedAt: null, updatedAt: 0 });

  function load() {
    let data;
    try { data = JSON.parse(localStorage.getItem(KEY)); }
    catch { data = null; }
    return normalize(data);
  }

  // Porta qualunque payload (vecchio schema, import, cloud) alla forma corrente.
  function normalize(data) {
    if (!data || typeof data.months !== 'object' || data.months === null) {
      return { version: SCHEMA, months: {} };
    }
    const months = {};
    for (const [ym, m] of Object.entries(data.months)) {
      months[ym] = {
        days: (m && typeof m.days === 'object' && m.days) || {},
        closed: !!(m && m.closed),
        closedAt: (m && m.closedAt) || null,
        updatedAt: (m && Number(m.updatedAt)) || 0
      };
    }
    return { version: SCHEMA, months };
  }

  // ── Persistenza ────────────────────────────────────────────────────────────

  let _pushTimer = null;

  function schedulePush(data) {
    if (!(window.FlexAlotSync && window.FlexAlotSync.isConnected())) return;
    clearTimeout(_pushTimer);
    const snapshot = JSON.stringify(data);
    _pushTimer = setTimeout(() => {
      window.FlexAlotSync.push(JSON.parse(snapshot));
    }, 1500);
  }

  function save(data) {
    const norm = normalize(data);
    try { localStorage.setItem(KEY, JSON.stringify(norm)); } catch {}
    schedulePush(norm);
    return norm;
  }

  function touch(data, ym) {
    if (data.months[ym]) data.months[ym].updatedAt = Date.now();
  }

  // ── Query ──────────────────────────────────────────────────────────────────

  function getMonth(ym) {
    return load().months[ym] || emptyMonth();
  }

  function getAllMonths() {
    return Object.entries(load().months).sort(([a], [b]) => b.localeCompare(a));
  }

  // ── Mutazioni ──────────────────────────────────────────────────────────────

  function setDay(ym, dateStr, dayData) {
    const data = load();
    if (!data.months[ym]) data.months[ym] = emptyMonth();
    if (dayData === null) delete data.months[ym].days[dateStr];
    else data.months[ym].days[dateStr] = dayData;
    touch(data, ym);
    save(data);
  }

  function ensureMonth(ym) {
    const data = load();
    if (!data.months[ym]) { data.months[ym] = emptyMonth(); touch(data, ym); save(data); }
  }

  function closeMonth(ym) {
    const data = load();
    if (!data.months[ym]) data.months[ym] = emptyMonth();
    data.months[ym].closed = true;
    data.months[ym].closedAt = new Date().toISOString();
    touch(data, ym);
    save(data);
  }

  // ── Merge (sincronizzazione) ───────────────────────────────────────────────
  // Unione mese per mese: vince chi ha l'updatedAt più recente. A parità (o se
  // mancante da una parte) vince `b`, che nell'uso è sempre il cloud.
  function merge(a, b) {
    const A = normalize(a), B = normalize(b);
    const out = { version: SCHEMA, months: {} };
    const keys = new Set([...Object.keys(A.months), ...Object.keys(B.months)]);
    for (const k of keys) {
      const ma = A.months[k], mb = B.months[k];
      if (!ma) out.months[k] = mb;
      else if (!mb) out.months[k] = ma;
      else out.months[k] = (mb.updatedAt || 0) >= (ma.updatedAt || 0) ? mb : ma;
    }
    return out;
  }

  // ── Import / Export ────────────────────────────────────────────────────────

  function exportJSON() { return JSON.stringify(load(), null, 2); }

  function importJSON(jsonStr) {
    const parsed = JSON.parse(jsonStr);
    if (!parsed || typeof parsed.months !== 'object') throw new Error('Formato non valido');
    save(parsed);
  }

  return {
    load, save, merge, normalize,
    getMonth, getAllMonths,
    setDay, ensureMonth, closeMonth,
    exportJSON, importJSON
  };
})();

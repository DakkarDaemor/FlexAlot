const Storage = (() => {
  const KEY = 'flexalot_v1';

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || { months: {} }; }
    catch { return { months: {} }; }
  }

  function save(data) {
    localStorage.setItem(KEY, JSON.stringify(data));
    if (window.FlexAlotSync && window.FlexAlotSync.isConnected()) {
      window.FlexAlotSync.push(data);
    }
  }

  function getMonth(ym) {
    return load().months[ym] || { days: {}, closed: false, closedAt: null };
  }

  function setDay(ym, dateStr, dayData) {
    const data = load();
    if (!data.months[ym]) data.months[ym] = { days: {}, closed: false, closedAt: null };
    if (dayData === null) delete data.months[ym].days[dateStr];
    else data.months[ym].days[dateStr] = dayData;
    save(data);
  }

  function ensureMonth(ym) {
    const data = load();
    if (!data.months[ym]) { data.months[ym] = { days: {}, closed: false, closedAt: null }; save(data); }
  }

  function closeMonth(ym) {
    const data = load();
    if (!data.months[ym]) data.months[ym] = { days: {}, closed: false, closedAt: null };
    data.months[ym].closed = true;
    data.months[ym].closedAt = new Date().toISOString();
    save(data);
  }

  function getAllMonths() {
    return Object.entries(load().months).sort(([a], [b]) => b.localeCompare(a));
  }

  function exportJSON() { return JSON.stringify(load(), null, 2); }

  function importJSON(jsonStr) {
    const parsed = JSON.parse(jsonStr);
    if (!parsed || typeof parsed.months !== 'object') throw new Error('Formato non valido');
    save(parsed);
  }

  return { load, getMonth, setDay, ensureMonth, closeMonth, getAllMonths, exportJSON, importJSON };
})();

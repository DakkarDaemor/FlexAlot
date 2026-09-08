// Preferenze locali del dispositivo (contratto, tema, inizio settimana…).
// NON sono dati del calendario: non passano da Storage né dalla sincronizzazione,
// così ogni persona/dispositivo tiene le proprie impostazioni.
const Config = (() => {
  const KEY = 'flexalot_config_v1';

  const DEFAULTS = {
    workH:         8,      // ore lavorative in una giornata piena
    flexThreshold: 40,     // % di flex sul lavorato oltre cui scatta l'allerta
    rolCap:        7.5,     // massimo ROL imputabile in un giorno
    weekStart:     1,      // 1 = lunedì, 0 = domenica
    defaultFlexH:  4,      // ore Flex proposte la prima volta
    theme:         'auto', // 'auto' | 'light' | 'dark'
    patronDate:    '',     // festa del patrono, formato 'MM-DD' ('' = nessuna)
    patronName:    'Patrono'
  };

  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY));
      return (raw && typeof raw === 'object') ? { ...DEFAULTS, ...raw } : { ...DEFAULTS };
    } catch {
      return { ...DEFAULTS };
    }
  }

  function save(patch) {
    const next = { ...load(), ...patch };
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
    applyTheme(next.theme);
    return next;
  }

  function reset() {
    try { localStorage.removeItem(KEY); } catch {}
    applyTheme('auto');
    return { ...DEFAULTS };
  }

  function get(k) { return load()[k]; }

  // Il tema esplicito vince sempre sul media query del sistema (vedi styles.css).
  function applyTheme(theme) {
    theme = theme || load().theme;
    const root = document.documentElement;
    if (theme === 'light' || theme === 'dark') root.setAttribute('data-theme', theme);
    else root.removeAttribute('data-theme');
  }

  applyTheme();

  return { load, save, reset, get, applyTheme, DEFAULTS };
})();

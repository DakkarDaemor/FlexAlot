const Holidays = (() => {
  function easter(year) {
    const a = year % 19, b = Math.floor(year / 100), c = year % 100;
    const d = Math.floor(b / 4), e = b % 4;
    const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return { month, day };
  }

  function pad(n) { return String(n).padStart(2, '0'); }

  const FIXED_NAMES = {
    '01-01': 'Capodanno', '01-06': 'Epifania', '04-25': 'Liberazione',
    '05-01': 'Festa del Lavoro', '06-02': 'Repubblica', '08-15': 'Ferragosto',
    '11-01': 'Tutti i Santi', '12-08': 'Immacolata', '12-25': 'Natale',
    '12-26': 'Santo Stefano'
  };

  const _cache = {};
  let _custom = null; // { mmdd: 'MM-DD', name: string } — festa del patrono locale

  function setCustom(mmdd, name) {
    _custom = /^\d{2}-\d{2}$/.test(mmdd || '') ? { mmdd, name: name || 'Patrono' } : null;
    for (const k of Object.keys(_cache)) delete _cache[k]; // invalida la cache
  }

  function getHolidays(year) {
    if (_cache[year]) return _cache[year];
    const e = easter(year);
    const eDate = new Date(year, e.month - 1, e.day);
    const eMon = new Date(eDate); eMon.setDate(eMon.getDate() + 1);

    const set = new Set();
    Object.keys(FIXED_NAMES).forEach(mmdd => set.add(`${year}-${mmdd}`));
    set.add(`${year}-${pad(e.month)}-${pad(e.day)}`);
    set.add(`${year}-${pad(eMon.getMonth()+1)}-${pad(eMon.getDate())}`);

    const eStr = `${year}-${pad(e.month)}-${pad(e.day)}`;
    const eMonStr = `${year}-${pad(eMon.getMonth()+1)}-${pad(eMon.getDate())}`;

    const names = {};
    Object.entries(FIXED_NAMES).forEach(([mmdd, name]) => { names[`${year}-${mmdd}`] = name; });
    names[eStr] = 'Pasqua';
    names[eMonStr] = 'Pasquetta';

    if (_custom) {
      const ckey = `${year}-${_custom.mmdd}`;
      set.add(ckey);
      names[ckey] = _custom.name;
    }

    set._names = names;
    _cache[year] = set;
    return set;
  }

  function getName(dateStr) {
    const year = parseInt(dateStr.slice(0, 4));
    const set = getHolidays(year);
    return (set._names && set._names[dateStr]) || 'Festività';
  }

  return { getHolidays, getName, setCustom };
})();

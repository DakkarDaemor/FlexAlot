(() => {
  const MONTHS = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
                  'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
  // Indicizzati per getDay(): 0 = domenica … 6 = sabato
  const WDAYS_SHORT = ['Dom','Lun','Mar','Mer','Gio','Ven','Sab'];
  const WDAYS_FULL  = ['domenica','lunedì','martedì','mercoledì','giovedì','venerdì','sabato'];

  const now = new Date();
  const state = {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    view: 'calendar',
    selected: null   // giorno con la "cornice" — impostato al giorno corrente in init()
  };

  // ── Parametri del contratto (da Impostazioni) ─────────────────────────────

  const workH         = () => Config.get('workH');
  const rolCap        = () => Config.get('rolCap');
  const flexThreshold = () => Config.get('flexThreshold');
  const weekStart     = () => (Config.get('weekStart') === 0 ? 0 : 1);

  // Default ore Flex: il valore da Impostazioni la prima volta, poi l'ultimo
  // salvato — così si adatta all'abitudine di chi usa l'app. Preferenza locale
  // di UI: non passa da Storage né dalla sync.
  const LAST_FLEX_KEY = 'flexalot_last_flexH';

  function rememberedFlexH() {
    try {
      const v = parseFloat(localStorage.getItem(LAST_FLEX_KEY));
      if (v > 0 && v <= workH()) return v;
    } catch {}
    return Math.min(Config.get('defaultFlexH'), workH());
  }

  function rememberFlexH(h) {
    try {
      if (h > 0 && h <= workH()) localStorage.setItem(LAST_FLEX_KEY, String(h));
    } catch {}
  }

  // ── Utilities ──────────────────────────────────────────────────────────────

  const pad = n => String(n).padStart(2, '0');
  const ym  = (y, m) => `${y}-${pad(m)}`;
  const ds  = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;

  function daysInMonth(y, m) { return new Date(y, m, 0).getDate(); }

  // Celle vuote iniziali, in base al giorno di inizio settimana configurato
  function firstDow(y, m) {
    return (new Date(y, m - 1, 1).getDay() - weekStart() + 7) % 7;
  }

  function dow(y, m, d) { return new Date(y, m - 1, d).getDay(); } // 0=Sun

  const TODAY = new Date(); TODAY.setHours(0,0,0,0);

  const isToday       = (y,m,d) => { const t=new Date(); return t.getFullYear()===y&&t.getMonth()+1===m&&t.getDate()===d; };
  const isPast        = (y,m,d) => new Date(y,m-1,d) <= TODAY;
  const isCurMonth    = (y,m)   => { const t=new Date(); return t.getFullYear()===y&&t.getMonth()+1===m; };

  function formatH(h) {
    if (!h) return '0h';
    const hrs = Math.floor(h), mins = Math.round((h - hrs) * 60);
    return mins ? `${hrs}h${mins}` : `${hrs}h`;
  }

  // ── Stats computation ──────────────────────────────────────────────────────

  function computeStats(y, m) {
    const WORK_H = workH();
    const data = Storage.getMonth(ym(y, m));
    const hols = Holidays.getHolidays(y);
    const days = daysInMonth(y, m);
    let offH=0, flexH=0, rolH=0, budgetH=0;
    let ferieDays=0, festivoDays=0, malattiaDays=0, congedoDays=0;

    for (let d = 1; d <= days; d++) {
      const w = dow(y, m, d);
      if (w === 0 || w === 6) continue;                     // weekend
      const key = ds(y, m, d);
      if (hols.has(key)) continue;                          // festività nazionale / patrono

      budgetH += WORK_H;                                    // budget = tutti i gg lavorativi × ore/giorno

      const dd = data.days[key];
      if (!dd) { offH += WORK_H; continue; }                // ufficio implicito

      const type = dd.type;
      const rol  = parseFloat(dd.rol) || 0;

      if      (type === 'ferie')    { ferieDays++; }
      else if (type === 'festivo')  { festivoDays++; }
      else if (type === 'malattia') { malattiaDays++; }
      else if (type === 'congedo')  { congedoDays++; }
      else {
        // flexH: nuovo campo esplicito; fallback backward-compat per vecchi dati type='flex'
        const fh = dd.flexH != null ? parseFloat(dd.flexH) : (type === 'flex' ? Math.max(0, WORK_H - rol) : 0);
        flexH += fh;
        offH  += Math.max(0, WORK_H - fh - rol);
        rolH  += rol;
      }
    }

    const total   = offH + flexH;
    const flexPct = total > 0 ? Math.round(flexH / total * 100) : 0;
    const offPct  = total > 0 ? Math.round(offH  / total * 100) : 0;
    return { offH, flexH, total, flexPct, offPct, rolH, budgetH,
             ferieDays, festivoDays, malattiaDays, congedoDays };
  }

  // ── Stats bar ──────────────────────────────────────────────────────────────

  function renderStats() {
    const s = computeStats(state.year, state.month);
    const fd = s.flexPct > flexThreshold();

    // Percentuale del lavorato rispetto al monte ore disponibile
    const donePct = s.budgetH > 0 ? Math.round(s.total / s.budgetH * 100) : 0;

    // Chip secondari: solo quelli > 0
    const chips = [];
    if (s.ferieDays   > 0) chips.push(`<span class="sec-chip chip-ferie">🌴 ${s.ferieDays}g ferie</span>`);
    if (s.rolH        > 0) chips.push(`<span class="sec-chip chip-rol">⏱ ROL ${formatH(s.rolH)}</span>`);
    if (s.festivoDays > 0) chips.push(`<span class="sec-chip chip-fest">🎉 ${s.festivoDays}g festivi</span>`);
    if (s.malattiaDays> 0) chips.push(`<span class="sec-chip chip-mal">🤒 ${s.malattiaDays}g malattia</span>`);
    if (s.congedoDays > 0) chips.push(`<span class="sec-chip chip-con">👶 ${s.congedoDays}g congedo</span>`);

    document.getElementById('stats-bar').innerHTML = `
      <div class="stats-main">
        <div class="stat-col">
          <div class="stat-val">${formatH(s.total)}</div>
          <div class="stat-pct">${donePct}%</div>
          <div class="stat-lbl">Lavorate / ${formatH(s.budgetH)}</div>
        </div>
        <div class="stat-div"></div>
        <div class="stat-col">
          <div class="stat-val">${formatH(s.offH)}</div>
          <div class="stat-pct">${s.offPct}%</div>
          <div class="stat-lbl">Ufficio</div>
        </div>
        <div class="stat-div"></div>
        <div class="stat-col">
          <div class="stat-val${fd?' danger':''}">
            ${formatH(s.flexH)}${fd?'<span class="warn-icon">!</span>':''}
          </div>
          <div class="stat-pct${fd?' danger':''}">${s.flexPct}%</div>
          <div class="stat-lbl">Flex</div>
        </div>
      </div>
      ${chips.length ? `<div class="stats-sec">${chips.join('')}</div>` : ''}`;
  }

  // ── Calendar ───────────────────────────────────────────────────────────────

  function renderWeekdayHeaders() {
    const start = weekStart();
    const el = document.querySelector('.weekday-headers');
    if (!el) return;
    el.innerHTML = '';
    for (let i = 0; i < 7; i++) {
      const wd = (start + i) % 7;                 // 0=Dom … 6=Sab
      const div = document.createElement('div');
      div.className = 'wday' + (wd === 0 || wd === 6 ? ' we' : '');
      div.textContent = WDAYS_SHORT[wd];
      el.appendChild(div);
    }
  }

  // Sposta subito la "cornice" sul giorno toccato (il pallino resta sull'oggi).
  function selectCell(key, cell) {
    if (state.selected === key) return;
    state.selected = key;
    const grid = document.getElementById('days-grid');
    grid.querySelectorAll('.day-cell.selected').forEach(c => c.classList.remove('selected'));
    cell.classList.add('selected');
  }

  function renderCalendar() {
    const { year: y, month: m } = state;
    renderWeekdayHeaders();
    document.getElementById('month-title').textContent = `${MONTHS[m-1]} ${y}`;

    const data = Storage.getMonth(ym(y, m));
    const hols = Holidays.getHolidays(y);
    const days = daysInMonth(y, m);
    const lead = firstDow(y, m);
    const grid = document.getElementById('days-grid');
    grid.innerHTML = '';

    // Empty leading cells
    for (let i = 0; i < lead; i++) {
      const el = document.createElement('div');
      el.className = 'day-cell empty';
      grid.appendChild(el);
    }

    for (let d = 1; d <= days; d++) {
      const key = ds(y, m, d);
      const w   = dow(y, m, d);
      const isWE  = w === 0 || w === 6;
      const isNH  = hols.has(key);
      const isFut = isCurMonth(y,m) && !isPast(y,m,d);

      const cell = document.createElement('div');
      const cls  = ['day-cell'];

      if      (isWE) cls.push('weekend');
      else if (isNH) cls.push('nat-hol');
      else {
        const dd   = data.days[key];
        const type = dd ? dd.type : 'office';
        cls.push('type-' + type);
        if (isFut) cls.push('future');
      }
      if (isToday(y,m,d)) cls.push('today');
      if (state.selected === key) cls.push('selected');
      cell.className = cls.join(' ');

      // Day number
      const numEl = document.createElement('div');
      numEl.className = 'day-num';
      numEl.textContent = d;
      cell.appendChild(numEl);

      if (!isWE && !isNH) {
        const dd   = data.days[key];
        const type = dd ? dd.type : 'unset';
        const rol  = dd ? (parseFloat(dd.rol)||0) : 0;
        const fh   = dd && dd.flexH != null ? parseFloat(dd.flexH)
                   : (type === 'flex' ? Math.max(0, workH() - rol) : 0);

        // [testo, classe, ore] — le ore (piccole) compaiono solo per flex e ROL
        const badges = [];
        if (type === 'flex')     badges.push(['Flex',  'flex', fh > 0 ? formatH(fh) : '']);
        if (type === 'ferie')    badges.push(['Ferie', 'ferie']);
        if (type === 'festivo')  badges.push(['Fest',  'festivo']);
        if (type === 'malattia') badges.push(['Mal',   'malattia']);
        if (type === 'congedo')  badges.push(['Cong',  'congedo']);
        if (rol  > 0)            badges.push(['ROL',   'rol', formatH(rol)]);

        if (badges.length > 0) {
          const wrap = document.createElement('div');
          wrap.className = 'day-badges';
          badges.forEach(([text, cls, hrs]) => {
            const b = document.createElement('div');
            b.className = `day-badge b-${cls}`;
            b.textContent = text;
            if (hrs) {
              const h = document.createElement('span');
              h.className = 'badge-h';
              h.textContent = hrs;
              b.appendChild(h);
            }
            wrap.appendChild(b);
          });
          cell.appendChild(wrap);
        }
        cell.addEventListener('click', () => { selectCell(key, cell); openModal(key, y, m, d, false); });
      } else {
        cell.addEventListener('click', () => { selectCell(key, cell); openModal(key, y, m, d, true); });
      }

      grid.appendChild(cell);
    }

    renderStats();
  }

  // ── Modal ──────────────────────────────────────────────────────────────────

  let _editKey  = null;
  let _flexVal  = 0;
  let _rolVal   = 0;

  // Tipi "assenza": esclusivi con tutto il resto, senza ore da imputare.
  const ABSENCE_TYPES = ['ferie', 'festivo', 'malattia', 'congedo'];

  function openModal(key, y, m, d, readOnly) {
    _editKey = readOnly ? null : key;
    const w = dow(y, m, d);
    document.getElementById('modal-title').textContent =
      `${WDAYS_FULL[w]} ${d} ${MONTHS[m-1].toLowerCase()} ${y}`;

    const body = document.getElementById('modal-body');
    const saveBtn = document.getElementById('modal-save');

    if (readOnly) {
      let info = w===0||w===6 ? (w===6?'Sabato':'Domenica') : Holidays.getName(key);
      body.innerHTML = `<div class="modal-info-box"><div class="info-icon">📅</div><div class="info-text">${info}</div></div>`;
      saveBtn.style.display = 'none';
    } else {
      const WORK_H  = workH();
      const ROL_CAP = rolCap();
      saveBtn.style.display = '';
      const mData = Storage.getMonth(`${y}-${pad(m)}`);
      const dd    = mData.days[key];
      const type  = (dd && dd.type) ? dd.type : 'office'; // default UI preselection
      const rol   = dd ? (parseFloat(dd.rol)||0) : 0;

      // Backward-compat: vecchi dati type='flex' senza campo flexH
      _flexVal = dd && dd.flexH != null
        ? Math.min(parseFloat(dd.flexH), WORK_H)
        : (type === 'flex' ? Math.max(0, WORK_H - rol) : 0);
      _rolVal  = Math.min(rol, ROL_CAP);

      const flexSel = _flexVal > 0;
      const rolSel  = _rolVal > 0;
      const sel = t => (type === t ? ' sel' : '');

      body.innerHTML = `
        <p class="modal-section-label">Tipo giornata</p>
        <div class="type-grid">
          <button class="type-btn${flexSel?' sel':''}"     data-t="flex">🏠 Flex</button>
          <button class="type-btn${rolSel?' sel':''}"      data-t="rol">⏱ ROL</button>
          <button class="type-btn${sel('ferie')}"          data-t="ferie">🌴 Ferie</button>
          <button class="type-btn${sel('festivo')}"        data-t="festivo">🎉 Festivo</button>
          <button class="type-btn${sel('malattia')}"       data-t="malattia">🤒 Malattia</button>
          <button class="type-btn${sel('congedo')}"        data-t="congedo">👶 Congedo</button>
        </div>
        <div id="flex-wrap" class="rol-wrap"${flexSel?'':' style="display:none"'}>
          <p class="modal-section-label">Ore smart working</p>
          <div class="rol-stepper">
            <button class="step-btn" id="flex-minus"${_flexVal<=0.5?' disabled':''}>−</button>
            <span class="step-val" id="flex-val">${_flexVal>0?formatH(_flexVal):'—'}</span>
            <button class="step-btn" id="flex-plus"${_flexVal>=WORK_H?' disabled':''}>+</button>
          </div>
        </div>
        <div id="rol-wrap" class="rol-wrap"${rolSel?'':' style="display:none"'}>
          <p class="modal-section-label">Ore ROL (permesso orario)</p>
          <div class="rol-stepper">
            <button class="step-btn" id="rol-minus"${_rolVal<=0.5?' disabled':''}>−</button>
            <span class="step-val" id="rol-val">${_rolVal>0?formatH(_rolVal):'—'}</span>
            <button class="step-btn" id="rol-plus"${_rolVal>=ROL_CAP?' disabled':''}>+</button>
          </div>
        </div>`;

      const updateFlexStepper = () => {
        document.getElementById('flex-val').textContent  = _flexVal > 0 ? formatH(_flexVal) : '—';
        document.getElementById('flex-minus').disabled   = _flexVal <= 0.5;
        document.getElementById('flex-plus').disabled    = _flexVal >= WORK_H;
      };
      const updateRolStepper = () => {
        document.getElementById('rol-val').textContent   = _rolVal > 0 ? formatH(_rolVal) : '—';
        document.getElementById('rol-minus').disabled    = _rolVal <= 0.5;
        document.getElementById('rol-plus').disabled     = _rolVal >= ROL_CAP;
      };

      document.getElementById('flex-minus').addEventListener('click', () => {
        _flexVal = Math.max(0.5, Math.round((_flexVal - 0.5) * 2) / 2);
        updateFlexStepper();
      });
      document.getElementById('flex-plus').addEventListener('click', () => {
        _flexVal = Math.min(WORK_H, Math.round((_flexVal + 0.5) * 2) / 2);
        updateFlexStepper();
      });
      document.getElementById('rol-minus').addEventListener('click', () => {
        _rolVal = Math.max(0.5, Math.round((_rolVal - 0.5) * 2) / 2);
        updateRolStepper();
      });
      document.getElementById('rol-plus').addEventListener('click', () => {
        _rolVal = Math.min(ROL_CAP, Math.round((_rolVal + 0.5) * 2) / 2);
        updateRolStepper();
      });

      body.querySelectorAll('.type-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const t = btn.dataset.t;
          const wasSelected = btn.classList.contains('sel');
          if (ABSENCE_TYPES.includes(t)) {
            body.querySelectorAll('.type-btn').forEach(b => b.classList.remove('sel'));
            if (!wasSelected) btn.classList.add('sel');
            document.getElementById('flex-wrap').style.display = 'none';
            document.getElementById('rol-wrap').style.display  = 'none';
          } else {
            body.querySelectorAll('.type-btn')
                .forEach(b => { if (ABSENCE_TYPES.includes(b.dataset.t)) b.classList.remove('sel'); });
            const nowOn = !wasSelected;
            btn.classList.toggle('sel', nowOn);
            if (t === 'flex') {
              if (nowOn && _flexVal <= 0) { _flexVal = rememberedFlexH(); updateFlexStepper(); }
              document.getElementById('flex-wrap').style.display = nowOn ? '' : 'none';
            } else {
              if (nowOn && _rolVal <= 0)  { _rolVal = Math.min(4, ROL_CAP); updateRolStepper(); }
              document.getElementById('rol-wrap').style.display  = nowOn ? '' : 'none';
            }
          }
        });
      });
    }

    document.getElementById('modal-overlay').classList.add('open');
  }

  function closeModal() {
    document.getElementById('modal-overlay').classList.remove('open');
    _editKey = null;
  }

  function saveModal() {
    if (!_editKey) return;
    const q = t => !!document.querySelector(`#modal-body .type-btn[data-t="${t}"].sel`);
    const flexBtnSel = q('flex');
    const rolBtnSel  = q('rol');
    const absence    = ABSENCE_TYPES.find(q);

    let type, flexH, rol;
    if (absence) {
      type = absence; flexH = 0; rol = 0;
    } else {
      type  = flexBtnSel ? 'flex' : 'office';
      flexH = flexBtnSel ? _flexVal : 0;
      rol   = rolBtnSel  ? _rolVal  : 0;
    }
    if (flexH > 0) rememberFlexH(flexH);
    Storage.setDay(_editKey.slice(0,7), _editKey, { type, flexH, rol });
    closeModal();
    renderCalendar();
  }

  // ── Archive ────────────────────────────────────────────────────────────────

  function autoClose() {
    const curYm = ym(now.getFullYear(), now.getMonth()+1);
    const data = Storage.load();
    Object.keys(data.months).forEach(m => {
      if (m < curYm && !data.months[m].closed) Storage.closeMonth(m);
    });
  }

  function renderArchive() {
    autoClose();
    const list = document.getElementById('archive-list');
    const months = Storage.getAllMonths();

    if (months.length === 0) {
      list.innerHTML = '<div class="empty-state">Nessun mese salvato ancora.<br>I mesi passati appariranno qui.</div>';
      return;
    }

    list.innerHTML = months.map(([ymStr, mData]) => {
      const [y, m] = ymStr.split('-').map(Number);
      const s = computeStats(y, m);
      const fd = s.flexPct > flexThreshold();
      const label = `${MONTHS[m-1]} ${y}`;
      const badge = mData.closed
        ? '<span class="arch-badge closed">Chiuso</span>'
        : '<span class="arch-badge open">In corso</span>';

      const donePct = s.budgetH > 0 ? Math.round(s.total / s.budgetH * 100) : 0;
      return `<div class="arch-card">
        <div class="arch-card-head">
          <span class="arch-month">${label}</span>${badge}
        </div>
        <div class="arch-stats">
          <div class="arch-stat">
            <span class="arch-val">${formatH(s.total)}</span>
            <span class="arch-lbl">Lavorate${s.budgetH?' / '+formatH(s.budgetH):''}</span>
            <span class="arch-sub">${donePct}%</span>
          </div>
          <div class="arch-stat">
            <span class="arch-val">${formatH(s.offH)}</span>
            <span class="arch-lbl">Ufficio</span>
            <span class="arch-sub">${s.offPct}%</span>
          </div>
          <div class="arch-stat${fd?' danger':''}">
            <span class="arch-val">${formatH(s.flexH)}${fd?' ⚠':''}</span>
            <span class="arch-lbl">Flex</span>
            <span class="arch-sub">${s.flexPct}%</span>
          </div>
          ${s.ferieDays>0?`<div class="arch-stat"><span class="arch-val">${s.ferieDays}g</span><span class="arch-lbl">Ferie</span></div>`:''}
          ${s.rolH>0?`<div class="arch-stat"><span class="arch-val">${formatH(s.rolH)}</span><span class="arch-lbl">ROL</span></div>`:''}
          ${s.malattiaDays>0?`<div class="arch-stat"><span class="arch-val">${s.malattiaDays}g</span><span class="arch-lbl">Malattia</span></div>`:''}
          ${s.congedoDays>0?`<div class="arch-stat"><span class="arch-val">${s.congedoDays}g</span><span class="arch-lbl">Congedo</span></div>`:''}
        </div>
      </div>`;
    }).join('');
  }

  // ── Navigation ─────────────────────────────────────────────────────────────

  function switchView(v) {
    state.view = v;
    document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
    document.getElementById(`view-${v}`).classList.add('active');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view===v));
    if (v === 'archive') renderArchive();
  }

  // ── Sync (Firebase, opzionale) ─────────────────────────────────────────────

  const sync = () => window.FlexAlotSync;

  function renderSyncState() {
    const dot = document.getElementById('sync-dot');
    const on = !!(sync() && sync().isConnected());
    dot.hidden = !on;
    const st = on && sync() ? sync().state() : 'idle';
    dot.classList.toggle('syncing', st === 'busy');
    dot.classList.toggle('error', st === 'error');
    if (!document.getElementById('sync-overlay').classList.contains('open')) return;
    refreshSyncHint();
  }

  function fmtWhen(ts) {
    if (!ts) return '';
    const d = new Date(ts), n = new Date();
    const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    const sameDay = d.toDateString() === n.toDateString();
    return sameDay ? `oggi ${time}` : `${pad(d.getDate())}/${pad(d.getMonth()+1)} ${time}`;
  }

  function refreshSyncHint() {
    const hint = document.getElementById('sync-hint');
    if (!sync() || !sync().isConfigured()) {
      hint.textContent = 'Sincronizzazione non configurata in questa installazione.';
      return;
    }
    if (!sync().isConnected()) {
      hint.textContent = 'Nessuna sincronizzazione attiva: i dati restano solo su questo dispositivo.';
      return;
    }
    const st = sync().state();
    if (st === 'busy')  { hint.textContent = 'Sincronizzazione in corso…'; return; }
    if (st === 'error') { hint.textContent = 'Ultimo salvataggio cloud non riuscito (offline?). Riprova al prossimo salvataggio.'; return; }
    const last = sync().lastPush();
    hint.textContent = last
      ? `Sincronizzazione attiva. Ultimo salvataggio cloud: ${fmtWhen(last)}.`
      : 'Sincronizzazione attiva su questo dispositivo.';
  }

  // Fonde i dati cloud con quelli locali mese per mese (vince l'updatedAt più
  // recente), poi ripropaga il risultato al cloud.
  function applyCloudData(cloud) {
    const merged = Storage.merge(Storage.load(), cloud);
    Storage.save(merged);
    autoClose();
    renderCalendar();
    if (state.view === 'archive') renderArchive();
  }

  // All'avvio: se il dispositivo è già collegato a un profilo cloud, allinea i
  // dati locali con quelli remoti.
  async function syncBootstrap() {
    renderSyncState();
    if (!sync() || !sync().isConfigured() || !sync().isConnected()) return;
    try {
      const cloud = await sync().pull();
      if (cloud === null) sync().push(Storage.load());   // profilo nuovo: carico i dati locali
      else applyCloudData(cloud);
    } catch {
      /* offline: si continua con i dati locali, verranno ripropagati al primo salvataggio */
    }
  }

  function openSyncModal() {
    document.getElementById('sync-pass').value = '';
    const configured = !!(sync() && sync().isConfigured());
    const connected = configured && sync().isConnected();
    document.getElementById('sync-connect').disabled = !configured;
    document.getElementById('sync-pass').disabled = !configured;
    document.getElementById('sync-disconnect').hidden = !connected;
    document.getElementById('sync-overlay').classList.add('open');
    refreshSyncHint();
  }

  function closeSyncModal() {
    document.getElementById('sync-overlay').classList.remove('open');
  }

  async function doConnect() {
    const input = document.getElementById('sync-pass');
    const hint = document.getElementById('sync-hint');
    const pass = input.value.trim();
    if (!pass) { hint.textContent = 'Inserisci una passphrase.'; return; }
    if (!sync() || !sync().isConfigured()) return;

    hint.textContent = 'Sincronizzazione in corso…';
    try {
      const cloud = await sync().connect(pass);
      if (cloud === null) {
        sync().push(Storage.load());
        hint.textContent = 'Sincronizzazione attivata, dati caricati sul cloud.';
      } else {
        applyCloudData(cloud);
        hint.textContent = 'Dati uniti con quelli di un altro dispositivo.';
      }
      renderSyncState();
      document.getElementById('sync-disconnect').hidden = false;
      setTimeout(closeSyncModal, 900);
    } catch {
      if (sync()) sync().disconnect();
      hint.textContent = 'Errore di sincronizzazione, riprova.';
      renderSyncState();
    }
  }

  function doDisconnect() {
    if (sync()) sync().disconnect();
    renderSyncState();
    closeSyncModal();
  }

  // ── Impostazioni ───────────────────────────────────────────────────────────

  // Festa del patrono: due menu a tendina (giorno / mese) — niente tastiera su
  // mobile, impossibile digitare un formato sbagliato. Valore salvato: 'MM-DD'.

  // Tutti tolleranti a elementi mancanti: durante un aggiornamento il SW può
  // servire per un attimo un index.html e un app.js di build diverse.
  function fillPatronSelects() {
    const day = document.getElementById('set-patronDay');
    const mon = document.getElementById('set-patronMonth');
    if (!day || !mon) return false;
    if (day.options.length && mon.options.length) return true;   // già popolati
    day.innerHTML = '<option value="">giorno</option>';
    for (let d = 1; d <= 31; d++) day.add(new Option(d, d));
    mon.innerHTML = '<option value="">mese</option>';
    MONTHS.forEach((name, i) => mon.add(new Option(name, i + 1)));
    return true;
  }

  function patronSelectsToValue() {
    const dEl = document.getElementById('set-patronDay');
    const mEl = document.getElementById('set-patronMonth');
    const d = dEl ? +dEl.value : 0;
    const m = mEl ? +mEl.value : 0;
    return (d >= 1 && d <= 31 && m >= 1 && m <= 12) ? `${pad(m)}-${pad(d)}` : '';
  }

  function loadPatronSelects(mmdd) {
    if (!fillPatronSelects()) return;
    const ok = /^\d{2}-\d{2}$/.test(mmdd || '');
    document.getElementById('set-patronMonth').value = ok ? String(+mmdd.slice(0, 2)) : '';
    document.getElementById('set-patronDay').value   = ok ? String(+mmdd.slice(3, 5)) : '';
    updatePatronHint();
  }

  function updatePatronHint() {
    const hint = document.getElementById('patron-hint');
    const dEl  = document.getElementById('set-patronDay');
    const mEl  = document.getElementById('set-patronMonth');
    if (!hint || !dEl || !mEl) return;
    const d = +dEl.value, m = +mEl.value;
    hint.classList.remove('hint-err');
    if (!d && !m) { hint.textContent = 'Lascia su “giorno / mese” se non applicabile.'; return; }
    if (!d || !m) { hint.textContent = 'Scegli sia il giorno sia il mese.'; hint.classList.add('hint-err'); return; }
    hint.textContent = `→ ${d} ${MONTHS[m - 1].toLowerCase()}`;
  }

  function applyConfig() {
    Holidays.setCustom(Config.get('patronDate'), Config.get('patronName'));
    Config.applyTheme();
  }

  function openSettings() {
    const c = Config.load();
    document.getElementById('set-workH').value         = c.workH;
    document.getElementById('set-flexThreshold').value = c.flexThreshold;
    document.getElementById('set-rolCap').value        = c.rolCap;
    document.getElementById('set-weekStart').value     = String(c.weekStart);
    document.getElementById('set-defaultFlexH').value  = c.defaultFlexH;
    document.getElementById('set-theme').value         = c.theme;
    document.getElementById('set-patronName').value    = c.patronName;
    loadPatronSelects(c.patronDate);
    renderVersion();
    document.getElementById('settings-overlay').classList.add('open');
  }

  // ── Versione ───────────────────────────────────────────────────────────────
  // js/version.js è rigenerato a ogni commit dal hook scripts/hooks/pre-commit.

  function renderVersion() {
    const el = document.getElementById('settings-version');
    const v  = self.APP_VERSION || 'dev';
    const dt = self.APP_BUILD_DATE ? ` (${self.APP_BUILD_DATE})` : '';
    el.textContent = `Versione ${v}${dt} · tocca per aggiornare`;
  }

  // Tocca la versione per forzare l'aggiornamento. La cache del SW è "cache-first"
  // e cambia nome a ogni build: l'unico modo di aggiornare è far installare e
  // ATTIVARE il nuovo service worker, poi ricaricare. Su mobile la rete è lenta,
  // quindi non basta un timeout fisso: seguiamo il ciclo di vita del SW.
  async function checkForUpdate() {
    const el = document.getElementById('settings-version');
    el.textContent = 'Controllo aggiornamenti…';

    if (!('serviceWorker' in navigator)) { location.reload(); return; }

    let reg;
    try { reg = await navigator.serviceWorker.getRegistration(); } catch { reg = null; }
    if (!reg) { location.reload(); return; }

    let done = false;
    const finish = () => { if (!done) { done = true; location.reload(); } };

    // Il nuovo SW ha preso il controllo della pagina (clients.claim in activate).
    navigator.serviceWorker.addEventListener('controllerchange', finish);

    // Segui il SW in arrivo fino a "activated" (se controllerchange non scatta,
    // es. prima installazione senza SW precedente).
    const track = sw => sw && sw.addEventListener('statechange', () => {
      if (sw.state === 'activated') finish();
    });
    track(reg.installing || reg.waiting);

    let updateFound = false;
    reg.addEventListener('updatefound', () => {
      updateFound = true;
      const sw = reg.installing;
      track(sw);
      // Se resta in attesa (skipWaiting non applicato), sollecitalo.
      if (reg.waiting) reg.waiting.postMessage('skipWaiting');
    });

    try {
      await reg.update();
      if (reg.waiting) reg.waiting.postMessage('skipWaiting');
    } catch {
      finish();                       // offline: ricarica e basta
      return;
    }

    // Nessun SW nuovo entro un attimo => già aggiornata: ricarica comunque.
    setTimeout(() => { if (!updateFound) finish(); }, 2500);
    // Rete molto lenta: tetto massimo di attesa.
    setTimeout(finish, 8000);
  }

  function closeSettings() {
    document.getElementById('settings-overlay').classList.remove('open');
  }

  function saveSettings() {
    const num = (id, def, min, max) => {
      let v = parseFloat(document.getElementById(id).value);
      if (!isFinite(v)) v = def;
      return Math.min(max, Math.max(min, v));
    };
    const theme = document.getElementById('set-theme').value;
    Config.save({
      workH:         num('set-workH', 8, 1, 24),
      flexThreshold: Math.round(num('set-flexThreshold', 40, 0, 100)),
      rolCap:        num('set-rolCap', 7.5, 0.5, 24),
      weekStart:     document.getElementById('set-weekStart').value === '0' ? 0 : 1,
      defaultFlexH:  num('set-defaultFlexH', 4, 0.5, 24),
      theme:         ['auto','light','dark'].includes(theme) ? theme : 'auto',
      patronDate:    patronSelectsToValue(),
      patronName:    (document.getElementById('set-patronName').value || 'Patrono').trim().slice(0,40) || 'Patrono'
    });
    applyConfig();
    closeSettings();
    renderCalendar();
    if (state.view === 'archive') renderArchive();
  }

  function resetSettings() {
    if (!confirm('Ripristinare tutte le impostazioni ai valori predefiniti?')) return;
    Config.reset();
    applyConfig();
    closeSettings();
    renderCalendar();
    if (state.view === 'archive') renderArchive();
  }

  // ── Export ─────────────────────────────────────────────────────────────────

  function download(filename, text, mime) {
    const blob = new Blob([text], { type: mime });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  function icsLabel(dd) {
    if (!dd) return '';
    switch (dd.type) {
      case 'flex':     return `Flex${dd.flexH ? ' ' + formatH(dd.flexH) : ''}`;
      case 'ferie':    return 'Ferie';
      case 'festivo':  return 'Festivo aziendale';
      case 'malattia': return 'Malattia';
      case 'congedo':  return 'Congedo';
      default:         return (parseFloat(dd.rol) || 0) > 0 ? `ROL ${formatH(dd.rol)}` : '';
    }
  }

  function buildICS() {
    const data  = Storage.load();
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    const out = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//FlexAlot//IT', 'CALSCALE:GREGORIAN'];
    Object.values(data.months).forEach(mo => {
      Object.entries(mo.days).forEach(([date, dd]) => {
        const label = icsLabel(dd);
        if (!label) return;
        const start = date.replace(/-/g, '');
        const end = new Date(date + 'T00:00:00');
        end.setDate(end.getDate() + 1);
        const endStr = `${end.getFullYear()}${pad(end.getMonth()+1)}${pad(end.getDate())}`;
        out.push('BEGIN:VEVENT',
          `UID:${date}@flexalot`,
          `DTSTAMP:${stamp}`,
          `DTSTART;VALUE=DATE:${start}`,
          `DTEND;VALUE=DATE:${endStr}`,
          `SUMMARY:FlexAlot – ${label}`,
          'END:VEVENT');
      });
    });
    out.push('END:VCALENDAR');
    return out.join('\r\n');
  }

  // ── Init ───────────────────────────────────────────────────────────────────

  function init() {
    applyConfig();
    autoClose();

    // All'avvio la cornice sta sull'oggi; poi segue i tap.
    state.selected = ds(now.getFullYear(), now.getMonth() + 1, now.getDate());

    // Prima le cose che DEVONO andare comunque: disegna il calendario e
    // (ri)registra il service worker, così un aggiornamento futuro può sempre
    // rimettere a posto anche se il resto del cablaggio fallisce.
    renderCalendar();
    if ('serviceWorker' in navigator)
      navigator.serviceWorker.register('sw.js').catch(() => {});

    // Il resto è il cablaggio dell'interfaccia. Se durante un aggiornamento il
    // SW serve per un attimo HTML e JS di build diverse, un elemento può
    // mancare: qui si logga e si prosegue invece di lasciare l'app "appesa".
    try {

    document.getElementById('prev-month').addEventListener('click', () => {
      if (--state.month < 1) { state.month = 12; state.year--; }
      renderCalendar();
    });
    document.getElementById('next-month').addEventListener('click', () => {
      if (++state.month > 12) { state.month = 1; state.year++; }
      renderCalendar();
    });

    document.querySelectorAll('.nav-btn').forEach(b =>
      b.addEventListener('click', () => switchView(b.dataset.view)));

    document.getElementById('modal-overlay').addEventListener('click', e => {
      if (e.target.id === 'modal-overlay') closeModal();
    });
    document.getElementById('modal-cancel').addEventListener('click', closeModal);
    document.getElementById('modal-save').addEventListener('click', saveModal);

    const today = () => new Date().toISOString().slice(0,10);
    document.getElementById('export-btn').addEventListener('click', () =>
      download(`flexalot-${today()}.json`, Storage.exportJSON(), 'application/json'));
    document.getElementById('ics-btn').addEventListener('click', () =>
      download(`flexalot-${today()}.ics`, buildICS(), 'text/calendar'));

    const importFile = document.getElementById('import-file');
    document.getElementById('import-btn').addEventListener('click', () => importFile.click());
    importFile.addEventListener('change', () => {
      const file = importFile.files[0];
      if (!file) return;
      importFile.value = '';
      const reader = new FileReader();
      reader.onload = e => {
        try {
          Storage.importJSON(e.target.result);
          renderArchive();
          renderCalendar();
        } catch {
          alert('File non valido o formato non riconosciuto.');
        }
      };
      reader.readAsText(file);
    });

    document.getElementById('sync-btn').addEventListener('click', openSyncModal);
    document.getElementById('sync-cancel').addEventListener('click', closeSyncModal);
    document.getElementById('sync-connect').addEventListener('click', doConnect);
    document.getElementById('sync-disconnect').addEventListener('click', doDisconnect);
    document.getElementById('sync-overlay').addEventListener('click', e => {
      if (e.target.id === 'sync-overlay') closeSyncModal();
    });
    document.getElementById('sync-pass').addEventListener('keydown', e => {
      if (e.key === 'Enter') doConnect();
    });
    window.addEventListener('flexalot-sync', renderSyncState);

    document.getElementById('settings-btn').addEventListener('click', openSettings);
    document.getElementById('set-cancel').addEventListener('click', closeSettings);
    document.getElementById('set-save').addEventListener('click', saveSettings);
    document.getElementById('set-reset').addEventListener('click', resetSettings);
    document.getElementById('settings-version').addEventListener('click', checkForUpdate);
    document.getElementById('set-patronDay')?.addEventListener('change', updatePatronHint);
    document.getElementById('set-patronMonth')?.addEventListener('change', updatePatronHint);
    document.getElementById('settings-overlay').addEventListener('click', e => {
      if (e.target.id === 'settings-overlay') closeSettings();
    });

    // iOS ignora user-scalable=no: disinneschiamo pinch e doppio-tap a mano.
    ['gesturestart', 'gesturechange', 'gestureend'].forEach(ev =>
      document.addEventListener(ev, e => e.preventDefault(), { passive: false }));
    document.addEventListener('touchmove', e => {
      if (e.touches.length > 1) e.preventDefault();
    }, { passive: false });

    } catch (e) {
      console.error('FlexAlot: cablaggio UI incompleto (build miste?)', e);
    }

    syncBootstrap();
  }

  document.addEventListener('DOMContentLoaded', init);
})();

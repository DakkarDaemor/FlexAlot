(() => {
  const WORK_H = 8;
  const MONTHS = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
                  'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
  const WDAYS_SHORT = ['Lun','Mar','Mer','Gio','Ven','Sab','Dom'];
  const WDAYS_FULL  = ['lunedì','martedì','mercoledì','giovedì','venerdì','sabato','domenica'];

  const now = new Date();
  const state = {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    view: 'calendar'
  };

  // ── Utilities ──────────────────────────────────────────────────────────────

  const pad = n => String(n).padStart(2, '0');
  const ym  = (y, m) => `${y}-${pad(m)}`;
  const ds  = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;

  function daysInMonth(y, m) { return new Date(y, m, 0).getDate(); }

  function firstDow(y, m) {          // 0=Mon … 6=Sun (empty leading cells)
    return (new Date(y, m - 1, 1).getDay() + 6) % 7;
  }

  function dow(y, m, d) { return new Date(y, m - 1, d).getDay(); } // 0=Sun

  const TODAY = new Date(); TODAY.setHours(0,0,0,0);

  const isToday       = (y,m,d) => { const t=new Date(); return t.getFullYear()===y&&t.getMonth()+1===m&&t.getDate()===d; };
  const isPast        = (y,m,d) => new Date(y,m-1,d) <= TODAY;
  const isCurMonth    = (y,m)   => { const t=new Date(); return t.getFullYear()===y&&t.getMonth()+1===m; };
  const isPastMonth   = (y,m)   => { const t=new Date(); return y<t.getFullYear()||(y===t.getFullYear()&&m<t.getMonth()+1); };

  function formatH(h) {
    if (!h) return '0h';
    const hrs = Math.floor(h), mins = Math.round((h - hrs) * 60);
    return mins ? `${hrs}h${mins}` : `${hrs}h`;
  }

  // ── Stats computation ──────────────────────────────────────────────────────

  function computeStats(y, m) {
    const data = Storage.getMonth(ym(y, m));
    const hols = Holidays.getHolidays(y);
    const days = daysInMonth(y, m);
    let offH=0, flexH=0, rolH=0, ferieDays=0, festivoDays=0, budgetH=0;

    for (let d = 1; d <= days; d++) {
      const w = dow(y, m, d);
      if (w === 0 || w === 6) continue;                     // weekend
      const key = ds(y, m, d);
      if (hols.has(key)) continue;                          // national holiday

      budgetH += WORK_H;                                    // budget = tutti i gg lavorativi × 8h

      const dd = data.days[key];
      if (!dd) { offH += WORK_H; continue; }                // ufficio implicito

      const type = dd.type;
      const rol  = parseFloat(dd.rol) || 0;

      if      (type === 'ferie')   { ferieDays++; }
      else if (type === 'festivo') { festivoDays++; }
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
    return { offH, flexH, total, flexPct, offPct, rolH, ferieDays, festivoDays, budgetH };
  }

  // ── Stats bar ──────────────────────────────────────────────────────────────

  function renderStats() {
    const s = computeStats(state.year, state.month);
    const fd = s.flexPct > 40;

    // Percentuale del lavorato rispetto al monte ore disponibile
    const donePct = s.budgetH > 0 ? Math.round(s.total / s.budgetH * 100) : 0;

    // Chip secondari: solo quelli > 0
    const chips = [];
    if (s.ferieDays  > 0) chips.push(`<span class="sec-chip chip-ferie">🌴 ${s.ferieDays}g ferie</span>`);
    if (s.rolH       > 0) chips.push(`<span class="sec-chip chip-rol">⏱ ROL ${formatH(s.rolH)}</span>`);
    if (s.festivoDays> 0) chips.push(`<span class="sec-chip chip-fest">🎉 ${s.festivoDays}g festivi</span>`);

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

  function renderCalendar() {
    const { year: y, month: m } = state;
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

        const badges = [];
        if (type === 'flex')    badges.push(['Flex',  'flex']);
        if (type === 'ferie')   badges.push(['Ferie', 'ferie']);
        if (type === 'festivo') badges.push(['Fest',  'festivo']);
        if (rol  > 0)           badges.push(['ROL',   'rol']);

        if (badges.length > 0) {
          const wrap = document.createElement('div');
          wrap.className = 'day-badges';
          badges.forEach(([text, cls]) => {
            const b = document.createElement('div');
            b.className = `day-badge b-${cls}`;
            b.textContent = text;
            wrap.appendChild(b);
          });
          cell.appendChild(wrap);
        }
        cell.addEventListener('click', () => openModal(key, y, m, d, false));
      } else {
        cell.addEventListener('click', () => openModal(key, y, m, d, true));
      }

      grid.appendChild(cell);
    }

    renderStats();
  }

  // ── Modal ──────────────────────────────────────────────────────────────────

  let _editKey  = null;
  let _flexVal  = 0;
  let _rolVal   = 0;

  function openModal(key, y, m, d, readOnly) {
    _editKey = readOnly ? null : key;
    const w = dow(y, m, d);
    const dayNameIdx = (w + 6) % 7;
    document.getElementById('modal-title').textContent =
      `${WDAYS_FULL[dayNameIdx]} ${d} ${MONTHS[m-1].toLowerCase()} ${y}`;

    const body = document.getElementById('modal-body');
    const saveBtn = document.getElementById('modal-save');

    if (readOnly) {
      const hols = Holidays.getHolidays(y);
      let info = w===0||w===6 ? (w===6?'Sabato':'Domenica') : Holidays.getName(key);
      body.innerHTML = `<div class="modal-info-box"><div class="info-icon">📅</div><div class="info-text">${info}</div></div>`;
      saveBtn.style.display = 'none';
    } else {
      saveBtn.style.display = '';
      const mData = Storage.getMonth(`${y}-${pad(m)}`);
      const dd    = mData.days[key];
      const type  = (dd && dd.type) ? dd.type : 'office'; // default UI preselection
      const rol   = dd ? (parseFloat(dd.rol)||0) : 0;

      // Backward-compat: vecchi dati type='flex' senza campo flexH
      _flexVal = dd && dd.flexH != null
        ? Math.min(parseFloat(dd.flexH), WORK_H)
        : (type === 'flex' ? Math.max(0, WORK_H - rol) : 0);
      _rolVal  = Math.min(rol, 7.5);

      const flexSel    = _flexVal > 0;
      const rolSel     = _rolVal > 0;
      const ferieSel   = type === 'ferie';
      const festivoSel = type === 'festivo';

      body.innerHTML = `
        <p class="modal-section-label">Tipo giornata</p>
        <div class="type-grid">
          <button class="type-btn${flexSel?' sel':''}"    data-t="flex">🏠 Flex</button>
          <button class="type-btn${rolSel?' sel':''}"     data-t="rol">⏱ ROL</button>
          <button class="type-btn${ferieSel?' sel':''}"   data-t="ferie">🌴 Ferie</button>
          <button class="type-btn${festivoSel?' sel':''}" data-t="festivo">🎉 Festivo</button>
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
            <button class="step-btn" id="rol-plus"${_rolVal>=7.5?' disabled':''}>+</button>
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
        document.getElementById('rol-plus').disabled     = _rolVal >= 7.5;
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
        _rolVal = Math.min(7.5, Math.round((_rolVal + 0.5) * 2) / 2);
        updateRolStepper();
      });

      body.querySelectorAll('.type-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const t = btn.dataset.t;
          const wasSelected = btn.classList.contains('sel');
          if (t === 'ferie' || t === 'festivo') {
            body.querySelectorAll('.type-btn').forEach(b => b.classList.remove('sel'));
            if (!wasSelected) btn.classList.add('sel');
            document.getElementById('flex-wrap').style.display = 'none';
            document.getElementById('rol-wrap').style.display  = 'none';
          } else {
            body.querySelectorAll('.type-btn[data-t="ferie"],.type-btn[data-t="festivo"]')
                .forEach(b => b.classList.remove('sel'));
            const nowOn = !wasSelected;
            btn.classList.toggle('sel', nowOn);
            if (t === 'flex') {
              if (nowOn && _flexVal <= 0) { _flexVal = 4; updateFlexStepper(); }
              document.getElementById('flex-wrap').style.display = nowOn ? '' : 'none';
            } else {
              if (nowOn && _rolVal <= 0)  { _rolVal  = 4; updateRolStepper(); }
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
    const flexBtnSel = !!document.querySelector('#modal-body .type-btn[data-t="flex"].sel');
    const rolBtnSel  = !!document.querySelector('#modal-body .type-btn[data-t="rol"].sel');
    const ferieSel   = !!document.querySelector('#modal-body .type-btn[data-t="ferie"].sel');
    const festivoSel = !!document.querySelector('#modal-body .type-btn[data-t="festivo"].sel');
    let type, flexH, rol;
    if      (ferieSel)   { type = 'ferie';   flexH = 0; rol = 0; }
    else if (festivoSel) { type = 'festivo'; flexH = 0; rol = 0; }
    else {
      type  = flexBtnSel ? 'flex' : 'office';
      flexH = flexBtnSel ? _flexVal : 0;
      rol   = rolBtnSel  ? _rolVal  : 0;
    }
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
      const fd = s.flexPct > 40;
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

  // ── Init ───────────────────────────────────────────────────────────────────

  function init() {
    autoClose();

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

    document.getElementById('export-btn').addEventListener('click', () => {
      const blob = new Blob([Storage.exportJSON()], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url;
      a.download = `flexalot-${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
    });

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

    if ('serviceWorker' in navigator)
      navigator.serviceWorker.register('sw.js').catch(() => {});

    renderCalendar();
  }

  document.addEventListener('DOMContentLoaded', init);
})();

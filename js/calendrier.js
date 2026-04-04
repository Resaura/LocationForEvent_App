// ═══════════════════════════════════════════════════════════════
// CALENDRIER.JS — Vue calendrier des événements (devis avec recup)
// ═══════════════════════════════════════════════════════════════

const Calendrier = (() => {

  let _vue = 'semaine'; // 'jour' | '3jours' | 'semaine' | 'mois'
  let _ref = new Date(); // date de référence courante

  // ─── Libellés ─────────────────────────────────────────────
  const JC  = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
  const JL  = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
  const MNM = ['Janvier','Février','Mars','Avril','Mai','Juin',
               'Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

  // ─── Couleurs par statut ──────────────────────────────────
  const CALS = {
    brouillon:    { bg: '#F3F4F6', bd: '#D1D5DB', col: '#4B5563' },
    'envoyé':     { bg: '#DBEAFE', bd: '#93C5FD', col: '#1D4ED8' },
    'à relancer': { bg: '#FEF3C7', bd: '#FCD34D', col: '#B45309' },
    'accepté':    { bg: '#D1FAE5', bd: '#6EE7B7', col: '#047857' },
    'refusé':     { bg: '#FEE2E2', bd: '#FCA5A5', col: '#DC2626' },
    'expiré':     { bg: '#FEE2E2', bd: '#EF4444', col: '#7F1D1D' },
  };

  // ─── Injection CSS (une seule fois) ───────────────────────
  let _stylesOk = false;
  function _css() {
    if (_stylesOk) return;
    _stylesOk = true;
    const el = document.createElement('style');
    el.textContent = `
      /* ── Toolbar ─────────────────────────────────────────── */
      .cal-bar {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        align-items: center;
        margin-bottom: 16px;
      }
      .cal-period {
        font-family: 'Syne', sans-serif;
        font-weight: 700;
        color: var(--navy);
        font-size: .9rem;
        margin-left: auto;
        white-space: nowrap;
      }

      /* ── Vue colonnes (jour / 3j / semaine) ──────────────── */
      .cal-scroll { overflow-x: auto; }
      .cal-grid {
        display: grid;
        border: 1px solid var(--border);
        border-radius: var(--r);
        overflow: hidden;
        min-width: 320px;
      }
      .cal-hd {
        background: var(--navy);
        color: rgba(255,255,255,.8);
        text-align: center;
        padding: 10px 6px;
        font-family: 'Syne', sans-serif;
        font-size: .73rem;
        font-weight: 700;
        border-right: 1px solid rgba(255,255,255,.08);
        line-height: 1.4;
      }
      .cal-hd:last-child  { border-right: none; }
      .cal-hd.is-today    { background: var(--blue); }
      .cal-col {
        background: #fff;
        padding: 8px 6px;
        min-height: 120px;
        border-right: 1px solid var(--border);
        border-top: 1px solid var(--border);
      }
      .cal-col:last-child { border-right: none; }
      .cal-col.is-today   { background: var(--blue-l); }

      /* ── Événement (vue colonnes) ─────────────────────────── */
      .cal-evt {
        border-radius: 6px;
        padding: 5px 8px;
        margin-bottom: 5px;
        font-size: .71rem;
        cursor: pointer;
        border-left: 3px solid;
        line-height: 1.4;
        transition: opacity .15s;
      }
      .cal-evt:hover     { opacity: .76; }
      .cal-evt-num       { font-weight: 700; display: block; }
      .cal-evt-cli       {
        opacity: .8;
        display: block;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 160px;
      }
      .cal-evt-empty {
        text-align: center;
        color: var(--grey);
        font-size: .72rem;
        padding: 18px 4px;
      }

      /* ── Vue mois ─────────────────────────────────────────── */
      .cal-month {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        border: 1px solid var(--border);
        border-radius: var(--r);
        overflow: hidden;
      }
      .cal-m-hd {
        background: var(--navy);
        color: rgba(255,255,255,.75);
        text-align: center;
        padding: 8px 4px;
        font-size: .68rem;
        font-weight: 700;
        font-family: 'Syne', sans-serif;
      }
      .cal-m-day {
        background: #fff;
        border-right: 1px solid var(--border);
        border-top: 1px solid var(--border);
        padding: 5px 4px;
        min-height: 82px;
      }
      .cal-m-day:nth-child(7n+8) { border-right: none; }
      .cal-m-day.out             { background: #F9FAFB; }
      .cal-m-day.is-today        { background: var(--blue-l); }
      .cal-m-num {
        font-size: .72rem;
        font-weight: 700;
        color: var(--text3);
        margin-bottom: 3px;
      }
      .cal-m-num.today-n { color: var(--blue); }

      /* ── Événement compact (vue mois) ─────────────────────── */
      .cal-m-evt {
        border-radius: 4px;
        padding: 2px 5px;
        margin-bottom: 2px;
        font-size: .63rem;
        font-weight: 600;
        cursor: pointer;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        border-left: 2px solid;
        transition: opacity .15s;
      }
      .cal-m-evt:hover { opacity: .75; }
      .cal-m-more {
        font-size: .62rem;
        color: var(--grey);
        padding: 1px 3px;
        cursor: default;
      }

      /* ── Icône conflit ─────────────────────────────────────── */
      .cal-warn { font-size: .68rem; margin-right: 2px; }

      /* ── Responsive ───────────────────────────────────────── */
      @media (max-width: 600px) {
        .cal-period    { margin-left: 0; width: 100%; }
        .cal-evt-cli   { max-width: 90px; }
      }
    `;
    document.head.appendChild(el);
  }

  // ─── Helpers date ──────────────────────────────────────────
  function _today() {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d;
  }

  function _norm(s) {
    // Parse 'YYYY-MM-DD' ou 'YYYY-MM-DDTHH:mm', retourne Date à minuit
    if (!s) return null;
    const d = new Date(s);
    if (isNaN(d.getTime())) return null;
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function _sameDay(a, b) {
    return a.getFullYear() === b.getFullYear()
        && a.getMonth()    === b.getMonth()
        && a.getDate()     === b.getDate();
  }

  function _addDays(d, n) {
    const r = new Date(d); r.setDate(r.getDate() + n); return r;
  }

  // Lundi de la semaine contenant date
  function _mondayOf(date) {
    const d = new Date(date); d.setHours(0, 0, 0, 0);
    const dow = d.getDay(); // 0=dim
    d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
    return d;
  }

  // ─── Plages à afficher selon la vue ───────────────────────
  function _getDays() {
    const ref = new Date(_ref); ref.setHours(0, 0, 0, 0);
    if (_vue === 'jour')   return [ref];
    if (_vue === '3jours') return [0, 1, 2].map(n => _addDays(ref, n));
    if (_vue === 'semaine') {
      const mon = _mondayOf(ref);
      return [0,1,2,3,4,5,6].map(n => _addDays(mon, n));
    }
    return [];
  }

  // ─── Événements qui chevauchent un jour ───────────────────
  function _evtsForDay(day) {
    const dayEnd = new Date(day); dayEnd.setHours(23, 59, 59, 999);
    return db.devis.filter(d => {
      if (!d.recup) return false;
      const start = _norm(d.recup);
      if (!start) return false;
      const end = (d.retour && d.retour.trim()) ? _norm(d.retour) : start;
      return start <= dayEnd && end >= day;
    });
  }

  // ─── Détection des conflits de matériel ───────────────────
  function _conflictIds() {
    const evts = db.devis.filter(d => d.recup);
    const ids  = new Set();
    for (let i = 0; i < evts.length; i++) {
      for (let j = i + 1; j < evts.length; j++) {
        const a = evts[i], b = evts[j];
        const aS = _norm(a.recup); if (!aS) continue;
        const bS = _norm(b.recup); if (!bS) continue;
        const aE = (a.retour && a.retour.trim()) ? _norm(a.retour) : aS;
        const bE = (b.retour && b.retour.trim()) ? _norm(b.retour) : bS;
        // Pas de chevauchement ?
        if (aS > bE || bS > aE) continue;
        // Matériel commun ?
        const aMats = new Set((a.lines || []).map(l => l.name));
        if ((b.lines || []).some(l => aMats.has(l.name))) {
          ids.add(a.id);
          ids.add(b.id);
        }
      }
    }
    return ids;
  }

  // ─── HTML d'un événement ───────────────────────────────────
  function _evtHtml(d, conflicts, compact = false) {
    const st   = d.statut || 'brouillon';
    const c    = CALS[st] || CALS.brouillon;
    const icon = d.doctype === 'facture' ? '🧾' : '📋';
    const warn = conflicts.has(d.id)
      ? `<span class="cal-warn" title="Conflit matériel détecté">⚠️</span>`
      : '';
    const click = `onclick="typeof Historique!=='undefined'&&Historique.openDetail(${d.id})"`;

    if (compact) {
      return `<div class="cal-m-evt"
        style="background:${c.bg};border-color:${c.bd};color:${c.col}"
        ${click}>${warn}${icon} ${d.num || '—'} ${d.client || ''}</div>`;
    }
    return `<div class="cal-evt"
      style="background:${c.bg};border-color:${c.bd};color:${c.col}"
      ${click}>
      <span class="cal-evt-num">${warn}${icon} ${d.num || '—'}</span>
      <span class="cal-evt-cli">${d.client || 'Sans client'}</span>
    </div>`;
  }

  // ─── Libellé de la période affichée ───────────────────────
  function _periodLabel() {
    const ref = new Date(_ref);
    if (_vue === 'mois') {
      return MNM[ref.getMonth()] + ' ' + ref.getFullYear();
    }
    const days = _getDays();
    if (days.length === 1) {
      return JL[days[0].getDay()] + ' ' + days[0].getDate()
           + ' ' + MNM[days[0].getMonth()] + ' ' + days[0].getFullYear();
    }
    const f = days[0], l = days[days.length - 1];
    if (f.getMonth() === l.getMonth() && f.getFullYear() === l.getFullYear()) {
      return f.getDate() + ' – ' + l.getDate()
           + ' ' + MNM[f.getMonth()] + ' ' + f.getFullYear();
    }
    return f.getDate() + ' ' + MNM[f.getMonth()].slice(0, 3)
         + ' – ' + l.getDate() + ' ' + MNM[l.getMonth()].slice(0, 3)
         + ' ' + l.getFullYear();
  }

  // ─── Toolbar ──────────────────────────────────────────────
  function _renderBar() {
    const VUES = [
      { k: 'jour',    l: 'Jour' },
      { k: '3jours',  l: '3 jours' },
      { k: 'semaine', l: 'Semaine' },
      { k: 'mois',    l: 'Mois' },
    ];
    const vueBtns = VUES.map(v =>
      `<button class="btn btn-sm ${_vue === v.k ? 'btn-primary' : 'btn-ghost'}"
        onclick="Calendrier.setVue('${v.k}')">${v.l}</button>`
    ).join('');
    return `<div class="cal-bar">
      <div class="btn-row" style="gap:4px;flex-wrap:nowrap">${vueBtns}</div>
      <div class="btn-row" style="gap:4px;flex-wrap:nowrap">
        <button class="btn btn-ghost btn-sm" onclick="Calendrier.nav(-1)">← Préc.</button>
        <button class="btn btn-ghost btn-sm" onclick="Calendrier.nav(0)">Aujourd'hui</button>
        <button class="btn btn-ghost btn-sm" onclick="Calendrier.nav(1)">Suiv. →</button>
      </div>
      <span class="cal-period">${_periodLabel()}</span>
    </div>`;
  }

  // ─── Vue colonnes (jour / 3 jours / semaine) ──────────────
  function _renderCols(days, conflicts) {
    const tod  = _today();
    const cols = days.length;

    const headers = days.map(d => {
      const isT = _sameDay(d, tod);
      return `<div class="cal-hd${isT ? ' is-today' : ''}">
        ${JC[d.getDay()]} ${d.getDate()}<br>
        <span style="font-size:.63rem;opacity:.65">${MNM[d.getMonth()].slice(0, 3)}</span>
      </div>`;
    }).join('');

    const cols_html = days.map(d => {
      const isT  = _sameDay(d, tod);
      const evts = _evtsForDay(d);
      const inner = evts.length
        ? evts.map(e => _evtHtml(e, conflicts)).join('')
        : `<div class="cal-evt-empty">—</div>`;
      return `<div class="cal-col${isT ? ' is-today' : ''}">${inner}</div>`;
    }).join('');

    return `<div class="cal-scroll">
      <div class="cal-grid" style="grid-template-columns:repeat(${cols},1fr)">
        ${headers}${cols_html}
      </div>
    </div>`;
  }

  // ─── Vue mois ─────────────────────────────────────────────
  function _renderMois(conflicts) {
    const tod   = _today();
    const year  = _ref.getFullYear();
    const month = _ref.getMonth();

    const firstOfMonth = new Date(year, month, 1);
    const startDay     = _mondayOf(firstOfMonth);
    const lastDay      = new Date(year, month + 1, 0); // dernier jour du mois

    // Nombre de cellules nécessaires (semaines complètes)
    const diff      = Math.round((lastDay - startDay) / 86400000);
    const totalCells = Math.ceil((diff + 1) / 7) * 7;

    const JOURS_M = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
    const hdRow   = JOURS_M.map(j => `<div class="cal-m-hd">${j}</div>`).join('');

    const MAX_SHOW = 3;
    const dayCells = Array.from({ length: totalCells }, (_, i) => {
      const d    = _addDays(startDay, i);
      const isOut  = d.getMonth() !== month;
      const isT    = _sameDay(d, tod);
      const evts   = _evtsForDay(d);
      const shown  = evts.slice(0, MAX_SHOW);
      const more   = evts.length - MAX_SHOW;
      const numCls = isT ? 'cal-m-num today-n' : 'cal-m-num';
      const moreHtml = more > 0
        ? `<div class="cal-m-more">+ ${more} autre${more > 1 ? 's' : ''}</div>`
        : '';
      return `<div class="cal-m-day${isOut ? ' out' : ''}${isT ? ' is-today' : ''}">
        <div class="${numCls}">${d.getDate()}</div>
        ${shown.map(e => _evtHtml(e, conflicts, true)).join('')}
        ${moreHtml}
      </div>`;
    }).join('');

    return `<div class="cal-month">${hdRow}${dayCells}</div>`;
  }

  // ─── Rendu principal ──────────────────────────────────────
  function render() {
    _css();
    const wrap = document.getElementById('cal-wrap');
    if (!wrap) return;

    const conflicts = _conflictIds();
    const gridHtml  = _vue === 'mois'
      ? _renderMois(conflicts)
      : _renderCols(_getDays(), conflicts);

    wrap.innerHTML = _renderBar() + gridHtml;
  }

  // ─── Navigation ───────────────────────────────────────────
  function nav(dir) {
    if (dir === 0) {
      _ref = new Date();
    } else if (_vue === 'mois') {
      _ref = new Date(_ref.getFullYear(), _ref.getMonth() + dir, 1);
    } else {
      const step = { jour: 1, '3jours': 3, semaine: 7 }[_vue] || 1;
      _ref = _addDays(_ref, dir * step);
    }
    render();
  }

  // ─── Changer de vue ───────────────────────────────────────
  function setVue(v) {
    _vue = v;
    render();
  }

  return { render, nav, setVue };
})();
window.Calendrier = Calendrier;

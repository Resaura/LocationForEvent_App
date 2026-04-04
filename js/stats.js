// ═══════════════════════════════════════════════════════════════
// STATS.JS — Stats & Rentabilité du matériel
// ═══════════════════════════════════════════════════════════════

const Stats = (() => {
  let _sortCol  = 'ca';
  let _sortDir  = -1;  // -1 = desc, 1 = asc
  let _filCat   = 'Toutes';
  let _filStatut = 'Tous';

  // ── Calcul des données de rentabilité ─────────────────────
  function _buildData() {
    const accepted = db.devis.filter(d => d.statut === 'accepté');

    // Agréger les lignes par nom de matériel (exclure services et épicerie)
    const matMap = {};
    accepted.forEach(dv => {
      (dv.lines || []).forEach(l => {
        if (l.dur === 'service' || l.dur === 'epicerie') return;
        const key = l.name;
        if (!matMap[key]) matMap[key] = { ca: 0, count: 0, lastDate: '' };
        matMap[key].ca    += l.prix || 0;
        matMap[key].count += 1;
        if ((dv.date || '') > matMap[key].lastDate) matMap[key].lastDate = dv.date;
      });
    });

    // Construire le tableau : un objet par matériel du catalogue
    return db.cat.map(item => {
      const stats = matMap[item.name] || { ca: 0, count: 0, lastDate: '' };
      const pa = item.pa || 0;
      const pct = pa > 0 ? (stats.ca / pa * 100) : 0;
      return {
        id:       item.id,
        name:     item.name,
        cat:      item.cat || 'Autre',
        pa,
        count:    stats.count,
        ca:       stats.ca,
        pct,
        restant:  Math.max(0, pa - stats.ca),
        lastDate: stats.lastDate,
      };
    });
  }

  // ── Filtrage ──────────────────────────────────────────────
  function _filtered(data) {
    return data.filter(r => {
      if (_filCat !== 'Toutes' && r.cat !== _filCat) return false;
      if (_filStatut === 'Rentabilisés') return r.pct >= 100;
      if (_filStatut === 'En cours')     return r.count > 0 && r.pct < 100;
      if (_filStatut === 'Jamais loué')  return r.count === 0;
      return true;
    });
  }

  // ── Tri ───────────────────────────────────────────────────
  function _sorted(data) {
    return [...data].sort((a, b) => {
      let va = a[_sortCol], vb = b[_sortCol];
      if (typeof va === 'string') { va = va.toLowerCase(); vb = (vb || '').toLowerCase(); }
      if (va < vb) return -1 * _sortDir;
      if (va > vb) return  1 * _sortDir;
      return 0;
    });
  }

  function sort(col) {
    if (_sortCol === col) { _sortDir *= -1; }
    else { _sortCol = col; _sortDir = -1; }
    render();
  }

  function setFilter(cat) { _filCat = cat; render(); }
  function setStatut(s)   { _filStatut = s; render(); }

  // ── Rendu principal ──────────────────────────────────────
  function render() {
    const allData  = _buildData();
    const accepted = db.devis.filter(d => d.statut === 'accepté');

    // ─ KPI cards ─
    const caTotal     = allData.reduce((s, r) => s + r.ca, 0);
    const nbRent      = allData.filter(r => r.pct >= 100).length;
    const nbAccepted  = accepted.length;

    // Matériel le plus loué
    let topName = '—', topCount = 0;
    allData.forEach(r => { if (r.count > topCount) { topCount = r.count; topName = r.name; } });

    const lp = typeof labelPrix === 'function' ? labelPrix() : '';
    const sfx = lp ? ` ${lp}` : '';
    const kpiEl = document.getElementById('stats-kpi');
    if (kpiEl) {
      kpiEl.innerHTML = `
      <div class="stat"><div class="stat-ic ic-green"><i data-lucide="dollar-sign"></i></div><div><div class="stat-lbl">CA total${sfx}</div><div class="stat-val">${prixAffiche(caTotal).toFixed(2)} €</div></div></div>
      <div class="stat"><div class="stat-ic ic-blue"><i data-lucide="package"></i></div><div><div class="stat-lbl">Matériels rentabilisés</div><div class="stat-val">${nbRent} / ${db.cat.length}</div></div></div>
      <div class="stat"><div class="stat-ic ic-gold"><i data-lucide="file-text"></i></div><div><div class="stat-lbl">Devis acceptés</div><div class="stat-val">${nbAccepted}</div></div></div>
      <div class="stat"><div class="stat-ic ic-purple"><i data-lucide="trophy"></i></div><div><div class="stat-lbl">Le plus loué</div><div class="stat-val" style="font-size:.78rem">${topName} (${topCount}×)</div></div></div>
    `;
      lucide.createIcons({ nodes: kpiEl.querySelectorAll('[data-lucide]') });
    }

    // ─ Chips catégorie ─
    const chipsEl = document.getElementById('stats-chips');
    if (chipsEl) {
      const cats = ['Toutes', ...new Set(db.cat.map(i => i.cat || 'Autre'))];
      chipsEl.innerHTML = cats.map(c =>
        `<button class="chip${c === _filCat ? ' on' : ''}" onclick="Stats.setFilter('${c}')">${c}</button>`
      ).join('');
    }

    // ─ Chips statut ─
    const statutEl = document.getElementById('stats-statut-chips');
    if (statutEl) {
      const statuts = ['Tous', 'Rentabilisés', 'En cours', 'Jamais loué'];
      statutEl.innerHTML = statuts.map(s =>
        `<button class="chip${s === _filStatut ? ' on' : ''}" onclick="Stats.setStatut('${s}')">${s}</button>`
      ).join('');
    }

    // ─ Tableau ─
    const filtered = _sorted(_filtered(allData));
    const tbodyEl  = document.getElementById('stats-tbody');
    const emptyEl  = document.getElementById('stats-empty');
    if (tbodyEl) {
      if (!filtered.length) {
        tbodyEl.innerHTML = '';
        if (emptyEl) emptyEl.style.display = 'block';
      } else {
        if (emptyEl) emptyEl.style.display = 'none';
        tbodyEl.innerHTML = filtered.map(r => {
          const pctClamped = Math.min(r.pct, 100);
          const barColor = r.pct >= 100 ? '#059669' : r.pct >= 50 ? '#D97706' : '#DC2626';
          return `<tr>
            <td style="font-weight:600">${r.name}</td>
            <td style="text-align:right">${r.pa.toFixed(2)} €</td>
            <td style="text-align:center">${r.count}</td>
            <td style="text-align:right;font-weight:600">${prixAffiche(r.ca).toFixed(2)} €</td>
            <td style="min-width:140px">
              <div style="display:flex;align-items:center;gap:6px">
                <div style="flex:1;background:#F3F4F6;border-radius:99px;height:8px;overflow:hidden">
                  <div style="width:${pctClamped}%;height:100%;background:${barColor};border-radius:99px;transition:width .3s"></div>
                </div>
                <span style="font-size:.72rem;font-weight:600;color:${barColor};min-width:40px;text-align:right">${r.pct.toFixed(0)}%</span>
              </div>
            </td>
            <td style="text-align:right">${r.restant > 0 ? r.restant.toFixed(2) + ' €' : '<span style="color:#059669;font-weight:600">Amorti</span>'}</td>
            <td style="text-align:center;font-size:.78rem;color:var(--grey)">${r.lastDate ? fmtDate(r.lastDate) : '—'}</td>
          </tr>`;
        }).join('');
      }
    }

    // ─ Entêtes tri ─
    const thEls = document.querySelectorAll('#stats-table th[data-col]');
    thEls.forEach(th => {
      const col = th.dataset.col;
      let arrow = '';
      if (col === _sortCol) arrow = _sortDir === 1 ? ' ↑' : ' ↓';
      th.textContent = th.dataset.label + arrow;
    });

    // ─ Graphique CA mensuel ─
    _renderChart(accepted);
  }

  // ── Graphique barres CSS — 12 derniers mois ───────────────
  function _renderChart(accepted) {
    const el = document.getElementById('stats-chart');
    if (!el) return;

    const now   = new Date();
    const months = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        key:   d.toISOString().slice(0, 7),
        label: d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }),
        ca:    0,
      });
    }

    accepted.forEach(dv => {
      if (!dv.date) return;
      const key = dv.date.slice(0, 7);
      const m   = months.find(x => x.key === key);
      if (m) m.ca += dv.total || 0;
    });

    const maxCA = Math.max(...months.map(m => m.ca), 1);

    el.innerHTML = `
      <div style="display:flex;align-items:flex-end;gap:4px;height:180px;padding:0 4px">
        ${months.map(m => {
          const h = m.ca > 0 ? Math.max(m.ca / maxCA * 160, 6) : 4;
          const col = m.ca > 0 ? 'var(--blue)' : '#E5E7EB';
          return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px">
            <span style="font-size:.6rem;font-weight:600;color:var(--navy)">${m.ca > 0 ? prixAffiche(m.ca).toFixed(0) + ' €' : ''}</span>
            <div style="width:100%;height:${h}px;background:${col};border-radius:4px 4px 0 0;transition:height .3s"></div>
            <span style="font-size:.58rem;color:var(--grey);white-space:nowrap">${m.label}</span>
          </div>`;
        }).join('')}
      </div>`;
  }

  return { render, sort, setFilter, setStatut };
})();
window.Stats = Stats;

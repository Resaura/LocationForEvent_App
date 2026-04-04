// ═══════════════════════════════════════════════════════════════
// CLIENTS.JS — Fichier clients CRM
// ═══════════════════════════════════════════════════════════════

const Clients = (() => {
  let _search  = '';
  let _sortCol = 'nom';
  let _sortDir = 1;   // 1=asc, -1=desc
  let _filBadge = 'Tous';

  // ── Stats d'un client ────────────────────────────────────
  function _statsFor(nom) {
    const cnom   = (nom || '').toLowerCase();
    const devis  = db.devis.filter(d => (d.client || '').toLowerCase() === cnom);
    const accepted = devis.filter(d => d.statut === 'accepté');
    const ca     = accepted.reduce((s, d) => s + (d.total || 0), 0);
    const nbTot  = devis.length;
    const nbAcc  = accepted.length;
    const dates  = devis.map(d => d.date).filter(Boolean).sort();
    const datesAcc = accepted.map(d => d.date).filter(Boolean).sort();
    return {
      nbTot,
      nbAcc,
      ca,
      firstDate:  dates[0] || '',
      lastDate:   datesAcc[datesAcc.length - 1] || '',
      avgDevis:   nbAcc > 0 ? ca / nbAcc : 0,
      devis,
    };
  }

  function _badge(nbTot) {
    if (nbTot >= 10) return { icon: '💎', label: 'VIP',      key: 'VIP' };
    if (nbTot >= 5)  return { icon: '🥇', label: 'Fidèle',   key: 'Fidèle' };
    if (nbTot >= 2)  return { icon: '🥈', label: 'Régulier',  key: 'Régulier' };
    return               { icon: '🥉', label: 'Nouveau',  key: 'Nouveau' };
  }

  function _badgeHtml(nbTot) {
    const b = _badge(nbTot);
    return `<span style="font-size:.68rem;font-weight:600;margin-left:4px">${b.icon} ${b.label}</span>`;
  }

  // ── Filtrage + Tri ───────────────────────────────────────
  function _enriched() {
    return db.clients.map(c => {
      const s = _statsFor(c.nom);
      const b = _badge(s.nbTot);
      return { ...c, ...s, badgeKey: b.key };
    });
  }

  function _filtered(list) {
    return list.filter(c => {
      if (_filBadge !== 'Tous' && c.badgeKey !== _filBadge) return false;
      if (!_search) return true;
      return (c.nom || '').toLowerCase().includes(_search)
          || (c.tel || '').toLowerCase().includes(_search)
          || (c.email || '').toLowerCase().includes(_search)
          || (c.adr || '').toLowerCase().includes(_search);
    });
  }

  function _sorted(list) {
    return [...list].sort((a, b) => {
      let va, vb;
      if (_sortCol === 'nom')      { va = a.nom.toLowerCase(); vb = b.nom.toLowerCase(); }
      else if (_sortCol === 'ca')  { va = a.ca; vb = b.ca; }
      else if (_sortCol === 'nb')  { va = a.nbTot; vb = b.nbTot; }
      else if (_sortCol === 'last') { va = a.lastDate || ''; vb = b.lastDate || ''; }
      else { va = a.nom.toLowerCase(); vb = b.nom.toLowerCase(); }
      if (va < vb) return -1 * _sortDir;
      if (va > vb) return  1 * _sortDir;
      return 0;
    });
  }

  function setSort(col) {
    if (_sortCol === col) _sortDir *= -1;
    else { _sortCol = col; _sortDir = col === 'nom' ? 1 : -1; }
    render();
  }

  function setBadgeFilter(b) { _filBadge = b; render(); }

  function filter() {
    const el = document.getElementById('cli-search');
    _search  = el ? el.value.toLowerCase().trim() : '';
    render();
  }

  // ── Rendu principal ──────────────────────────────────────
  function render() {
    const all      = _enriched();
    const filtered = _sorted(_filtered(all));

    // ─ KPI ─
    const kpiEl = document.getElementById('cli-kpi');
    if (kpiEl) {
      const totalCa = all.reduce((s, c) => s + c.ca, 0);
      let topName = '—', topNb = 0;
      all.forEach(c => { if (c.nbTot > topNb) { topNb = c.nbTot; topName = c.nom; } });
      kpiEl.innerHTML = `
        <div class="stat"><div class="stat-ic ic-blue"><i data-lucide="users"></i></div><div><div class="stat-lbl">Total clients</div><div class="stat-val">${db.clients.length}</div></div></div>
        <div class="stat"><div class="stat-ic ic-green"><i data-lucide="dollar-sign"></i></div><div><div class="stat-lbl">CA total${labelPrix() ? ' ' + labelPrix() : ''}</div><div class="stat-val">${prixAffiche(totalCa).toFixed(2)} €</div></div></div>
        <div class="stat"><div class="stat-ic ic-purple"><i data-lucide="trophy"></i></div><div><div class="stat-lbl">Plus fidèle</div><div class="stat-val" style="font-size:.78rem">${topName} (${topNb}×)</div></div></div>
      `;
      lucide.createIcons({ nodes: kpiEl.querySelectorAll('[data-lucide]') });
    }

    // ─ Chips badge ─
    const chipsEl = document.getElementById('cli-badge-chips');
    if (chipsEl) {
      const badges = ['Tous', 'Nouveau', 'Régulier', 'Fidèle', 'VIP'];
      chipsEl.innerHTML = badges.map(b =>
        `<button class="chip${b === _filBadge ? ' on' : ''}" onclick="Clients.setBadgeFilter('${b}')">${b}</button>`
      ).join('');
    }

    // ─ Tri chips ─
    const sortEl = document.getElementById('cli-sort-chips');
    if (sortEl) {
      const sorts = [
        { col: 'nom',  label: 'Nom A-Z' },
        { col: 'ca',   label: 'CA' },
        { col: 'nb',   label: 'Nb locations' },
        { col: 'last', label: 'Dernière loc.' },
      ];
      sortEl.innerHTML = sorts.map(s => {
        const active = s.col === _sortCol ? ' on' : '';
        const arrow  = s.col === _sortCol ? (_sortDir === 1 ? ' ↑' : ' ↓') : '';
        return `<button class="chip${active}" onclick="Clients.setSort('${s.col}')">${s.label}${arrow}</button>`;
      }).join('');
    }

    // ─ Liste ─
    const listEl = document.getElementById('cli-list');
    const empty  = document.getElementById('cli-empty');
    if (!listEl) return;

    if (!filtered.length) {
      listEl.innerHTML = '';
      if (empty) empty.style.display = 'block';
      return;
    }
    if (empty) empty.style.display = 'none';

    listEl.innerHTML = filtered.map(c => {
      const badge = _badgeHtml(c.nbTot);
      return `<div class="cli-card" onclick="Clients.openDetail(${c.id})">
        <div class="flex jb items-c">
          <div style="min-width:0;flex:1">
            <div class="cli-name">${c.nom} ${badge}</div>
            <div class="cli-info">
              ${c.tel ? `📞 ${c.tel}` : ''}
              ${c.email ? ` · ${c.email}` : ''}
            </div>
            <div style="font-size:.72rem;color:var(--grey);margin-top:3px">
              ${c.nbTot} location${c.nbTot > 1 ? 's' : ''} · CA : ${prixAffiche(c.ca).toFixed(2)} €
              ${c.lastDate ? ` · Dernier : ${fmtDate(c.lastDate)}` : ''}
            </div>
          </div>
          <div style="text-align:right;flex-shrink:0">
            <div class="btn-row" style="justify-content:flex-end">
              <button class="btn btn-primary btn-sm" onclick="event.stopPropagation();Clients.newDevisFor(${c.id})"><i data-lucide="pencil"></i> Devis</button>
              <button class="btn btn-danger btn-sm" onclick="event.stopPropagation();Clients.del(${c.id})"><i data-lucide="trash-2"></i></button>
            </div>
          </div>
        </div>
      </div>`;
    }).join('');
    lucide.createIcons({ nodes: listEl.querySelectorAll('[data-lucide]') });
  }

  // ── Fiche détaillée (modale) ──────────────────────────────
  function openDetail(id) {
    const cli = db.clients.find(c => c.id === id);
    if (!cli) return;

    const s     = _statsFor(cli.nom);
    const badge = _badgeHtml(s.nbTot);

    const titleEl = document.getElementById('m-cli-detail-title');
    const bdEl    = document.getElementById('m-cli-detail-bd');
    if (titleEl) titleEl.textContent = cli.nom;
    if (!bdEl) return;

    // Historique devis du client
    const dvList = [...s.devis].reverse().map(d => {
      const statut = d.statut || 'brouillon';
      const sBadge = typeof statutBadge !== 'undefined' ? statutBadge(statut) : '';
      return `<div class="dvc" onclick="App.closeModal('m-cli-detail');typeof Historique!=='undefined'&&Historique.openDetail(${d.id})" style="cursor:pointer">
        <div class="flex jb items-c">
          <div>
            <div class="dvc-num" style="display:flex;align-items:center;gap:5px">${d.num || '—'} ${sBadge}</div>
            <div class="dvc-client">${fmtDate(d.date)} · ${d.type || ''}</div>
          </div>
          <div class="dvc-total">${(d.total || 0).toFixed(2)} €</div>
        </div>
      </div>`;
    }).join('');

    bdEl.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px">
        <span style="font-size:1.1rem;font-weight:700">${cli.nom}</span>
        ${badge}
      </div>
      <div class="g2 mb-3" style="gap:6px;font-size:.84rem">
        ${cli.tel   ? `<div><i data-lucide="phone"></i> <strong>${cli.tel}</strong></div>` : ''}
        ${cli.email ? `<div><i data-lucide="mail"></i> <strong>${cli.email}</strong></div>` : ''}
        ${cli.adr   ? `<div style="grid-column:span 2"><i data-lucide="map-pin"></i> ${cli.adr}</div>` : ''}
        ${cli.notes ? `<div style="grid-column:span 2;color:var(--grey)"><i data-lucide="file-text"></i> ${cli.notes}</div>` : ''}
      </div>

      <div class="sep"></div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:14px 0;text-align:center;font-size:.82rem">
        <div>
          <div style="font-size:1.1rem;font-weight:700;color:var(--navy)">${s.nbTot}</div>
          <div style="color:var(--grey)">Devis total</div>
        </div>
        <div>
          <div style="font-size:1.1rem;font-weight:700;color:var(--green)">${s.nbAcc}</div>
          <div style="color:var(--grey)">Acceptés</div>
        </div>
        <div>
          <div style="font-size:1.1rem;font-weight:700;color:var(--blue)">${prixAffiche(s.ca).toFixed(2)} €</div>
          <div style="color:var(--grey)">CA total</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px;text-align:center;font-size:.78rem;color:var(--grey)">
        <div>Premier : ${s.firstDate ? fmtDate(s.firstDate) : '—'}</div>
        <div>Dernier : ${s.lastDate ? fmtDate(s.lastDate) : '—'}</div>
        <div>Moy/devis : ${prixAffiche(s.avgDevis).toFixed(2)} €</div>
      </div>

      <div class="sep"></div>
      <div style="font-size:.85rem;font-weight:600;color:var(--navy);margin-bottom:8px">Historique des devis</div>
      ${dvList || '<div style="padding:10px;color:var(--grey);font-size:.82rem">Aucun devis</div>'}

      <div class="sep"></div>
      <div class="btn-row mt-3 no-print">
        <button class="btn btn-ghost btn-sm" onclick="App.closeModal('m-cli-detail');Clients.openModal(${cli.id})"><i data-lucide="pencil"></i> Modifier</button>
        <button class="btn btn-primary btn-sm" onclick="App.closeModal('m-cli-detail');Clients.newDevisFor(${cli.id})"><i data-lucide="plus"></i> Nouveau devis</button>
      </div>
    `;
    lucide.createIcons({ nodes: bdEl.querySelectorAll('[data-lucide]') });
    App.openModal('m-cli-detail');
  }

  // ── Modal édition ────────────────────────────────────────
  function openModal(id) {
    const titleEl = document.getElementById('m-cli-title');
    _setVal('m-cli-id', id || '');
    if (titleEl) titleEl.textContent = id ? 'Modifier le client' : 'Nouveau client';

    if (id) {
      const cli = db.clients.find(c => c.id === id);
      if (!cli) return;
      _setVal('m-cli-nom',   cli.nom   || '');
      _setVal('m-cli-tel',   cli.tel   || '');
      _setVal('m-cli-email', cli.email || '');
      _setVal('m-cli-adr',   cli.adr   || '');
      _setVal('m-cli-notes', cli.notes || '');
    } else {
      ['m-cli-nom','m-cli-tel','m-cli-email','m-cli-adr','m-cli-notes'].forEach(x => _setVal(x, ''));
    }
    App.openModal('m-cli');
  }

  // ── Sauvegarder ───────────────────────────────────────────
  async function save() {
    const nom = (document.getElementById('m-cli-nom')?.value || '').trim();
    if (!nom) { App.toast('Le nom est requis', 'err'); return; }

    const id   = parseInt(_getVal('m-cli-id')) || null;
    const data = {
      nom,
      tel:   _getVal('m-cli-tel'),
      email: _getVal('m-cli-email'),
      adr:   _getVal('m-cli-adr'),
      notes: _getVal('m-cli-notes')
    };

    let cli;
    if (id) {
      const idx = db.clients.findIndex(c => c.id === id);
      if (idx >= 0) { db.clients[idx] = { ...db.clients[idx], ...data }; cli = db.clients[idx]; }
    } else {
      cli = { ...data };
      db.clients.push(cli);
    }

    try {
      await Promise.all([sbUpsertCli(cli), sbSaveMeta(db.ndv, db.nid)]);
      App.closeModal('m-cli');
      render();
      App.updateBadges();
      App.toast('Client sauvegardé ✅', 'ok');
    } catch (err) {
      console.error(err);
      App.toast('Erreur de sauvegarde', 'err');
    }
  }

  // ── Supprimer ─────────────────────────────────────────────
  async function del(id) {
    const cli = db.clients.find(c => c.id === id);
    if (!cli || !confirm(`Supprimer "${cli.nom}" ?`)) return;
    try {
      await sbDeleteCli(id);
      db.clients = db.clients.filter(c => c.id !== id);
      render();
      App.updateBadges();
      App.toast('Client supprimé', 'ok');
    } catch (err) {
      console.error(err);
      App.toast('Erreur de suppression', 'err');
    }
  }

  // ── Nouveau devis pour ce client ──────────────────────────
  function newDevisFor(id) {
    if (typeof Devis !== 'undefined') Devis.fillFromClient(id);
    App.go('nouveau-devis');
  }

  // ── Helpers ───────────────────────────────────────────────
  function _getVal(id) { const el = document.getElementById(id); return el ? el.value : ''; }
  function _setVal(id, v) { const el = document.getElementById(id); if (el) el.value = v; }

  return { render, filter, openModal, openDetail, save, del, newDevisFor, setSort, setBadgeFilter };
})();
window.Clients = Clients;

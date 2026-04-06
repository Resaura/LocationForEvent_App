// ═══════════════════════════════════════════════════════════════
// CATALOGUE.JS — Gestion du matériel
// ═══════════════════════════════════════════════════════════════

const Catalogue = (() => {
  let _filCat    = 'Tous';
  let _filSearch = '';

  // ── Rendu principal ────────────────────────────────────────
  function render() {
    _buildChips();
    _renderTable();
  }

  function _buildChips() {
    const el = document.getElementById('cat-chips');
    if (!el) return;
    const cats = ['Tous', ...(db.categories?.length ? db.categories : [])];
    el.innerHTML = cats.map(c =>
      `<button class="chip${c === _filCat ? ' on' : ''}" onclick="Catalogue.setFilter('${c}')">${c}</button>`
    ).join('');
  }

  function _filtered() {
    return db.cat.filter(i => {
      const matchCat    = _filCat === 'Tous' || i.cat === _filCat;
      const matchSearch = !_filSearch || i.name.toLowerCase().includes(_filSearch) ||
                          (i.notes || '').toLowerCase().includes(_filSearch);
      return matchCat && matchSearch;
    });
  }

  function _renderTable() {
    const tbody = document.getElementById('cat-tbody');
    const empty = document.getElementById('cat-empty');
    if (!tbody) return;

    const items = _filtered();

    if (!items.length) {
      tbody.innerHTML = '';
      if (empty) empty.style.display = 'block';
      return;
    }
    if (empty) empty.style.display = 'none';

    tbody.innerHTML = items.map(i => {
      const prix = i.pa ? calc(i.pa, 'jour') : null;
      const ttcDisp = i.pa_ttc ? ` <span class="text-sm" style="color:var(--grey)">(${i.pa_ttc.toLocaleString('fr-FR')} € TTC)</span>` : '';
      const prixDisp = i.pa
        ? `<span style="font-weight:600;color:var(--navy)">${i.pa.toLocaleString('fr-FR')} € HT</span>${ttcDisp}
           ${prix ? `<br><span class="text-sm">Jour : ${prix.unit.toFixed(2)} € HT</span>` : ''}`
        : '<span class="text-sm">—</span>';

      const tvaLabel = i.tva ? `${(i.tva * 100).toFixed(1).replace('.0', '')} %` : '—';

      return `<tr>
        <td style="font-weight:500;max-width:200px" class="truncate">${i.name}</td>
        <td><span class="badge bg-grey">${i.cat || 'Autre'}</span></td>
        <td>${prixDisp}</td>
        <td class="text-sm">${tvaLabel}</td>
        <td>${i.owned
          ? '<span class="badge bg-green"><i data-lucide="check-circle"></i> Possédé</span>'
          : '<span class="badge bg-gold"><i data-lucide="refresh-cw"></i> À acquérir</span>'}</td>
        <td class="text-sm truncate" style="max-width:160px">${i.notes || ''}</td>
        <td>
          <div class="flex gap-2">
            <button class="btn btn-ghost btn-xs btn-icon" onclick="Catalogue.openModal(${i.id})" title="Modifier"><i data-lucide="pencil"></i></button>
            <button class="btn btn-danger btn-xs btn-icon" onclick="Catalogue.del(${i.id})" title="Supprimer"><i data-lucide="trash-2"></i></button>
          </div>
        </td>
      </tr>`;
    }).join('');
    lucide.createIcons({ nodes: tbody.querySelectorAll('[data-lucide]') });
  }

  // ── Filtre ────────────────────────────────────────────────
  function filter() {
    const searchEl = document.getElementById('cat-search');
    _filSearch = searchEl ? searchEl.value.toLowerCase().trim() : '';
    _renderTable();
  }

  function setFilter(cat) {
    _filCat = cat;
    _buildChips();
    _renderTable();
  }

  // ── Modal ajout / modification ────────────────────────────
  function openModal(id) {
    fillCatSelect('m-mat-cat');
    const idEl    = document.getElementById('m-mat-id');
    const titleEl = document.getElementById('m-mat-title');
    const prevEl  = document.getElementById('m-mat-prev');

    if (idEl)    idEl.value = id || '';
    if (titleEl) titleEl.textContent = id ? 'Modifier le matériel' : 'Nouveau matériel';
    if (prevEl)  prevEl.style.display = 'none';

    if (id) {
      const item = db.cat.find(x => x.id === id);
      if (!item) return;
      _setVal('m-mat-nom',    item.name);
      _setVal('m-mat-cat',    item.cat);
      _setVal('m-mat-statut', item.owned ? 'owned' : 'future');
      _setVal('m-mat-tva',    item.tva != null ? String(item.tva) : '0');
      _setVal('m-mat-notes',  item.notes || '');
      _setVal('m-mat-pa-ht',  item.pa || '');
      _setVal('m-mat-pa-ttc', item.pa_ttc || '');
      // Si pa_ttc absent, recalculer
      if (item.pa && !item.pa_ttc) {
        const tva = item.tva || 0;
        _setVal('m-mat-pa-ttc', tva > 0 ? (item.pa * (1 + tva)).toFixed(2) : item.pa);
      }
      previewPrix();
    } else {
      ['m-mat-nom', 'm-mat-pa-ht', 'm-mat-pa-ttc', 'm-mat-notes'].forEach(x => _setVal(x, ''));
      _setVal('m-mat-statut', 'owned');
      _setVal('m-mat-tva', '0');
    }

    App.openModal('m-mat');
  }

  function previewPrix() {
    const pa  = parseFloat(_getVal('m-mat-pa-ht'));
    const el  = document.getElementById('m-mat-prev');
    if (!el) return;
    if (!pa || pa <= 0) { el.style.display = 'none'; return; }

    const tva = parseFloat(_getVal('m-mat-tva')) || 0;
    const durations = ['jour', 'weekend', 'semaine', '2s', '3s', 'mois'];
    const labels    = ['Jour', 'W-end', 'Semaine', '2 sem.', '3 sem.', 'Mois'];
    const parts = durations.map((d, i) => {
      const r = calc(pa, d, 1, tva);
      return r ? `<span style="white-space:nowrap"><strong>${labels[i]} :</strong> ${r.unit.toFixed(2)} € HT</span>` : '';
    }).filter(Boolean);

    el.style.display = 'block';
    el.innerHTML = '<strong>Tarifs calculés :</strong> ' + parts.join(' · ');
  }

  // ── Sauvegarder ───────────────────────────────────────────
  async function save() {
    const nom = _getVal('m-mat-nom').trim();
    if (!nom) { App.toast('Le nom est requis', 'err'); return; }

    const id   = parseInt(_getVal('m-mat-id')) || null;
    const tvaRaw = _getVal('m-mat-tva');
    const tvaVal = parseFloat(tvaRaw);
    const data = {
      name:   nom,
      pa:     parseFloat(_getVal('m-mat-pa-ht'))  || null,
      pa_ttc: parseFloat(_getVal('m-mat-pa-ttc')) || null,
      cat:    _getVal('m-mat-cat')                || 'Autre',
      owned:  _getVal('m-mat-statut') === 'owned',
      tva:    isNaN(tvaVal) ? 0 : tvaVal,
      notes:  _getVal('m-mat-notes').trim()
    };

    let item;
    if (id) {
      const idx = db.cat.findIndex(i => i.id === id);
      if (idx >= 0) { db.cat[idx] = { ...db.cat[idx], ...data }; item = db.cat[idx]; }
      else { App.toast('Matériel introuvable', 'err'); return; }
    } else {
      item = { ...data };
      db.cat.push(item);
    }

    try {
      await sbUpsertMat(item);
      App.closeModal('m-mat');
      render();
      App.updateBadges();
      App.toast('Matériel sauvegardé ✅', 'ok');
    } catch (err) {
      console.error('Erreur sauvegarde matériel:', err, 'Data envoyée:', JSON.stringify(data));
      App.toast('Erreur de sauvegarde : ' + (err.message || err), 'err');
    }
  }

  // ── Supprimer ─────────────────────────────────────────────
  async function del(id) {
    const item = db.cat.find(i => i.id === id);
    if (!item) return;
    if (!confirm(`Supprimer "${item.name}" ?`)) return;

    try {
      await sbDeleteMat(id);
      db.cat = db.cat.filter(i => i.id !== id);
      render();
      App.updateBadges();
      App.toast('Matériel supprimé', 'ok');
    } catch (err) {
      console.error(err);
      App.toast('Erreur de suppression', 'err');
    }
  }

  // ── Export CSV ────────────────────────────────────────────
  function exportCsv() {
    const headers = ['Nom', 'Catégorie', 'Prix achat (€)', 'TVA (%)', 'Statut', 'Prix jour (€)', 'Notes'];
    const rows = db.cat.map(i => {
      const pj = i.pa ? calc(i.pa, 'jour') : null;
      return [
        `"${i.name}"`,
        `"${i.cat || ''}"`,
        i.pa || '',
        i.tva ? (i.tva * 100) : 0,
        i.owned ? 'Possédé' : 'À acquérir',
        pj ? pj.unit.toFixed(2) : '',
        `"${(i.notes || '').replace(/"/g, '""')}"`
      ].join(',');
    });
    const csv  = [headers.join(','), ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = 'catalogue_lfe_' + today() + '.csv';
    a.click();
    App.toast('CSV exporté ✅', 'ok');
  }

  // ── Helpers privés ────────────────────────────────────────
  function _getVal(id) {
    const el = document.getElementById(id);
    return el ? el.value : '';
  }
  function _setVal(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val;
  }

  // ── Sync HT ↔ TTC ─────────────────────────────────────────
  function syncPrix(dir) {
    const tva = parseFloat(_getVal('m-mat-tva')) || 0;
    if (dir === 'ht') {
      const ht = parseFloat(_getVal('m-mat-pa-ht'));
      if (!isNaN(ht) && ht >= 0) {
        const ttc = tva > 0 ? (ht * (1 + tva)) : ht;
        _setVal('m-mat-pa-ttc', ttc.toFixed(2));
      }
    } else {
      const ttc = parseFloat(_getVal('m-mat-pa-ttc'));
      if (!isNaN(ttc) && ttc >= 0) {
        const ht = tva > 0 ? (ttc / (1 + tva)) : ttc;
        _setVal('m-mat-pa-ht', ht.toFixed(2));
      }
    }
    previewPrix();
  }

  function syncTVA() {
    const ht = parseFloat(_getVal('m-mat-pa-ht'));
    if (!isNaN(ht) && ht > 0) {
      const tva = parseFloat(_getVal('m-mat-tva')) || 0;
      const ttc = tva > 0 ? (ht * (1 + tva)) : ht;
      _setVal('m-mat-pa-ttc', ttc.toFixed(2));
    }
    previewPrix();
  }

  // ── API publique ──────────────────────────────────────────
  return { render, filter, setFilter, openModal, previewPrix, syncPrix, syncTVA, save, del, exportCsv };
})();
window.Catalogue = Catalogue;

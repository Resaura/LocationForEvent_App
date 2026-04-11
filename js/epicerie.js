// ═══════════════════════════════════════════════════════════════
// EPICERIE.JS — Gestion des produits alimentaires & consommables
// ═══════════════════════════════════════════════════════════════

// ─── SUPABASE HELPERS ────────────────────────────────────────
async function sbUpsertEpicerie(item) {
  if (item.id) {
    const { id, ...data } = item;
    const { error } = await sb.from('epicerie').update(data).eq('id', id);
    if (error) throw error;
  } else {
    const { id: _, ...data } = item;
    const { data: row, error } = await sb.from('epicerie').insert(data).select('id').single();
    if (error) throw error;
    item.id = row.id;
  }
}

async function sbDeleteEpicerie(id) {
  const { error } = await sb.from('epicerie').delete().eq('id', id);
  if (error) throw error;
}

// ─── PRODUITS PAR DÉFAUT ─────────────────────────────────────
const EPI_DEFAULTS = [
  { nom: 'Huile tournesol 5L',    prix: 8,    unite: 'bidon',  categorie: 'Huiles',       actif: true, conservation: 'Ambiant' },
  { nom: 'Sucre 1kg',             prix: 1.50, unite: 'kg',     categorie: 'Sucré',        actif: true, conservation: 'Sec' },
  { nom: 'Farine 1kg',            prix: 1.20, unite: 'kg',     categorie: 'Sucré',        actif: true, conservation: 'Sec' },
  { nom: 'Nutella 1kg',           prix: 6,    unite: 'pot',    categorie: 'Sucré',        actif: true, conservation: 'Ambiant' },
  { nom: 'Chocolat fondue 1kg',   prix: 5,    unite: 'kg',     categorie: 'Sucré',        actif: true, conservation: 'Ambiant' },
  { nom: 'Gobelets 50x',          prix: 3,    unite: 'paquet', categorie: 'Consommables', actif: true, conservation: 'Sec' },
  { nom: 'Assiettes carton 50x',  prix: 4,    unite: 'paquet', categorie: 'Consommables', actif: true, conservation: 'Sec' },
  { nom: 'Serviettes 100x',       prix: 2,    unite: 'paquet', categorie: 'Consommables', actif: true, conservation: 'Sec' },
];

// ─── CATÉGORIES ÉPICERIE ─────────────────────────────────────
const EPI_CATS = ['Toutes', 'Huiles', 'Sucré', 'Salé', 'Boissons', 'Consommables'];

// ─── CONSERVATION (couleurs badges) ──────────────────────────
const CONSERV = {
  Sec:       { col: '#6B7280', bg: '#F3F4F6' },
  Frais:     { col: '#059669', bg: '#D1FAE5' },
  'Surgelé': { col: '#1D4ED8', bg: '#DBEAFE' },
  Ambiant:   { col: '#D97706', bg: '#FEF3C7' },
};

// ─── MODULE ÉPICERIE ─────────────────────────────────────────
const Epicerie = (() => {
  let _editId    = null;
  let _filCat    = 'Toutes';
  let _search    = '';
  let _catSearch = '';

  // ── Rendu principal ──────────────────────────────────────
  function render() {
    _buildChips();
    _renderList();
    _renderCatList();
    _renderConsList();
  }

  // ── Chips catégorie ──────────────────────────────────────
  function _buildChips() {
    const el = document.getElementById('epi-chips');
    if (!el) return;
    // Catégories dynamiques : union des existantes + prédéfinies
    const usedCats = [...new Set(db.epicerie.map(p => p.categorie).filter(Boolean))];
    const configCats = db.epi_categories && db.epi_categories.length ? db.epi_categories : EPI_CATS.slice(1);
    const allCats  = ['Toutes', ...new Set([...configCats, ...usedCats])];
    const visCats  = _catSearch ? allCats.filter(c => c === 'Toutes' || c.toLowerCase().includes(_catSearch)) : allCats;
    el.innerHTML = visCats.map(c => {
      const active = c === _filCat ? ' on' : '';
      return `<button class="chip${active}" onclick="Epicerie.setFilter('${c}')">${c}</button>`;
    }).join('');
  }

  function setFilter(cat) {
    _filCat = cat;
    _buildChips();
    _renderList();
  }

  function filter() {
    const el = document.getElementById('epi-search');
    _search  = el ? el.value.toLowerCase().trim() : '';
    _renderList();
  }

  // ── Filtrage ─────────────────────────────────────────────
  function _filtered() {
    return db.epicerie.filter(p => {
      const matchCat = _filCat === 'Toutes' || p.categorie === _filCat;
      const matchCatSearch = !_catSearch || (p.categorie || '').toLowerCase().includes(_catSearch);
      const matchSearch = !_search
        || p.nom.toLowerCase().includes(_search)
        || (p.categorie || '').toLowerCase().includes(_search);
      return matchCat && matchCatSearch && matchSearch;
    });
  }

  // ── Rendu liste ──────────────────────────────────────────
  function _renderList() {
    const listEl  = document.getElementById('epi-list');
    const emptyEl = document.getElementById('epi-empty');
    if (!listEl) return;

    const items = _filtered();
    if (!items.length) {
      listEl.innerHTML = '';
      if (emptyEl) emptyEl.style.display = 'block';
      return;
    }
    if (emptyEl) emptyEl.style.display = 'none';

    listEl.innerHTML = items.map(p => {
      const activeBadge = p.actif
        ? '<span style="font-size:.68rem;background:#D1FAE5;color:#059669;padding:2px 7px;border-radius:99px;font-weight:600">Actif</span>'
        : '<span style="font-size:.68rem;background:#F3F4F6;color:#6B7280;padding:2px 7px;border-radius:99px;font-weight:600">Inactif</span>';
      const toggleLabel = p.actif ? 'Désactiver' : 'Activer';
      const toggleIcon  = p.actif ? '⏸️' : '▶️';
      const rowStyle = p.actif ? '' : 'opacity:.55';
      const cons = CONSERV[p.conservation] || CONSERV.Sec;
      const consBadge = `<span style="font-size:.66rem;background:${cons.bg};color:${cons.col};padding:2px 7px;border-radius:99px;font-weight:600">${p.conservation || 'Sec'}</span>`;

      return `<div class="card mb-2" style="${rowStyle}">
        <div class="card-hd" style="padding:10px 14px">
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
              <span style="font-size:.88rem;font-weight:600"><i data-lucide="shopping-cart"></i> ${p.nom}</span>
              ${activeBadge}
              ${consBadge}
              <span class="badge bg-grey" style="font-size:.66rem">${p.categorie || '—'}</span>
            </div>
            <div style="font-size:.78rem;color:var(--grey);margin-top:2px">
              ${p.prix.toFixed(2)} € HT${p.pa_ttc ? ` / ${p.pa_ttc.toFixed(2)} € TTC` : ''} / ${p.unite || 'unité'}${p.tva ? ` <span style="font-size:.68rem;color:var(--blue)">(TVA ${(p.tva*100).toFixed(1).replace('.0','')}%)</span>` : ''}
            </div>
          </div>
          <div class="btn-row" style="flex-shrink:0">
            <button class="btn btn-ghost btn-sm" onclick="Epicerie.openModal(${p.id})"><i data-lucide="pencil"></i></button>
            <button class="btn btn-ghost btn-sm" onclick="Epicerie.toggle(${p.id})">${toggleIcon} ${toggleLabel}</button>
            <button class="btn btn-danger btn-sm" onclick="Epicerie.del(${p.id})"><i data-lucide="trash-2"></i></button>
          </div>
        </div>
      </div>`;
    }).join('');
    lucide.createIcons({ nodes: listEl.querySelectorAll('[data-lucide]') });
  }

  // ── Remplissage dynamique des selects ────────────────────
  function _fillEpiCatSelect() {
    const sel = document.getElementById('m-epi-cat');
    if (!sel) return;
    const cats = db.epi_categories && db.epi_categories.length ? db.epi_categories : ['Huiles', 'Sucré', 'Salé', 'Boissons', 'Consommables'];
    sel.innerHTML = cats.map(c => `<option value="${c}">${c}</option>`).join('');
  }

  function _fillEpiConsSelect() {
    const sel = document.getElementById('m-epi-conserv');
    if (!sel) return;
    const cons = db.epi_conservations && db.epi_conservations.length ? db.epi_conservations : ['Sec', 'Frais', 'Surgelé', 'Ambiant'];
    sel.innerHTML = cons.map(c => `<option value="${c}">${c}</option>`).join('');
  }

  // ── Gestion des catégories ──────────────────────────────
  function _renderCatList() {
    const el = document.getElementById('epi-cat-list');
    if (!el) return;
    const cats = db.epi_categories || [];
    el.innerHTML = cats.map(c => `<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)">
      <span style="font-size:.85rem">${c}</span>
      <div class="btn-row">
        <button class="btn btn-ghost btn-sm" onclick="Epicerie.renameCat('${c.replace(/'/g, "\\'")}')">✏️</button>
        <button class="btn btn-danger btn-sm" onclick="Epicerie.delCat('${c.replace(/'/g, "\\'")}')">🗑️</button>
      </div>
    </div>`).join('');
  }

  async function _saveCats() {
    await sb.from('config').upsert({ key: 'epicerie_categories', value: JSON.stringify(db.epi_categories) }, { onConflict: 'key' });
  }

  async function addCat() {
    const input = document.getElementById('epi-new-cat');
    const name = input?.value?.trim();
    if (!name) return;
    if ((db.epi_categories || []).includes(name)) { App.toast('Cette catégorie existe déjà', 'warn'); return; }
    if (!db.epi_categories) db.epi_categories = [];
    db.epi_categories.push(name);
    input.value = '';
    try { await _saveCats(); render(); App.toast('Catégorie ajoutée ✅', 'ok'); }
    catch (e) { console.error(e); App.toast('Erreur', 'err'); }
  }

  async function renameCat(old) {
    const newName = prompt('Nouveau nom pour "' + old + '" :', old);
    if (!newName || newName.trim() === old) return;
    const trimmed = newName.trim();
    const idx = (db.epi_categories || []).indexOf(old);
    if (idx < 0) return;
    db.epi_categories[idx] = trimmed;
    // Mettre à jour les produits associés
    for (const p of db.epicerie.filter(x => x.categorie === old)) {
      p.categorie = trimmed;
      try { await sbUpsertEpicerie({ ...p }); } catch (e) { console.error(e); }
    }
    try { await _saveCats(); render(); App.toast('Catégorie renommée ✅', 'ok'); }
    catch (e) { console.error(e); App.toast('Erreur', 'err'); }
  }

  async function delCat(name) {
    if (!confirm(`Supprimer la catégorie "${name}" ?\nLes produits associés passeront en "Autre".`)) return;
    db.epi_categories = (db.epi_categories || []).filter(c => c !== name);
    for (const p of db.epicerie.filter(x => x.categorie === name)) {
      p.categorie = 'Autre';
      try { await sbUpsertEpicerie({ ...p }); } catch (e) { console.error(e); }
    }
    try { await _saveCats(); render(); App.toast('Catégorie supprimée', 'ok'); }
    catch (e) { console.error(e); App.toast('Erreur', 'err'); }
  }

  // ── Gestion des conservations ───────────────────────────
  function _renderConsList() {
    const el = document.getElementById('epi-cons-list');
    if (!el) return;
    const cons = db.epi_conservations || [];
    el.innerHTML = cons.map(c => `<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)">
      <span style="font-size:.85rem">${c}</span>
      <div class="btn-row">
        <button class="btn btn-ghost btn-sm" onclick="Epicerie.renameCons('${c.replace(/'/g, "\\'")}')">✏️</button>
        <button class="btn btn-danger btn-sm" onclick="Epicerie.delCons('${c.replace(/'/g, "\\'")}')">🗑️</button>
      </div>
    </div>`).join('');
  }

  async function _saveCons() {
    await sb.from('config').upsert({ key: 'epicerie_conservations', value: JSON.stringify(db.epi_conservations) }, { onConflict: 'key' });
  }

  async function addCons() {
    const input = document.getElementById('epi-new-cons');
    const name = input?.value?.trim();
    if (!name) return;
    if ((db.epi_conservations || []).includes(name)) { App.toast('Cette conservation existe déjà', 'warn'); return; }
    if (!db.epi_conservations) db.epi_conservations = [];
    db.epi_conservations.push(name);
    input.value = '';
    try { await _saveCons(); render(); App.toast('Conservation ajoutée ✅', 'ok'); }
    catch (e) { console.error(e); App.toast('Erreur', 'err'); }
  }

  async function renameCons(old) {
    const newName = prompt('Nouveau nom pour "' + old + '" :', old);
    if (!newName || newName.trim() === old) return;
    const trimmed = newName.trim();
    const idx = (db.epi_conservations || []).indexOf(old);
    if (idx < 0) return;
    db.epi_conservations[idx] = trimmed;
    for (const p of db.epicerie.filter(x => x.conservation === old)) {
      p.conservation = trimmed;
      try { await sbUpsertEpicerie({ ...p }); } catch (e) { console.error(e); }
    }
    try { await _saveCons(); render(); App.toast('Conservation renommée ✅', 'ok'); }
    catch (e) { console.error(e); App.toast('Erreur', 'err'); }
  }

  async function delCons(name) {
    if (!confirm(`Supprimer la conservation "${name}" ?\nLes produits associés passeront en "Autre".`)) return;
    db.epi_conservations = (db.epi_conservations || []).filter(c => c !== name);
    for (const p of db.epicerie.filter(x => x.conservation === name)) {
      p.conservation = 'Autre';
      try { await sbUpsertEpicerie({ ...p }); } catch (e) { console.error(e); }
    }
    try { await _saveCons(); render(); App.toast('Conservation supprimée', 'ok'); }
    catch (e) { console.error(e); App.toast('Erreur', 'err'); }
  }

  // ── Modale création / édition ─────────────────────────────
  function openModal(id = null) {
    _editId = id;
    _fillEpiCatSelect();
    _fillEpiConsSelect();
    const titleEl = document.getElementById('m-epi-title');
    const idEl    = document.getElementById('m-epi-id');
    const nomEl   = document.getElementById('m-epi-nom');
    const uniteEl = document.getElementById('m-epi-unite');
    const catEl   = document.getElementById('m-epi-cat');
    const actifEl = document.getElementById('m-epi-actif');
    const consEl  = document.getElementById('m-epi-conserv');

    const htEl  = document.getElementById('m-epi-prix-ht');
    const ttcEl = document.getElementById('m-epi-prix-ttc');

    if (id) {
      const p = db.epicerie.find(x => x.id === id);
      if (!p) return;
      if (titleEl) titleEl.textContent = 'Modifier le produit';
      if (idEl)    idEl.value    = id;
      if (nomEl)   nomEl.value   = p.nom || '';
      if (htEl)    htEl.value    = p.prix || '';
      if (ttcEl)   ttcEl.value   = p.pa_ttc || '';
      if (uniteEl) uniteEl.value = p.unite || 'unité';
      if (catEl)   catEl.value   = p.categorie || 'Consommables';
      if (consEl)  consEl.value  = p.conservation || 'Sec';
      const tvaEl = document.getElementById('m-epi-tva');
      if (tvaEl)   tvaEl.value  = p.tva != null ? String(p.tva) : '0.055';
      if (actifEl) actifEl.checked = p.actif !== false;
      // Si pa_ttc absent, recalculer
      if (p.prix && !p.pa_ttc && ttcEl) {
        const tva = p.tva || 0;
        ttcEl.value = tva > 0 ? (p.prix * (1 + tva)).toFixed(2) : p.prix;
      }
    } else {
      if (titleEl) titleEl.textContent = 'Nouveau produit';
      if (idEl)    idEl.value    = '';
      if (nomEl)   nomEl.value   = '';
      if (htEl)    htEl.value    = '';
      if (ttcEl)   ttcEl.value   = '';
      if (uniteEl) uniteEl.value = 'unité';
      if (catEl)   catEl.value   = 'Consommables';
      if (consEl)  consEl.value  = 'Sec';
      const tvaEl = document.getElementById('m-epi-tva');
      if (tvaEl)   tvaEl.value  = '0.055';
      if (actifEl) actifEl.checked = true;
    }

    App.openModal('m-epi');
  }

  // ── Enregistrer ───────────────────────────────────────────
  async function save() {
    const nom = document.getElementById('m-epi-nom')?.value?.trim();
    if (!nom) { App.toast('Le nom est requis', 'err'); return; }

    const item = {
      nom,
      prix:         parseFloat(document.getElementById('m-epi-prix-ht')?.value) || 0,
      pa_ttc:     parseFloat(document.getElementById('m-epi-prix-ttc')?.value) || 0,
      unite:        document.getElementById('m-epi-unite')?.value?.trim() || 'unité',
      categorie:    document.getElementById('m-epi-cat')?.value || 'Consommables',
      conservation: document.getElementById('m-epi-conserv')?.value || 'Sec',
      tva:          parseFloat(document.getElementById('m-epi-tva')?.value) || 0,
      actif:        document.getElementById('m-epi-actif')?.checked ?? true,
    };

    const id = parseInt(document.getElementById('m-epi-id')?.value);
    if (id) item.id = id;

    try {
      await sbUpsertEpicerie(item);

      if (id) {
        const idx = db.epicerie.findIndex(x => x.id === id);
        if (idx >= 0) db.epicerie[idx] = item;
      } else {
        db.epicerie.push(item);
      }

      App.closeModal('m-epi');
      render();
      App.toast('Produit enregistré ✅', 'ok');
    } catch (err) {
      console.error(err);
      App.toast('Erreur lors de la sauvegarde', 'err');
    }
  }

  // ── Activer / Désactiver ──────────────────────────────────
  async function toggle(id) {
    const p = db.epicerie.find(x => x.id === id);
    if (!p) return;
    p.actif = !p.actif;
    _renderList();
    try {
      await sbUpsertEpicerie({ ...p });
      App.toast(p.actif ? 'Produit activé' : 'Produit désactivé', 'ok');
    } catch (err) {
      console.error(err);
      p.actif = !p.actif;
      _renderList();
      App.toast('Erreur', 'err');
    }
  }

  // ── Supprimer ─────────────────────────────────────────────
  async function del(id) {
    const p = db.epicerie.find(x => x.id === id);
    if (!p || !confirm(`Supprimer "${p.nom}" ?`)) return;
    try {
      await sbDeleteEpicerie(id);
      db.epicerie = db.epicerie.filter(x => x.id !== id);
      _renderList();
      App.toast('Produit supprimé', 'ok');
    } catch (err) {
      console.error(err);
      App.toast('Erreur lors de la suppression', 'err');
    }
  }

  // ── Seeder les produits par défaut ────────────────────────
  async function seedDefaults() {
    for (const item of EPI_DEFAULTS) {
      const p = { ...item };
      await sbUpsertEpicerie(p);
      db.epicerie.push(p);
    }
    _renderList();
  }

  // ── Sync HT ↔ TTC ─────────────────────────────────────────
  function syncPrix(dir) {
    const tva = parseFloat(document.getElementById('m-epi-tva')?.value) || 0;
    if (dir === 'ht') {
      const ht = parseFloat(document.getElementById('m-epi-prix-ht')?.value);
      if (!isNaN(ht) && ht >= 0) {
        const ttc = tva > 0 ? (ht * (1 + tva)) : ht;
        const el = document.getElementById('m-epi-prix-ttc');
        if (el) el.value = ttc.toFixed(2);
      }
    } else {
      const ttc = parseFloat(document.getElementById('m-epi-prix-ttc')?.value);
      if (!isNaN(ttc) && ttc >= 0) {
        const ht = tva > 0 ? (ttc / (1 + tva)) : ttc;
        const el = document.getElementById('m-epi-prix-ht');
        if (el) el.value = ht.toFixed(2);
      }
    }
  }

  function syncTVA() {
    const ht = parseFloat(document.getElementById('m-epi-prix-ht')?.value);
    if (!isNaN(ht) && ht > 0) {
      const tva = parseFloat(document.getElementById('m-epi-tva')?.value) || 0;
      const ttc = tva > 0 ? (ht * (1 + tva)) : ht;
      const el = document.getElementById('m-epi-prix-ttc');
      if (el) el.value = ttc.toFixed(2);
    }
  }

  function filterCats() {
    const el = document.getElementById('epi-cat-search');
    _catSearch = el ? el.value.toLowerCase().trim() : '';
    _buildChips();
    _renderList();
  }

  return { render, openModal, save, del, toggle, setFilter, filter, filterCats, syncPrix, syncTVA, seedDefaults, addCat, renameCat, delCat, addCons, renameCons, delCons };
})();
window.Epicerie = Epicerie;

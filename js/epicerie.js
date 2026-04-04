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
  let _editId  = null;
  let _filCat  = 'Toutes';
  let _search  = '';

  // ── Rendu principal ──────────────────────────────────────
  function render() {
    _buildChips();
    _renderList();
  }

  // ── Chips catégorie ──────────────────────────────────────
  function _buildChips() {
    const el = document.getElementById('epi-chips');
    if (!el) return;
    // Catégories dynamiques : union des existantes + prédéfinies
    const usedCats = [...new Set(db.epicerie.map(p => p.categorie).filter(Boolean))];
    const allCats  = ['Toutes', ...new Set([...EPI_CATS.slice(1), ...usedCats])];
    el.innerHTML = allCats.map(c => {
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
      const matchSearch = !_search
        || p.nom.toLowerCase().includes(_search)
        || (p.categorie || '').toLowerCase().includes(_search);
      return matchCat && matchSearch;
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
              ${p.prix.toFixed(2)} € / ${p.unite || 'unité'}${p.tva ? ` <span style="font-size:.68rem;color:var(--blue)">(TVA ${(p.tva*100).toFixed(1).replace('.0','')}%)</span>` : ''}
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

  // ── Modale création / édition ─────────────────────────────
  function openModal(id = null) {
    _editId = id;
    const titleEl = document.getElementById('m-epi-title');
    const idEl    = document.getElementById('m-epi-id');
    const nomEl   = document.getElementById('m-epi-nom');
    const prixEl  = document.getElementById('m-epi-prix');
    const uniteEl = document.getElementById('m-epi-unite');
    const catEl   = document.getElementById('m-epi-cat');
    const actifEl = document.getElementById('m-epi-actif');
    const consEl  = document.getElementById('m-epi-conserv');

    if (id) {
      const p = db.epicerie.find(x => x.id === id);
      if (!p) return;
      if (titleEl) titleEl.textContent = 'Modifier le produit';
      if (idEl)    idEl.value    = id;
      if (nomEl)   nomEl.value   = p.nom || '';
      if (prixEl)  prixEl.value  = p.prix || '';
      if (uniteEl) uniteEl.value = p.unite || 'unité';
      if (catEl)   catEl.value   = p.categorie || 'Consommables';
      if (consEl)  consEl.value  = p.conservation || 'Sec';
      const tvaEl = document.getElementById('m-epi-tva');
      if (tvaEl)   tvaEl.value  = p.tva != null ? String(p.tva) : '0.055';
      if (actifEl) actifEl.checked = p.actif !== false;
    } else {
      if (titleEl) titleEl.textContent = 'Nouveau produit';
      if (idEl)    idEl.value    = '';
      if (nomEl)   nomEl.value   = '';
      if (prixEl)  prixEl.value  = '';
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
      prix:         parseFloat(document.getElementById('m-epi-prix')?.value) || 0,
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

  return { render, openModal, save, del, toggle, setFilter, filter, seedDefaults };
})();
window.Epicerie = Epicerie;

// ═══════════════════════════════════════════════════════════════
// CATEGORIES.JS — Gestion des catégories
// ═══════════════════════════════════════════════════════════════

const Categories = (() => {

  // ── Rendu principal ────────────────────────────────────────
  function render() {
    _renderList();
    _renderStats();
  }

  function _renderList() {
    const el = document.getElementById('cat-list-mgr');
    if (!el) return;
    const cats = db.categories || [];
    if (!cats.length) {
      el.innerHTML = '<div class="empty"><p>Aucune catégorie</p></div>';
      return;
    }
    el.innerHTML = cats.map(c => `
      <div class="flex jb items-c" style="padding:9px 0;border-bottom:1px solid var(--border)">
        <span style="font-weight:500">${c}</span>
        <div class="flex gap-2">
          <button class="btn btn-ghost btn-xs" onclick="Categories.openRenameModal('${_esc(c)}')">✏️</button>
          <button class="btn btn-danger btn-xs" onclick="Categories.del('${_esc(c)}')">🗑️</button>
        </div>
      </div>`).join('');
  }

  function _renderStats() {
    const el = document.getElementById('cat-stats-bd');
    if (!el) return;
    const cats = db.categories || [];
    if (!cats.length) { el.innerHTML = ''; return; }
    el.innerHTML = cats.map(c => {
      const total  = db.cat.filter(i => i.cat === c).length;
      const owned  = db.cat.filter(i => i.cat === c && i.owned).length;
      return `<div class="flex jb items-c" style="padding:9px 0;border-bottom:1px solid var(--border);font-size:.84rem">
        <span class="badge bg-grey">${c}</span>
        <span class="text-sm">${owned} possédé${owned > 1 ? 's' : ''} / ${total} total</span>
      </div>`;
    }).join('');
  }

  // ── Ajouter ────────────────────────────────────────────────
  async function add() {
    const input = document.getElementById('new-cat-input');
    const val   = input ? input.value.trim() : '';
    if (!val) return;
    if (!db.categories) db.categories = [];
    if (db.categories.includes(val)) { App.toast('Cette catégorie existe déjà', 'warn'); return; }

    db.categories.push(val);
    try {
      await sbSaveCats(db.categories);
      if (input) input.value = '';
      render();
      App.toast('Catégorie ajoutée ✅', 'ok');
    } catch (err) {
      db.categories.pop();
      console.error(err);
      App.toast('Erreur de sauvegarde', 'err');
    }
  }

  // ── Supprimer ─────────────────────────────────────────────
  async function del(cat) {
    if (!confirm(`Supprimer "${cat}" ? Le matériel associé sera mis en "Autre".`)) return;

    const affected = db.cat.filter(i => i.cat === cat);
    affected.forEach(i => (i.cat = 'Autre'));
    db.categories = (db.categories || []).filter(c => c !== cat);

    try {
      await Promise.all([
        sbSaveCats(db.categories),
        ...affected.map(i => sbUpsertMat(i))
      ]);
      render();
      if (typeof Catalogue !== 'undefined') Catalogue.render();
      App.toast('Catégorie supprimée', 'ok');
    } catch (err) {
      console.error(err);
      App.toast('Erreur de sauvegarde', 'err');
    }
  }

  // ── Renommer ──────────────────────────────────────────────
  function openRenameModal(cat) {
    const oldEl = document.getElementById('ren-cat-old');
    const newEl = document.getElementById('ren-cat-new');
    if (oldEl) oldEl.value = cat;
    if (newEl) newEl.value = cat;
    App.openModal('m-cat-ren');
    setTimeout(() => newEl && newEl.select(), 100);
  }

  async function rename() {
    const old = (document.getElementById('ren-cat-old')?.value || '').trim();
    const nv  = (document.getElementById('ren-cat-new')?.value || '').trim();
    if (!nv || nv === old) { App.closeModal('m-cat-ren'); return; }
    if (db.categories.includes(nv)) { App.toast('Ce nom existe déjà', 'warn'); return; }

    const affected = db.cat.filter(i => i.cat === old);
    affected.forEach(i => (i.cat = nv));
    const idx = (db.categories || []).indexOf(old);
    if (idx >= 0) db.categories[idx] = nv;

    try {
      await Promise.all([
        sbSaveCats(db.categories),
        ...affected.map(i => sbUpsertMat(i))
      ]);
      App.closeModal('m-cat-ren');
      render();
      if (typeof Catalogue !== 'undefined') Catalogue.render();
      App.toast('Catégorie renommée ✅', 'ok');
    } catch (err) {
      console.error(err);
      App.toast('Erreur de sauvegarde', 'err');
    }
  }

  // ── Helper ─────────────────────────────────────────────────
  function _esc(str) { return str.replace(/'/g, "\\'"); }

  return { render, add, del, openRenameModal, rename };
})();
window.Categories = Categories;

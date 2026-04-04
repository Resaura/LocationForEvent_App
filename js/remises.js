// ═══════════════════════════════════════════════════════════════
// REMISES.JS — Gestion des remises (CRUD + Paramètres)
// ═══════════════════════════════════════════════════════════════

// ── Fonctions Supabase ─────────────────────────────────────────
async function sbSaveRemise(r) {
  if (r.id) {
    const { id, ...data } = r;
    const { error } = await sb.from('remises').update(data).eq('id', id);
    if (error) throw error;
  } else {
    const { id: _, ...data } = r;
    const { data: row, error } = await sb.from('remises').insert(data).select('id').single();
    if (error) throw error;
    r.id = row.id;
  }
}

async function sbDeleteRemise(id) {
  const { error } = await sb.from('remises').delete().eq('id', id);
  if (error) throw error;
}

// ── Defaults ───────────────────────────────────────────────────
const REMISE_DEFAULTS = [
  { nom: 'Remise professionnel', type: 'pourcentage', valeur: 10, description: 'Tarif pro', actif: true },
  { nom: 'Remise fidélité',     type: 'pourcentage', valeur: 5,  description: 'Client fidèle', actif: true },
  { nom: 'Pack location',       type: 'pourcentage', valeur: 15, description: 'Location multi-matériel', actif: true },
  { nom: 'Remise association',  type: 'pourcentage', valeur: 8,  description: 'Tarif associatif', actif: true },
];

// ── Module Remises ─────────────────────────────────────────────
const Remises = (() => {

  // ── Seed defaults si table vide ─────────────────────────────
  async function seedDefaults() {
    for (const r of REMISE_DEFAULTS) {
      const copy = { ...r };
      await sbSaveRemise(copy);
      db.remises.push(copy);
    }
  }

  // ── Rendu dans la page Paramètres ───────────────────────────
  function renderList() {
    const el = document.getElementById('p-remises-list');
    if (!el) return;

    if (!db.remises.length) {
      el.innerHTML = '<div style="padding:10px;color:var(--grey);font-size:.82rem">Aucune remise configurée</div>';
      return;
    }

    el.innerHTML = db.remises.map(r => {
      const val = r.type === 'pourcentage' ? `${r.valeur}%` : `${r.valeur.toFixed(2)} €`;
      const badge = r.actif
        ? '<span style="font-size:.65rem;padding:2px 7px;border-radius:99px;background:#D1FAE5;color:#059669;font-weight:600">Actif</span>'
        : '<span style="font-size:.65rem;padding:2px 7px;border-radius:99px;background:#F3F4F6;color:#6B7280;font-weight:600">Inactif</span>';
      return `<div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--border)">
        <span style="flex:1;font-size:.84rem">
          <strong>${r.nom}</strong>
          <span style="color:var(--grey);font-size:.78rem;margin-left:4px">${val}</span>
          ${badge}
        </span>
        <button class="btn btn-ghost btn-sm" onclick="Remises.toggle(${r.id})" style="padding:2px 8px;font-size:.72rem">${r.actif ? '<i data-lucide="pause"></i>' : '<i data-lucide="play"></i>'}</button>
        <button class="btn btn-ghost btn-sm" onclick="Remises.openModal(${r.id})" style="padding:2px 8px;font-size:.72rem"><i data-lucide="pencil"></i></button>
        <button class="btn btn-danger btn-sm" onclick="Remises.del(${r.id})" style="padding:2px 8px;font-size:.72rem"><i data-lucide="trash-2"></i></button>
      </div>`;
    }).join('');
    lucide.createIcons({ nodes: el.querySelectorAll('[data-lucide]') });
  }

  // ── Modale création / édition ───────────────────────────────
  function openModal(id) {
    const titleEl = document.getElementById('m-rem-title');
    const setVal = (elId, v) => { const el = document.getElementById(elId); if (el) el.value = v; };

    setVal('m-rem-id', id || '');

    if (id) {
      const r = db.remises.find(x => x.id === id);
      if (!r) return;
      if (titleEl) titleEl.textContent = 'Modifier la remise';
      setVal('m-rem-nom',   r.nom);
      setVal('m-rem-type',  r.type || 'pourcentage');
      setVal('m-rem-val',   r.valeur);
      setVal('m-rem-desc',  r.description || '');
    } else {
      if (titleEl) titleEl.textContent = 'Nouvelle remise';
      ['m-rem-nom','m-rem-desc'].forEach(x => setVal(x, ''));
      setVal('m-rem-type', 'pourcentage');
      setVal('m-rem-val', '');
    }
    App.openModal('m-rem');
  }

  // ── Sauvegarder ─────────────────────────────────────────────
  async function save() {
    const getVal = id => { const el = document.getElementById(id); return el ? el.value : ''; };
    const nom = getVal('m-rem-nom').trim();
    if (!nom) { App.toast('Le nom est requis', 'err'); return; }

    const valeur = parseFloat(getVal('m-rem-val'));
    if (isNaN(valeur) || valeur <= 0) { App.toast('Valeur invalide', 'err'); return; }

    const id   = parseInt(getVal('m-rem-id')) || null;
    const data = {
      nom,
      type:        getVal('m-rem-type') || 'pourcentage',
      valeur,
      description: getVal('m-rem-desc'),
      actif:       true,
    };

    let r;
    if (id) {
      const idx = db.remises.findIndex(x => x.id === id);
      if (idx >= 0) {
        db.remises[idx] = { ...db.remises[idx], ...data };
        r = db.remises[idx];
      }
    } else {
      r = { ...data };
      db.remises.push(r);
    }

    try {
      await sbSaveRemise(r);
      App.closeModal('m-rem');
      renderList();
      App.toast('Remise sauvegardée ✅', 'ok');
    } catch (err) {
      console.error(err);
      App.toast('Erreur de sauvegarde', 'err');
    }
  }

  // ── Toggle actif / inactif ──────────────────────────────────
  async function toggle(id) {
    const r = db.remises.find(x => x.id === id);
    if (!r) return;
    r.actif = !r.actif;
    try {
      await sbSaveRemise(r);
      renderList();
      App.toast(r.actif ? 'Remise activée' : 'Remise désactivée', 'ok');
    } catch (err) {
      console.error(err);
      App.toast('Erreur', 'err');
    }
  }

  // ── Supprimer ───────────────────────────────────────────────
  async function del(id) {
    const r = db.remises.find(x => x.id === id);
    if (!r || !confirm(`Supprimer la remise "${r.nom}" ?`)) return;
    try {
      await sbDeleteRemise(id);
      db.remises = db.remises.filter(x => x.id !== id);
      renderList();
      App.toast('Remise supprimée', 'ok');
    } catch (err) {
      console.error(err);
      App.toast('Erreur', 'err');
    }
  }

  return { renderList, openModal, save, del, toggle, seedDefaults };
})();
window.Remises = Remises;

// ═══════════════════════════════════════════════════════════════
// SERVICES.JS — Gestion des prestations facturables
// ═══════════════════════════════════════════════════════════════

// ─── SUPABASE HELPERS ────────────────────────────────────────
async function sbUpsertService(svc) {
  if (svc.id) {
    const { id, ...data } = svc;
    const { error } = await sb.from('services').update(data).eq('id', id);
    if (error) throw error;
  } else {
    const { id: _, ...data } = svc;
    const { data: row, error } = await sb.from('services').insert(data).select('id').single();
    if (error) throw error;
    svc.id = row.id;
  }
}

async function sbDeleteService(id) {
  const { error } = await sb.from('services').delete().eq('id', id);
  if (error) throw error;
}

// ─── SERVICES PAR DÉFAUT ─────────────────────────────────────
const SVC_DEFAULTS = [
  {
    nom: 'Installation barnum',
    description: 'Livraison et installation complète d\'un barnum',
    options: [
      { nom: 'Livraison',  prix: 150, type: 'fixe',   obligatoire: true  },
      { nom: 'Montage',    prix: 0,   type: 'inclus',  obligatoire: true  },
      { nom: 'Démontage',  prix: 0,   type: 'inclus',  obligatoire: false },
    ]
  },
  {
    nom: 'Livraison simple',
    description: 'Transport du matériel sur site',
    options: [
      { nom: 'Livraison', prix: 1.5, type: 'par_km', obligatoire: true },
    ]
  },
  {
    nom: 'Récupération huile',
    description: 'Collecte et traitement des huiles usagées',
    options: [
      { nom: 'Récupération huile', prix: 30, type: 'fixe', obligatoire: true },
    ]
  },
  {
    nom: 'Retour machine sale',
    description: 'Forfait nettoyage pour machine retournée sale',
    options: [
      { nom: 'Nettoyage machine', prix: 25, type: 'fixe', obligatoire: true },
    ]
  },
  {
    nom: 'Assurance événement',
    description: 'Couverture assurance pour l\'événement',
    options: [
      { nom: 'Assurance', prix: 50, type: 'fixe', obligatoire: false },
    ]
  },
];

// ─── MODULE SERVICES ─────────────────────────────────────────
const Services = (() => {
  let _editId = null;
  let _optKey = 0; // clé unique pour chaque ligne d'option dans la modale

  // Labels types d'option
  const TYPE_LABELS = {
    fixe:      'Fixe',
    par_km:    '/km',
    inclus:    'Inclus',
    sur_devis: 'Sur devis',
  };

  // ── Rendu principal ──────────────────────────────────────
  function render() {
    _renderList();
  }

  function _renderList() {
    const listEl  = document.getElementById('svc-list');
    const emptyEl = document.getElementById('svc-empty');
    if (!listEl) return;

    if (!db.services?.length) {
      listEl.innerHTML = '';
      if (emptyEl) emptyEl.style.display = 'block';
      return;
    }
    if (emptyEl) emptyEl.style.display = 'none';

    listEl.innerHTML = db.services.map(s => {
      const opts = (s.options || []);
      const optsHtml = opts.map(o => {
        const priceLabel = o.type === 'inclus'   ? 'Inclus'
                         : o.type === 'sur_devis' ? 'Sur devis'
                         : o.type === 'par_km'    ? `${o.prix} €/km`
                         :                          `${(o.prix || 0).toFixed(2)} €`;
        const obligBadge = o.obligatoire
          ? `<span style="font-size:.6rem;background:#DBEAFE;color:#1D4ED8;padding:1px 5px;border-radius:4px;font-weight:600">Oblig.</span>`
          : '';
        return `<div style="display:flex;align-items:center;gap:6px;padding:4px 0;border-bottom:1px solid var(--border)">
          <span style="flex:1;font-size:.8rem">${o.nom}</span>
          <span style="font-size:.78rem;color:var(--grey)">${priceLabel}</span>
          <span style="font-size:.75rem;color:var(--text3);background:var(--bg);padding:1px 6px;border-radius:4px">${TYPE_LABELS[o.type] || o.type}</span>
          ${obligBadge}
        </div>`;
      }).join('');

      return `<div class="card mb-3">
        <div class="card-hd">
          <div>
            <div class="card-title" style="font-size:.88rem"><i data-lucide="wrench"></i> ${s.nom}${s.tva ? ` <span style="font-size:.68rem;color:var(--blue);font-weight:400">(TVA ${(s.tva*100).toFixed(1).replace('.0','')}%)</span>` : ''}</div>
            ${s.description ? `<div style="font-size:.75rem;color:var(--grey);margin-top:2px">${s.description}</div>` : ''}
          </div>
          <div class="btn-row">
            <button class="btn btn-ghost btn-sm" onclick="Services.openModal(${s.id})"><i data-lucide="pencil"></i> Modifier</button>
            <button class="btn btn-danger btn-sm" onclick="Services.del(${s.id})"><i data-lucide="trash-2"></i></button>
          </div>
        </div>
        ${opts.length ? `<div class="card-bd no-top" style="padding-top:4px">${optsHtml}</div>` : ''}
      </div>`;
    }).join('');
    lucide.createIcons({ nodes: listEl.querySelectorAll('[data-lucide]') });
  }

  // ── Modale création / édition ─────────────────────────────
  function openModal(id = null) {
    _editId = id;
    _optKey = 0;

    // Vider options
    const optsEl = document.getElementById('m-svc-options');
    if (optsEl) optsEl.innerHTML = '';

    const titleEl = document.getElementById('m-svc-title');
    const idEl    = document.getElementById('m-svc-id');
    const nomEl   = document.getElementById('m-svc-nom');
    const descEl  = document.getElementById('m-svc-desc');

    if (id) {
      const svc = db.services.find(s => s.id === id);
      if (!svc) return;
      if (titleEl) titleEl.textContent = 'Modifier le service';
      if (idEl)   idEl.value  = id;
      if (nomEl)  nomEl.value = svc.nom || '';
      if (descEl) descEl.value = svc.description || '';
      const tvaEl = document.getElementById('m-svc-tva');
      if (tvaEl) tvaEl.value = svc.tva != null ? String(svc.tva) : '0.20';
      (svc.options || []).forEach(opt => addOption(opt));
    } else {
      if (titleEl) titleEl.textContent = 'Nouveau service';
      if (idEl)   idEl.value  = '';
      if (nomEl)  nomEl.value = '';
      if (descEl) descEl.value = '';
      const tvaEl = document.getElementById('m-svc-tva');
      if (tvaEl) tvaEl.value = '0.20';
    }

    App.openModal('m-svc');
    setTimeout(() => syncTVA(), 50);
  }

  // ── Ajouter une ligne d'option dans la modale ─────────────
  function addOption(prefill = null) {
    const key   = ++_optKey;
    const nom   = prefill?.nom   || '';
    const prix  = prefill?.prix  ?? 0;
    const type  = prefill?.type  || 'fixe';
    const oblig = prefill?.obligatoire || false;

    const row = document.createElement('div');
    row.className  = 'svc-opt-row';
    row.dataset.key = key;
    row.style.cssText = [
      'display:grid',
      'grid-template-columns:1fr 80px 110px auto auto',
      'gap:6px',
      'align-items:center',
      'margin-bottom:8px',
    ].join(';');

    row.innerHTML = `
      <input class="svc-opt-nom" type="text" placeholder="Nom de l'option" value="${nom}"
             style="padding:6px 10px;border:1px solid var(--border);border-radius:var(--r-sm);font-size:.82rem;width:100%">
      <input class="svc-opt-prix" type="number" placeholder="0" value="${prix}" step="0.01" min="0"
             style="padding:6px 8px;border:1px solid var(--border);border-radius:var(--r-sm);font-size:.82rem;width:100%">
      <select class="svc-opt-type"
              style="padding:6px 8px;border:1px solid var(--border);border-radius:var(--r-sm);font-size:.82rem;width:100%">
        <option value="fixe"      ${type==='fixe'?'selected':''}>Fixe (€)</option>
        <option value="par_km"    ${type==='par_km'?'selected':''}>Par km</option>
        <option value="inclus"    ${type==='inclus'?'selected':''}>Inclus (0€)</option>
        <option value="sur_devis" ${type==='sur_devis'?'selected':''}>Sur devis</option>
      </select>
      <label style="display:flex;align-items:center;gap:4px;font-size:.78rem;white-space:nowrap;cursor:pointer">
        <input class="svc-opt-oblig" type="checkbox" ${oblig ? 'checked' : ''}>
        Oblig.
      </label>
      <button onclick="Services.removeOption(${key})"
              style="padding:5px 9px;border:1px solid var(--border);border-radius:var(--r-sm);background:#fff;cursor:pointer;font-size:.78rem;color:var(--red)"><i data-lucide="x"></i></button>`;
    lucide.createIcons({ nodes: row.querySelectorAll('[data-lucide]') });

    const container = document.getElementById('m-svc-options');
    if (container) container.appendChild(row);
  }

  // ── Supprimer une ligne d'option ──────────────────────────
  function removeOption(key) {
    const row = document.querySelector(`#m-svc-options [data-key="${key}"]`);
    if (row) row.remove();
  }

  // ── Lire les options depuis la modale ─────────────────────
  function _readOpts() {
    return Array.from(document.querySelectorAll('#m-svc-options .svc-opt-row'))
      .map(row => ({
        nom:         row.querySelector('.svc-opt-nom')?.value?.trim()   || '',
        prix:        parseFloat(row.querySelector('.svc-opt-prix')?.value) || 0,
        type:        row.querySelector('.svc-opt-type')?.value           || 'fixe',
        obligatoire: row.querySelector('.svc-opt-oblig')?.checked        || false,
      }))
      .filter(o => o.nom);
  }

  // ── Enregistrer ───────────────────────────────────────────
  async function save() {
    const nom = document.getElementById('m-svc-nom')?.value?.trim();
    if (!nom) { App.toast('Le nom est requis', 'err'); return; }

    const svc = {
      nom,
      description: document.getElementById('m-svc-desc')?.value?.trim() || '',
      tva:         parseFloat(document.getElementById('m-svc-tva')?.value) || 0,
      options:     _readOpts(),
    };

    const id = parseInt(document.getElementById('m-svc-id')?.value);
    if (id) svc.id = id;

    try {
      await sbUpsertService(svc);

      if (id) {
        const idx = db.services.findIndex(s => s.id === id);
        if (idx >= 0) db.services[idx] = svc;
      } else {
        db.services.push(svc);
      }

      App.closeModal('m-svc');
      _renderList();

      // Rafraîchir le picker dans le formulaire devis si visible
      if (typeof Devis !== 'undefined') Devis.renderServicePicker();

      App.toast('Service enregistré ✅', 'ok');
    } catch (err) {
      console.error(err);
      App.toast('Erreur lors de la sauvegarde', 'err');
    }
  }

  // ── Supprimer un service ──────────────────────────────────
  async function del(id) {
    const svc = db.services.find(s => s.id === id);
    if (!svc || !confirm(`Supprimer le service "${svc.nom}" ?`)) return;
    try {
      await sbDeleteService(id);
      db.services = db.services.filter(s => s.id !== id);
      _renderList();
      if (typeof Devis !== 'undefined') Devis.renderServicePicker();
      App.toast('Service supprimé', 'ok');
    } catch (err) {
      console.error(err);
      App.toast('Erreur lors de la suppression', 'err');
    }
  }

  // ── Seeder les services par défaut ────────────────────────
  async function seedDefaults() {
    for (const svc of SVC_DEFAULTS) {
      const s = { ...svc };
      await sbUpsertService(s);
      db.services.push(s);
    }
    _renderList();
  }

  // ── Sync TVA — affiche conversion HT↔TTC ──────────────────
  function syncTVA() {
    const tva  = parseFloat(document.getElementById('m-svc-tva')?.value) || 0;
    const conv = document.getElementById('m-svc-conv');
    if (!conv) return;
    const opts = _readOpts();
    const totalFixe = opts.filter(o => o.type === 'fixe').reduce((s, o) => s + o.prix, 0);
    if (!totalFixe || !tva) {
      conv.textContent = !tva ? 'Pas de TVA appliquée' : '';
      return;
    }
    conv.textContent = `Total options fixes : ${totalFixe.toFixed(2)} € HT = ${(totalFixe * (1 + tva)).toFixed(2)} € TTC`;
  }

  return { render, openModal, addOption, removeOption, syncTVA, save, del, seedDefaults };
})();
window.Services = Services;

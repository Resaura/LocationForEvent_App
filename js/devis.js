// ═══════════════════════════════════════════════════════════════
// DEVIS.JS — Création / édition de devis + Historique
// ═══════════════════════════════════════════════════════════════

// ─── STATUTS ─────────────────────────────────────────────────
const STATUTS = {
  brouillon:    { label: 'Brouillon',  col: '#6B7280', bg: '#F3F4F6' },
  'envoyé':     { label: 'Envoyé',     col: '#1D4ED8', bg: '#DBEAFE' },
  'à relancer': { label: 'À relancer', col: '#D97706', bg: '#FEF3C7' },
  'accepté':    { label: 'Accepté',    col: '#059669', bg: '#D1FAE5' },
  'refusé':     { label: 'Refusé',     col: '#DC2626', bg: '#FEE2E2' },
  'expiré':     { label: 'Expiré',     col: '#7F1D1D', bg: '#FCA5A5' },
};

function statutBadge(statut) {
  const s = STATUTS[statut] || STATUTS.brouillon;
  return `<span style="display:inline-block;padding:2px 9px;border-radius:99px;font-size:.7rem;font-weight:600;color:${s.col};background:${s.bg};vertical-align:middle">${s.label}</span>`;
}

function needsRelance(d) {
  if (d.statut === 'à relancer') return true;
  if (d.statut === 'envoyé') {
    const dvDate = new Date(d.date);
    if (isNaN(dvDate.getTime())) return false;
    return (Date.now() - dvDate.getTime()) / 864e5 > 5;
  }
  return false;
}


// ─── CALCUL TVA VENTILÉE PAR TAUX ────────────────────────────
// Utilisé par Devis (updateTotals) et Historique (_detailHtml) et Print
function calcTvaMap(lines, totalRemises, sousTotal) {
  const map = {}; // { taux: { baseHT, montantTva } }
  (lines || []).forEach(l => {
    const t = l.tva || 0;
    if (!map[t]) map[t] = { baseHT: 0, montantTva: 0 };
    map[t].baseHT += l.prix;
  });
  Object.keys(map).forEach(t => {
    const ratio = sousTotal > 0 ? map[t].baseHT / sousTotal : 0;
    const remise = totalRemises * ratio;
    map[t].baseHT = Math.max(0, map[t].baseHT - remise);
    map[t].montantTva = map[t].baseHT * parseFloat(t);
  });
  return map;
}

// ─── MODULE DEVIS (formulaire) ────────────────────────────────
const Devis = (() => {
  let _lines    = [];       // lignes du devis en cours
  let _editId   = null;     // id du devis en cours d'édition
  let _selItem  = null;     // matériel sélectionné dans l'autocomplete
  let _remises  = [];       // remises appliquées au devis en cours

  // ── Préremplissage depuis simulateur ──────────────────────
  function prefill({ name, pa, qty, id }) {
    reset();
    setTimeout(() => {
      _setVal('nd-mat-q', name);
      _setVal('nd-pa',    pa);
      _setVal('nd-qty',   qty);
      if (id) _selItem = db.cat.find(i => i.id === id) || null;
      calcLine();
    }, 50);
  }

  // ── Préremplissage depuis client ──────────────────────────
  function fillFromClient(cliId) {
    const cli = db.clients.find(c => c.id === cliId);
    if (!cli) return;
    reset();
    setTimeout(() => {
      _setVal('nd-nom',   cli.nom);
      _setVal('nd-tel',   cli.tel   || '');
      _setVal('nd-email', cli.email || '');
    }, 50);
  }

  // ── Datalist clients ──────────────────────────────────────
  function renderCliList() {
    const dl = document.getElementById('nd-cli-list');
    if (!dl) return;
    dl.innerHTML = db.clients.map(c => `<option value="${c.nom}">`).join('');
    fillTypeSelect('nd-type');
    renderServicePicker();
    renderEpiceriePicker();
    _renderRemiseSelect();
    // Badge de numéro si édition
    const badge = document.getElementById('nd-num-badge');
    if (badge) badge.style.display = 'none';
    if (_editId) {
      const dv = db.devis.find(d => d.id === _editId);
      if (dv && badge) { badge.textContent = dv.num; badge.style.display = ''; }
      const title = document.getElementById('nd-title');
      if (title) title.innerHTML = '<i data-lucide="pencil"></i> Modifier le devis';
      lucide.createIcons({ nodes: title ? [title.querySelector('[data-lucide]')] : [] });
    } else {
      const title = document.getElementById('nd-title');
      if (title) title.innerHTML = '<i data-lucide="pencil"></i> Nouveau devis';
      lucide.createIcons({ nodes: title ? [title.querySelector('[data-lucide]')] : [] });
    }
  }

  // ── Recherche matériel (autocomplete) ─────────────────────
  function matSearch() {
    const input = document.getElementById('nd-mat-q');
    const drop  = document.getElementById('nd-mat-drop');
    if (!input || !drop) return;

    const q = input.value.toLowerCase().trim();
    if (!q) { drop.classList.remove('open'); _selItem = null; return; }

    const results = db.cat.filter(i => i.name.toLowerCase().includes(q)).slice(0, 8);
    if (!results.length) { drop.classList.remove('open'); return; }

    drop.innerHTML = results.map(i => {
      const price = i.pa ? ` (${i.pa.toLocaleString('fr-FR')} €)` : '';
      return `<div class="autocomplete-item" onclick="Devis.pickMat(${i.id})">
        <strong>${i.name}</strong><span>${price}</span>
      </div>`;
    }).join('');
    drop.classList.add('open');
  }

  function pickMat(id) {
    const item  = db.cat.find(i => i.id === id);
    const input = document.getElementById('nd-mat-q');
    const drop  = document.getElementById('nd-mat-drop');
    const paEl  = document.getElementById('nd-pa');
    if (!item) return;

    _selItem = item;
    if (input) input.value = item.name;
    if (drop)  drop.classList.remove('open');
    if (paEl && item.pa) paEl.value = item.pa;
    calcLine();
  }

  // ── Calcul d'une ligne ────────────────────────────────────
  function calcLine() {
    const pa     = parseFloat(_getVal('nd-pa')) || _selItem?.pa || null;
    const dur    = _getVal('nd-dur') || 'weekend';
    const qty    = parseInt(_getVal('nd-qty')) || 1;
    const prev   = document.getElementById('nd-preview');
    if (!prev) return;

    if (!pa) { prev.style.display = 'none'; _setAttr('nd-prix-loc', 'placeholder', 'Facultatif'); return; }

    const r = calc(pa, dur, qty);
    if (!r) { prev.style.display = 'none'; return; }

    _setAttr('nd-prix-loc', 'placeholder', r.disp.toFixed(2));
    prev.style.display = 'block';
    prev.innerHTML = `<strong>Prix calculé :</strong> ${r.disp.toFixed(2)} € (×${qty}) · Caution : ${r.caut} €`;
  }

  // ── Ajouter une ligne ─────────────────────────────────────
  function addLine() {
    const pa          = parseFloat(_getVal('nd-pa')) || _selItem?.pa || null;
    const dur         = _getVal('nd-dur') || 'weekend';
    const qty         = parseInt(_getVal('nd-qty')) || 1;
    const prixManuel  = parseFloat(_getVal('nd-prix-loc')) || null;
    const name        = _selItem?.name || _getVal('nd-mat-q').trim();

    if (!name) { App.toast('Sélectionnez ou saisissez un matériel', 'err'); return; }

    let prix, caut;
    if (prixManuel) {
      prix = prixManuel;
      caut = pa ? (calc(pa, 'jour', qty)?.caut || 0) : 0;
    } else if (pa) {
      const r = calc(pa, dur, qty);
      if (!r) { App.toast('Saisissez un prix manuellement', 'warn'); return; }
      prix = r.disp;
      caut = r.caut;
    } else {
      App.toast("Prix d'achat manquant — saisissez un prix manuellement", 'warn');
      return;
    }

    _lines.push({ id: Date.now(), name, dur, qty, pu: prix / qty, prix, caut, tva: _selItem?.tva || 0, remises: [] });

    // Reset champs ligne
    _setVal('nd-mat-q', '');
    _setVal('nd-pa', '');
    _setVal('nd-qty', 1);
    _setVal('nd-prix-loc', '');
    document.getElementById('nd-preview').style.display = 'none';
    _selItem = null;

    renderLines();
    App.toast('Ligne ajoutée ✅', 'ok');
  }

  function delLine(id) {
    _lines = _lines.filter(l => l.id !== id);
    renderLines();
  }

  // ── Modifier une ligne existante ──────────────────────────
  function editLine(id) {
    const l = _lines.find(x => x.id === id);
    if (!l) return;

    // Supprimer la ligne du récap
    _lines = _lines.filter(x => x.id !== id);
    renderLines();

    if (l.dur === 'service') {
      // Pré-remplir le picker service
      const svc = db.services.find(s => l.name.startsWith(s.nom));
      if (svc) _setVal('nd-svc-sel', svc.id);
      updateServiceOptions();
      App.toast('✏️ Modification en cours — modifiez et re-ajoutez le service', 'ok');
    } else if (l.dur === 'epicerie') {
      // Pré-remplir le picker épicerie
      const epi = (db.epicerie || []).find(p => p.nom === l.name);
      if (epi) {
        pickEpi(epi.id);
        _setVal('nd-epi-qty', l.qty || 1);
        epiCalc();
      }
      App.toast('✏️ Modification en cours — modifiez et re-ajoutez le produit', 'ok');
    } else {
      // Pré-remplir le picker matériel
      const item = db.cat.find(i => i.name === l.name);
      _setVal('nd-mat-q', l.name);
      _setVal('nd-dur',   l.dur || 'weekend');
      _setVal('nd-qty',   l.qty || 1);
      if (item) {
        _selItem = item;
        _setVal('nd-pa', item.pa || '');
      }
      _setVal('nd-prix-loc', l.prix ? (l.prix).toFixed(2) : '');
      calcLine();
      document.getElementById('nd-mat-q')?.focus();
      App.toast('✏️ Modification en cours — modifiez et re-ajoutez', 'ok');
    }
  }

  // ── Calcul remises d'une ligne ─────────────────────────────
  function _applyLineRemises(l) {
    if (!l.remises) l.remises = [];
    let base = l.prix;
    for (const r of l.remises) {
      if (r.type === 'pourcentage') {
        r.montant_deduit = arrondi(base * r.valeur / 100);
      } else {
        r.montant_deduit = Math.min(r.valeur, base);
      }
      base -= r.montant_deduit;
    }
    l.prixNet = Math.max(0, base);
  }

  // ── Rendu des lignes ──────────────────────────────────────
  function renderLines() {
    const wrap  = document.getElementById('nd-lines-wrap');
    const empty = document.getElementById('nd-empty');
    const linesEl = document.getElementById('nd-lines');
    if (!wrap || !empty) return;

    if (!_lines.length) {
      wrap.style.display  = 'none';
      empty.style.display = 'block';
      _updateSelBar();
      return;
    }
    wrap.style.display  = 'block';
    empty.style.display = 'none';

    // Recalculer les remises de chaque ligne
    _lines.forEach(l => _applyLineRemises(l));

    linesEl.innerHTML = _lines.map(l => {
      const badge = l.dur === 'epicerie'
        ? '<span style="font-size:.65rem;background:#FEF3C7;color:#D97706;padding:1px 6px;border-radius:99px;font-weight:600;margin-left:4px"><i data-lucide="shopping-cart"></i> Épicerie</span>'
        : l.dur === 'service'
        ? '<span style="font-size:.65rem;background:#EFF6FF;color:#1D4ED8;padding:1px 6px;border-radius:99px;font-weight:600;margin-left:4px"><i data-lucide="wrench"></i> Service</span>'
        : '';
      const hasRem = l.remises && l.remises.length > 0;

      // Remises par ligne
      let remHtml = '';
      if (hasRem) {
        remHtml = `<div class="dv-line-remises">${l.remises.map((r, ri) => {
          const lab = r.type === 'pourcentage' ? `(-${r.valeur}%)` : `(-${r.valeur.toFixed(2)} €)`;
          return `<div class="dv-line-rem">
            <span class="rem-label"><i data-lucide="tag"></i> ${r.nom} ${lab}</span>
            <span class="rem-amount">- ${r.montant_deduit.toFixed(2)} €</span>
            <button class="dv-del" onclick="Devis.removeLineRemise(${l.id},${ri})" title="Retirer"><i data-lucide="x"></i></button>
          </div>`;
        }).join('')}</div>
        <div class="dv-line-net">Net HT : ${l.prixNet.toFixed(2)} €</div>`;
      }

      return `<div class="dv-line-wrap">
        <div class="dv-line">
          <input type="checkbox" class="line-check" data-id="${l.id}" onchange="Devis.onLineCheck()">
          <span class="dv-ln">${l.name}${badge}</span>
          <span class="dv-dur">${DL[l.dur] || l.dur}</span>
          <span class="dv-qty">×${l.qty}</span>
          <span class="dv-pr">${l.prix.toFixed(2)} €</span>
          <button class="dv-edit" onclick="Devis.editLine(${l.id})" title="Modifier"><i data-lucide="pencil"></i></button>
          <button class="dv-del" onclick="Devis.delLine(${l.id})"><i data-lucide="x"></i></button>
        </div>
        ${remHtml}
      </div>`;
    }).join('');
    lucide.createIcons({ nodes: linesEl.querySelectorAll('[data-lucide]') });

    _updateSelBar();
    updateTotals();
  }

  // ── Barre de sélection ────────────────────────────────────
  function _getCheckedIds() {
    return Array.from(document.querySelectorAll('#nd-lines .line-check:checked')).map(cb => parseInt(cb.dataset.id));
  }

  function _updateSelBar() {
    const barEl = document.getElementById('nd-sel-bar');
    if (!barEl) return;
    const ids = _getCheckedIds();
    if (!ids.length) {
      barEl.style.display = 'none';
      return;
    }
    barEl.style.display = 'flex';
    const actives = (db.remises || []).filter(r => r.actif);
    barEl.innerHTML = `
      <span class="sel-count">${ids.length} ligne${ids.length > 1 ? 's' : ''} sélectionnée${ids.length > 1 ? 's' : ''}</span>
      <select id="nd-sel-remise">
        <option value="">— Remise —</option>
        ${actives.map(r => {
          const val = r.type === 'pourcentage' ? `${r.valeur}%` : `${r.valeur.toFixed(2)} €`;
          return `<option value="${r.id}">${r.nom} (${val})</option>`;
        }).join('')}
      </select>
      <button class="btn btn-primary btn-sm" onclick="Devis.applyRemiseToSelected()"><i data-lucide="tag"></i> Appliquer</button>
      <button class="btn btn-ghost btn-sm" onclick="Devis.deselectAll()">Désélectionner</button>`;
    lucide.createIcons({ nodes: barEl.querySelectorAll('[data-lucide]') });
  }

  function onLineCheck() { _updateSelBar(); }

  function deselectAll() {
    document.querySelectorAll('#nd-lines .line-check').forEach(cb => cb.checked = false);
    _updateSelBar();
  }

  // ── Appliquer une remise aux lignes sélectionnées ─────────
  function applyRemiseToSelected() {
    const selEl = document.getElementById('nd-sel-remise');
    if (!selEl) return;
    const rId = parseInt(selEl.value);
    if (!rId) { App.toast('Sélectionnez une remise', 'warn'); return; }

    const r = db.remises.find(x => x.id === rId);
    if (!r) return;

    const ids = _getCheckedIds();
    if (!ids.length) { App.toast('Aucune ligne sélectionnée', 'warn'); return; }

    let count = 0;
    ids.forEach(id => {
      const l = _lines.find(x => x.id === id);
      if (!l) return;
      if (!l.remises) l.remises = [];
      // Ne pas ajouter la même remise deux fois sur la même ligne
      if (l.remises.find(x => x.nom === r.nom)) return;
      l.remises.push({ nom: r.nom, type: r.type, valeur: r.valeur, montant_deduit: 0 });
      count++;
    });

    if (!count) { App.toast('Remise déjà appliquée sur ces lignes', 'warn'); return; }
    renderLines();
    App.toast(`Remise appliquée sur ${count} ligne${count > 1 ? 's' : ''} ✅`, 'ok');
  }

  // ── Retirer une remise d'une ligne ────────────────────────
  function removeLineRemise(lineId, remIdx) {
    const l = _lines.find(x => x.id === lineId);
    if (!l || !l.remises) return;
    l.remises.splice(remIdx, 1);
    renderLines();
  }

  // ── Totaux ────────────────────────────────────────────────
  function updateTotals() {
    // Sous-total = somme des prixNet (après remises par ligne)
    const sousTotalBrut = _lines.reduce((s, l) => s + l.prix, 0);
    const sousTotal     = _lines.reduce((s, l) => s + (l.prixNet != null ? l.prixNet : l.prix), 0);
    const caut  = _lines.reduce((s, l) => s + (l.caut || 0), 0);
    const km    = parseFloat(_getVal('nd-km')) || 0;
    const kmt   = db.params?.km || 1.5;
    const lp    = labelPrix();
    const suffix = lp ? ` ${lp}` : '';

    // Calcul des remises globales (sur le sous-total après remises par ligne)
    let totalRemisesGlobales = 0;
    _remises.forEach(r => {
      if (r.type === 'pourcentage') {
        r.montant_deduit = arrondi(sousTotal * r.valeur / 100);
      } else {
        r.montant_deduit = Math.min(r.valeur, sousTotal - totalRemisesGlobales);
      }
      totalRemisesGlobales += r.montant_deduit;
    });

    const totHT = Math.max(0, sousTotal - totalRemisesGlobales);

    // Remises globales appliquées
    const remEl = document.getElementById('nd-remises-applied');
    if (remEl) {
      if (_remises.length) {
        remEl.style.display = 'block';
        remEl.innerHTML = `<div style="font-size:.72rem;color:var(--grey);margin-bottom:4px">Sous-total après remises lignes : ${sousTotal.toFixed(2)} €</div>` +
          _remises.map((r, i) => {
            const label = r.type === 'pourcentage' ? `(-${r.valeur}%)` : `(-${r.valeur.toFixed(2)} €)`;
            return `<div class="flex jb items-c" style="font-size:.78rem;color:var(--red);padding:2px 0">
              <span><i data-lucide="tag"></i> ${r.nom} ${label}</span>
              <span style="display:flex;align-items:center;gap:4px">
                - ${r.montant_deduit.toFixed(2)} €
                <button class="dv-del" style="font-size:.7rem" onclick="Devis.removeRemise(${i})"><i data-lucide="x"></i></button>
              </span>
            </div>`;
          }).join('');
        lucide.createIcons({ nodes: remEl.querySelectorAll('[data-lucide]') });
      } else {
        remEl.style.display = 'none';
      }
    }

    // TVA détail complet — toujours visible
    const tvaEl = document.getElementById('nd-tva-detail');
    if (tvaEl) {
      const tvaMap = calcTvaMap(_lines.map(l => ({ ...l, prix: l.prixNet != null ? l.prixNet : l.prix })), totalRemisesGlobales, sousTotal);
      const totalTVA = Object.values(tvaMap).reduce((s, v) => s + v.montantTva, 0);

      tvaEl.style.display = 'block';
      let html = `<div style="font-size:.78rem;color:var(--text2);line-height:1.9">`;
      html += `<div class="flex jb"><span>Sous-total HT :</span><span>${totHT.toFixed(2)} €</span></div>`;
      if (totalTVA > 0) {
        Object.entries(tvaMap)
          .filter(([, v]) => v.montantTva > 0)
          .sort(([a], [b]) => parseFloat(a) - parseFloat(b))
          .forEach(([taux, v]) => {
            html += `<div class="flex jb" style="color:var(--text3)"><span>TVA ${(taux * 100).toFixed(1).replace('.0', '')}% :</span><span>${v.montantTva.toFixed(2)} €</span></div>`;
          });
        html += `<div class="flex jb" style="font-weight:700;color:var(--text);border-top:1px solid var(--border);padding-top:4px;margin-top:2px"><span>Total TTC :</span><span>${(totHT + totalTVA).toFixed(2)} €</span></div>`;
      } else {
        html += `<div class="flex jb" style="font-weight:700;color:var(--text);border-top:1px solid var(--border);padding-top:4px;margin-top:2px"><span>Total TTC :</span><span>${totHT.toFixed(2)} €</span></div>`;
      }
      html += `<div class="flex jb" style="color:var(--text3)"><span>Caution estimée :</span><span>${caut} €</span></div>`;
      html += `</div>`;
      tvaEl.innerHTML = html;
    }

    const livEl = document.getElementById('nd-liv');
    if (livEl) {
      if (km > 0) {
        livEl.style.display = 'block';
        _setTxt('nd-al',  (km * kmt).toFixed(2) + ' €');
        _setTxt('nd-ret', (km * kmt).toFixed(2) + ' €');
      } else {
        livEl.style.display = 'none';
      }
    }

    // Re-calculer les prix par_km si un service est sélectionné
    if (_getVal('nd-svc-sel')) updateServiceOptions();
  }

  // ── Remises ────────────────────────────────────────────────
  function addRemise() {
    const selEl = document.getElementById('nd-remise-sel');
    if (!selEl) return;
    const id = parseInt(selEl.value);
    if (!id) { App.toast('Sélectionnez une remise', 'warn'); return; }

    const r = db.remises.find(x => x.id === id);
    if (!r) return;

    // Vérifier si déjà appliquée
    if (_remises.find(x => x.nom === r.nom)) {
      App.toast('Cette remise est déjà appliquée', 'warn');
      return;
    }

    _remises.push({
      nom:    r.nom,
      type:   r.type,
      valeur: r.valeur,
      montant_deduit: 0,
    });

    selEl.value = '';
    updateTotals();
    App.toast('Remise appliquée ✅', 'ok');
  }

  function removeRemise(idx) {
    _remises.splice(idx, 1);
    updateTotals();
  }

  // ── Service picker ────────────────────────────────────────
  function renderServicePicker() {
    const el = document.getElementById('nd-svc-picker');
    if (!el) return;

    if (!db.services?.length) {
      el.innerHTML = `<p style="font-size:.8rem;color:var(--grey)">Aucun service configuré.
        <button class="btn btn-ghost btn-sm" style="margin-left:6px" onclick="App.go('services')">Configurer →</button></p>`;
      return;
    }

    el.innerHTML = `
      <div class="fg">
        <label class="fl">Service</label>
        <select id="nd-svc-sel" onchange="Devis.updateServiceOptions()" style="width:100%">
          <option value="">— Choisir un service —</option>
          ${db.services.map(s => `<option value="${s.id}">${s.nom}</option>`).join('')}
        </select>
      </div>
      <div id="nd-svc-opts" style="display:none;margin-top:10px"></div>
      <div id="nd-svc-total" style="display:none;font-size:.82rem;color:var(--navy);font-weight:700;text-align:right;margin-top:6px"></div>
      <button class="btn btn-primary btn-sm fw mt-2" id="nd-svc-add-btn" style="display:none"
              onclick="Devis.addServiceLine()"><i data-lucide="wrench"></i> Ajouter ce service au devis</button>`;
  }

  // ── Mise à jour des options selon le service choisi ───────
  function updateServiceOptions() {
    const selId  = parseInt(_getVal('nd-svc-sel')) || null;
    const optsEl = document.getElementById('nd-svc-opts');
    const totEl  = document.getElementById('nd-svc-total');
    const addBtn = document.getElementById('nd-svc-add-btn');

    if (!selId) {
      if (optsEl) optsEl.style.display = 'none';
      if (totEl)  totEl.style.display  = 'none';
      if (addBtn) addBtn.style.display = 'none';
      return;
    }

    const svc = db.services.find(s => s.id === selId);
    if (!svc || !optsEl) return;

    const km = parseFloat(_getVal('nd-km')) || 0;

    optsEl.style.display = 'block';
    if (addBtn) addBtn.style.display = 'block';

    optsEl.innerHTML = (svc.options || []).map((opt, i) => {
      const prix = opt.type === 'par_km' ? opt.prix * km : opt.prix;
      let priceLabel;
      if (opt.type === 'inclus')    priceLabel = '<em style="color:var(--grey)">Inclus</em>';
      else if (opt.type === 'sur_devis') priceLabel = '<em style="color:var(--grey)">Sur devis</em>';
      else if (opt.type === 'par_km')    priceLabel = `<span style="color:var(--grey)">${opt.prix} €/km × ${km} km = </span><strong>${prix.toFixed(2)} €</strong>`;
      else                               priceLabel = `<strong>${prix.toFixed(2)} €</strong>`;

      const disabled = opt.obligatoire ? 'disabled' : '';
      const checked  = opt.obligatoire ? 'checked'  : '';
      return `<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--border)">
        <input type="checkbox" id="nd-svc-opt-${i}" ${checked} ${disabled}
               style="width:15px;height:15px;flex-shrink:0"
               onchange="Devis.refreshServiceTotal()">
        <label for="nd-svc-opt-${i}" style="font-size:.82rem;flex:1;cursor:pointer">
          ${opt.nom}${opt.obligatoire ? ' <span style="font-size:.68rem;color:var(--blue)">●</span>' : ''}
        </label>
        <span style="font-size:.8rem">${priceLabel}</span>
      </div>`;
    }).join('');

    refreshServiceTotal();
  }

  // ── Recalcul du total service affiché ─────────────────────
  function refreshServiceTotal() {
    const selId = parseInt(_getVal('nd-svc-sel')) || null;
    const totEl = document.getElementById('nd-svc-total');
    if (!selId || !totEl) return;

    const svc = db.services.find(s => s.id === selId);
    if (!svc) return;

    const km = parseFloat(_getVal('nd-km')) || 0;
    let total = 0;
    (svc.options || []).forEach((opt, i) => {
      const cb = document.getElementById(`nd-svc-opt-${i}`);
      if (cb && cb.checked) {
        if (opt.type === 'fixe')   total += opt.prix;
        if (opt.type === 'par_km') total += opt.prix * km;
      }
    });

    totEl.style.display = 'block';
    totEl.textContent   = `Total service : ${total.toFixed(2)} €`;
  }

  // ── Ajouter le service comme ligne ────────────────────────
  function addServiceLine() {
    const selId = parseInt(_getVal('nd-svc-sel')) || null;
    if (!selId) { App.toast('Sélectionnez un service', 'err'); return; }

    const svc = db.services.find(s => s.id === selId);
    if (!svc) return;

    const km = parseFloat(_getVal('nd-km')) || 0;
    const selectedOpts = [];
    let totalPrix = 0;

    (svc.options || []).forEach((opt, i) => {
      const cb = document.getElementById(`nd-svc-opt-${i}`);
      if (!cb || !cb.checked) return;
      selectedOpts.push(opt.nom);
      if (opt.type === 'fixe')   totalPrix += opt.prix;
      if (opt.type === 'par_km') totalPrix += opt.prix * km;
    });

    if (!selectedOpts.length) { App.toast('Sélectionnez au moins une option', 'warn'); return; }

    const suffix = ` (${selectedOpts.join(', ')})`;
    _lines.push({
      id:   Date.now(),
      name: svc.nom + suffix,
      dur:  'service',
      qty:  1,
      pu:   totalPrix,
      prix: totalPrix,
      caut: 0,
      tva:  svc.tva || 0,
      remises: [],
    });

    // Reset le picker
    _setVal('nd-svc-sel', '');
    const optsEl = document.getElementById('nd-svc-opts');
    const totEl  = document.getElementById('nd-svc-total');
    const addBtn = document.getElementById('nd-svc-add-btn');
    if (optsEl) optsEl.style.display = 'none';
    if (totEl)  totEl.style.display  = 'none';
    if (addBtn) addBtn.style.display = 'none';

    renderLines();
    App.toast('Service ajouté ✅', 'ok');
  }

  // ── Épicerie picker ────────────────────────────────────────
  function renderEpiceriePicker() {
    const el = document.getElementById('nd-epi-picker');
    if (!el) return;

    const actifs = (db.epicerie || []).filter(p => p.actif);
    if (!actifs.length) {
      el.innerHTML = `<p style="font-size:.8rem;color:var(--grey)">Aucun produit épicerie.
        <button class="btn btn-ghost btn-sm" style="margin-left:6px" onclick="App.go('epicerie')">Configurer →</button></p>`;
      return;
    }

    el.innerHTML = `
      <div class="fg">
        <label class="fl">Rechercher un produit</label>
        <div class="autocomplete-wrap">
          <input type="text" id="nd-epi-q" placeholder="Nom du produit…"
                 oninput="Devis.epiSearch()" autocomplete="off">
          <div class="autocomplete-drop" id="nd-epi-drop"></div>
        </div>
      </div>
      <div id="nd-epi-sel-wrap" style="display:none;margin-top:8px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
          <span id="nd-epi-sel-name" style="font-size:.84rem;font-weight:600;flex:1"></span>
          <span id="nd-epi-sel-pu" style="font-size:.78rem;color:var(--grey)"></span>
        </div>
        <div class="r2" style="gap:8px">
          <div class="fg">
            <label class="fl">Quantité</label>
            <input type="number" id="nd-epi-qty" value="1" min="1" step="1" oninput="Devis.epiCalc()">
          </div>
          <div class="fg">
            <label class="fl">Total</label>
            <div id="nd-epi-total" style="font-size:.88rem;font-weight:700;color:var(--navy);padding:8px 0">0,00 €</div>
          </div>
        </div>
        <button class="btn btn-primary btn-sm fw" onclick="Devis.addEpiLine()"><i data-lucide="shopping-cart"></i> Ajouter au devis</button>
      </div>`;
  }

  let _selEpi = null;

  function epiSearch() {
    const input = document.getElementById('nd-epi-q');
    const drop  = document.getElementById('nd-epi-drop');
    if (!input || !drop) return;

    const q = input.value.toLowerCase().trim();
    if (!q) { drop.classList.remove('open'); return; }

    const actifs  = (db.epicerie || []).filter(p => p.actif);
    const results = actifs.filter(p => p.nom.toLowerCase().includes(q)).slice(0, 8);
    if (!results.length) { drop.classList.remove('open'); return; }

    drop.innerHTML = results.map(p =>
      `<div class="autocomplete-item" onclick="Devis.pickEpi(${p.id})">
        <strong>${p.nom}</strong><span style="color:var(--grey);font-size:.78rem">${p.prix.toFixed(2)} €/${p.unite || 'unité'}</span>
      </div>`
    ).join('');
    drop.classList.add('open');
  }

  function pickEpi(id) {
    const p     = (db.epicerie || []).find(x => x.id === id);
    const input = document.getElementById('nd-epi-q');
    const drop  = document.getElementById('nd-epi-drop');
    if (!p) return;

    _selEpi = p;
    if (input) input.value = p.nom;
    if (drop)  drop.classList.remove('open');

    const wrap = document.getElementById('nd-epi-sel-wrap');
    const name = document.getElementById('nd-epi-sel-name');
    const pu   = document.getElementById('nd-epi-sel-pu');
    if (wrap) wrap.style.display = 'block';
    if (name) name.textContent = p.nom;
    if (pu)   pu.textContent   = `${p.prix.toFixed(2)} € / ${p.unite || 'unité'}`;

    _setVal('nd-epi-qty', 1);
    epiCalc();
  }

  function epiCalc() {
    if (!_selEpi) return;
    const qty   = parseInt(_getVal('nd-epi-qty')) || 1;
    const total = _selEpi.prix * qty;
    const el    = document.getElementById('nd-epi-total');
    if (el) el.textContent = total.toFixed(2) + ' €';
  }

  function addEpiLine() {
    if (!_selEpi) { App.toast('Sélectionnez un produit', 'err'); return; }
    const qty   = parseInt(_getVal('nd-epi-qty')) || 1;
    const prix  = _selEpi.prix * qty;

    _lines.push({
      id:   Date.now(),
      name: _selEpi.nom,
      dur:  'epicerie',
      qty,
      pu:   _selEpi.prix,
      prix,
      caut: 0,
      tva:  _selEpi.tva || 0,
      remises: [],
    });

    // Reset picker
    _selEpi = null;
    _setVal('nd-epi-q', '');
    _setVal('nd-epi-qty', 1);
    const wrap = document.getElementById('nd-epi-sel-wrap');
    if (wrap) wrap.style.display = 'none';

    renderLines();
    App.toast('Produit ajouté ✅', 'ok');
  }

  // ── Construire l'objet devis ──────────────────────────────
  function _buildData(doctype = 'devis') {
    // Recalculer remises par ligne
    _lines.forEach(l => _applyLineRemises(l));
    const sousTotal = _lines.reduce((s, l) => s + (l.prixNet != null ? l.prixNet : l.prix), 0);
    let totalRemisesGlobales = 0;
    const remisesCopy = JSON.parse(JSON.stringify(_remises));
    remisesCopy.forEach(r => {
      if (r.type === 'pourcentage') {
        r.montant_deduit = arrondi(sousTotal * r.valeur / 100);
      } else {
        r.montant_deduit = Math.min(r.valeur, sousTotal - totalRemisesGlobales);
      }
      totalRemisesGlobales += r.montant_deduit;
    });
    return {
      date:   today(),
      client: _getVal('nd-nom'),
      tel:    _getVal('nd-tel'),
      email:  _getVal('nd-email'),
      type:   _getVal('nd-type'),
      lieu:   _getVal('nd-lieu'),
      recup:  _getVal('nd-recup'),
      retour: _getVal('nd-retour'),
      km:     parseFloat(_getVal('nd-km')) || 0,
      notes:  _getVal('nd-notes'),
      lines:  JSON.parse(JSON.stringify(_lines)),
      remises: remisesCopy,
      total:  Math.max(0, sousTotal - totalRemisesGlobales),
      doctype
    };
  }

  // ── Sauvegarder ───────────────────────────────────────────
  async function save() {
    if (!_lines.length) { App.toast('Ajoutez au moins une ligne', 'err'); return; }
    await _persist('devis');
  }

  async function saveAsFacture() {
    if (!_lines.length) { App.toast('Ajoutez au moins une ligne', 'err'); return; }
    await _persist('facture');
  }

  async function _persist(doctype) {
    const isEdit = !!_editId;
    const prefix = doctype === 'facture' ? 'F' : 'D';
    const num    = isEdit
      ? db.devis.find(d => d.id === _editId)?.num
      : prefix + String(db.ndv).padStart(4, '0');

    if (!isEdit) db.ndv++;

    const data = { ...(_editId ? { id: _editId } : {}), num, ..._buildData(doctype) };

    // Gestion du statut : brouillon pour nouveau, on préserve l'existant pour l'édition
    if (!isEdit) {
      data.statut = 'brouillon';
    } else {
      const existingStatut = db.devis.find(d => d.id === _editId)?.statut || 'brouillon';
      data.statut = existingStatut;
    }

    // Auto-créer le client s'il n'existe pas
    let newCli = null;
    const cnom = data.client.trim();
    if (cnom && !db.clients.find(c => c.nom.toLowerCase() === cnom.toLowerCase())) {
      newCli = { nom: cnom, tel: data.tel, email: data.email, adr: '', notes: '' };
      db.clients.push(newCli);
    }

    // Mettre à jour en mémoire
    if (isEdit) {
      const idx = db.devis.findIndex(d => d.id === _editId);
      if (idx >= 0) db.devis[idx] = data;
    } else {
      db.devis.push(data);
    }

    try {
      const ops = [sbUpsertDv(data), sbSaveMeta(db.ndv, db.nid)];
      if (newCli) ops.push(sbUpsertCli(newCli));
      await Promise.all(ops);

      App.toast(`${doctype === 'facture' ? 'Facture' : 'Devis'} ${num} sauvegardé ✅`, 'ok');
      App.updateBadges();
      reset();
    } catch (err) {
      console.error(err);
      App.toast('Erreur de sauvegarde', 'err');
    }
  }

  // ── Aperçu impression ─────────────────────────────────────
  function print() {
    if (!_lines.length) { App.toast('Aucune ligne', 'err'); return; }
    const data = { id: 0, num: 'APERÇU', ..._buildData() };
    if (typeof Print !== 'undefined') Print.dv(data);
  }

  function download() {
    if (!_lines.length) { App.toast('Aucune ligne', 'err'); return; }
    const data = { id: 0, num: 'APERÇU', ..._buildData() };
    if (typeof Print !== 'undefined') Print.downloadPdf(data);
  }

  // ── Éditer un devis existant ──────────────────────────────
  function edit(id) {
    const dv = db.devis.find(d => d.id === id);
    if (!dv) return;
    _editId  = id;
    _lines   = JSON.parse(JSON.stringify(dv.lines || []));
    _remises = JSON.parse(JSON.stringify(dv.remises || []));
    App.go('nouveau-devis');
    setTimeout(() => {
      _setVal('nd-nom',    dv.client || '');
      _setVal('nd-tel',    dv.tel    || '');
      _setVal('nd-email',  dv.email  || '');
      _setVal('nd-lieu',   dv.lieu   || '');
      _setVal('nd-recup',  dv.recup  || '');
      _setVal('nd-retour', dv.retour || '');
      _setVal('nd-km',     dv.km     || '');
      _setVal('nd-notes',  dv.notes  || '');
      renderLines();
      renderCliList();
      _setVal('nd-type',   dv.type   || 'Autre');
    }, 80);
  }

  // ── Vider le formulaire ───────────────────────────────────
  function reset() {
    _lines   = [];
    _remises = [];
    _editId  = null;
    _selItem = null;
    ['nd-nom','nd-tel','nd-email','nd-lieu','nd-recup','nd-retour','nd-km','nd-notes',
     'nd-mat-q','nd-pa','nd-prix-loc'].forEach(id => _setVal(id, ''));
    _setVal('nd-qty', 1);
    _setVal('nd-dur', 'weekend');
    renderLines();
    renderCliList();
  }

  // ── Calcul durée entre récupération et retour ─────────────
  function calcDuree() {
    const recup  = _getVal('nd-recup');
    const retour = _getVal('nd-retour');
    const hint   = document.getElementById('nd-duree-hint');
    if (!hint) return;

    if (!recup || !retour) { hint.style.display = 'none'; return; }

    const d1 = new Date(recup);
    const d2 = new Date(retour);
    if (isNaN(d1) || isNaN(d2)) { hint.style.display = 'none'; return; }

    const diffMs = d2 - d1;
    if (diffMs <= 0) {
      hint.style.display = 'block';
      hint.innerHTML = '<span style="color:var(--red);font-weight:600"><i data-lucide="alert-triangle"></i> La date de retour doit être après la récupération</span>';
      lucide.createIcons({ nodes: hint.querySelectorAll('[data-lucide]') });
      return;
    }

    const diffH    = diffMs / 36e5;
    const diffDays = diffMs / 864e5;
    const jours    = Math.floor(diffDays);
    const heures   = Math.round(diffH - jours * 24);

    let durLabel = '';
    if (jours > 0) durLabel += `${jours} jour${jours > 1 ? 's' : ''}`;
    if (heures > 0) durLabel += ` ${heures}h`;
    if (!durLabel) durLabel = 'Moins d\'1 heure';

    // Suggestion de durée de location
    let sugKey, sugLabel;
    if (diffDays < 1)       { sugKey = 'jour';    sugLabel = '1 Jour'; }
    else if (diffDays <= 4) { sugKey = 'weekend';  sugLabel = 'Week-end'; }
    else if (diffDays <= 9) { sugKey = 'semaine';  sugLabel = '1 Semaine'; }
    else if (diffDays <= 16){ sugKey = '2s';       sugLabel = '2 Semaines'; }
    else if (diffDays <= 23){ sugKey = '3s';       sugLabel = '3 Semaines'; }
    else                    { sugKey = 'mois';     sugLabel = '1 Mois'; }

    // Appliquer automatiquement la durée suggérée
    _setVal('nd-dur', sugKey);
    calcLine();

    hint.style.display = 'block';
    hint.innerHTML = `<span style="color:var(--blue);font-weight:600">⏱ Durée : ${durLabel.trim()}</span>`
      + `<span style="color:var(--grey);margin-left:8px">→ Durée suggérée : ${sugLabel}</span>`;
  }

  // ── Remise select ──────────────────────────────────────────
  function _renderRemiseSelect() {
    const el = document.getElementById('nd-remise-sel');
    if (!el) return;
    const actives = (db.remises || []).filter(r => r.actif);
    el.innerHTML = '<option value="">— Choisir une remise —</option>' +
      actives.map(r => {
        const val = r.type === 'pourcentage' ? `${r.valeur}%` : `${r.valeur.toFixed(2)} €`;
        return `<option value="${r.id}">${r.nom} (${val})</option>`;
      }).join('');
  }

  // ── Helpers ───────────────────────────────────────────────
  function _getVal(id) { const el = document.getElementById(id); return el ? el.value : ''; }
  function _setVal(id, v) { const el = document.getElementById(id); if (el) el.value = v; }
  function _setTxt(id, v) { const el = document.getElementById(id); if (el) el.textContent = v; }
  function _setAttr(id, attr, v) { const el = document.getElementById(id); if (el) el[attr] = v; }

  // ── Auto-remplissage client ────────────────────────────────
  function _autoFillClient() {
    const nom = (_getVal('nd-nom') || '').trim();
    if (!nom) return;
    const cli = db.clients.find(c => (c.nom || '').toLowerCase() === nom.toLowerCase());
    if (!cli) return;
    _setVal('nd-tel',   cli.tel   || '');
    _setVal('nd-email', cli.email || '');
    const hint = document.getElementById('nd-cli-hint');
    if (hint) {
      hint.textContent = '✅ Client reconnu — infos pré-remplies';
      hint.style.display = 'block';
      setTimeout(() => { hint.style.display = 'none'; }, 2000);
    }
  }

  // Écouter le changement sur le champ client
  document.addEventListener('DOMContentLoaded', () => {
    const nomEl = document.getElementById('nd-nom');
    if (nomEl) {
      nomEl.addEventListener('change', _autoFillClient);
    }
  });

  // Fermer dropdown si clic ailleurs
  document.addEventListener('click', e => {
    if (!e.target.closest('#nd-mat-q') && !e.target.closest('#nd-mat-drop')) {
      const drop = document.getElementById('nd-mat-drop');
      if (drop) drop.classList.remove('open');
    }
  });

  // Fermer dropdown épicerie si clic ailleurs
  document.addEventListener('click', e => {
    if (!e.target.closest('#nd-epi-q') && !e.target.closest('#nd-epi-drop')) {
      const drop = document.getElementById('nd-epi-drop');
      if (drop) drop.classList.remove('open');
    }
  });

  return { prefill, fillFromClient, renderCliList, matSearch, pickMat, calcLine, addLine, delLine, editLine,
           renderLines, updateTotals, save, saveAsFacture, print, download, edit, reset, calcDuree,
           addRemise, removeRemise,
           onLineCheck, deselectAll, applyRemiseToSelected, removeLineRemise,
           renderServicePicker, updateServiceOptions, refreshServiceTotal, addServiceLine,
           renderEpiceriePicker, epiSearch, pickEpi, epiCalc, addEpiLine };
})();


// ─── MODULE HISTORIQUE ────────────────────────────────────────
const Historique = (() => {
  let _fil    = 'Tous';   // filtre statut : 'Tous' | clé STATUTS
  let _search = '';

  // ── Rendu ─────────────────────────────────────────────────
  function render() {
    _buildChips();
    _renderList();
  }

  // ── Chips de filtre statut ────────────────────────────────
  function _buildChips() {
    const el = document.getElementById('hist-chips');
    if (!el) return;
    // Statuts + chip "Factures" pour filtrer par doctype
    const filters = ['Tous', ...Object.keys(STATUTS), 'Factures'];
    el.innerHTML = filters.map(f => {
      let label;
      if (f === 'Tous')     label = 'Tous';
      else if (f === 'Factures') label = '🧾 Factures';
      else                  label = STATUTS[f]?.label || f;
      const active = f === _fil ? ' on' : '';
      return `<button class="chip${active}" onclick="Historique.setFilter('${f}')">${label}</button>`;
    }).join('');
  }

  // ── Filtrage ──────────────────────────────────────────────
  function _filtered() {
    return db.devis.filter(d => {
      const statut = d.statut || 'brouillon';
      let matchFil;
      if (_fil === 'Tous')         matchFil = true;
      else if (_fil === 'Factures') matchFil = d.doctype === 'facture';
      else                          matchFil = statut === _fil;
      const q = _search;
      const matchSearch = !q
        || (d.client || '').toLowerCase().includes(q)
        || (d.num    || '').toLowerCase().includes(q)
        || (d.lieu   || '').toLowerCase().includes(q);
      return matchFil && matchSearch;
    }).reverse();
  }

  // ── Rendu de la liste ─────────────────────────────────────
  function _renderList() {
    const listEl = document.getElementById('hist-list');
    const empty  = document.getElementById('hist-empty');
    if (!listEl) return;

    const items = _filtered();
    if (!items.length) {
      listEl.innerHTML = '';
      if (empty) empty.style.display = 'block';
      return;
    }
    if (empty) empty.style.display = 'none';

    listEl.innerHTML = items.map(d => {
      const isF    = d.doctype === 'facture';
      const km     = d.km || 0;
      const kmt    = db.params?.km || 1.5;
      const livraison = km > 0 ? ` + ${(km * kmt).toFixed(2)} € liv.` : '';
      const statut = d.statut || 'brouillon';
      const relBtn = needsRelance(d)
        ? `<button class="btn btn-gold btn-sm" style="padding:3px 10px;font-size:.72rem" onclick="event.stopPropagation();Historique.relancer(${d.id})"><i data-lucide="bell"></i> Relancer</button>`
        : '';

      return `<div class="dvc" onclick="Historique.openDetail(${d.id})">
        <div class="flex jb items-c">
          <div>
            <div class="dvc-num" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
              ${isF ? '<i data-lucide="file-text"></i>' : '<i data-lucide="clipboard"></i>'}
              ${isF ? '<span class="badge bg-green" style="margin:0">Facture</span>' : ''}
              ${statutBadge(statut)}
              ${d.num || '—'}
            </div>
            <div class="dvc-client">
              ${d.client || 'Sans client'}
              ${d.type ? ' · ' + d.type : ''}
              ${d.recup ? ' · ' + fmtDt(d.recup) : ''}
            </div>
          </div>
          <div style="text-align:right">
            <div class="dvc-total">${prixAffiche(d.total || 0).toFixed(2)} €${livraison}</div>
            <div class="text-sm">${fmtDate(d.date)}</div>
          </div>
        </div>
        <div class="flex gap-2 mt-2" style="align-items:center;flex-wrap:wrap" onclick="event.stopPropagation()">
          <span style="font-size:.72rem;color:var(--grey);white-space:nowrap">Statut :</span>
          <select onchange="Historique.changeStatut(${d.id}, this.value)"
                  style="font-size:.72rem;padding:3px 6px;border:1px solid var(--border);border-radius:6px;cursor:pointer;width:fit-content;max-width:160px">
            ${Object.entries(STATUTS).map(([k, v]) =>
              `<option value="${k}" ${statut === k ? 'selected' : ''}>${v.label}</option>`
            ).join('')}
          </select>
          ${relBtn}
        </div>
      </div>`;
    }).join('');
    lucide.createIcons({ nodes: listEl.querySelectorAll('[data-lucide]') });
  }

  // ── Filtre texte ────────────��───────────────────────���─────
  function filter() {
    const el = document.getElementById('hist-search');
    _search  = el ? el.value.toLowerCase().trim() : '';
    _renderList();
  }

  function setFilter(f) {
    _fil = f;
    _buildChips();
    _renderList();
  }

  // ── Changer statut ────────────────────────────────────────
  async function changeStatut(id, statut) {
    const dv = db.devis.find(d => d.id === id);
    if (!dv) return;
    const prev = dv.statut;
    dv.statut = statut;
    _renderList(); // re-render immédiat pour le badge — n'attend pas Supabase
    try {
      await sbUpdateStatutDv(id, statut);
      App.toast('Statut mis à jour ✅', 'ok');
    } catch (err) {
      console.error(err);
      dv.statut = prev; // rétablir l'état local si erreur Supabase
      _renderList();
      App.toast('Erreur mise à jour statut', 'err');
    }
  }

  // ── Email + passage à "envoyé" ────────────────────────────
  async function emailAndSetSent(id) {
    const dv = db.devis.find(d => d.id === id);
    if (!dv) return;
    if (typeof Print !== 'undefined') Print.email(dv);
    await changeStatut(id, 'envoyé');
  }

  // ── Relancer ──────────────────────────────────────────────
  function relancer(id) {
    const dv = db.devis.find(d => d.id === id);
    if (!dv) return;
    const idEl   = document.getElementById('m-rel-dv-id');
    const dateEl = document.getElementById('m-rel-date');
    const notEl  = document.getElementById('m-rel-notes');
    const titleEl = document.getElementById('m-rel-title');
    if (idEl)   idEl.value   = id;
    if (dateEl) dateEl.value = today();
    if (notEl)  notEl.value  = '';
    if (titleEl) {
      titleEl.innerHTML = `<i data-lucide="bell"></i> Relancer — ${dv.num || ''} (${dv.client || ''})`;
      lucide.createIcons({ nodes: titleEl.querySelectorAll('[data-lucide]') });
    }
    App.openModal('m-relance');
  }

  async function saveRelance(sendEmail = false) {
    const id    = parseInt(document.getElementById('m-rel-dv-id')?.value);
    const date  = document.getElementById('m-rel-date')?.value  || today();
    const notes = document.getElementById('m-rel-notes')?.value || '';
    if (!id) return;

    const dv = db.devis.find(d => d.id === id);
    if (!dv) return;

    try {
      await sbSaveRelance({ devis_id: id, date_relance: date, notes, created_at: today() });
      await changeStatut(id, 'à relancer');

      if (sendEmail && typeof Print !== 'undefined') {
        Print.email(dv);
      }

      App.closeModal('m-relance');
      App.toast('Relance enregistrée ✅', 'ok');
    } catch (err) {
      console.error(err);
      App.toast('Erreur lors de la relance', 'err');
    }
  }

  function sendRelanceEmail() {
    saveRelance(true);
  }

  // ── Détail modal ──────────────────────────────────────────
  function openDetail(id) {
    const dv  = db.devis.find(d => d.id === id);
    if (!dv) return;
    const isF = dv.doctype === 'facture';
    const bdEl    = document.getElementById('m-dv-bd');
    const titleEl = document.getElementById('m-dv-title');

    if (titleEl) titleEl.textContent = (isF ? 'Facture ' : 'Devis ') + (dv.num || '');
    if (bdEl) {
      bdEl.innerHTML = _detailHtml(dv);
      lucide.createIcons({ nodes: bdEl.querySelectorAll('[data-lucide]') });
    }
    App.openModal('m-dv');
  }

  function _detailHtml(dv) {
    const p   = db.params || {};
    const km  = dv.km || 0;
    const kmt = p.km || 1.5;
    // Calculer prixNet pour chaque ligne
    const lines = (dv.lines || []).map(l => {
      const ll = { ...l, remises: l.remises || [] };
      let base = ll.prix;
      for (const r of ll.remises) {
        if (r.type === 'pourcentage') r.montant_deduit = arrondi(base * r.valeur / 100);
        else r.montant_deduit = Math.min(r.valeur, base);
        base -= r.montant_deduit;
      }
      ll.prixNet = Math.max(0, base);
      return ll;
    });
    const sousTotal = lines.reduce((s, l) => s + l.prixNet, 0);
    const dvRemises = dv.remises || [];
    const totalRemises = dvRemises.reduce((s, r) => s + (r.montant_deduit || 0), 0);
    const tot  = Math.max(0, sousTotal - totalRemises);
    const caut = lines.reduce((s, l) => s + (l.caut || 0), 0);
    const statut = dv.statut || 'brouillon';

    return `<div style="font-size:.84rem">
      <div class="flex gap-2 mb-3" style="align-items:center">
        <span style="font-size:.8rem;color:var(--grey)">Statut :</span>
        ${statutBadge(statut)}
        <select onchange="Historique.changeStatut(${dv.id}, this.value)"
                style="font-size:.72rem;padding:3px 6px;border:1px solid var(--border);border-radius:6px;cursor:pointer">
          ${Object.entries(STATUTS).map(([k, v]) =>
            `<option value="${k}" ${statut === k ? 'selected' : ''}>${v.label}</option>`
          ).join('')}
        </select>
      </div>
      <div class="g2 mb-3" style="gap:6px">
        ${dv.client ? `<div><strong>Client :</strong> ${dv.client}</div>` : ''}
        ${dv.tel    ? `<div><strong>Tél :</strong> ${dv.tel}</div>` : ''}
        ${dv.email  ? `<div><strong>Email :</strong> ${dv.email}</div>` : ''}
        ${dv.type   ? `<div><strong>Événement :</strong> ${dv.type}</div>` : ''}
        ${dv.lieu   ? `<div style="grid-column:span 2"><strong>Lieu :</strong> ${dv.lieu}</div>` : ''}
        ${dv.recup  ? `<div><strong>Récupération :</strong> ${fmtDt(dv.recup)}</div>` : ''}
        ${dv.retour ? `<div><strong>Retour :</strong> ${fmtDt(dv.retour)}</div>` : ''}
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:.8rem;margin-bottom:10px">
        <thead><tr style="background:#F3F6FB">
          <th style="padding:7px 10px;text-align:left;border-bottom:2px solid #E5E7EB">Matériel</th>
          <th style="padding:7px 10px;text-align:center;border-bottom:2px solid #E5E7EB">Durée</th>
          <th style="padding:7px 10px;text-align:center;border-bottom:2px solid #E5E7EB">Qté</th>
          <th style="padding:7px 10px;text-align:right;border-bottom:2px solid #E5E7EB">Prix HT</th>
        </tr></thead>
        <tbody>
          ${lines.map(l => {
            const lnBadge = l.dur === 'epicerie' ? ' <span style="font-size:.6rem;background:#FEF3C7;color:#D97706;padding:1px 5px;border-radius:99px"><i data-lucide="shopping-cart"></i></span>'
                          : l.dur === 'service'  ? ' <span style="font-size:.6rem;background:#EFF6FF;color:#1D4ED8;padding:1px 5px;border-radius:99px"><i data-lucide="wrench"></i></span>'
                          : '';
            const hasRem = l.remises && l.remises.length > 0;
            let remRows = '';
            if (hasRem) {
              remRows = l.remises.map(r => {
                const lab = r.type === 'pourcentage' ? `(-${r.valeur}%)` : `(-${r.valeur.toFixed(2)} €)`;
                return `<tr><td colspan="3" style="padding:2px 10px 2px 24px;font-size:.7rem;color:#DC2626;border-bottom:none"><i data-lucide="tag"></i> ${r.nom} ${lab}</td><td style="padding:2px 10px;text-align:right;font-size:.7rem;color:#DC2626;border-bottom:none">- ${r.montant_deduit.toFixed(2)} €</td></tr>`;
              }).join('') +
              `<tr><td colspan="3" style="padding:2px 10px 2px 24px;font-size:.72rem;font-weight:600;color:var(--navy);border-bottom:1px solid #F3F4F6">Net HT</td><td style="padding:2px 10px;text-align:right;font-size:.72rem;font-weight:600;color:var(--navy);border-bottom:1px solid #F3F4F6">${l.prixNet.toFixed(2)} €</td></tr>`;
            }
            return `<tr>
            <td style="padding:7px 10px;border-bottom:${hasRem ? 'none' : '1px solid #F3F4F6'}">${l.name}${lnBadge}</td>
            <td style="padding:7px 10px;border-bottom:${hasRem ? 'none' : '1px solid #F3F4F6'};text-align:center">${DL[l.dur] || l.dur}</td>
            <td style="padding:7px 10px;border-bottom:${hasRem ? 'none' : '1px solid #F3F4F6'};text-align:center">${l.qty || 1}</td>
            <td style="padding:7px 10px;border-bottom:${hasRem ? 'none' : '1px solid #F3F4F6'};text-align:right;font-weight:600">${l.prix?.toFixed(2)} €</td>
          </tr>${remRows}`}).join('')}
        </tbody>
      </table>
      <div style="text-align:right;font-size:.84rem">
        ${km > 0 ? `<div style="color:var(--grey)">Livraison aller : ${(km * kmt).toFixed(2)} €</div>
                    <div style="color:var(--grey)">Retour si récup. : ${(km * kmt).toFixed(2)} €</div>` : ''}
        ${dvRemises.length ? `
          <div style="color:var(--grey);margin-top:5px">Sous-total : ${sousTotal.toFixed(2)} €</div>
          ${dvRemises.map(r => {
            const label = r.type === 'pourcentage' ? `(-${r.valeur}%)` : `(-${r.valeur.toFixed(2)} €)`;
            return `<div style="color:var(--red)"><i data-lucide="tag"></i> ${r.nom} ${label} : - ${(r.montant_deduit || 0).toFixed(2)} €</div>`;
          }).join('')}
        ` : ''}
        ${(() => {
          const tvaMap = calcTvaMap(lines.map(l => ({ ...l, prix: l.prixNet })), totalRemises, sousTotal);
          const totalTVA = Object.values(tvaMap).reduce((s, v) => s + v.montantTva, 0);
          if (totalTVA > 0) {
            const rows = Object.entries(tvaMap)
              .filter(([, v]) => v.montantTva > 0)
              .map(([taux, v]) => `<div style="color:var(--grey)">TVA ${(taux * 100).toFixed(1).replace('.0', '')}% (base ${v.baseHT.toFixed(2)} €) : ${v.montantTva.toFixed(2)} €</div>`)
              .join('');
            return `<div style="margin-top:5px;color:var(--grey)">Total HT : ${tot.toFixed(2)} €</div>
              ${rows}
              <div style="font-weight:700;color:var(--navy);font-size:.95rem">Total TTC : ${(tot + totalTVA).toFixed(2)} €</div>`;
          }
          return `<div style="font-weight:700;color:var(--navy);font-size:.95rem;margin-top:5px">Total : ${tot.toFixed(2)} €</div>`;
        })()}
        <div style="color:var(--grey)">Caution : ${caut} €</div>
      </div>
      ${dv.notes ? `<div style="margin-top:10px;background:#F9FAFB;padding:10px;border-radius:8px;font-size:.78rem"><strong>Notes :</strong> ${dv.notes}</div>` : ''}
      <div class="btn-row mt-4 no-print">
        <button class="btn btn-gold btn-sm" onclick="Print.dv(db.devis.find(d=>d.id===${dv.id}))"><i data-lucide="printer"></i> PDF</button>
        <button class="btn btn-gold btn-sm" onclick="Print.downloadPdf(db.devis.find(d=>d.id===${dv.id}))"><i data-lucide="download"></i> Télécharger</button>
        <button class="btn btn-purple btn-sm" onclick="Historique.emailAndSetSent(${dv.id})"><i data-lucide="mail"></i> Email</button>
        ${statut === 'accepté' ? `<button class="btn btn-primary btn-sm" onclick="App.closeModal('m-dv');Paiements.openModal(${dv.id})"><i data-lucide="credit-card"></i> Paiement</button>` : ''}
        ${needsRelance(dv) ? `<button class="btn btn-gold btn-sm" onclick="App.closeModal('m-dv');Historique.relancer(${dv.id})"><i data-lucide="bell"></i> Relancer</button>` : ''}
        <button class="btn btn-ghost btn-sm" onclick="Devis.edit(${dv.id});App.closeModal('m-dv')"><i data-lucide="pencil"></i> Modifier</button>
        <button class="btn btn-danger btn-sm" onclick="Historique.del(${dv.id})"><i data-lucide="trash-2"></i> Supprimer</button>
      </div>
    </div>`;
  }

  // ── Supprimer ─────────────────────────────────────────────
  async function del(id) {
    const dv = db.devis.find(d => d.id === id);
    if (!dv || !confirm(`Supprimer ${dv.doctype === 'facture' ? 'la facture' : 'le devis'} ${dv.num} ?`)) return;
    try {
      await sbDeleteDv(id);
      db.devis = db.devis.filter(d => d.id !== id);
      App.closeModal('m-dv');
      render();
      App.updateBadges();
      App.toast('Supprimé', 'ok');
    } catch (err) {
      console.error(err);
      App.toast('Erreur de suppression', 'err');
    }
  }

  // ── Export CSV ────────────────────────────────────────────
  function exportCsv() {
    const headers = ['Numéro','Type','Client','Date','Statut','Événement','Lieu','Total (€)','Km'];
    const rows = db.devis.map(d => [
      d.num || '',
      d.doctype === 'facture' ? 'Facture' : 'Devis',
      `"${d.client || ''}"`,
      d.date || '',
      d.statut || 'brouillon',
      `"${d.type || ''}"`,
      `"${d.lieu || ''}"`,
      (d.total || 0).toFixed(2),
      d.km || 0
    ].join(','));
    const csv  = [headers.join(','), ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = 'devis_lfe_' + today() + '.csv';
    a.click();
    App.toast('CSV exporté ✅', 'ok');
  }

  return {
    render, filter, setFilter,
    openDetail, del, exportCsv,
    changeStatut, emailAndSetSent,
    relancer, saveRelance, sendRelanceEmail
  };
})();
window.Devis      = Devis;
window.Historique = Historique;

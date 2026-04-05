// ═══════════════════════════════════════════════════════════════
// SIMULATEUR.JS — Calculateur de prix
// ═══════════════════════════════════════════════════════════════

const Simulateur = (() => {
  let _selItem = null;  // matériel sélectionné

  // ── Rendu ─────────────────────────────────────────────────
  function render() {
    _renderAmortPreview();
    // Recalculer si un item est déjà sélectionné
    if (_selItem) _calc();
  }

  function _renderAmortPreview() {
    const el = document.getElementById('sim-amort-preview');
    if (!el) return;
    if (!db.amort?.length) {
      el.innerHTML = '<div class="text-sm" style="padding:12px 0">Table non chargée</div>';
      return;
    }
    el.innerHTML = `
      <table class="dt" style="font-size:.78rem">
        <thead><tr>
          <th>Tranche</th><th>Jours</th><th>Jour</th><th>W-end</th><th>Sem.</th>
        </tr></thead>
        <tbody>
          ${db.amort.map(r => `<tr>
            <td>${r.label}</td>
            <td style="text-align:center">${r.j}</td>
            <td style="text-align:center">÷${r.j}</td>
            <td style="text-align:center">×${r.c.weekend}</td>
            <td style="text-align:center">×${r.c.semaine}</td>
          </tr>`).join('')}
        </tbody>
      </table>`;
  }

  // ── Recherche autocomplete ─────────────────────────────────
  function search() {
    const input = document.getElementById('sim-search');
    const drop  = document.getElementById('sim-drop');
    if (!input || !drop) return;

    const q = input.value.toLowerCase().trim();
    if (!q) { drop.classList.remove('open'); return; }

    const results = db.cat
      .filter(i => i.name.toLowerCase().includes(q))
      .slice(0, 8);

    if (!results.length) { drop.classList.remove('open'); return; }

    drop.innerHTML = results.map(i => {
      const price = i.pa ? ` · ${i.pa.toLocaleString('fr-FR')} €` : '';
      return `<div class="autocomplete-item" onclick="Simulateur.pickItem(${i.id})">
        <strong>${i.name}</strong><span>${price}</span>
      </div>`;
    }).join('');
    drop.classList.add('open');
  }

  function pickItem(id) {
    const item  = db.cat.find(i => i.id === id);
    const input = document.getElementById('sim-search');
    const drop  = document.getElementById('sim-drop');
    const paEl  = document.getElementById('sim-pa');
    if (!item) return;

    _selItem = item;
    if (input) input.value = item.name;
    if (drop)  drop.classList.remove('open');
    if (paEl && item.pa) paEl.value = item.pa;

    // Afficher indicateur HT/TTC de l'article
    const infoEl = document.getElementById('sim-item-info');
    if (infoEl) {
      const tva = item.tva || 0;
      const tvaPct = tva ? `TVA ${(tva * 100).toFixed(1).replace('.0', '')}%` : 'Sans TVA';
      infoEl.style.display = 'block';
      infoEl.innerHTML = `<span class="badge bg-blue" style="font-size:.62rem">Prix HT</span> ${item.pa ? item.pa.toLocaleString('fr-FR') + ' €' : '—'} · <span style="color:var(--text3)">${tvaPct}</span>`;
    }

    _calc();
  }

  // ── Calcul ────────────────────────────────────────────────
  function calc() { _calc(); }

  function _calc() {
    const pa  = parseFloat(document.getElementById('sim-pa')?.value);
    const qty = parseInt(document.getElementById('sim-qty')?.value)  || 1;
    const res = document.getElementById('sim-result');
    const grid = document.getElementById('sim-grid');
    if (!res || !grid) return;

    if (!pa || pa <= 0) { res.style.display = 'none'; return; }

    const durations = ['jour', 'weekend', 'semaine', '2s', '3s', 'mois'];
    const labels    = ['1 Jour', 'Week-end', 'Semaine', '2 Semaines', '3 Semaines', 'Mois'];

    const tva = _selItem?.tva || 0;
    const cells = durations.map((d, i) => {
      const result = window.calc ? window.calc(pa, d, qty) : null;
      if (!result) return `<div class="sim-box"><div class="sim-lbl">${labels[i]}</div><div class="sim-val" style="font-size:.9rem;color:rgba(255,255,255,.3)">—</div></div>`;
      const isMain = d === 'weekend';
      const prixHT = result.disp;
      const ttcLine = tva ? `<div class="sim-sub">${(prixHT * (1 + tva)).toFixed(2)} € TTC</div>` : '';
      return `<div class="sim-box">
        <div class="sim-lbl">${labels[i]}</div>
        <div class="sim-val${isMain ? ' gold' : ''}">${prixHT.toFixed(2)} € <span style="font-size:.55rem;font-weight:400;opacity:.6">HT</span></div>
        ${ttcLine}
        <div class="sim-sub">Caution : ${result.caut} €</div>
      </div>`;
    });

    grid.innerHTML = cells.join('');
    res.style.display = 'block';
  }

  // ── Reset ──────────────────────────────────────────────────
  function reset() {
    _selItem = null;
    const ids = ['sim-search', 'sim-pa'];
    ids.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    const qtyEl = document.getElementById('sim-qty');
    if (qtyEl) qtyEl.value = 1;
    const res = document.getElementById('sim-result');
    if (res) res.style.display = 'none';
    const drop = document.getElementById('sim-drop');
    if (drop) drop.classList.remove('open');
    const info = document.getElementById('sim-item-info');
    if (info) info.style.display = 'none';
  }

  // ── Créer un devis depuis le simulateur ───────────────────
  function addToDevis() {
    const pa  = parseFloat(document.getElementById('sim-pa')?.value);
    const qty = parseInt(document.getElementById('sim-qty')?.value) || 1;
    if (!pa || pa <= 0) { App.toast('Saisissez un prix d\'achat', 'warn'); return; }

    // Passer les infos via Devis
    if (typeof Devis !== 'undefined') {
      Devis.prefill({
        name: _selItem?.name || document.getElementById('sim-search')?.value || '',
        pa,
        qty,
        id: _selItem?.id || null
      });
    }
    App.go('nouveau-devis');
  }

  // Fermer le dropdown si clic ailleurs
  document.addEventListener('click', e => {
    if (!e.target.closest('#sim-search') && !e.target.closest('#sim-drop')) {
      const drop = document.getElementById('sim-drop');
      if (drop) drop.classList.remove('open');
    }
  });

  return { render, search, pickItem, calc, reset, addToDevis };
})();
window.Simulateur = Simulateur;

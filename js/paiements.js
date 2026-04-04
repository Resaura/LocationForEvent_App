// ═══════════════════════════════════════════════════════════════
// PAIEMENTS.JS — Suivi des paiements Stripe (Payment Links)
// ═══════════════════════════════════════════════════════════════

// ── Fonctions Supabase ─────────────────────────────────────────
async function sbSavePaiement(p) {
  if (p.id) {
    const { id, ...data } = p;
    const { error } = await sb.from('paiements').update(data).eq('id', id);
    if (error) throw error;
  } else {
    const { id: _, ...data } = p;
    const { data: row, error } = await sb.from('paiements').insert(data).select('id').single();
    if (error) throw error;
    p.id = row.id;
  }
}

async function sbDeletePaiement(id) {
  const { error } = await sb.from('paiements').delete().eq('id', id);
  if (error) throw error;
}

// ── Module Paiements ───────────────────────────────────────────
const Paiements = (() => {
  let _filter = 'Tous';

  const STATUT_PAY = {
    'en_attente': { label: 'En attente', col: '#D97706', bg: '#FEF3C7', icon: '⏳' },
    'recu':       { label: 'Reçu',       col: '#059669', bg: '#D1FAE5', icon: '✅' },
    'annule':     { label: 'Annulé',     col: '#DC2626', bg: '#FEE2E2', icon: '❌' },
  };

  function _statutBadge(statut) {
    const s = STATUT_PAY[statut] || STATUT_PAY['en_attente'];
    return `<span style="font-size:.68rem;font-weight:600;padding:2px 8px;border-radius:99px;background:${s.bg};color:${s.col}">${s.icon} ${s.label}</span>`;
  }

  // ── Trouver le paiement lié à un devis ────────────────────
  function _forDevis(devisId) {
    return db.paiements.find(p => p.devis_id === devisId) || null;
  }

  // ── Calcul statut global d'un paiement ────────────────────
  function _globalStatus(p) {
    if (!p) return 'aucun';
    const aRecu = p.acompte_statut === 'recu';
    const sRecu = p.solde_statut === 'recu';
    if (aRecu && sRecu) return 'complet';
    if (aRecu || sRecu) return 'partiel';
    if (p.acompte_statut === 'annule' && p.solde_statut === 'annule') return 'annule';
    return 'en_attente';
  }

  // ── Ouvrir la modale de suivi paiement ────────────────────
  function openModal(devisId) {
    const dv = db.devis.find(d => d.id === devisId);
    if (!dv) return;

    let p = _forDevis(devisId);
    if (!p) {
      p = {
        devis_id:       devisId,
        total:          dv.total || 0,
        acompte_pct:    30,
        acompte_lien:   '',
        acompte_statut: 'en_attente',
        acompte_date:   '',
        solde_lien:     '',
        solde_statut:   'en_attente',
        solde_date:     '',
      };
    }

    const acompteMt = (p.total * p.acompte_pct / 100);
    const soldeMt   = p.total - acompteMt;

    const bdEl = document.getElementById('m-pay-bd');
    if (!bdEl) return;

    bdEl.innerHTML = `
      <input type="hidden" id="pay-devis-id" value="${devisId}">

      <div style="text-align:center;margin-bottom:16px">
        <div style="font-size:.78rem;color:var(--grey)">Devis ${dv.num || '—'} · ${dv.client || 'Sans client'}</div>
        <div style="font-size:1.3rem;font-weight:700;color:var(--navy)">${prixAffiche(p.total || 0).toFixed(2)} €${labelPrix() ? ' ' + labelPrix() : ''}</div>
      </div>

      <div class="sep"></div>

      <!-- Acompte -->
      <div style="margin-bottom:18px">
        <div style="font-size:.88rem;font-weight:700;color:var(--navy);margin-bottom:8px">💰 Acompte</div>
        <div class="r2" style="margin-bottom:8px">
          <div class="fg">
            <label class="fl">Pourcentage (%)</label>
            <input type="number" id="pay-acompte-pct" value="${p.acompte_pct}" min="0" max="100"
                   oninput="Paiements._updateMontants()">
          </div>
          <div class="fg">
            <label class="fl">Montant</label>
            <input type="text" id="pay-acompte-mt" value="${acompteMt.toFixed(2)} €" readonly
                   style="background:#F9FAFB;font-weight:600">
          </div>
        </div>
        <div class="fg mb-2">
          <label class="fl">Lien Stripe</label>
          <div style="display:flex;gap:6px">
            <input type="url" id="pay-acompte-lien" value="${p.acompte_lien || ''}" placeholder="https://buy.stripe.com/..." style="flex:1">
            <button class="btn btn-ghost btn-sm" onclick="Paiements._copyLien('pay-acompte-lien')" title="Copier">📋</button>
          </div>
        </div>
        <div class="r2">
          <div class="fg">
            <label class="fl">Statut</label>
            <select id="pay-acompte-statut">
              ${Object.entries(STATUT_PAY).map(([k, v]) =>
                `<option value="${k}" ${p.acompte_statut === k ? 'selected' : ''}>${v.icon} ${v.label}</option>`
              ).join('')}
            </select>
          </div>
          <div class="fg">
            <label class="fl">Date de réception</label>
            <input type="date" id="pay-acompte-date" value="${p.acompte_date || ''}">
          </div>
        </div>
        <div style="margin-top:6px">
          <button class="btn btn-purple btn-sm" onclick="Paiements._emailLien(${devisId}, 'acompte')">📧 Envoyer par email</button>
        </div>
      </div>

      <div class="sep"></div>

      <!-- Solde -->
      <div style="margin-bottom:18px">
        <div style="font-size:.88rem;font-weight:700;color:var(--navy);margin-bottom:8px">💳 Solde</div>
        <div class="fg mb-2">
          <label class="fl">Montant restant</label>
          <input type="text" id="pay-solde-mt" value="${soldeMt.toFixed(2)} €" readonly
                 style="background:#F9FAFB;font-weight:600">
        </div>
        <div class="fg mb-2">
          <label class="fl">Lien Stripe</label>
          <div style="display:flex;gap:6px">
            <input type="url" id="pay-solde-lien" value="${p.solde_lien || ''}" placeholder="https://buy.stripe.com/..." style="flex:1">
            <button class="btn btn-ghost btn-sm" onclick="Paiements._copyLien('pay-solde-lien')" title="Copier">📋</button>
          </div>
        </div>
        <div class="r2">
          <div class="fg">
            <label class="fl">Statut</label>
            <select id="pay-solde-statut">
              ${Object.entries(STATUT_PAY).map(([k, v]) =>
                `<option value="${k}" ${p.solde_statut === k ? 'selected' : ''}>${v.icon} ${v.label}</option>`
              ).join('')}
            </select>
          </div>
          <div class="fg">
            <label class="fl">Date de réception</label>
            <input type="date" id="pay-solde-date" value="${p.solde_date || ''}">
          </div>
        </div>
        <div style="margin-top:6px">
          <button class="btn btn-purple btn-sm" onclick="Paiements._emailLien(${devisId}, 'solde')">📧 Envoyer par email</button>
        </div>
      </div>

      <div class="sep"></div>
      <div class="btn-row">
        <button class="btn btn-primary" onclick="Paiements.save()">💾 Enregistrer</button>
        <button class="btn btn-ghost" onclick="App.closeModal('m-pay')">Annuler</button>
      </div>
    `;

    const titleEl = document.getElementById('m-pay-title');
    if (titleEl) titleEl.textContent = 'Suivi paiement — ' + (dv.num || 'Devis');
    App.openModal('m-pay');
  }

  // ── Mise à jour dynamique des montants ────────────────────
  function _updateMontants() {
    const devisId = parseInt(document.getElementById('pay-devis-id')?.value);
    const dv = db.devis.find(d => d.id === devisId);
    if (!dv) return;
    const pct  = parseFloat(document.getElementById('pay-acompte-pct')?.value) || 0;
    const total = dv.total || 0;
    const aEl  = document.getElementById('pay-acompte-mt');
    const sEl  = document.getElementById('pay-solde-mt');
    if (aEl) aEl.value = (total * pct / 100).toFixed(2) + ' €';
    if (sEl) sEl.value = (total - total * pct / 100).toFixed(2) + ' €';
  }

  // ── Copier un lien ────────────────────────────────────────
  function _copyLien(inputId) {
    const el = document.getElementById(inputId);
    if (!el || !el.value) { App.toast('Aucun lien à copier', 'warn'); return; }
    navigator.clipboard.writeText(el.value).then(
      () => App.toast('Lien copié !', 'ok'),
      () => App.toast('Erreur de copie', 'err')
    );
  }

  // ── Envoyer le lien par email ─────────────────────────────
  function _emailLien(devisId, type) {
    const dv = db.devis.find(d => d.id === devisId);
    if (!dv || !dv.email) { App.toast('Pas d\'email client', 'warn'); return; }

    const lienId = type === 'acompte' ? 'pay-acompte-lien' : 'pay-solde-lien';
    const lien   = document.getElementById(lienId)?.value || '';
    if (!lien) { App.toast('Collez d\'abord le lien Stripe', 'warn'); return; }

    const p      = db.params || {};
    const label  = type === 'acompte' ? 'Acompte' : 'Solde';
    const pct    = parseFloat(document.getElementById('pay-acompte-pct')?.value) || 30;
    const total  = dv.total || 0;
    const montant = type === 'acompte' ? (total * pct / 100) : (total - total * pct / 100);

    const subject = encodeURIComponent(`${label} — ${dv.num || 'Devis'} — ${p.nom || 'LocationForEvent'}`);
    const body    = encodeURIComponent(
      `Bonjour ${dv.client || ''},\n\n` +
      `Voici le lien de paiement pour le ${label.toLowerCase()} de votre ${dv.doctype === 'facture' ? 'facture' : 'devis'} ${dv.num || ''}.\n\n` +
      `Montant : ${montant.toFixed(2)} €\n` +
      `Lien de paiement : ${lien}\n\n` +
      `Cordialement,\n${p.nom || 'LocationForEvent'}\n${p.tel || ''}\n${p.email || ''}`
    );

    window.open(`mailto:${dv.email}?subject=${subject}&body=${body}`, '_self');
  }

  // ── Sauvegarder ───────────────────────────────────────────
  async function save() {
    const devisId = parseInt(document.getElementById('pay-devis-id')?.value);
    if (!devisId) return;

    const dv = db.devis.find(d => d.id === devisId);
    if (!dv) return;

    let p = _forDevis(devisId);
    const isNew = !p;
    if (isNew) p = {};

    p.devis_id       = devisId;
    p.total          = dv.total || 0;
    p.acompte_pct    = parseFloat(document.getElementById('pay-acompte-pct')?.value) || 30;
    p.acompte_lien   = document.getElementById('pay-acompte-lien')?.value || '';
    p.acompte_statut = document.getElementById('pay-acompte-statut')?.value || 'en_attente';
    p.acompte_date   = document.getElementById('pay-acompte-date')?.value || '';
    p.solde_lien     = document.getElementById('pay-solde-lien')?.value || '';
    p.solde_statut   = document.getElementById('pay-solde-statut')?.value || 'en_attente';
    p.solde_date     = document.getElementById('pay-solde-date')?.value || '';

    try {
      await sbSavePaiement(p);
      if (isNew) db.paiements.push(p);
      App.closeModal('m-pay');
      App.toast('Paiement sauvegardé ✅', 'ok');
      // Rafraîchir la page courante
      if (App.curPage === 'paiements') render();
      if (App.curPage === 'dashboard') App.renderDash();
      if (App.curPage === 'historique' && typeof Historique !== 'undefined') Historique.render();
    } catch (err) {
      console.error(err);
      App.toast('Erreur de sauvegarde', 'err');
    }
  }

  // ── Supprimer un paiement ─────────────────────────────────
  async function del(id) {
    if (!confirm('Supprimer ce suivi de paiement ?')) return;
    try {
      await sbDeletePaiement(id);
      db.paiements = db.paiements.filter(p => p.id !== id);
      render();
      App.toast('Paiement supprimé', 'ok');
    } catch (err) {
      console.error(err);
      App.toast('Erreur de suppression', 'err');
    }
  }

  // ── Filtre ────────────────────────────────────────────────
  function setFilter(f) { _filter = f; render(); }

  // ── Export CSV ────────────────────────────────────────────
  function exportCsv() {
    const rows = _buildList();
    if (!rows.length) { App.toast('Aucun paiement à exporter', 'warn'); return; }

    const header = 'Devis;Client;Total;Acompte %;Acompte Mt;Acompte Statut;Acompte Date;Solde Mt;Solde Statut;Solde Date\n';
    const csv = header + rows.map(r => {
      const dv = db.devis.find(d => d.id === r.devis_id) || {};
      const aMt = (r.total * r.acompte_pct / 100).toFixed(2);
      const sMt = (r.total - r.total * r.acompte_pct / 100).toFixed(2);
      return [
        dv.num || '', dv.client || '', r.total?.toFixed(2),
        r.acompte_pct, aMt, r.acompte_statut, r.acompte_date || '',
        sMt, r.solde_statut, r.solde_date || ''
      ].join(';');
    }).join('\n');

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `paiements_${today()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    App.toast('CSV exporté', 'ok');
  }

  // ── Construction de la liste filtrée ──────────────────────
  function _buildList() {
    let list = [...db.paiements];

    if (_filter === 'En attente') {
      list = list.filter(p => _globalStatus(p) === 'en_attente');
    } else if (_filter === 'Reçus') {
      list = list.filter(p => _globalStatus(p) === 'complet');
    } else if (_filter === 'Partiels') {
      list = list.filter(p => _globalStatus(p) === 'partiel');
    }

    return list;
  }

  // ── Rendu page paiements ──────────────────────────────────
  function render() {
    const all  = db.paiements;
    const list = _buildList();

    // ─ KPI ─
    const kpiEl = document.getElementById('pay-kpi');
    if (kpiEl) {
      const totalAttendu = all.reduce((s, p) => s + (p.total || 0), 0);
      const totalRecu    = all.reduce((s, p) => {
        let r = 0;
        if (p.acompte_statut === 'recu') r += (p.total * p.acompte_pct / 100);
        if (p.solde_statut === 'recu')   r += (p.total - p.total * p.acompte_pct / 100);
        return s + r;
      }, 0);
      const nbAttente = all.filter(p => _globalStatus(p) === 'en_attente').length;
      const nbComplet = all.filter(p => _globalStatus(p) === 'complet').length;

      kpiEl.innerHTML = `
        <div class="stat"><div class="stat-ic ic-blue">💰</div><div><div class="stat-lbl">Total attendu</div><div class="stat-val">${prixAffiche(totalAttendu).toFixed(2)} €</div></div></div>
        <div class="stat"><div class="stat-ic ic-green">✅</div><div><div class="stat-lbl">Total encaissé</div><div class="stat-val">${prixAffiche(totalRecu).toFixed(2)} €</div></div></div>
        <div class="stat"><div class="stat-ic ic-gold">⏳</div><div><div class="stat-lbl">En attente</div><div class="stat-val">${nbAttente}</div></div></div>
        <div class="stat"><div class="stat-ic ic-purple">🎯</div><div><div class="stat-lbl">Complets</div><div class="stat-val">${nbComplet}</div></div></div>
      `;
    }

    // ─ Chips filtre ─
    const chipsEl = document.getElementById('pay-chips');
    if (chipsEl) {
      const filtres = ['Tous', 'En attente', 'Reçus', 'Partiels'];
      chipsEl.innerHTML = filtres.map(f =>
        `<button class="chip${f === _filter ? ' on' : ''}" onclick="Paiements.setFilter('${f}')">${f}</button>`
      ).join('');
    }

    // ─ Liste ─
    const listEl  = document.getElementById('pay-list');
    const emptyEl = document.getElementById('pay-empty');
    if (!listEl) return;

    if (!list.length) {
      listEl.innerHTML = '';
      if (emptyEl) emptyEl.style.display = 'block';
      return;
    }
    if (emptyEl) emptyEl.style.display = 'none';

    listEl.innerHTML = list.map(p => {
      const dv  = db.devis.find(d => d.id === p.devis_id) || {};
      const gs  = _globalStatus(p);
      const aMt = (p.total * p.acompte_pct / 100);
      const sMt = p.total - aMt;

      const gsBadge = gs === 'complet' ? '<span style="font-size:.68rem;font-weight:600;padding:2px 8px;border-radius:99px;background:#D1FAE5;color:#059669">✅ Complet</span>'
                    : gs === 'partiel' ? '<span style="font-size:.68rem;font-weight:600;padding:2px 8px;border-radius:99px;background:#FEF3C7;color:#D97706">⚡ Partiel</span>'
                    : gs === 'annule'  ? '<span style="font-size:.68rem;font-weight:600;padding:2px 8px;border-radius:99px;background:#FEE2E2;color:#DC2626">❌ Annulé</span>'
                    : '<span style="font-size:.68rem;font-weight:600;padding:2px 8px;border-radius:99px;background:#FEF3C7;color:#D97706">⏳ En attente</span>';

      return `<div class="dvc" style="cursor:pointer" onclick="Paiements.openModal(${p.devis_id})">
        <div class="flex jb items-c">
          <div>
            <div class="dvc-num" style="display:flex;align-items:center;gap:6px">
              💳 ${dv.num || '—'} ${gsBadge}
            </div>
            <div class="dvc-client">${dv.client || 'Sans client'} · ${fmtDate(dv.date)}</div>
            <div style="font-size:.72rem;color:var(--grey);margin-top:3px">
              Acompte ${_statutBadge(p.acompte_statut)} ${aMt.toFixed(2)} €
              · Solde ${_statutBadge(p.solde_statut)} ${sMt.toFixed(2)} €
            </div>
          </div>
          <div style="text-align:right">
            <div class="dvc-total">${prixAffiche(p.total || 0).toFixed(2)} €</div>
            <button class="btn btn-danger btn-sm" style="margin-top:4px;font-size:.68rem"
              onclick="event.stopPropagation();Paiements.del(${p.id})">🗑️</button>
          </div>
        </div>
      </div>`;
    }).join('');
  }

  // ── Rendu dashboard : paiements en attente ────────────────
  function renderDashSection() {
    const el = document.getElementById('dash-paiements');
    if (!el) return;

    const pending = db.paiements.filter(p => {
      const gs = _globalStatus(p);
      return gs === 'en_attente' || gs === 'partiel';
    });

    if (!pending.length) {
      el.innerHTML = '<div style="padding:16px;color:var(--grey);font-size:.84rem">Aucun paiement en attente</div>';
      return;
    }

    el.innerHTML = pending.map(p => {
      const dv  = db.devis.find(d => d.id === p.devis_id) || {};
      const aMt = (p.total * p.acompte_pct / 100);
      const recu = (p.acompte_statut === 'recu' ? aMt : 0) + (p.solde_statut === 'recu' ? (p.total - aMt) : 0);

      return `<div class="dvc" onclick="Paiements.openModal(${p.devis_id})" style="cursor:pointer">
        <div class="flex jb items-c">
          <div>
            <div class="dvc-num">💳 ${dv.num || '—'} · ${dv.client || 'Sans client'}</div>
            <div class="dvc-client">${prixAffiche(recu).toFixed(2)} € reçu / ${prixAffiche(p.total || 0).toFixed(2)} € attendu</div>
          </div>
          <button class="btn btn-primary btn-sm" style="font-size:.72rem;padding:3px 10px"
            onclick="event.stopPropagation();Paiements.openModal(${p.devis_id})">💳 Gérer</button>
        </div>
      </div>`;
    }).join('');
  }

  return {
    render, openModal, save, del, setFilter, exportCsv,
    renderDashSection,
    _updateMontants, _copyLien, _emailLien,
  };
})();
window.Paiements = Paiements;

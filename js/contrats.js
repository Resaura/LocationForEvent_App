// ═══════════════════════════════════════════════════════════════
// CONTRATS.JS — Contrats & Protection
// ═══════════════════════════════════════════════════════════════

const Contrats = (() => {

  // ── Modèle par défaut ─────────────────────────────────────
  const DEFAULT_TEMPLATE = `ARTICLE 1 — PARTIES

LE LOUEUR :
{LOUEUR_NOM} — {LOUEUR_ADRESSE} — {LOUEUR_TEL} — {LOUEUR_EMAIL}
{LOUEUR_SIRET}

LE LOCATAIRE :
{CLIENT_NOM} — {CLIENT_TEL} — {CLIENT_EMAIL}

ARTICLE 2 — OBJET DU CONTRAT

Le Loueur met à disposition du Locataire le matériel suivant pour l'événement : {TYPE_EVENEMENT}
Lieu de l'événement : {LIEU_EVENEMENT}

DÉSIGNATION DU MATÉRIEL LOUÉ :
{TABLEAU_MATERIEL}

{SOUS_TOTAL_HT}
{TVA_DETAIL}
{TOTAL_TTC}

ARTICLE 3 — DURÉE DE LOCATION

Date et heure de mise à disposition : {DATE_RECUP} à {HEURE_RECUP}
Date et heure de restitution prévue : {DATE_RETOUR} à {HEURE_RETOUR}
Toute prolongation devra faire l'objet d'un accord écrit préalable du Loueur et donnera lieu à une facturation complémentaire.

ARTICLE 4 — PRIX ET MODALITÉS DE PAIEMENT

Montant total TTC de la location : {TOTAL_TTC}
Dépôt de garantie (caution) : {CAUTION}
La caution sera restituée dans les 48h suivant le retour du matériel en bon état.
Modalités de paiement : virement bancaire / espèces / chèque.

ARTICLE 5 — CONDITIONS D'UTILISATION

Le Locataire s'engage à :
• Utiliser le matériel conformément à sa destination et aux instructions du Loueur
• Ne pas prêter, sous-louer ou céder le matériel à des tiers
• Protéger le matériel contre toute dégradation, vol ou perte
• Restituer le matériel dans l'état dans lequel il a été remis, propre et en bon état de fonctionnement
• Signaler immédiatement tout incident ou dommage au Loueur

ARTICLE 6 — RESPONSABILITÉ ET TRANSFERT DE GARDE

La responsabilité et la garde juridique du matériel sont transférées au Locataire dès la mise à disposition du matériel. Le Locataire assume l'entière responsabilité du matériel pendant toute la durée de la location.
Il est conseillé au Locataire de souscrire une assurance responsabilité civile couvrant les dommages pouvant survenir pendant la période de location.

ARTICLE 7 — DOMMAGES ET PERTE

En cas de dégradation, perte ou vol du matériel :
• Les frais de réparation ou de remplacement seront à la charge du Locataire, sur présentation de justificatifs
• La caution sera retenue en tout ou partie selon les dommages constatés
• Si le coût des dommages excède le montant de la caution, le Locataire s'engage à régler le solde restant dû

ARTICLE 8 — ANNULATION

Toute annulation doit être notifiée par écrit au Loueur.
• Annulation à plus de 30 jours : remboursement intégral de l'acompte
• Annulation entre 15 et 30 jours : retenue de 50% de l'acompte
• Annulation à moins de 15 jours : acompte intégralement retenu

ARTICLE 9 — ÉTAT DU MATÉRIEL

Le Loueur certifie que le matériel a été vérifié et nettoyé avant sa mise à disposition. Le Locataire reconnaît recevoir le matériel en bon état de fonctionnement.
Un contrôle sera effectué au retour du matériel. Le Loueur dispose de 48 heures pour signaler tout dommage constaté après restitution.

ARTICLE 10 — LITIGES

En cas de litige, les parties s'engagent à rechercher une solution amiable. À défaut, le litige sera soumis aux tribunaux compétents du ressort du siège du Loueur, conformément au droit français.`;

  const VARIABLES = [
    '{LOUEUR_NOM}', '{LOUEUR_ADRESSE}', '{LOUEUR_TEL}', '{LOUEUR_EMAIL}', '{LOUEUR_SIRET}',
    '{CLIENT_NOM}', '{CLIENT_TEL}', '{CLIENT_EMAIL}',
    '{NUM_CONTRAT}', '{DATE_EMISSION}', '{DATE_RECUP}', '{HEURE_RECUP}', '{DATE_RETOUR}', '{HEURE_RETOUR}',
    '{LIEU_EVENEMENT}', '{TYPE_EVENEMENT}',
    '{TABLEAU_MATERIEL}', '{SOUS_TOTAL_HT}', '{TVA_DETAIL}', '{TOTAL_TTC}', '{CAUTION}',
    '{VILLE_LOUEUR}', '{DATE_SIGNATURE}',
  ];

  const DEFAULT_PROTECTION = [
    { nom: 'Option Protection Essentielle', description: 'Dommages accidentels pris en charge jusqu\'à 100 €', type_tarif: 'fixe', valeur: 15, plafond_couverture: 100, actif: true },
    { nom: 'Option Protection Standard',    description: 'Dommages accidentels pris en charge jusqu\'à 300 €', type_tarif: 'fixe', valeur: 30, plafond_couverture: 300, actif: true },
    { nom: 'Option Protection Premium',     description: 'Dommages accidentels pris en charge jusqu\'à 500 €', type_tarif: 'pourcentage', valeur: 5, plafond_couverture: 500, actif: true },
  ];

  // ── Rendu principal ───────────────────────────────────────
  function render() {
    _renderTemplate();
    _renderProtection();
    _renderMentions();
  }

  // ══════════════════════════════════════════════════════════
  // SECTION A — Modèle de contrat
  // ══════════════════════════════════════════════════════════
  function _renderTemplate() {
    const el = document.getElementById('ct-template-editor');
    if (!el) return;
    const tpl = db.contrat_template || DEFAULT_TEMPLATE;
    el.value = tpl;
    _updatePreview();
  }

  function _updatePreview() {
    const el = document.getElementById('ct-preview');
    const editor = document.getElementById('ct-template-editor');
    if (!el || !editor) return;
    const p = db.params || {};
    const fake = {
      '{LOUEUR_NOM}':      p.nom || 'Ma Société',
      '{LOUEUR_ADRESSE}':  p.adr || '1 rue Exemple, 38000 Grenoble',
      '{LOUEUR_TEL}':      p.tel || '06 12 34 56 78',
      '{LOUEUR_EMAIL}':    p.email || 'contact@exemple.com',
      '{LOUEUR_SIRET}':    p.siret || '123 456 789 00010',
      '{CLIENT_NOM}':      'Jean Dupont',
      '{CLIENT_TEL}':      '06 98 76 54 32',
      '{CLIENT_EMAIL}':    'jean@exemple.com',
      '{NUM_CONTRAT}':     'D-0042',
      '{DATE_EMISSION}':   fmtDate(today()),
      '{DATE_RECUP}':      '15/06/2026',
      '{HEURE_RECUP}':     '09:00',
      '{DATE_RETOUR}':     '17/06/2026',
      '{HEURE_RETOUR}':    '18:00',
      '{LIEU_EVENEMENT}':  'Salle des fêtes, Bourgoin-Jallieu',
      '{TYPE_EVENEMENT}':  'Mariage',
      '{TABLEAU_MATERIEL}':'[Tableau du matériel]',
      '{SOUS_TOTAL_HT}':   'Sous-total HT : 350.00 €',
      '{TVA_DETAIL}':      'TVA 20% : 70.00 €',
      '{TOTAL_TTC}':       'Total TTC : 420.00 €',
      '{CAUTION}':         '280 €',
      '{VILLE_LOUEUR}':    (p.adr || '').split(',').pop()?.trim() || 'Bourgoin-Jallieu',
      '{DATE_SIGNATURE}':  fmtDate(today()),
    };
    let text = editor.value;
    for (const [k, v] of Object.entries(fake)) {
      text = text.split(k).join(`<strong style="color:var(--blue)">${v}</strong>`);
    }
    el.innerHTML = text.replace(/\n/g, '<br>');
  }

  async function saveTemplate() {
    const editor = document.getElementById('ct-template-editor');
    if (!editor) return;
    db.contrat_template = editor.value;
    try {
      await sb.from('config').upsert({ key: 'contrat_template', value: JSON.stringify(editor.value) }, { onConflict: 'key' });
      App.toast('Modèle sauvegardé ✅', 'ok');
    } catch (err) {
      console.error(err);
      App.toast('Erreur sauvegarde modèle', 'err');
    }
  }

  function resetTemplate() {
    if (!confirm('Réinitialiser le modèle par défaut ?')) return;
    const editor = document.getElementById('ct-template-editor');
    if (editor) editor.value = DEFAULT_TEMPLATE;
    db.contrat_template = DEFAULT_TEMPLATE;
    _updatePreview();
    App.toast('Modèle réinitialisé', 'ok');
  }

  // ══════════════════════════════════════════════════════════
  // SECTION B — Options Protection
  // ══════════════════════════════════════════════════════════
  function _renderProtection() {
    const el = document.getElementById('ct-prot-list');
    if (!el) return;
    const items = db.options_protection || [];
    if (!items.length) {
      el.innerHTML = '<div style="padding:12px;color:var(--grey);font-size:.82rem">Aucune option configurée</div>';
      return;
    }
    el.innerHTML = items.map(o => {
      const prix = o.type_tarif === 'pourcentage' ? `${o.valeur}% du total HT` : `${o.valeur.toFixed(2)} €`;
      return `<div class="flex jb items-c" style="padding:10px 0;border-bottom:1px solid var(--border)">
        <div>
          <div style="font-weight:600">${o.nom} ${!o.actif ? '<span class="badge bg-grey">Inactif</span>' : ''}</div>
          <div class="text-sm" style="color:var(--grey)">${o.description || ''} · ${prix} · Couvre jusqu'à ${o.plafond_couverture} €</div>
        </div>
        <div class="flex gap-2">
          <button class="btn btn-ghost btn-xs" onclick="Contrats.toggleProtection(${o.id})">${o.actif ? 'Désactiver' : 'Activer'}</button>
          <button class="btn btn-ghost btn-xs btn-icon" onclick="Contrats.openProtModal(${o.id})" title="Modifier"><i data-lucide="pencil"></i></button>
          <button class="btn btn-danger btn-xs btn-icon" onclick="Contrats.delProtection(${o.id})" title="Supprimer"><i data-lucide="trash-2"></i></button>
        </div>
      </div>`;
    }).join('');
    lucide.createIcons({ nodes: el.querySelectorAll('[data-lucide]') });
  }

  function openProtModal(id) {
    const titleEl = document.getElementById('m-prot-title');
    const idEl    = document.getElementById('m-prot-id');
    if (id) {
      const o = db.options_protection.find(x => x.id === id);
      if (!o) return;
      if (titleEl) titleEl.textContent = 'Modifier l\'option';
      if (idEl) idEl.value = id;
      document.getElementById('m-prot-nom').value = o.nom;
      document.getElementById('m-prot-desc').value = o.description || '';
      document.getElementById('m-prot-type').value = o.type_tarif || 'fixe';
      document.getElementById('m-prot-valeur').value = o.valeur;
      document.getElementById('m-prot-plafond').value = o.plafond_couverture || 0;
      document.getElementById('m-prot-actif').checked = o.actif !== false;
    } else {
      if (titleEl) titleEl.textContent = 'Nouvelle option protection';
      if (idEl) idEl.value = '';
      ['m-prot-nom', 'm-prot-desc'].forEach(x => { const e = document.getElementById(x); if (e) e.value = ''; });
      document.getElementById('m-prot-type').value = 'fixe';
      document.getElementById('m-prot-valeur').value = '';
      document.getElementById('m-prot-plafond').value = '';
      document.getElementById('m-prot-actif').checked = true;
    }
    App.openModal('m-prot');
  }

  async function saveProtection() {
    const nom = (document.getElementById('m-prot-nom')?.value || '').trim();
    if (!nom) { App.toast('Le nom est requis', 'err'); return; }
    const id = parseInt(document.getElementById('m-prot-id')?.value) || null;
    const data = {
      nom,
      description:       (document.getElementById('m-prot-desc')?.value || '').trim(),
      type_tarif:        document.getElementById('m-prot-type')?.value || 'fixe',
      valeur:            parseFloat(document.getElementById('m-prot-valeur')?.value) || 0,
      plafond_couverture: parseFloat(document.getElementById('m-prot-plafond')?.value) || 0,
      actif:             document.getElementById('m-prot-actif')?.checked ?? true,
    };

    try {
      if (id) {
        const { error } = await sb.from('options_protection').update(data).eq('id', id);
        if (error) throw error;
        const idx = db.options_protection.findIndex(x => x.id === id);
        if (idx >= 0) db.options_protection[idx] = { ...db.options_protection[idx], ...data };
      } else {
        const { data: row, error } = await sb.from('options_protection').insert(data).select('id').single();
        if (error) throw error;
        db.options_protection.push({ id: row.id, ...data });
      }
      App.closeModal('m-prot');
      _renderProtection();
      App.toast('Option sauvegardée ✅', 'ok');
    } catch (err) {
      console.error(err);
      App.toast('Erreur sauvegarde', 'err');
    }
  }

  async function toggleProtection(id) {
    const o = db.options_protection.find(x => x.id === id);
    if (!o) return;
    o.actif = !o.actif;
    try {
      await sb.from('options_protection').update({ actif: o.actif }).eq('id', id);
      _renderProtection();
    } catch (err) {
      console.error(err);
      App.toast('Erreur', 'err');
    }
  }

  async function delProtection(id) {
    if (!confirm('Supprimer cette option ?')) return;
    try {
      await sb.from('options_protection').delete().eq('id', id);
      db.options_protection = db.options_protection.filter(x => x.id !== id);
      _renderProtection();
      App.toast('Option supprimée', 'ok');
    } catch (err) {
      console.error(err);
      App.toast('Erreur suppression', 'err');
    }
  }

  async function seedDefaults() {
    try {
      const { data, error } = await sb.from('options_protection').insert(DEFAULT_PROTECTION).select('*');
      if (error) throw error;
      db.options_protection = data || [];
    } catch (err) {
      console.error('Seed options_protection error:', err);
    }
  }

  // ══════════════════════════════════════════════════════════
  // SECTION C — Mentions légales contrat
  // ══════════════════════════════════════════════════════════
  function _renderMentions() {
    const el = document.getElementById('ct-mentions');
    if (!el) return;
    el.value = db.contrat_mentions || '';
  }

  async function saveMentions() {
    const el = document.getElementById('ct-mentions');
    if (!el) return;
    db.contrat_mentions = el.value;
    try {
      await sb.from('config').upsert({ key: 'contrat_mentions', value: JSON.stringify(el.value) }, { onConflict: 'key' });
      App.toast('Mentions sauvegardées ✅', 'ok');
    } catch (err) {
      console.error(err);
      App.toast('Erreur sauvegarde', 'err');
    }
  }

  // ══════════════════════════════════════════════════════════
  // Helpers publics
  // ══════════════════════════════════════════════════════════
  function getTemplate() {
    return db.contrat_template || DEFAULT_TEMPLATE;
  }

  function getDefaultTemplate() {
    return DEFAULT_TEMPLATE;
  }

  return {
    render, saveTemplate, resetTemplate, _updatePreview,
    openProtModal, saveProtection, toggleProtection, delProtection, seedDefaults,
    saveMentions, getTemplate, getDefaultTemplate,
  };
})();
window.Contrats = Contrats;

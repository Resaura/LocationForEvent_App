// ═══════════════════════════════════════════════════════════════
// EMAILS.JS — Module Emails / Communication
// ═══════════════════════════════════════════════════════════════

// ─── SUPABASE HELPERS ────────────────────────────────────────
async function sbInsertEmailLog(entry) {
  const { data: row, error } = await sb.from('emails_log').insert(entry).select('id,date_envoi').single();
  if (error) throw error;
  return row;
}

async function sbLoadEmailsLog() {
  const { data, error } = await sb.from('emails_log').select('*').order('date_envoi', { ascending: false }).limit(50);
  if (error) throw error;
  return data || [];
}

// ─── CONTEXTES ───────────────────────────────────────────────
const EMAIL_CONTEXTES = [
  { key: '1er-contact',   label: '1er contact' },
  { key: 'envoi-devis',   label: 'Envoi devis' },
  { key: 'relance-j3',    label: 'Relance J+3' },
  { key: 'relance-j7',    label: 'Relance J+7' },
  { key: 'relance-j14',   label: 'Relance J+14' },
  { key: 'confirmation',  label: 'Confirmation' },
  { key: 'rappel',        label: 'Rappel J-3' },
  { key: 'remerciement',  label: 'Remerciement' },
  { key: 'avis-google',   label: 'Avis Google' },
];

// ─── SIGNATURE ───────────────────────────────────────────────
const EMAIL_SIGN = `\nLocationForEvent\n07 88 52 81 15\nlocationforevent.com`;

// ─── TEMPLATES ───────────────────────────────────────────────
const EMAIL_TEMPLATES = {

  '1er-contact': {
    objet: 'Votre demande de location \u2014 LocationForEvent',
    corps: `Bonjour {prenom},

Nous avons bien re\u00e7u votre demande concernant votre {event} pr\u00e9vu le {date_event}.

Nous pr\u00e9parons un devis personnalis\u00e9 adapt\u00e9 \u00e0 vos besoins. Vous le recevrez sous 24 heures.

Notre mat\u00e9riel est r\u00e9guli\u00e8rement entretenu et v\u00e9rifi\u00e9 avant chaque mise \u00e0 disposition. Nous restons disponibles pour toute question en attendant.

\u00c0 tr\u00e8s bient\u00f4t,${EMAIL_SIGN}`
  },

  'envoi-devis': {
    objet: 'Votre devis LocationForEvent \u00b7 {ref}',
    corps: `Bonjour {prenom},

Veuillez trouver ci-joint votre devis {ref} pour votre {event} du {date_event}.

Mat\u00e9riel pr\u00e9vu : {materiel}
Montant total : {montant}

Ce devis est valable 30 jours. Pour confirmer et bloquer la disponibilit\u00e9 du mat\u00e9riel, il vous suffit de nous r\u00e9pondre directement.

Nous restons \u00e0 votre disposition pour toute question ou modification.

Bien cordialement,${EMAIL_SIGN}`
  },

  'relance-j3': {
    objet: 'Votre devis LocationForEvent \u00b7 {ref}',
    corps: `Bonjour {prenom},

Nous nous permettons de revenir vers vous pour nous assurer que vous avez bien re\u00e7u notre devis {ref} concernant votre {event} du {date_event}.

Si vous avez des questions ou si vous souhaitez apporter des modifications, nous sommes \u00e0 votre \u00e9coute.

Bien cordialement,${EMAIL_SIGN}`
  },

  'relance-j7': {
    objet: 'Relance devis {ref} \u2014 {event} du {date_event}',
    corps: `Bonjour {prenom},

Nous revenons vers vous au sujet du devis {ref} envoy\u00e9 il y a quelques jours pour votre {event} du {date_event}.

Le mat\u00e9riel demand\u00e9 reste disponible pour le moment, mais nous ne pouvons pas garantir cette disponibilit\u00e9 ind\u00e9finiment.

Si le projet a \u00e9volu\u00e9 ou si vous souhaitez adapter le devis, n'h\u00e9sitez pas \u00e0 nous le faire savoir.

Bien cordialement,${EMAIL_SIGN}`
  },

  'relance-j14': {
    objet: 'Derni\u00e8re disponibilit\u00e9 \u2014 {event} du {date_event}',
    corps: `Bonjour {prenom},

Nous vous contactons une derni\u00e8re fois concernant le devis {ref} pour votre {event} du {date_event}.

La disponibilit\u00e9 du mat\u00e9riel ne pourra pas \u00eatre maintenue au-del\u00e0 de cette semaine. Si vous \u00eates toujours int\u00e9ress\u00e9(e), nous vous invitons \u00e0 nous confirmer rapidement.

Si votre projet a chang\u00e9, aucun souci. Nous restons \u00e0 votre disposition pour une prochaine occasion.

Bien cordialement,${EMAIL_SIGN}`
  },

  'confirmation': {
    objet: 'Confirmation de votre r\u00e9servation \u2014 LocationForEvent',
    corps: `Bonjour {prenom},

Nous avons le plaisir de vous confirmer la r\u00e9servation pour votre {event} du {date_event}.

R\u00e9capitulatif :
\u2022 Mat\u00e9riel : {materiel}
\u2022 Montant : {montant}
\u2022 R\u00e9f\u00e9rence : {ref}

Nous vous recontacterons prochainement pour organiser la livraison ou le retrait du mat\u00e9riel.

Merci pour votre confiance.

Bien cordialement,${EMAIL_SIGN}`
  },

  'rappel': {
    objet: 'Rappel \u2014 votre location du {date_event}',
    corps: `Bonjour {prenom},

Votre {event} approche. Voici un rappel des d\u00e9tails de votre location :

\u2022 Mat\u00e9riel : {materiel}
\u2022 Date : {date_event}
\u2022 R\u00e9f\u00e9rence : {ref}

Si vous avez un changement de derni\u00e8re minute, contactez-nous d\u00e8s que possible.

Nous vous souhaitons un excellent \u00e9v\u00e9nement.

Bien cordialement,${EMAIL_SIGN}`
  },

  'remerciement': {
    objet: 'Merci pour votre confiance \u2014 LocationForEvent',
    corps: `Bonjour {prenom},

Nous esp\u00e9rons que votre {event} s'est parfaitement d\u00e9roul\u00e9.

Ce fut un plaisir de vous accompagner. Si vous avez un prochain projet, nous serons ravis de travailler \u00e0 nouveau ensemble.

N'h\u00e9sitez pas \u00e0 nous contacter pour toute future occasion.

Bien cordialement,${EMAIL_SIGN}`
  },

  'avis-google': {
    objet: 'Un avis de votre part nous aiderait beaucoup',
    corps: `Bonjour {prenom},

Nous esp\u00e9rons que votre {event} a \u00e9t\u00e9 une r\u00e9ussite.

En tant que petite entreprise, les avis de nos clients nous aident \u00e0 nous faire conna\u00eetre. Si vous avez quelques secondes, un avis Google serait tr\u00e8s appr\u00e9ci\u00e9 :

[LIEN AVIS GOOGLE]

Merci par avance, et \u00e0 bient\u00f4t pour un prochain \u00e9v\u00e9nement.

Bien cordialement,${EMAIL_SIGN}`
  },
};

// ─── MODULE EMAILS ───────────────────────────────────────────
const Emails = (() => {
  let _ctx       = '1er-contact';
  let _selDevis  = null;
  let _log       = [];
  let _vars      = { prenom: '', nom: '', event: '', date_event: '', materiel: '', montant: '', ref: '' };

  // ── Render principal ─────────────────────────────────────
  function render() {
    _renderContextTabs();
    _renderVarsForm();
    _renderPreview();
    _renderLog();
  }

  // ── S\u00e9lecteur de devis ───────────────────────────────────
  function searchDevis() {
    const el = document.getElementById('em-devis-search');
    const listEl = document.getElementById('em-devis-list');
    if (!el || !listEl) return;
    const q = el.value.toLowerCase().trim();
    if (!q) { listEl.innerHTML = ''; listEl.style.display = 'none'; return; }
    const results = db.devis.filter(d =>
      (d.client || '').toLowerCase().includes(q) ||
      (d.num || '').toLowerCase().includes(q) ||
      (d.email || '').toLowerCase().includes(q)
    ).slice(0, 8);
    if (!results.length) {
      listEl.innerHTML = '<div style="padding:8px 12px;color:var(--grey);font-size:.82rem">Aucun devis trouv\u00e9</div>';
      listEl.style.display = 'block';
      return;
    }
    listEl.innerHTML = results.map(d => {
      const statut = d.statut || 'brouillon';
      return `<div class="em-devis-item" onclick="Emails.selectDevis(${d.id})" style="padding:8px 12px;cursor:pointer;border-bottom:1px solid var(--border);font-size:.84rem;display:flex;justify-content:space-between;align-items:center">
        <div><strong>${d.num || '\u2014'}</strong> \u00b7 ${d.client || 'Sans client'}</div>
        <div style="color:var(--grey);font-size:.76rem">${d.total ? d.total.toFixed(2) + ' \u20ac' : ''} \u00b7 ${statut}</div>
      </div>`;
    }).join('');
    listEl.style.display = 'block';
  }

  function selectDevis(id) {
    const d = db.devis.find(x => x.id === id);
    if (!d) return;
    _selDevis = d;
    document.getElementById('em-devis-search').value = `${d.num || '\u2014'} \u00b7 ${d.client || ''}`;
    document.getElementById('em-devis-list').style.display = 'none';

    // Pr\u00e9nom / nom
    const parts = (d.client || '').trim().split(/\s+/);
    const prenom = parts[0] || '';
    const nom = parts.slice(1).join(' ') || '';

    // Mat\u00e9riel principal
    const lines = (d.lines || []).filter(l => !l.optional);
    const materiel = lines.length
      ? (lines.length === 1 ? lines[0].name : lines[0].name + ' + ' + (lines.length - 1) + ' autre(s)')
      : '\u2014';

    // Date \u00e9v\u00e9nement (r\u00e9cup\u00e9ration)
    const dateEvent = d.recup ? fmtDate(d.recup.substring(0, 10)) : (d.date ? fmtDate(d.date) : '');

    // Montant TTC
    let montant = d.total ? d.total.toFixed(2) + ' \u20ac' : '';
    if (typeof calcTvaMap === 'function' && lines.length) {
      try {
        const recalc = lines.map(l => {
          const ll = { ...l, remises: l.remises || [] };
          let base = ll.prix;
          for (const r of ll.remises) {
            if (r.type === 'pourcentage') r.montant_deduit = (base * r.valeur / 100);
            else r.montant_deduit = Math.min(r.valeur, base);
            base -= r.montant_deduit;
          }
          ll.prixNet = Math.max(0, base);
          return ll;
        });
        const sousTotal = recalc.reduce((s, l) => s + l.prixNet, 0);
        const dvRemises = d.remises || [];
        const totalRem = dvRemises.reduce((s, r) => s + (r.montant_deduit || 0), 0);
        const tot = Math.max(0, sousTotal - totalRem);
        const tvaMap = calcTvaMap(recalc.map(l => ({ ...l, prix: l.prixNet })), totalRem, sousTotal);
        const totalTVA = Object.values(tvaMap).reduce((s, v) => s + v.montantTva, 0);
        montant = (tot + totalTVA).toFixed(2) + ' \u20ac TTC';
      } catch (e) { /* fallback d\u00e9j\u00e0 d\u00e9fini */ }
    }

    _vars = { prenom, nom, event: d.type || '', date_event: dateEvent, materiel, montant, ref: d.num || '' };
    _renderVarsForm();
    _renderPreview();
  }

  // ── Onglets contexte ─────────────────────────────────────
  function _renderContextTabs() {
    const el = document.getElementById('em-ctx-tabs');
    if (!el) return;
    el.innerHTML = EMAIL_CONTEXTES.map(c =>
      `<button class="chip${c.key === _ctx ? ' on' : ''}" onclick="Emails.setContext('${c.key}')">${c.label}</button>`
    ).join('');
  }

  function setContext(key) {
    _ctx = key;
    _renderContextTabs();
    _renderPreview();
  }

  // ── Formulaire variables ─────────────────────────────────
  function _renderVarsForm() {
    const map = { prenom: 'em-v-prenom', nom: 'em-v-nom', event: 'em-v-event', date_event: 'em-v-date', materiel: 'em-v-materiel', montant: 'em-v-montant', ref: 'em-v-ref' };
    for (const [key, id] of Object.entries(map)) {
      const el = document.getElementById(id);
      if (el) el.value = _vars[key] || '';
    }
  }

  function updateVar(key) {
    const map = { prenom: 'em-v-prenom', nom: 'em-v-nom', event: 'em-v-event', date_event: 'em-v-date', materiel: 'em-v-materiel', montant: 'em-v-montant', ref: 'em-v-ref' };
    const el = document.getElementById(map[key]);
    if (el) _vars[key] = el.value;
    _renderPreview();
  }

  // ── Pr\u00e9visualisation ─────────────────────────────────────
  function _renderPreview() {
    const tpl = EMAIL_TEMPLATES[_ctx];
    if (!tpl) return;
    const objEl = document.getElementById('em-preview-objet');
    const bodyEl = document.getElementById('em-preview-body');
    if (!objEl || !bodyEl) return;

    objEl.innerHTML = _replaceVars(tpl.objet);
    bodyEl.innerHTML = _replaceVars(tpl.corps).replace(/\n/g, '<br>');
  }

  function _replaceVars(text) {
    return text.replace(/\{(\w+)\}/g, (match, key) => {
      const val = _vars[key];
      if (val && val.trim()) return val;
      return `<span style="background:#FEF3C7;color:#D97706;padding:1px 4px;border-radius:3px;font-size:.88em">${match}</span>`;
    });
  }

  function _plainText(text) {
    return text.replace(/\{(\w+)\}/g, (match, key) => {
      const val = _vars[key];
      return (val && val.trim()) ? val : match;
    });
  }

  // ── Actions ──────────────────────────────────────────────
  async function copyMail() {
    const tpl = EMAIL_TEMPLATES[_ctx];
    if (!tpl) return;
    const objet = _plainText(tpl.objet);
    const corps = _plainText(tpl.corps);
    try {
      await navigator.clipboard.writeText(`Objet : ${objet}\n\n${corps}`);
      App.toast('Mail copi\u00e9 dans le presse-papier \u2705', 'ok');
    } catch (err) {
      console.error(err);
      App.toast('Erreur lors de la copie', 'err');
    }
  }

  function openMailto() {
    const tpl = EMAIL_TEMPLATES[_ctx];
    if (!tpl) return;
    const objet = _plainText(tpl.objet);
    const corps = _plainText(tpl.corps);
    const to = _selDevis?.email || '';
    window.location.href = `mailto:${to}?subject=${encodeURIComponent(objet)}&body=${encodeURIComponent(corps)}`;
  }

  async function saveLog() {
    const tpl = EMAIL_TEMPLATES[_ctx];
    if (!tpl) return;
    const entry = {
      devis_id: _selDevis?.id || null,
      contexte: EMAIL_CONTEXTES.find(c => c.key === _ctx)?.label || _ctx,
      objet: _plainText(tpl.objet),
      destinataire: _selDevis?.email || _selDevis?.client || '',
    };
    try {
      const row = await sbInsertEmailLog(entry);
      entry.id = row.id;
      entry.date_envoi = row.date_envoi;
      entry.client = _selDevis?.client || entry.destinataire;
      _log.unshift(entry);
      _renderLog();
      App.toast('Envoi enregistr\u00e9 \u2705', 'ok');
    } catch (err) {
      console.error(err);
      App.toast('Erreur lors de l\'enregistrement', 'err');
    }
  }

  // ── Historique ───────────────────────────────────────────
  function _renderLog() {
    const el = document.getElementById('em-log-body');
    if (!el) return;
    if (!_log.length) {
      el.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--grey);padding:14px;font-size:.84rem">Aucun envoi enregistr\u00e9</td></tr>';
      return;
    }
    el.innerHTML = _log.slice(0, 30).map(e => {
      const date = e.date_envoi ? fmtDt(e.date_envoi) : '\u2014';
      const client = e.client || e.destinataire || '\u2014';
      return `<tr>
        <td style="font-size:.82rem">${date}</td>
        <td style="font-size:.82rem">${client}</td>
        <td style="font-size:.82rem"><span class="badge bg-blue">${e.contexte}</span></td>
        <td style="font-size:.82rem">${e.objet || '\u2014'}</td>
      </tr>`;
    }).join('');
  }

  // ── Chargement des logs depuis Supabase ──────────────────
  async function loadLog() {
    try {
      const data = await sbLoadEmailsLog();
      _log = data.map(e => {
        if (e.devis_id) {
          const dv = db.devis.find(d => d.id === e.devis_id);
          if (dv) e.client = dv.client;
        }
        return e;
      });
    } catch (err) {
      console.error('Erreur chargement emails_log :', err);
    }
  }

  return { render, searchDevis, selectDevis, setContext, updateVar, copyMail, openMailto, saveLog, loadLog };
})();
window.Emails = Emails;

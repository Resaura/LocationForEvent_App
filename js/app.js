// ═══════════════════════════════════════════════════════════════
// APP.JS — LocationForEvent
// Navigation · Init Supabase · État global · Utilitaires
// ═══════════════════════════════════════════════════════════════

// ─── ÉTAT GLOBAL ─────────────────────────────────────────────
let db = {
  cat:        [],   // matériel
  devis:      [],
  clients:    [],
  amort:      [],
  categories: [],
  params:     {},
  ndv:        1,    // prochain numéro de devis
  nid:        100,  // prochain id interne
  services:        [],   // prestations facturables
  epicerie:        [],   // produits alimentaires & consommables
  types_evenement: [],   // types d'événements (noms)
  paiements:       [],   // suivi paiements Stripe
  remises:         [],   // remises configurées
};

// ─── CONSTANTES ──────────────────────────────────────────────
const DL = {
  jour:     '1 Jour',
  weekend:  'Week-end',
  semaine:  '1 Semaine',
  '2s':     '2 Semaines',
  '3s':     '3 Semaines',
  mois:     '1 Mois',
  service:  'Prestation',
  epicerie: 'Épicerie',
};

const DA_DEFAULT = [
  { id:1, label:'< 200 €',       min:0,    max:200,      j:7,  c:{ weekend:1.5, semaine:3.5, '2s':5.5, '3s':7.0,  mois:9.0  }, caut:.80 },
  { id:2, label:'201 – 500 €',   min:200,  max:500,      j:8,  c:{ weekend:1.5, semaine:3.5, '2s':5.5, '3s':7.0,  mois:9.0  }, caut:.60 },
  { id:3, label:'501 – 1 000 €', min:500,  max:1000,     j:10, c:{ weekend:1.5, semaine:3.5, '2s':5.5, '3s':7.0,  mois:9.0  }, caut:.55 },
  { id:4, label:'1 001 – 2 000€',min:1000, max:2000,     j:12, c:{ weekend:1.5, semaine:3.5, '2s':5.5, '3s':7.0,  mois:9.0  }, caut:.50 },
  { id:5, label:'2 001 – 3 000€',min:2000, max:3000,     j:13, c:{ weekend:1.5, semaine:3.5, '2s':5.5, '3s':6.75, mois:8.75 }, caut:.40 },
  { id:6, label:'3 001 – 4 500€',min:3000, max:4500,     j:14, c:{ weekend:1.5, semaine:3.4, '2s':5.25,'3s':6.5,  mois:8.5  }, caut:.35 },
  { id:7, label:'> 4 500 €',     min:4500, max:Infinity, j:15, c:{ weekend:1.5, semaine:3.2, '2s':5.0, '3s':6.0,  mois:8.0  }, caut:.30 },
];

const DCAT_DEFAULT = ['Cuisine sucrée','Cuisine salée','Boissons','Tentes & mobilier','Entretien','Autre'];

const DTYPE_DEFAULT = [
  'Mariage','Anniversaire','Baptême','Communion','Fête privée',
  'Garden party','Événement entreprise','Séminaire','Fête de village','Buvette','Autre'
];

const DP_DEFAULT = {
  nom:      'LocationForEvent',
  tel:      '07 88 52 81 15',
  email:    'contact@locationforevent.com',
  adr:      'Bourgoin-Jallieu (38300)',
  site:     'https://locationforevent.com',
  siret:    '',
  km:       1.5,
  valid:    30,
  mentions: 'Devis non contractuel — valable 30 jours. Matériel vérifié et nettoyé avant chaque location.'
};

// ─── NAVIGATION ──────────────────────────────────────────────
const PAGE_TITLES = {
  'dashboard':     'Tableau de bord',
  'calendrier':    'Calendrier',
  'catalogue':     'Catalogue matériel',
  'simulateur':    'Simulateur de prix',
  'stats':         'Stats & Rentabilité',
  'nouveau-devis': 'Nouveau devis',
  'historique':    'Devis & Factures',
  'clients':       'Fichier clients',
  'amortissement': 'Amortissement',
  'categories':    'Catégories',
  'services':      'Prestations & Services',
  'epicerie':      'Épicerie & Consommables',
  'paiements':     'Paiements',
  'parametres':    'Paramètres',
};

const App = {
  curPage: 'dashboard',

  // ── Navigation ──────────────────────────────────────────────
  go(page) {
    // pages
    document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
    const target = document.getElementById('page-' + page);
    if (target) target.classList.add('active');

    // sidebar
    document.querySelectorAll('.s-item').forEach(el => {
      el.classList.toggle('active', el.dataset.page === page);
    });

    // titre topbar
    document.getElementById('top-title').textContent = PAGE_TITLES[page] || page;

    // fermer mobile
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('mobOvl').classList.remove('open');

    App.curPage = page;
    App._renderPage(page);
  },

  _renderPage(page) {
    const map = {
      'dashboard':     () => App.renderDash(),
      'calendrier':    () => typeof Calendrier !== 'undefined' && Calendrier.render(),
      'catalogue':     () => typeof Catalogue !== 'undefined' && Catalogue.render(),
      'simulateur':    () => typeof Simulateur !== 'undefined' && Simulateur.render(),
      'stats':         () => typeof Stats !== 'undefined' && Stats.render(),
      'nouveau-devis': () => typeof Devis !== 'undefined' && Devis.renderCliList(),
      'historique':    () => typeof Historique !== 'undefined' && Historique.render(),
      'clients':       () => typeof Clients !== 'undefined' && Clients.render(),
      'amortissement': () => typeof Amortissement !== 'undefined' && Amortissement.render(),
      'categories':    () => typeof Categories !== 'undefined' && Categories.render(),
      'services':      () => typeof Services !== 'undefined' && Services.render(),
      'epicerie':      () => typeof Epicerie !== 'undefined' && Epicerie.render(),
      'paiements':     () => typeof Paiements !== 'undefined' && Paiements.render(),
      'parametres':    () => { Params.render(); App._updateStorageInfo(); },
    };
    if (map[page]) map[page]();
  },

  refreshAll() {
    App.updateBadges();
    App._renderPage(App.curPage);
  },

  // ── Sidebar badges ──────────────────────────────────────────
  updateBadges() {
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('sb-cat', db.cat.length);
    set('sb-dv',  db.devis.length);
    set('sb-cli', db.clients.length);
  },

  // ── Modales ─────────────────────────────────────────────────
  openModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('open');
  },
  closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('open');
  },

  // ── Toast ────────────────────────────────────────────────────
  toast(msg, type = '') {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.className = 'toast show' + (type ? ' ' + type : '');
    clearTimeout(App._toastTimer);
    App._toastTimer = setTimeout(() => { el.className = 'toast'; }, 3200);
  },

  // ── Dashboard ────────────────────────────────────────────────
  renderDash() {
    const now      = new Date();
    const curMonth = now.getMonth();
    const curYear  = now.getFullYear();
    const todayStr = today();

    // ── Helpers ──
    const isThisMonth = d => { const dt = new Date(d); return dt.getMonth() === curMonth && dt.getFullYear() === curYear; };
    const isThisYear  = d => new Date(d).getFullYear() === curYear;
    const accepted    = db.devis.filter(d => d.statut === 'accepté');
    const enAttente   = db.devis.filter(d => ['brouillon','envoyé','à relancer'].includes(d.statut || 'brouillon'));

    // ── KPIs Rangée 1 — Vue générale ──
    const owned = db.cat.filter(i => i.owned).length;
    const newClientsMonth = db.clients.filter(c => c.id && isThisMonth(new Date(Number(c.id)).toISOString())).length;
    const encaisseMois = db.paiements.reduce((s, p) => {
      const aMt = (p.total || 0) * (p.acompte_pct || 0) / 100;
      let r = 0;
      if (p.acompte_statut === 'recu' && p.acompte_date && isThisMonth(p.acompte_date)) r += aMt;
      if (p.solde_statut === 'recu' && p.solde_date && isThisMonth(p.solde_date)) r += ((p.total || 0) - aMt);
      return s + r;
    }, 0);

    const s1 = document.getElementById('dash-stats-1');
    if (s1) {
      s1.innerHTML = `
      <div class="stat"><div class="stat-ic ic-blue"><i data-lucide="package"></i></div><div><div class="stat-lbl">Matériels</div><div class="stat-val">${db.cat.length}</div><div class="stat-sub">${owned} possédés</div></div></div>
      <div class="stat"><div class="stat-ic ic-purple"><i data-lucide="users"></i></div><div><div class="stat-lbl">Clients</div><div class="stat-val">${db.clients.length}</div><div class="stat-sub">+${newClientsMonth} ce mois</div></div></div>
      <div class="stat"><div class="stat-ic ic-gold"><i data-lucide="file-text"></i></div><div><div class="stat-lbl">Devis</div><div class="stat-val">${db.devis.length}</div><div class="stat-sub">${enAttente.length} en attente</div></div></div>
      <div class="stat"><div class="stat-ic ic-green"><i data-lucide="banknote"></i></div><div><div class="stat-lbl">Encaissé ce mois</div><div class="stat-val">${_fmtKpi(encaisseMois)} €</div></div></div>
    `;
      lucide.createIcons({ nodes: s1.querySelectorAll('[data-lucide]') });
    }

    // ── KPIs Rangée 2 — Financier ──
    const caMois  = accepted.filter(d => d.date && isThisMonth(d.date)).reduce((s, d) => s + (d.total || 0), 0);
    const caAnnee = accepted.filter(d => d.date && isThisYear(d.date)).reduce((s, d) => s + (d.total || 0), 0);
    const totalDv = db.devis.length;
    const tauxConv = totalDv ? (accepted.length / totalDv * 100).toFixed(0) : 0;
    const montantAttente = enAttente.reduce((s, d) => s + (d.total || 0), 0);

    const s2 = document.getElementById('dash-stats-2');
    if (s2) {
      s2.innerHTML = `
      <div class="stat"><div class="stat-ic ic-green"><i data-lucide="trending-up"></i></div><div><div class="stat-lbl">CA ce mois</div><div class="stat-val">${_fmtKpi(caMois)} €</div></div></div>
      <div class="stat"><div class="stat-ic ic-blue"><i data-lucide="bar-chart-2"></i></div><div><div class="stat-lbl">CA cette année</div><div class="stat-val">${_fmtKpi(caAnnee)} €</div></div></div>
      <div class="stat"><div class="stat-ic ic-purple"><i data-lucide="target"></i></div><div><div class="stat-lbl">Taux conversion</div><div class="stat-val">${tauxConv}%</div><div class="stat-sub">${accepted.length}/${totalDv} acceptés</div></div></div>
      <div class="stat"><div class="stat-ic ic-gold"><i data-lucide="clock"></i></div><div><div class="stat-lbl">En attente</div><div class="stat-val">${enAttente.length}</div><div class="stat-sub">${_fmtKpi(montantAttente)} €</div></div></div>
    `;
      lucide.createIcons({ nodes: s2.querySelectorAll('[data-lucide]') });
    }

    // ── Graphique CA mensuel (12 derniers mois) ──
    const chartEl = document.getElementById('dash-chart');
    if (chartEl) {
      const months = [];
      for (let i = 11; i >= 0; i--) {
        const dt = new Date(curYear, curMonth - i, 1);
        months.push({ m: dt.getMonth(), y: dt.getFullYear(), label: dt.toLocaleString('fr-FR', { month: 'short' }).replace('.', '') });
      }
      const caByMonth = months.map(mo => {
        return accepted.filter(d => {
          if (!d.date) return false;
          const dt = new Date(d.date);
          return dt.getMonth() === mo.m && dt.getFullYear() === mo.y;
        }).reduce((s, d) => s + (d.total || 0), 0);
      });
      const maxCA = Math.max(...caByMonth, 1);

      chartEl.innerHTML = `<div class="dash-chart-wrap">${months.map((mo, i) => {
        const val = caByMonth[i];
        const isCurrent = (mo.m === curMonth && mo.y === curYear);
        let barStyle;
        if (val > 0) {
          const h = Math.max(6, (val / maxCA * 80)) + '%';
          barStyle = `height:${h};background:${isCurrent ? 'var(--blue)' : 'var(--navy2)'}`;
        } else {
          barStyle = 'height:6px;background:var(--border2);border-radius:3px;width:100%';
        }
        return `<div class="dash-bar-col">
          <div class="dash-bar" style="${barStyle}">
            <div class="dash-bar-tip">${val.toFixed(0)} €</div>
          </div>
          <div class="dash-bar-lbl">${mo.label}</div>
        </div>`;
      }).join('')}</div>`;
    }

    // ── Actions requises ──
    const actionsEl = document.getElementById('dash-actions');
    if (actionsEl) {
      const alerts = [];

      // Devis à relancer
      const aRelancer = typeof needsRelance !== 'undefined' ? db.devis.filter(needsRelance) : [];
      if (aRelancer.length) {
        alerts.push(`<div class="dash-alert">
          <div class="dash-alert-ic" style="background:var(--gold-l)"><i data-lucide="bell"></i></div>
          <div class="dash-alert-body">
            <div class="dash-alert-title">${aRelancer.length} devis à relancer</div>
            <div class="dash-alert-desc">${aRelancer.slice(0,3).map(d => d.num || '—').join(', ')}${aRelancer.length > 3 ? '…' : ''}</div>
          </div>
          <button class="btn btn-gold btn-sm" onclick="App.go('historique')" style="font-size:.72rem;padding:3px 10px">Voir →</button>
        </div>`);
      }

      // Devis expirés
      const validDays = db.params.valid || 30;
      const expired = db.devis.filter(d => {
        if (!d.date || d.statut === 'accepté' || d.statut === 'refusé' || d.statut === 'expiré') return false;
        const expDate = new Date(d.date);
        expDate.setDate(expDate.getDate() + validDays);
        return expDate < now;
      });
      if (expired.length) {
        alerts.push(`<div class="dash-alert">
          <div class="dash-alert-ic" style="background:var(--red-l)"><i data-lucide="clock"></i></div>
          <div class="dash-alert-body">
            <div class="dash-alert-title">${expired.length} devis expiré${expired.length > 1 ? 's' : ''}</div>
            <div class="dash-alert-desc">Validité dépassée (${validDays} jours)</div>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="App.go('historique')" style="font-size:.72rem;padding:3px 10px">Voir →</button>
        </div>`);
      }

      // Paiements en attente > 7 jours
      const pendingPay = db.paiements.filter(p => {
        const isPartial = p.acompte_statut !== 'recu' || p.solde_statut !== 'recu';
        if (!isPartial) return false;
        const dv = db.devis.find(d => d.id === p.devis_id);
        if (!dv || !dv.date) return false;
        return (Date.now() - new Date(dv.date).getTime()) / 864e5 > 7;
      });
      if (pendingPay.length) {
        alerts.push(`<div class="dash-alert">
          <div class="dash-alert-ic" style="background:var(--blue-l)"><i data-lucide="credit-card"></i></div>
          <div class="dash-alert-body">
            <div class="dash-alert-title">${pendingPay.length} paiement${pendingPay.length > 1 ? 's' : ''} en attente</div>
            <div class="dash-alert-desc">Depuis plus de 7 jours</div>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="App.go('paiements')" style="font-size:.72rem;padding:3px 10px">Voir →</button>
        </div>`);
      }

      // Conflits calendrier (même matériel, même période)
      const conflicts = [];
      const activeDevis = db.devis.filter(d => d.recup && d.retour && ['accepté','envoyé','brouillon','à relancer'].includes(d.statut || 'brouillon'));
      for (let i = 0; i < activeDevis.length; i++) {
        for (let j = i + 1; j < activeDevis.length; j++) {
          const a = activeDevis[i], b = activeDevis[j];
          if (new Date(a.recup) < new Date(b.retour) && new Date(b.recup) < new Date(a.retour)) {
            const commonItems = (a.lines || []).filter(la => (b.lines || []).some(lb => lb.name === la.name));
            if (commonItems.length) conflicts.push({ a, b, items: commonItems });
          }
        }
      }
      if (conflicts.length) {
        alerts.push(`<div class="dash-alert">
          <div class="dash-alert-ic" style="background:#FEE2E2"><i data-lucide="alert-triangle"></i></div>
          <div class="dash-alert-body">
            <div class="dash-alert-title">${conflicts.length} conflit${conflicts.length > 1 ? 's' : ''} calendrier</div>
            <div class="dash-alert-desc">${conflicts[0].items[0].name} : ${conflicts[0].a.num} / ${conflicts[0].b.num}</div>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="App.go('calendrier')" style="font-size:.72rem;padding:3px 10px">Voir →</button>
        </div>`);
      }

      actionsEl.innerHTML = alerts.length ? alerts.join('') : '<div style="padding:16px;color:var(--grey);font-size:.84rem">Aucune action requise — tout est à jour ✅</div>';
      lucide.createIcons({ nodes: actionsEl.querySelectorAll('[data-lucide]') });
    }

    // ── Activité récente ──
    const activityEl = document.getElementById('dash-activity');
    if (activityEl) {
      const events = [];

      // Devis créés / statut modifié
      db.devis.forEach(d => {
        const ts = Number(d.id) || 0;
        const statut = d.statut || 'brouillon';
        const isF = d.doctype === 'facture';
        events.push({
          ts,
          icon: isF ? '<i data-lucide="file-text"></i>' : '<i data-lucide="clipboard"></i>',
          bg: isF ? 'var(--green-l)' : 'var(--blue-l)',
          text: `${isF ? 'Facture' : 'Devis'} ${d.num || '—'} — ${d.client || 'Sans client'}`,
          sub: statut !== 'brouillon' ? (typeof statutBadge !== 'undefined' ? statutBadge(statut) : statut) : 'Créé',
          date: fmtDate(d.date)
        });
      });

      // Clients ajoutés
      db.clients.forEach(c => {
        const ts = Number(c.id) || 0;
        events.push({
          ts,
          icon: '<i data-lucide="user"></i>',
          bg: 'var(--purple-l)',
          text: `Nouveau client : ${c.nom}`,
          sub: c.email || c.tel || '',
          date: fmtDate(new Date(ts).toISOString().slice(0,10))
        });
      });

      // Paiements reçus
      db.paiements.forEach(p => {
        const dv = db.devis.find(d => d.id === p.devis_id);
        if (p.acompte_statut === 'recu' && p.acompte_date) {
          events.push({
            ts: new Date(p.acompte_date).getTime() || 0,
            icon: '<i data-lucide="dollar-sign"></i>',
            bg: 'var(--green-l)',
            text: `Acompte reçu — ${dv?.num || '—'}`,
            sub: `${prixAffiche((p.total || 0) * (p.acompte_pct || 0) / 100).toFixed(2)} €`,
            date: fmtDate(p.acompte_date)
          });
        }
        if (p.solde_statut === 'recu' && p.solde_date) {
          events.push({
            ts: new Date(p.solde_date).getTime() || 0,
            icon: '<i data-lucide="dollar-sign"></i>',
            bg: 'var(--green-l)',
            text: `Solde reçu — ${dv?.num || '—'}`,
            sub: `${prixAffiche((p.total || 0) - ((p.total || 0) * (p.acompte_pct || 0) / 100)).toFixed(2)} €`,
            date: fmtDate(p.solde_date)
          });
        }
      });

      events.sort((a, b) => b.ts - a.ts);
      const top10 = events.slice(0, 10);

      if (!top10.length) {
        activityEl.innerHTML = '<div style="padding:16px;color:var(--grey);font-size:.84rem">Aucune activité récente</div>';
      } else {
        activityEl.innerHTML = top10.map(e => `
          <div class="dash-act">
            <div class="dash-act-ic" style="background:${e.bg}">${e.icon}</div>
            <div class="dash-act-body">
              <div>${e.text}</div>
              <div style="font-size:.72rem;color:var(--grey)">${e.sub}</div>
            </div>
            <div class="dash-act-date">${e.date}</div>
          </div>`).join('');
        lucide.createIcons({ nodes: activityEl.querySelectorAll('[data-lucide]') });
      }
    }
  },

  // ── Export / Import ──────────────────────────────────────────
  exportData() {
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'lfe_' + today() + '.json';
    a.click();
    App.toast('Export téléchargé ✅', 'ok');
  },

  importData(e) {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = async ev => {
      try {
        const imported = JSON.parse(ev.target.result);
        if (!imported.cat && !imported.devis) throw new Error('Format invalide');
        db = { ...db, ...imported };
        if (!db.categories?.length) db.categories = [...DCAT_DEFAULT];
        await sbSyncAll(db);
        App.refreshAll();
        App.toast('Données importées ✅', 'ok');
      } catch {
        App.toast('Fichier invalide ❌', 'err');
      }
    };
    r.readAsText(f);
    e.target.value = '';
  },

  async clearAll() {
    if (!confirm('Réinitialiser TOUTES les données ? Cette action est irréversible.')) return;
    try {
      await sbClearAll();
      await App._initDefaults();
      App.refreshAll();
      App.toast('Données réinitialisées', 'ok');
    } catch (err) {
      console.error(err);
      App.toast('Erreur lors de la réinitialisation', 'err');
    }
  },

  // ── Connexion status ─────────────────────────────────────────
  setConnStatus(online) {
    const dot   = document.getElementById('conn-dot');
    const label = document.getElementById('conn-label');
    if (dot)   dot.classList.toggle('online', online);
    if (label) label.textContent = online ? 'Connecté' : 'Hors ligne';
  },

  // ── Storage info (paramètres) ────────────────────────────────
  _updateStorageInfo() {
    const el = document.getElementById('p-storage-info');
    if (!el) return;
    const size = new Blob([JSON.stringify(db)]).size;
    el.innerHTML = `Matériels : ${db.cat.length} · Devis : ${db.devis.length} · Clients : ${db.clients.length}
      <br><span style="color:var(--grey)">Snapshot local : ~${(size / 1024).toFixed(1)} Ko</span>`;
  },

  // ── Init defaults (première utilisation) ─────────────────────
  async _initDefaults() {
    db = {
      cat:        [],
      devis:      [],
      clients:    [],
      amort:      JSON.parse(JSON.stringify(DA_DEFAULT)),
      categories: [...DCAT_DEFAULT],
      params:     { ...DP_DEFAULT },
      ndv:        1,
      nid:        100
    };
    try {
      await sbSyncAll(db);
    } catch (err) {
      console.error('Init defaults error:', err);
    }
  },

  // ── Chargement ───────────────────────────────────────────────
  async init() {
    // Événements sidebar
    document.querySelectorAll('.s-item[data-page]').forEach(btn => {
      btn.addEventListener('click', () => App.go(btn.dataset.page));
    });
    // Boutons dans les pages qui naviguent aussi
    document.querySelectorAll('[data-page]:not(.s-item)').forEach(btn => {
      btn.addEventListener('click', () => App.go(btn.dataset.page));
    });

    // Hamburger mobile
    const hb  = document.getElementById('hamburger');
    const sbar = document.getElementById('sidebar');
    const ovl  = document.getElementById('mobOvl');
    if (hb)  hb.addEventListener('click',  () => { sbar.classList.toggle('open'); ovl.classList.toggle('open'); });
    if (ovl) ovl.addEventListener('click', () => { sbar.classList.remove('open'); ovl.classList.remove('open'); });

    // Fermer les modales au clic sur l'overlay
    document.querySelectorAll('.overlay').forEach(ov => {
      ov.addEventListener('click', e => { if (e.target === ov) ov.classList.remove('open'); });
    });

    try {
      const [data, svcRes, epiRes, teRes, payRes, remRes] = await Promise.all([
        sbLoad(),
        sb.from('services').select('*').order('id'),
        sb.from('epicerie').select('*').order('id'),
        sb.from('types_evenement').select('*').order('id'),
        sb.from('paiements').select('*').order('id'),
        sb.from('remises').select('*').order('id'),
      ]);
      const hasData = data.cat.length || data.devis.length || data.amort.length;

      if (hasData) {
        db.cat        = data.cat;
        db.devis      = data.devis;
        db.clients    = data.clients;
        db.amort      = data.amort.length ? data.amort : JSON.parse(JSON.stringify(DA_DEFAULT));
        db.categories = data.categories.length ? data.categories : [...DCAT_DEFAULT];
        db.params     = Object.keys(data.params || {}).length ? data.params : { ...DP_DEFAULT };
        db.ndv        = data.ndv;
        db.nid        = data.nid;
      } else {
        await App._initDefaults();
      }

      // Charger les services (indépendant du reste)
      db.services = svcRes.data || [];
      if (!db.services.length && typeof Services !== 'undefined') {
        await Services.seedDefaults();
      }

      // Charger l'épicerie
      db.epicerie = epiRes.data || [];
      if (!db.epicerie.length && typeof Epicerie !== 'undefined') {
        await Epicerie.seedDefaults();
      }

      // Charger les types d'événements
      db.types_evenement = (teRes.data || []).map(t => t.nom);
      if (!db.types_evenement.length) {
        db.types_evenement = [...DTYPE_DEFAULT];
        await sb.from('types_evenement').insert(DTYPE_DEFAULT.map(nom => ({ nom })));
      }

      // Charger les paiements
      db.paiements = payRes.data || [];

      // Charger les remises
      db.remises = remRes.data || [];
      if (!db.remises.length && typeof Remises !== 'undefined') {
        await Remises.seedDefaults();
      }

      App.setConnStatus(true);
    } catch (err) {
      console.error('Supabase load error:', err);
      App.setConnStatus(false);
      App.toast('Erreur de connexion Supabase', 'err');
    } finally {
      // Masquer le loading overlay
      const loading = document.getElementById('app-loading');
      if (loading) loading.style.display = 'none';

      // Rendu initial
      App.renderDash();
      App.updateBadges();

      // Enregistrer le service worker
      if (typeof Pwa !== 'undefined') Pwa.register();

      // Initialiser les icônes Lucide
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }
  }
};

// ─── PARAMÈTRES (simple, reste dans app.js) ──────────────────
const Params = {
  render() {
    const p = db.params || {};
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val ?? ''; };
    set('p-nom',      p.nom);
    set('p-tel',      p.tel);
    set('p-email',    p.email);
    set('p-adr',      p.adr);
    set('p-site',     p.site);
    set('p-siret',    p.siret);
    set('p-km',       p.km ?? 1.5);
    set('p-valid',    p.valid ?? 30);
    set('p-mentions', p.mentions);
    // TVA par article
    set('p-saisie-prix', p.saisie_prix || 'HT');
    Params._updateTvaBadge();
    Params.renderTypes();
    if (typeof Remises !== 'undefined') Remises.renderList();
    Params._renderDesignFields();
  },

  async save() {
    const get = id => { const el = document.getElementById(id); return el ? el.value : ''; };
    const prevDesign = db.params.design || {};
    db.params = {
      nom:      get('p-nom'),
      tel:      get('p-tel'),
      email:    get('p-email'),
      adr:      get('p-adr'),
      site:     get('p-site'),
      siret:    get('p-siret'),
      km:       parseFloat(get('p-km'))   || 1.5,
      valid:    parseInt(get('p-valid'))  || 30,
      mentions: get('p-mentions'),
      saisie_prix:  get('p-saisie-prix') || 'HT',
      design:       prevDesign,
    };
    try {
      await sbSaveParams(db.params);
      Params._updateTvaBadge();
      App.toast('Paramètres sauvegardés ✅', 'ok');
    } catch (err) {
      console.error(err);
      App.toast('Erreur sauvegarde', 'err');
    }
  },

  _updateTvaBadge() {
    const el = document.getElementById('tva-badge');
    if (!el) return;
    // TVA par article — les montants affichés sont toujours HT
    el.style.display = 'inline-block';
    el.textContent = 'HT';
    el.style.background = '#F3F4F6'; el.style.color = '#6B7280';
  },

  // ── Types d'événements ────────────────────────────────────
  renderTypes() {
    const el = document.getElementById('p-types-list');
    if (!el) return;
    if (!db.types_evenement.length) {
      el.innerHTML = '<div style="padding:10px;color:var(--grey);font-size:.82rem">Aucun type configuré</div>';
      return;
    }
    el.innerHTML = db.types_evenement.map((t, i) => `
      <div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--border)">
        <span style="flex:1;font-size:.84rem">${t}</span>
        <button class="btn btn-ghost btn-sm" onclick="Params.renameType(${i})" style="padding:2px 8px;font-size:.72rem"><i data-lucide="pencil"></i></button>
        <button class="btn btn-danger btn-sm" onclick="Params.delType(${i})" style="padding:2px 8px;font-size:.72rem"><i data-lucide="trash-2"></i></button>
      </div>`).join('');
    lucide.createIcons({ nodes: el.querySelectorAll('[data-lucide]') });
  },

  async addType() {
    const input = document.getElementById('p-type-input');
    if (!input) return;
    const nom = input.value.trim();
    if (!nom) { App.toast('Saisissez un nom', 'err'); return; }
    if (db.types_evenement.includes(nom)) { App.toast('Ce type existe déjà', 'warn'); return; }

    try {
      await sb.from('types_evenement').insert({ nom });
      db.types_evenement.push(nom);
      input.value = '';
      Params.renderTypes();
      App.toast('Type ajouté ✅', 'ok');
    } catch (err) {
      console.error(err);
      App.toast('Erreur', 'err');
    }
  },

  async renameType(idx) {
    const old = db.types_evenement[idx];
    const nouveau = prompt('Nouveau nom :', old);
    if (!nouveau || nouveau.trim() === old) return;
    const nom = nouveau.trim();
    if (db.types_evenement.includes(nom)) { App.toast('Ce type existe déjà', 'warn'); return; }

    try {
      await sb.from('types_evenement').update({ nom }).eq('nom', old);
      db.types_evenement[idx] = nom;
      Params.renderTypes();
      App.toast('Type renommé ✅', 'ok');
    } catch (err) {
      console.error(err);
      App.toast('Erreur', 'err');
    }
  },

  async delType(idx) {
    const nom = db.types_evenement[idx];
    if (!confirm(`Supprimer le type "${nom}" ?`)) return;

    try {
      await sb.from('types_evenement').delete().eq('nom', nom);
      db.types_evenement.splice(idx, 1);
      Params.renderTypes();
      App.toast('Type supprimé', 'ok');
    } catch (err) {
      console.error(err);
      App.toast('Erreur', 'err');
    }
  },

  // ── Design des devis ─────────────────────────────────────────
  _getDesignDefaults() {
    return {
      couleurPrimaire: '#0F2744',
      couleurSecondaire: '#2563EB',
      logo: null,
      disposition: 'A',
      police: 'classique',
      afficherCaution: true,
      afficherMentions: true,
      afficherSiret: true,
      filigrane: false
    };
  },

  _renderDesignFields() {
    const d = Object.assign(Params._getDesignDefaults(), db.params.design || {});
    const el = id => document.getElementById(id);

    const c1 = el('p-design-couleur1'); if (c1) c1.value = d.couleurPrimaire;
    const c2 = el('p-design-couleur2'); if (c2) c2.value = d.couleurSecondaire;
    const font = el('p-design-font'); if (font) font.value = d.police;

    // Disposition radio
    ['A', 'B', 'C'].forEach(v => {
      const label = el('p-design-disp-' + v);
      const radio = label?.querySelector('input[type=radio]');
      if (radio) radio.checked = (d.disposition === v);
      if (label) label.className = d.disposition === v ? 'chip on' : 'chip';
    });

    // Toggles
    const cb = (id, val) => { const e = el(id); if (e) e.checked = val; };
    cb('p-design-caution', d.afficherCaution);
    cb('p-design-mentions', d.afficherMentions);
    cb('p-design-siret', d.afficherSiret);
    cb('p-design-filigrane', d.filigrane);

    // Logo preview
    const prev = el('p-design-logo-preview');
    const delBtn = el('p-design-logo-del');
    if (prev) prev.innerHTML = d.logo ? `<img src="${d.logo}" style="max-height:50px;max-width:160px;border-radius:4px">` : '';
    if (delBtn) delBtn.style.display = d.logo ? '' : 'none';

    Params.renderDesignPreview();
  },

  _readDesignFields() {
    const el = id => document.getElementById(id);
    const disp = document.querySelector('input[name="p-design-disp"]:checked');
    return {
      couleurPrimaire:   el('p-design-couleur1')?.value || '#0F2744',
      couleurSecondaire: el('p-design-couleur2')?.value || '#2563EB',
      logo:              (db.params.design || {}).logo || null,
      disposition:       disp?.value || 'A',
      police:            el('p-design-font')?.value || 'classique',
      afficherCaution:   el('p-design-caution')?.checked ?? true,
      afficherMentions:  el('p-design-mentions')?.checked ?? true,
      afficherSiret:     el('p-design-siret')?.checked ?? true,
      filigrane:         el('p-design-filigrane')?.checked || false
    };
  },

  handleLogoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 200000) { App.toast('Image trop lourde (max 200 Ko)', 'warn'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      if (!db.params.design) db.params.design = {};
      db.params.design.logo = reader.result;
      Params._renderDesignFields();
    };
    reader.readAsDataURL(file);
  },

  removeLogo() {
    if (!db.params.design) db.params.design = {};
    db.params.design.logo = null;
    document.getElementById('p-design-logo-input').value = '';
    Params._renderDesignFields();
  },

  async saveDesign() {
    const design = Params._readDesignFields();
    db.params.design = design;
    try {
      await sb.from('parametres').upsert({ id: 1, design });
      App.toast('Design sauvegardé ✅', 'ok');
    } catch (err) {
      console.error(err);
      App.toast('Erreur sauvegarde design', 'err');
    }
  },

  renderDesignPreview() {
    const container = document.getElementById('p-design-preview');
    if (!container) return;
    const d = Params._readDesignFields();
    const p = db.params || {};

    // Update chip styling for disposition
    ['A', 'B', 'C'].forEach(v => {
      const label = document.getElementById('p-design-disp-' + v);
      const radio = label?.querySelector('input[type=radio]');
      if (label) label.className = radio?.checked ? 'chip on' : 'chip';
    });

    const fontMap = { classique: 'Helvetica, Arial, sans-serif', moderne: "'Instrument Sans', sans-serif", elegante: 'Georgia, "Times New Roman", serif' };
    const fontFam = fontMap[d.police] || fontMap.classique;
    const nom = p.nom || 'LocationForEvent';
    const logoHtml = d.logo ? `<img src="${d.logo}" style="max-height:28px;max-width:80px;border-radius:3px">` : '';

    let headerHtml = '';
    if (d.disposition === 'A') {
      headerHtml = `<div style="display:flex;align-items:center;gap:8px;padding-bottom:6px;border-bottom:2px solid ${d.couleurPrimaire}">
        ${logoHtml}
        <div>
          <div style="font-weight:700;font-size:13px;color:${d.couleurPrimaire}">${nom}</div>
          ${d.afficherSiret && p.siret ? `<div style="font-size:8px;color:#9CA3AF">SIRET : ${p.siret}</div>` : ''}
        </div>
        <div style="margin-left:auto;text-align:right">
          <div style="font-weight:700;font-size:12px;color:${d.couleurSecondaire}">DEVIS</div>
          <div style="font-size:8px;color:#6B7280">N° D-0001</div>
        </div>
      </div>`;
    } else if (d.disposition === 'B') {
      headerHtml = `<div style="display:flex;justify-content:space-between;padding-bottom:6px;border-bottom:2px solid ${d.couleurPrimaire}">
        <div>
          <div style="font-weight:700;font-size:13px;color:${d.couleurPrimaire}">${nom}</div>
          ${d.afficherSiret && p.siret ? `<div style="font-size:8px;color:#9CA3AF">SIRET : ${p.siret}</div>` : ''}
        </div>
        <div style="text-align:right">
          ${logoHtml}
          <div style="font-weight:700;font-size:12px;color:${d.couleurSecondaire}">DEVIS</div>
          <div style="font-size:8px;color:#6B7280">N° D-0001</div>
        </div>
      </div>`;
    } else {
      headerHtml = `<div style="text-align:center;padding-bottom:6px;border-bottom:2px solid ${d.couleurPrimaire}">
        ${logoHtml ? `<div style="margin-bottom:4px">${logoHtml}</div>` : ''}
        <div style="font-weight:700;font-size:13px;color:${d.couleurPrimaire}">${nom}</div>
        ${d.afficherSiret && p.siret ? `<div style="font-size:8px;color:#9CA3AF">SIRET : ${p.siret}</div>` : ''}
        <div style="font-weight:700;font-size:12px;color:${d.couleurSecondaire};margin-top:3px">DEVIS N° D-0001</div>
      </div>`;
    }

    const filigraneHtml = d.filigrane ? `<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-30deg);font-size:28px;font-weight:800;color:rgba(107,114,128,0.08);pointer-events:none;white-space:nowrap">BROUILLON</div>` : '';

    container.innerHTML = `<div style="font-family:${fontFam};position:relative;overflow:hidden">
      ${filigraneHtml}
      ${headerHtml}
      <div style="margin-top:6px;font-size:9px;color:#374151">
        <div style="background:#F9FAFB;border-radius:4px;padding:4px 6px;margin-bottom:6px">
          <strong>Client :</strong> Jean Dupont &nbsp; <strong>Événement :</strong> Mariage
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:8px">
          <tr><th style="background:${d.couleurPrimaire};color:#fff;padding:3px 5px;text-align:left">Désignation</th><th style="background:${d.couleurPrimaire};color:#fff;padding:3px 5px;text-align:right">Total</th></tr>
          <tr><td style="padding:2px 5px;border-bottom:1px solid #F3F4F6">Crêpière pro</td><td style="padding:2px 5px;text-align:right;border-bottom:1px solid #F3F4F6">15,50 €</td></tr>
          <tr><td style="padding:2px 5px;background:#F9FAFB">Barnum 3×6</td><td style="padding:2px 5px;text-align:right;background:#F9FAFB">45,00 €</td></tr>
        </table>
        <div style="text-align:right;margin-top:4px;font-weight:700;color:${d.couleurPrimaire};font-size:10px">Total : 60,50 €</div>
        ${d.afficherCaution ? '<div style="text-align:right;font-size:8px;color:#6B7280">Caution estimée : 250 €</div>' : ''}
        ${d.afficherMentions ? '<div style="margin-top:6px;font-size:7px;color:#9CA3AF;text-align:center;border-top:1px solid #E5E7EB;padding-top:4px">Conditions générales de vente…</div>' : ''}
      </div>
    </div>`;
  }
};

// ─── FONCTIONS UTILITAIRES GLOBALES ──────────────────────────
// (utilisées par tous les modules)

function today() {
  return new Date().toISOString().slice(0, 10);
}

function fmtDate(s) {
  if (!s) return '—';
  try {
    const d = new Date(s);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch { return s; }
}

function fmtDt(s) {
  if (!s) return '';
  try {
    const d = new Date(s);
    return d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return s; }
}

// Arrondi supérieur au 0,50 € le plus proche
function arrondi(val) {
  return Math.ceil(val * 2) / 2;
}

// Calcul du prix selon la table d'amortissement
// Retourne { jour: number, disp: number, caut: number } ou null
function calc(pa, dur, qty = 1) {
  if (!pa || pa <= 0) return null;
  const rule = db.amort.find(r => pa >= r.min && pa < r.max);
  if (!rule) return null;

  const prixJour = pa / rule.j;
  let coeff;
  if (dur === 'jour') {
    coeff = 1;
  } else {
    coeff = rule.c[dur];
  }
  if (!coeff) return null;

  const prixUnit = arrondi(prixJour * coeff);
  const total    = arrondi(prixUnit * qty);
  const caut     = Math.round(pa * rule.caut * qty);

  return {
    jour: prixJour,
    unit: prixUnit,
    disp: total,
    caut
  };
}

// Remplir un <select> de catégories
function fillCatSelect(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const cats = db.categories?.length ? db.categories : DCAT_DEFAULT;
  el.innerHTML = cats.map(c => `<option value="${c}">${c}</option>`).join('');
}

// Remplir un <select> de types d'événements
function fillTypeSelect(id, selected) {
  const el = document.getElementById(id);
  if (!el) return;
  const types = db.types_evenement?.length ? db.types_evenement : ['Autre'];
  el.innerHTML = [...types].sort((a, b) => a.localeCompare(b, 'fr')).map(t => `<option value="${t}" ${t === selected ? 'selected' : ''}>${t}</option>`).join('');
}

// ─── TVA — Fonctions utilitaires globales ───────────────────
// Depuis la refonte TVA par article, les montants sont toujours HT.
// prixAffiche retourne simplement le montant (protection NaN).
function prixAffiche(montantHT) {
  return isNaN(montantHT) ? 0 : montantHT;
}

// Helper dashboard : formatte un montant pour KPI (protection NaN)
function _fmtKpi(montant) {
  const v = prixAffiche(montant);
  return isNaN(v) ? '0' : v.toFixed(0);
}

function labelPrix() {
  return 'HT';
}

window.prixAffiche = prixAffiche;
window.labelPrix   = labelPrix;
window.arrondi     = arrondi;

// ─── EXPOSITION GLOBALE ─────────────────────────────────────
window.App    = App;
window.Params = Params;

// ─── LANCEMENT ───────────────────────────────────────────────
App.init();
